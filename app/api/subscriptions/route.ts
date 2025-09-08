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
      WITH cost_history AS (
        SELECT 
          subscription_id,
          json_agg(
            json_build_object(
              'period', to_char(period, 'YYYY-MM-DD'),
              'amount', amount::float
            ) ORDER BY period DESC
          ) AS history,
          MAX(amount) FILTER (WHERE date_trunc('month', period) = date_trunc('month', CURRENT_DATE)) AS current_month,
          MAX(amount) FILTER (WHERE date_trunc('month', period) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')) AS last_month
        FROM subscription_costs
        GROUP BY subscription_id
      ),
      payment_history AS (
        SELECT 
          subscription_id,
          json_agg(
            json_build_object(
              'id', id,
              'date', to_char(payment_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
              'amount', amount::float,
              'status', status,
              'method', method,
              'reference', reference
            ) ORDER BY payment_date DESC
          ) AS payments
        FROM payments
        GROUP BY subscription_id
      )
      SELECT 
        s.id,
        s.company,
        s.service,
        s.cost,
        s.billing,
        to_char(s.next_billing, 'YYYY-MM-DD') AS "nextBilling",
        to_char(s.contract_end, 'YYYY-MM-DD') AS "contractEnd",
        s.category,
        s.manager,
        s.renewal_alert AS "renewalAlert",
        s.status,
        s.payment_method AS "paymentMethod",
        s.tags,
        s.notes,
        s.pricing_type AS "pricingType",
        ch.current_month::float AS "currentMonthCost",
        ch.last_month::float AS "lastMonthCost",
        COALESCE(ch.history, '[]'::json) AS "costHistory",
        s.last_payment_status AS "lastPaymentStatus",
        COALESCE(ph.payments, '[]'::json) AS payments,
        0 AS attachment_count
      FROM subscriptions s
      LEFT JOIN cost_history ch ON ch.subscription_id = s.id
      LEFT JOIN payment_history ph ON ph.subscription_id = s.id
      ORDER BY s.id DESC
    `;

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to fetch subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const result = await sql`
      INSERT INTO subscriptions (
        company, service, cost, billing, next_billing, contract_end,
        category, manager, renewal_alert, status, payment_method,
        tags, notes, pricing_type, last_payment_status
      ) VALUES (
        ${body.company}, ${body.service}, ${body.cost}, ${body.billing},
        ${body.nextBilling || null}, ${body.contractEnd || null},
        ${body.category || null}, ${body.manager || null},
        ${body.renewalAlert || 30}, ${body.status}, ${body.paymentMethod},
        ${JSON.stringify(body.tags || [])}, ${body.notes || null},
        ${body.pricingType || 'fixed'}, ${body.lastPaymentStatus || 'pending'}
      )
      RETURNING id
    `;

    return NextResponse.json({ id: result.rows[0].id });
  } catch (error) {
    console.error('Failed to create subscription:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}