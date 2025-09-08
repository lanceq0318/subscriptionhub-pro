// app/api/reports/route.ts
export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { sql } from '@/app/lib/db';

function normalizeMonthly(cost: number, billing: 'monthly' | 'yearly' | 'quarterly') {
  if (billing === 'yearly') return cost / 12;
  if (billing === 'quarterly') return cost / 3;
  return cost;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const period = url.searchParams.get('period'); // "YYYY-MM"
    const db = sql();

    // Determine month window
    let start: string;
    let next: string;
    if (period && /^\d{4}-\d{2}$/.test(period)) {
      const [y, m] = period.split('-').map(Number);
      const s = new Date(Date.UTC(y, m - 1, 1));
      const e = new Date(Date.UTC(y, m, 1));
      start = s.toISOString().slice(0, 10);
      next = e.toISOString().slice(0, 10);
    } else {
      const now = new Date();
      const s = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const e = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      start = s.toISOString().slice(0, 10);
      next = e.toISOString().slice(0, 10);
    }

    // Active subscriptions and month-specific variable actuals
    const subs = await db<{
      company: string;
      category: string | null;
      department: string | null;
      billing: 'monthly' | 'yearly' | 'quarterly';
      pricing_type: 'fixed' | 'variable' | null;
      cost: number;
      current_month_cost: number | null;
      budget: number | null;
      status: string;
    }[]>`
      WITH c AS (
        SELECT subscription_id,
               MAX(amount) FILTER (
                 WHERE date_trunc('month', period) = date_trunc('month', ${start}::date)
               ) AS current_month_cost
        FROM subscription_costs
        GROUP BY subscription_id
      )
      SELECT s.company,
             s.category,
             s.department,
             s.billing,
             s.pricing_type,
             (s.cost)::float AS cost,
             COALESCE((c.current_month_cost)::float, NULL) AS current_month_cost,
             (s.budget)::float AS budget,
             s.status
      FROM subscriptions s
      LEFT JOIN c ON c.subscription_id = s.id
      WHERE s.status = 'active';
    `;

    const rows = subs.map(s => {
      const monthly =
        s.pricing_type === 'variable' && typeof s.current_month_cost === 'number'
          ? s.current_month_cost
          : normalizeMonthly(s.cost, s.billing);
      return { ...s, monthly };
    });

    const totalSpend = rows.reduce((t, r) => t + r.monthly, 0);
    const by = (key: 'company' | 'category' | 'department') => {
      const map = new Map<string, number>();
      rows.forEach(r => {
        const k = (r[key] || (key === 'category' ? 'Other' : 'Unassigned')) as string;
        map.set(k, (map.get(k) ?? 0) + r.monthly);
      });
      return [...map.entries()]
        .map(([name, amount]) => ({ [key]: name, amount }))
        .sort((a, b) => (b as any).amount - (a as any).amount);
    };

    const byCompany = by('company') as { company: string; amount: number }[];
    const byCategory = by('category') as { category: string; amount: number }[];
    const byDepartment = by('department') as { department: string; amount: number }[];

    const paidQ = await db<{ paid: number | null }[]>`
      SELECT COALESCE(SUM(amount)::float, 0) AS paid
        FROM payments
       WHERE date >= ${start}::date
         AND date <  ${next}::date;
    `;
    const paidThisPeriod = paidQ[0]?.paid ?? 0;

    // Optional: basic budget utilization (sum of budgets/12)
    const totalBudget = rows.reduce((t, r) => t + (r.budget ?? 0), 0);
    const budgetUtilization = totalBudget > 0 ? (totalSpend / (totalBudget / 12)) * 100 : 0;

    return NextResponse.json({
      period: start.slice(0, 7),
      totalSpend,
      paidThisPeriod,
      projectedSpend: totalSpend * 12,
      budgetUtilization,
      byCompany,
      byCategory,
      byDepartment,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
