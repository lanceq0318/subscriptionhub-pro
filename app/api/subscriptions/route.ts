import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { SubscriptionCreateSchema, parseJson } from '@/app/lib/validation';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim();
    const tag = url.searchParams.get('tag')?.trim();
    const status = url.searchParams.get('status')?.trim() as 'active' | 'pending' | 'cancelled' | null;
    const sort = (url.searchParams.get('sort') || 'created_at').toLowerCase();
    const order = (url.searchParams.get('order') || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Sanitize sort to known columns (prevents injection)
    const validSortColumns = [
      'company',
      'service',
      'cost',
      'billing',
      'next_billing',
      'created_at',
      'updated_at',
      'contract_end',
    ];
    const sortKey = validSortColumns.includes(sort) ? sort : 'created_at';

    // Build WHERE conditions as an array of strings with placeholders
    const whereConditions: string[] = [];
    const whereParams: any[] = [];
    if (q) {
      whereConditions.push(`(s.company ILIKE $${whereParams.length + 1} OR s.service ILIKE $${whereParams.length + 1})`);
      whereParams.push(`%${q}%`);
    }
    if (status) {
      whereConditions.push(`s.status = $${whereParams.length + 1}`);
      whereParams.push(status);
    }
    if (tag) {
      whereConditions.push(
        `EXISTS (SELECT 1 FROM subscription_tags tt WHERE tt.subscription_id = s.id AND tt.tag = $${whereParams.length + 1})`
      );
      whereParams.push(tag);
    }

    // Construct the WHERE clause string
    const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Construct the ORDER BY clause string (safe due to validation)
    const orderByClause = `ORDER BY s.${sortKey} ${order}`;

    // Build full query text as string
    const queryText = `
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
        s.created_at        AS "createdAt",
        s.updated_at        AS "updatedAt",
        -- latest payment (status + date)
        lp.status           AS "lastPaymentStatus",
        lp.payment_date     AS "lastPaymentDate",
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
        ) AS "payments",
        -- derived status (auto)
        CASE
          WHEN s.status = 'cancelled' THEN 'cancelled'
          WHEN s.next_billing IS NOT NULL AND s.next_billing::date < CURRENT_DATE THEN 'overdue'
          WHEN lp.status IS NOT NULL THEN lp.status
          ELSE s.status
        END AS "derivedStatus"
      FROM subscriptions s
      LEFT JOIN subscription_tags t ON t.subscription_id = s.id
      LEFT JOIN payments p ON p.subscription_id = s.id
      LEFT JOIN attachments a ON a.subscription_id = s.id
      LEFT JOIN LATERAL (
        SELECT status, payment_date
        FROM payments p2
        WHERE p2.subscription_id = s.id
        ORDER BY payment_date DESC, id DESC
        LIMIT 1
      ) lp ON TRUE
      ${whereClause}
      GROUP BY s.id, lp.status, lp.payment_date
      ${orderByClause}
    `;

    // Execute the query with parameters
    const result = await sql.query(queryText, whereParams);

    // Normalize the response
    const normalized = result.rows.map((s: any) => ({
      ...s,
      cost: typeof s.cost === 'string' ? Number(s.cost) : s.cost,
      attachmentCount: Number(s.attachmentCount ?? 0),
      payments: Array.isArray(s.payments)
        ? s.payments.map((p: any) => ({
            ...p,
            amount: typeof p?.amount === 'string' ? Number(p.amount) : p?.amount,
          }))
        : [],
    }));

    return NextResponse.json(normalized);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}

// Handle POST requests for subscription creation
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

    // Insert the subscription
    const result = await sql<{ id: number }>`
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
    const id = result.rows[0].id;

    // Insert tags associated with the new subscription
    if (Array.isArray(tags) && tags.length > 0) {
      const tagInserts = tags.map(tag => sql`
        INSERT INTO subscription_tags (subscription_id, tag)
        VALUES (${id}, ${tag})
      `);
      await Promise.all(tagInserts); // Use Promise.all to insert tags in parallel
    }

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}
