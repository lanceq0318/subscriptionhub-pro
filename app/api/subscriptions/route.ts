// app/api/subscriptions/route.ts
<<<<<<< HEAD
=======
import { sql } from '@vercel/postgres';
>>>>>>> parent of fdb4560 (Imporvement)
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
<<<<<<< HEAD
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
=======
    const { rows: subscriptions } = await sql<{
      id: number;
      company: string;
      service: string;
      cost: string; // numeric comes back as string
      billing: 'monthly' | 'yearly' | 'quarterly';
      next_billing: string | null;
      contract_end: string | null;
      category: string | null;
      manager: string | null;
      renewal_alert: number;
      status: 'active' | 'pending' | 'cancelled';
      payment_method: string | null;
      notes: string | null;
      last_payment_status: 'paid' | 'pending' | 'overdue';
      created_at: string;
      updated_at: string;
      tags: string[] | null;
      attachment_count: string; // count returns as string
      payments: {
        id: number;
        date: string;
        amount: string;
        status: 'paid' | 'pending' | 'overdue';
        method: string | null;
        reference: string | null;
      }[] | null;
    }>`
      SELECT 
        s.*,
<<<<<<< HEAD
<<<<<<< HEAD
        ARRAY_AGG(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL) AS tags,
        COUNT(DISTINCT a.id) AS attachment_count,
        JSON_AGG(DISTINCT JSONB_BUILD_OBJECT(
=======
=======
>>>>>>> parent of b79e0e7 (Complete subscription tracker with authentication and database)
        array_agg(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL) as tags,
        COUNT(DISTINCT a.id) as attachment_count,
        json_agg(DISTINCT jsonb_build_object(
>>>>>>> parent of b79e0e7 (Complete subscription tracker with authentication and database)
          'id', p.id,
          'date', p.payment_date,
          'amount', p.amount,
          'status', p.status,
          'method', p.method,
          'reference', p.reference
<<<<<<< HEAD
<<<<<<< HEAD
        )) FILTER (WHERE p.id IS NOT NULL) AS payments
>>>>>>> parent of fdb4560 (Imporvement)
      FROM subscriptions s
      LEFT JOIN cost_history ch ON ch.subscription_id = s.id
      LEFT JOIN payment_history ph ON ph.subscription_id = s.id
      ORDER BY s.id DESC
=======
=======
>>>>>>> parent of b79e0e7 (Complete subscription tracker with authentication and database)
        )) FILTER (WHERE p.id IS NOT NULL) as payments
      FROM subscriptions s
      LEFT JOIN subscription_tags t ON s.id = t.subscription_id
      LEFT JOIN attachments a ON s.id = a.subscription_id
      LEFT JOIN payments p ON s.id = p.subscription_id
      GROUP BY s.id
      ORDER BY s.created_at DESC
<<<<<<< HEAD
>>>>>>> parent of b79e0e7 (Complete subscription tracker with authentication and database)
=======
>>>>>>> parent of b79e0e7 (Complete subscription tracker with authentication and database)
    `;

<<<<<<< HEAD
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to fetch subscriptions:', error);
=======
    // Normalize numeric strings to numbers where it helps the client
    const normalized = subscriptions.map((s) => ({
      ...s,
      cost: Number(s.cost),
      attachment_count: Number(s.attachment_count),
    }));

    return NextResponse.json(normalized);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
>>>>>>> parent of fdb4560 (Imporvement)
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
<<<<<<< HEAD
    
    const result = await sql`
=======
    const {
<<<<<<< HEAD
<<<<<<< HEAD
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
    };

    // Insert subscription
    const { rows } = await sql<{ id: number }>`
>>>>>>> parent of fdb4560 (Imporvement)
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

<<<<<<< HEAD
    return NextResponse.json({ id: result.rows[0].id });
  } catch (error) {
    console.error('Failed to create subscription:', error);
=======
    const subscriptionId = rows[0].id;

    // Insert tags (best-effort; if this fails the subscription still exists)
    if (Array.isArray(tags) && tags.length > 0) {
=======
      company, service, cost, billing, nextBilling, contractEnd,
      category, manager, renewalAlert, status, paymentMethod,
      usage, notes, tags, lastPaymentStatus
    } = body;

    // Insert subscription
    const { rows } = await sql`
      INSERT INTO subscriptions (
        company, service, cost, billing, next_billing, contract_end,
        category, manager, renewal_alert, status, payment_method,
        usage, notes, last_payment_status
      ) VALUES (
        ${company}, ${service}, ${cost}, ${billing}, ${nextBilling || null},
        ${contractEnd || null}, ${category || null}, ${manager || null},
        ${renewalAlert || 30}, ${status || 'active'}, ${paymentMethod || null},
        ${usage || null}, ${notes || null}, ${lastPaymentStatus || 'pending'}
      ) RETURNING id
    `;

=======
      company, service, cost, billing, nextBilling, contractEnd,
      category, manager, renewalAlert, status, paymentMethod,
      usage, notes, tags, lastPaymentStatus
    } = body;

    // Insert subscription
    const { rows } = await sql`
      INSERT INTO subscriptions (
        company, service, cost, billing, next_billing, contract_end,
        category, manager, renewal_alert, status, payment_method,
        usage, notes, last_payment_status
      ) VALUES (
        ${company}, ${service}, ${cost}, ${billing}, ${nextBilling || null},
        ${contractEnd || null}, ${category || null}, ${manager || null},
        ${renewalAlert || 30}, ${status || 'active'}, ${paymentMethod || null},
        ${usage || null}, ${notes || null}, ${lastPaymentStatus || 'pending'}
      ) RETURNING id
    `;

>>>>>>> parent of b79e0e7 (Complete subscription tracker with authentication and database)
    const subscriptionId = rows[0].id;

    // Insert tags
    if (tags && tags.length > 0) {
<<<<<<< HEAD
>>>>>>> parent of b79e0e7 (Complete subscription tracker with authentication and database)
=======
>>>>>>> parent of b79e0e7 (Complete subscription tracker with authentication and database)
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
>>>>>>> parent of fdb4560 (Imporvement)
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}