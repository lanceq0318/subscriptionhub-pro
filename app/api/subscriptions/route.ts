// app/api/subscriptions/route.ts
export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { sql } from '@/app/lib/db';

export async function GET() {
  try {
    const db = sql();

    // Aggregate cost history + current month, plus payments
    const rows = await db<{
      id: number;
      company: string;
      service: string;
      cost: number;
      billing: 'monthly' | 'yearly' | 'quarterly';
      nextBilling: string | null;
      contractEnd: string | null;
      category: string | null;
      manager: string | null;
      renewalAlert: number;
      status: 'active' | 'pending' | 'cancelled';
      paymentMethod: string;
      tags: string[] | null;
      notes: string | null;
      lastPaymentStatus: 'paid' | 'pending' | 'overdue' | null;
      pricingType: 'fixed' | 'variable' | null;
      department: string | null;
      costCenter: string | null;
      vendor: string | null;
      accountNumber: string | null;
      autoRenew: boolean | null;
      budget: number | null;
      currentMonthCost: number | null;
      lastMonthCost: number | null;
      costHistory: { period: string; amount: number }[];
      attachment_count: number;
      payments: {
        id: string;
        date: string;
        amount: number;
        status: 'paid' | 'pending' | 'overdue';
        method: string | null;
        reference: string | null;
        invoiceNumber: string | null;
        notes: string | null;
      }[];
    }[]>`
      WITH costs AS (
        SELECT
          subscription_id,
          json_agg(
            json_build_object(
              'period', to_char(period, 'YYYY-MM-DD'),
              'amount', (amount)::float
            )
            ORDER BY period DESC
          ) AS cost_history,
          MAX(amount) FILTER (
            WHERE date_trunc('month', period) = date_trunc('month', now())
          ) AS current_month_cost,
          MAX(amount) FILTER (
            WHERE date_trunc('month', period) = date_trunc('month', now()) - interval '1 month'
          ) AS last_month_cost
        FROM subscription_costs
        GROUP BY subscription_id
      ),
      pay AS (
        SELECT
          subscription_id,
          json_agg(
            json_build_object(
              'id', id::text,
              'date', to_char(date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
              'amount', amount::float,
              'status', status,
              'method', method,
              'reference', reference,
              'invoiceNumber', invoice_number,
              'notes', notes
            )
            ORDER BY date DESC
          ) AS payments
        FROM payments
        GROUP BY subscription_id
      )
      SELECT
        s.id,
        s.company,
        s.service,
        (s.cost)::float AS cost,
        s.billing,
        to_char(s.next_billing, 'YYYY-MM-DD') AS "nextBilling",
        to_char(s.contract_end, 'YYYY-MM-DD') AS "contractEnd",
        s.category,
        s.manager,
        s.renewal_alert AS "renewalAlert",
        s.status,
        s.payment_method AS "paymentMethod",
        COALESCE(s.tags, '[]'::jsonb) AS tags,
        s.notes,
        s.last_payment_status AS "lastPaymentStatus",
        s.pricing_type AS "pricingType",
        s.department,
        s.cost_center AS "costCenter",
        s.vendor,
        s.account_number AS "accountNumber",
        s.auto_renew AS "autoRenew",
        (s.budget)::float AS budget,
        COALESCE((c.current_month_cost)::float, NULL) AS "currentMonthCost",
        COALESCE((c.last_month_cost)::float, NULL) AS "lastMonthCost",
        COALESCE(c.cost_history, '[]') AS "costHistory",
        0::int AS "attachment_count",
        COALESCE(p.payments, '[]') AS payments
      FROM subscriptions s
      LEFT JOIN costs c ON c.subscription_id = s.id
      LEFT JOIN pay   p ON p.subscription_id = s.id
      ORDER BY s.id DESC;
    `;

    // pg returns jsonb already parsed via the Neon driver
    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = sql();

    const {
      company, service, cost, billing,
      nextBilling, contractEnd, category, manager,
      renewalAlert = 30, status,
      paymentMethod, tags = [], notes = null,
      lastPaymentStatus = 'pending',
      pricingType = 'fixed',
      department = null, costCenter = null,
      vendor = null, accountNumber = null,
      autoRenew = false, budget = null,
    } = body;

    const inserted = await db<{ id: number }[]>`
      INSERT INTO subscriptions (
        company, service, cost, billing,
        next_billing, contract_end, category, manager,
        renewal_alert, status, payment_method, tags, notes,
        last_payment_status, pricing_type, department, cost_center,
        vendor, account_number, auto_renew, budget
      )
      VALUES (
        ${company}, ${service}, ${cost}, ${billing},
        ${nextBilling || null}, ${contractEnd || null}, ${category || null}, ${manager || null},
        ${renewalAlert}, ${status}, ${paymentMethod}, ${JSON.stringify(tags)}, ${notes},
        ${lastPaymentStatus}, ${pricingType}, ${department}, ${costCenter},
        ${vendor}, ${accountNumber}, ${autoRenew}, ${budget}
      )
      RETURNING id;
    `;

    return NextResponse.json({ ok: true, id: inserted[0].id });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
