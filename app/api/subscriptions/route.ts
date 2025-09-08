// app/api/subscriptions/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

type Row = {
  id: number;
  company: string;
  service: string;
  cost: number | string;
  billing: 'monthly' | 'quarterly' | 'yearly';
  nextBilling: string | null;
  contractEnd: string | null;
  category: string | null;
  manager: string | null;
  renewalAlert: number | null;
  status: 'active' | 'pending' | 'cancelled';
  paymentMethod: string | null;
  tags: string[] | null;
  notes: string | null;
  pricingType: 'fixed' | 'variable' | null;
  currentMonthCost: number | null;
  lastMonthCost: number | null;
  costHistory: { period: string; amount: number }[];
  payments: {
    id: number;
    date: string;
    amount: number;
    status: 'paid' | 'pending' | 'overdue';
    method: string | null;
    reference: string | null;
  }[];
  lastPaymentStatus: 'paid' | 'pending' | 'overdue' | null;
  attachment_count: number;
};

export async function GET() {
  try {
    const { rows } = await sql<Row>`
      SELECT
        s.id,
        s.company,
        s.service,
        s.cost,
        s.billing,
        s.next_billing  AS "nextBilling",
        s.contract_end  AS "contractEnd",
        s.category,
        s.manager,
        s.renewal_alert AS "renewalAlert",
        s.status,
        s.payment_method AS "paymentMethod",
        s.tags,
        s.notes,
        s.pricing_type  AS "pricingType",

        -- number of persisted files (if you have attachments table)
        (
          SELECT COUNT(*)::int
          FROM attachments a
          WHERE a.subscription_id = s.id
        ) AS "attachment_count",

        -- current-month actuals (variable or fixed)
        (
          SELECT COALESCE(SUM(c.amount)::float8, NULL)
          FROM subscription_costs c
          WHERE c.subscription_id = s.id
            AND date_trunc('month', c.period) = date_trunc('month', now())
        ) AS "currentMonthCost",

        -- last-month actuals
        (
          SELECT COALESCE(SUM(c.amount)::float8, NULL)
          FROM subscription_costs c
          WHERE c.subscription_id = s.id
            AND date_trunc('month', c.period) = date_trunc('month', now() - interval '1 month')
        ) AS "lastMonthCost",

        -- full monthly cost history
        COALESCE((
          SELECT json_agg(
                   json_build_object(
                     'period', to_char(c.period, 'YYYY-MM-DD'),
                     'amount', c.amount::float8
                   )
                   ORDER BY c.period
                 )
          FROM subscription_costs c
          WHERE c.subscription_id = s.id
        ), '[]'::json) AS "costHistory",

        -- all payments (most recent first)
        COALESCE((
          SELECT json_agg(
                   json_build_object(
                     'id', p.id,
                     'date', to_char(p.payment_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                     'amount', p.amount::float8,
                     'status', p.status,
                     'method', p.method,
                     'reference', p.reference
                   )
                   ORDER BY p.payment_date DESC, p.id DESC
                 )
          FROM payments p
          WHERE p.subscription_id = s.id
        ), '[]'::json) AS payments,

        -- last known payment status (from latest payment or column)
        COALESCE((
          SELECT p.status
          FROM payments p
          WHERE p.subscription_id = s.id
          ORDER BY p.payment_date DESC, p.id DESC
          LIMIT 1
        ), s.last_payment_status) AS "lastPaymentStatus"

      FROM subscriptions s
      ORDER BY s.id DESC;
    `;

    return NextResponse.json(rows);
  } catch (err) {
    console.error('subscriptions GET error', err);
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}
