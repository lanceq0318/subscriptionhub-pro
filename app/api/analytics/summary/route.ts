import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    const [mtd, last30, ytd, monthlyTrend, byCat, counts, runRate] = await Promise.all([
      sql<{ total: string | null }>`SELECT COALESCE(SUM(amount),0)::numeric::text AS total FROM payments WHERE status='paid' AND payment_date >= date_trunc('month', CURRENT_DATE)`,
      sql<{ total: string | null }>`SELECT COALESCE(SUM(amount),0)::numeric::text AS total FROM payments WHERE status='paid' AND payment_date >= (CURRENT_DATE - INTERVAL '30 days')`,
      sql<{ total: string | null }>`SELECT COALESCE(SUM(amount),0)::numeric::text AS total FROM payments WHERE status='paid' AND payment_date >= date_trunc('year', CURRENT_DATE)`,
      sql<{ month: string; total: string }>`
        SELECT to_char(date_trunc('month', payment_date), 'YYYY-MM') AS month, SUM(amount)::text AS total
        FROM payments
        WHERE status='paid' AND payment_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '5 months')
        GROUP BY 1 ORDER BY 1
      `,
      sql<{ category: string | null; total: string }>`
        SELECT s.category, SUM(p.amount)::text AS total
        FROM payments p
        JOIN subscriptions s ON s.id = p.subscription_id
        WHERE p.status='paid' AND p.payment_date >= date_trunc('year', CURRENT_DATE)
        GROUP BY s.category
        ORDER BY SUM(p.amount) DESC
        LIMIT 10
      `,
      sql<{ overdue: number; active: number }>`
        SELECT
          COUNT(*) FILTER (WHERE s.status <> 'cancelled' AND s.next_billing IS NOT NULL AND s.next_billing::date < CURRENT_DATE) AS overdue,
          COUNT(*) FILTER (WHERE s.status = 'active' AND (s.contract_end IS NULL OR s.contract_end::date >= CURRENT_DATE)) AS active
        FROM subscriptions s
      `,
      sql<{ mrr: string }>`
        SELECT COALESCE(SUM(
          CASE s.billing
            WHEN 'monthly' THEN s.cost
            WHEN 'quarterly' THEN s.cost/3.0
            WHEN 'yearly' THEN s.cost/12.0
            ELSE s.cost
          END
        ),0)::text AS mrr
        FROM subscriptions s
        WHERE s.status <> 'cancelled'
      `,
    ]);

    return NextResponse.json({
      ledger: {
        mtd: Number(mtd.rows[0].total ?? 0),
        last30: Number(last30.rows[0].total ?? 0),
        ytd: Number(ytd.rows[0].total ?? 0),
        trend6m: monthlyTrend.rows.map(r => ({ month: r.month, total: Number(r.total) })),
        byCategoryYtd: byCat.rows.map(r => ({ category: r.category ?? 'Uncategorized', total: Number(r.total) })),
      },
      fleet: {
        overdueCount: counts.rows[0].overdue ?? 0,
        activeCount: counts.rows[0].active ?? 0,
        mrrRunRate: Number(runRate.rows[0].mrr ?? 0),
      }
    });
  } catch (e) {
    console.error('analytics summary failed', e);
    return NextResponse.json({ error: 'Failed to compute analytics' }, { status: 500 });
  }
}
