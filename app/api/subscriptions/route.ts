import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { rows } = await sql<any>`
      SELECT 
<<<<<<< HEAD
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
        s.created_at        AS "createdAt",
        s.updated_at        AS "updatedAt",
        ARRAY_AGG(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL) AS "tags",
        COUNT(DISTINCT a.id) AS "attachmentCount",
        JSON_AGG(DISTINCT JSONB_BUILD_OBJECT(
=======
        s.*,
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
        )) FILTER (WHERE p.id IS NOT NULL) AS "payments"
=======
        )) FILTER (WHERE p.id IS NOT NULL) as payments
>>>>>>> parent of b79e0e7 (Complete subscription tracker with authentication and database)
      FROM subscriptions s
      LEFT JOIN subscription_tags t ON s.id = t.subscription_id
      LEFT JOIN attachments a ON s.id = a.subscription_id
      LEFT JOIN payments p ON s.id = p.subscription_id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `;

    const normalized = (rows || []).map((s: any) => ({
      ...s,
      cost: typeof s.cost === 'string' ? Number(s.cost) : s.cost,
      attachmentCount:
        typeof s.attachmentCount === 'string' ? Number(s.attachmentCount) : (s.attachmentCount ?? 0),
      payments: Array.isArray(s.payments)
        ? s.payments.map((p: any) => ({
            ...p,
            amount: typeof p?.amount === 'string' ? Number(p.amount) : p?.amount,
            date: p?.date, // already aliased as 'date' in JSONB_BUILD_OBJECT
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

    const { rows } = await sql<{ id: number }>`
      INSERT INTO subscriptions (
        company, service, cost, billing, next_billing, contract_end,
        category, manager, renewal_alert, status, payment_method,
        notes, last_payment_status
      ) VALUES (
        ${company}, ${service}, ${cost}, ${billing},
        ${nextBilling || null}, ${contractEnd || null},
        ${category || null}, ${manager || null},
        ${renewalAlert ?? 30}, ${status || 'active'},
        ${paymentMethod || null}, ${notes || null},
        ${lastPaymentStatus || 'pending'}
      )
      RETURNING id
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
>>>>>>> parent of b79e0e7 (Complete subscription tracker with authentication and database)
    `;

    const subscriptionId = rows[0].id;

<<<<<<< HEAD
    if (Array.isArray(tags) && tags.length > 0) {
=======
    // Insert tags
    if (tags && tags.length > 0) {
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
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}