// app/api/subscriptions/route.ts
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { rows } = await sql<any>`
      SELECT 
        s.id,
        s.company,
        s.service,
        s.cost,
        s.billing,
        s.next_billing      AS "nextBilling",
        s.contract_end      AS "contractEnd",
        s.category,
        s.manager,
        s.renewal_alert     AS "renewalAlert",
        s.status,
        s.payment_method    AS "paymentMethod",
        s.notes,
        s.last_payment_status AS "lastPaymentStatus",
        s.pricing_type      AS "pricingType",
        s.created_at        AS "createdAt",
        s.updated_at        AS "updatedAt",

        -- tags and payments
        ARRAY_AGG(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL) AS "tags",

        JSON_AGG(DISTINCT JSONB_BUILD_OBJECT(
          'id', p.id,
          'date', p.payment_date,
          'amount', p.amount,
          'status', p.status,
          'method', p.method,
          'reference', p.reference
        )) FILTER (WHERE p.id IS NOT NULL) AS "payments",

        -- current and last month actuals
        (
          SELECT sc.amount
          FROM subscription_costs sc
          WHERE sc.subscription_id = s.id
            AND sc.period = DATE_TRUNC('month', CURRENT_DATE)::date
          LIMIT 1
        ) AS "currentMonthCost",

        (
          SELECT sc.amount
          FROM subscription_costs sc
          WHERE sc.subscription_id = s.id
            AND sc.period = (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month')::date
          LIMIT 1
        ) AS "lastMonthCost",

        -- last up-to-12 months history (period, amount)
        (
          SELECT JSON_AGG(JSON_BUILD_OBJECT('period', hh.period, 'amount', hh.amount) ORDER BY hh.period DESC)
          FROM (
            SELECT period, amount
            FROM subscription_costs
            WHERE subscription_id = s.id
              AND period >= (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 month')::date
            ORDER BY period DESC
          ) AS hh
        ) AS "costHistory"

      FROM subscriptions s
      LEFT JOIN subscription_tags t ON s.id = t.subscription_id
      LEFT JOIN payments p         ON s.id = p.subscription_id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `;

    const normalized = (rows || []).map((s: any) => ({
      ...s,
      cost: typeof s.cost === 'string' ? Number(s.cost) : s.cost,
      currentMonthCost: typeof s.currentMonthCost === 'string' ? Number(s.currentMonthCost) : s.currentMonthCost,
      lastMonthCost: typeof s.lastMonthCost === 'string' ? Number(s.lastMonthCost) : s.lastMonthCost,
      payments: Array.isArray(s.payments)
        ? s.payments.map((p: any) => ({
            ...p,
            amount: typeof p?.amount === 'string' ? Number(p.amount) : p?.amount,
          }))
        : [],
      costHistory: Array.isArray(s.costHistory)
        ? s.costHistory.map((h: any) => ({
            period: h.period,
            amount: typeof h.amount === 'string' ? Number(h.amount) : h.amount,
          }))
        : [],
    }));

    return NextResponse.json(normalized);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      company,
      service,
      cost,
      billing,
      nextBilling,
      contractEnd,
      category,
      manager,
      renewalAlert,
      status,
      paymentMethod,
      notes,
      tags,
      lastPaymentStatus,
      pricingType, // 'fixed' | 'variable' (defaults server-side)
    } = body as {
      company: string;
      service: string;
      cost: number;
      billing: 'monthly' | 'yearly' | 'quarterly';
      nextBilling?: string | null;
      contractEnd?: string | null;
      category?: string | null;
      manager?: string | null;
      renewalAlert?: number;
      status?: 'active' | 'pending' | 'cancelled';
      paymentMethod?: string | null;
      notes?: string | null;
      tags?: string[];
      lastPaymentStatus?: 'paid' | 'pending' | 'overdue';
      pricingType?: 'fixed' | 'variable';
    };

    const { rows } = await sql<{ id: number }>`
      INSERT INTO subscriptions (
        company, service, cost, billing, next_billing, contract_end,
        category, manager, renewal_alert, status, payment_method,
        notes, last_payment_status, pricing_type
      ) VALUES (
        ${company}, ${service}, ${cost}, ${billing},
        ${nextBilling || null}, ${contractEnd || null},
        ${category || null}, ${manager || null},
        ${renewalAlert ?? 30}, ${status || 'active'},
        ${paymentMethod || null}, ${notes || null},
        ${lastPaymentStatus || 'pending'}, ${pricingType || 'fixed'}
      )
      RETURNING id
    `;

    const subscriptionId = rows[0].id;

    if (Array.isArray(tags) && tags.length > 0) {
      for (const tag of tags) {
        await sql`
          INSERT INTO subscription_tags (subscription_id, tag)
          VALUES (${subscriptionId}, ${tag})
        `;
      }
    }

    return NextResponse.json({ id: subscriptionId, ...body });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}
