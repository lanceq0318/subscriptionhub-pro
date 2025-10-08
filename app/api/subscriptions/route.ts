import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { SubscriptionCreateSchema, parseJson } from '@/app/lib/validation';

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
        s.created_at        AS "createdAt",
        s.updated_at        AS "updatedAt",
        ARRAY_AGG(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL) AS "tags",
        COUNT(DISTINCT a.id) AS "attachmentCount",
        COALESCE(
          JSON_AGG(DISTINCT JSONB_BUILD_OBJECT(
            'id', p.id,
            'date', p.payment_date,
            'amount', p.amount,
            'status', p.status,
            'method', p.method,
            'reference', p.reference
          )) FILTER (WHERE p.id IS NOT NULL),
          '[]'::json
        ) AS "payments"
      FROM subscriptions s
      LEFT JOIN subscription_tags t ON t.subscription_id = s.id
      LEFT JOIN payments p ON p.subscription_id = s.id
      LEFT JOIN attachments a ON a.subscription_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `;

    const normalized = rows.map((s: any) => ({
      ...s,
      cost: typeof s.cost === 'string' ? Number(s.cost) : s.cost,
      attachmentCount:
        typeof s.attachmentCount === 'string' ? Number(s.attachmentCount) : (s.attachmentCount ?? 0),
      payments: Array.isArray(s.payments)
        ? s.payments.map((p: any) => ({
            ...p,
            amount: typeof p?.amount === 'string' ? Number(p.amount) : p?.amount,
            date: p?.date,
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
    const json = await parseJson<any>(request);
    const parsed = SubscriptionCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }
    const {
      company, service, cost, billing,
      nextBilling, contractEnd,
      category, manager, renewalAlert,
      status, paymentMethod, tags, notes,
    } = parsed.data;

    const { rows } = await sql<{ id: number }>`
      INSERT INTO subscriptions (
        company, service, cost, billing, next_billing, contract_end,
        category, manager, renewal_alert, status, payment_method,
        notes, last_payment_status
      ) VALUES (
        ${company}, ${service}, ${cost}, ${billing},
        ${nextBilling || null}, ${contractEnd || null},
        ${category || null}, ${manager || null}, ${renewalAlert ?? 30},
        ${status || 'active'}, ${paymentMethod || null},
        ${notes || null}, 'pending'
      )
      RETURNING id
    `;

    const id = rows[0].id;

    if (Array.isArray(tags) && tags.length > 0) {
      for (const tag of tags) {
        await sql`
          INSERT INTO subscription_tags (subscription_id, tag)
          VALUES (${id}, ${tag})
        `;
      }
    }

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}
