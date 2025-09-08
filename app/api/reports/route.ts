// app/api/reports/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

// Utility
const startOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const endOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get('from'); // ISO date
    const toParam = searchParams.get('to');     // ISO date
    const company = searchParams.get('company');
    const category = searchParams.get('category');

    const now = new Date();
    const defFrom = startOfMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1)));
    const defTo = endOfMonth(now);

    const from = (fromParam ? new Date(fromParam) : defFrom).toISOString();
    const to = (toParam ? new Date(toParam) : defTo).toISOString();

    // Summary totals by payment status
    const { rows: summaryRows } = await sql<{
      paid: string | number;
      pending: string | number;
      overdue: string | number;
    }>`
      SELECT
        COALESCE(SUM(CASE WHEN p.status='paid' THEN p.amount ELSE 0 END),0)   AS paid,
        COALESCE(SUM(CASE WHEN p.status='pending' THEN p.amount ELSE 0 END),0) AS pending,
        COALESCE(SUM(CASE WHEN p.status='overdue' THEN p.amount ELSE 0 END),0) AS overdue
      FROM payments p
      JOIN subscriptions s ON s.id = p.subscription_id
      WHERE p.payment_date >= ${from}::timestamptz
        AND p.payment_date <= ${to}::timestamptz
        ${company ? sql`AND s.company = ${company}` : sql``}
        ${category ? sql`AND s.category = ${category}` : sql``}
    `;
    const summary = summaryRows[0] || { paid: 0, pending: 0, overdue: 0 };

    // Run-rate & counts from active/pending subs
    const { rows: runRateRows } = await sql<{
      run_rate: string | number;
      active_count: number;
      vendors: number;
    }>`
      SELECT
        COALESCE(SUM(
          CASE s.billing
            WHEN 'monthly' THEN s.cost
            WHEN 'quarterly' THEN s.cost / 3
            WHEN 'yearly' THEN s.cost / 12
          END
        ), 0) AS run_rate,
        COUNT(*) FILTER (WHERE s.status = 'active') AS active_count,
        COUNT(DISTINCT s.service) AS vendors
      FROM subscriptions s
      WHERE s.status IN ('active','pending')
    `;
    const run = runRateRows[0] || { run_rate: 0, active_count: 0, vendors: 0 };

    // By month
    const byMonth = await sql<{
      period: string;
      paid: string | number;
      pending: string | number;
      overdue: string | number;
    }>`
      SELECT
        DATE_TRUNC('month', p.payment_date)::date AS period,
        COALESCE(SUM(CASE WHEN p.status='paid' THEN p.amount ELSE 0 END),0) AS paid,
        COALESCE(SUM(CASE WHEN p.status='pending' THEN p.amount ELSE 0 END),0) AS pending,
        COALESCE(SUM(CASE WHEN p.status='overdue' THEN p.amount ELSE 0 END),0) AS overdue
      FROM payments p
      JOIN subscriptions s ON s.id = p.subscription_id
      WHERE p.payment_date >= ${from}::timestamptz
        AND p.payment_date <= ${to}::timestamptz
        ${company ? sql`AND s.company = ${company}` : sql``}
        ${category ? sql`AND s.category = ${category}` : sql``}
      GROUP BY 1
      ORDER BY 1
    `;

    // By company
    const byCompany = await sql<{ company: string; paid: string | number }>`
      SELECT s.company, COALESCE(SUM(CASE WHEN p.status='paid' THEN p.amount ELSE 0 END),0) AS paid
      FROM payments p
      JOIN subscriptions s ON s.id = p.subscription_id
      WHERE p.payment_date >= ${from}::timestamptz
        AND p.payment_date <= ${to}::timestamptz
        ${company ? sql`AND s.company = ${company}` : sql``}
        ${category ? sql`AND s.category = ${category}` : sql``}
      GROUP BY s.company
      ORDER BY paid DESC
    `;

    // By category
    const byCategory = await sql<{ category: string | null; paid: string | number }>`
      SELECT s.category, COALESCE(SUM(CASE WHEN p.status='paid' THEN p.amount ELSE 0 END),0) AS paid
      FROM payments p
      JOIN subscriptions s ON s.id = p.subscription_id
      WHERE p.payment_date >= ${from}::timestamptz
        AND p.payment_date <= ${to}::timestamptz
        ${company ? sql`AND s.company = ${company}` : sql``}
        ${category ? sql`AND s.category = ${category}` : sql``}
      GROUP BY s.category
      ORDER BY paid DESC
    `;

    return NextResponse.json({
      params: { from, to, company, category },
      summary: {
        totalPaid: Number(summary.paid) || 0,
        totalPending: Number(summary.pending) || 0,
        totalOverdue: Number(summary.overdue) || 0,
        monthlyRunRate: Number(run.run_rate) || 0,
        activeSubscriptions: Number(run.active_count) || 0,
        vendors: Number(run.vendors) || 0,
      },
      byMonth: byMonth.rows.map(r => ({
        period: r.period,
        paid: Number(r.paid),
        pending: Number(r.pending),
        overdue: Number(r.overdue),
      })),
      byCompany: byCompany.rows.map(r => ({ company: r.company, paid: Number(r.paid) })),
      byCategory: byCategory.rows.map(r => ({ category: r.category || 'Uncategorized', paid: Number(r.paid) })),
    });
  } catch (err) {
    console.error('reports error', err);
    return NextResponse.json({ error: 'Failed to build report' }, { status: 500 });
  }
}
