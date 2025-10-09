import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { SubscriptionCreateSchema, parseJson } from '@/app/lib/validation';

// Make sure this runs in the Node runtime on Vercel
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const qRaw = url.searchParams.get('q')?.trim() || null;
    const tag = url.searchParams.get('tag')?.trim() || null;

    // Allow status=active|pending|cancelled|overdue|all
    const statusRaw = url.searchParams.get('status')?.trim()?.toLowerCase() || null;
    const isOverdue = statusRaw === 'overdue';
    const statusParam =
      statusRaw && ['active', 'pending', 'cancelled'].includes(statusRaw)
        ? (statusRaw as 'active' | 'pending' | 'cancelled')
        : null; // 'all' or unknown -> no direct status filter

    // Sorting – only allow known columns
    const sortRaw = (url.searchParams.get('sort') || 'created_at').toLowerCase();
    const order = (url.searchParams.get('order') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const allowedSorts = new Set([
      'company', 'service', 'cost', 'billing', 'next_billing', 'created_at', 'updated_at', 'contract_end',
    ]);
    const sortKey = allowedSorts.has(sortRaw) ? sortRaw : 'created_at';

    const qLike = qRaw ? `%${qRaw}%` : null;

    // Single query: no nested sql fragments, everything toggled by params/CASE
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

      WHERE
        ( ${qLike} IS NULL OR (s.company ILIKE ${qLike} OR s.service ILIKE ${qLike}) )
        AND ( ${statusParam} IS NULL OR s.status = ${statusParam} )
        AND ( ${isOverdue} = false OR (s.next_billing IS NOT NULL AND s.next_billing::date < CURRENT_DATE AND s.status <> 'cancelled') )
        AND ( ${tag} IS NULL OR EXISTS (
              SELECT 1 FROM subscription_tags tt
              WHERE tt.subscription_id = s.id AND tt.tag = ${tag}
            ))

      GROUP BY s.id, lp.status, lp.payment_date

      ORDER BY
        -- text fields
        CASE WHEN ${sortKey} = 'company'       AND ${order} = 'asc'  THEN s.company      END ASC,
        CASE WHEN ${sortKey} = 'company'       AND ${order} = 'desc' THEN s.company      END DESC,
        CASE WHEN ${sortKey} = 'service'       AND ${order} = 'asc'  THEN s.service      END ASC,
        CASE WHEN ${sortKey} = 'service'       AND ${order} = 'desc' THEN s.service      END DESC,
        CASE WHEN ${sortKey} = 'billing'       AND ${order} = 'asc'  THEN s.billing      END ASC,
        CASE WHEN ${sortKey} = 'billing'       AND ${order} = 'desc' THEN s.billing      END DESC,

        -- numeric / date fields
        CASE WHEN ${sortKey} = 'cost'          AND ${order} = 'asc'  THEN s.cost         END ASC,
        CASE WHEN ${sortKey} = 'cost'          AND ${order} = 'desc' THEN s.cost         END DESC,
        CASE WHEN ${sortKey} = 'next_billing'  AND ${order} = 'asc'  THEN s.next_billing END ASC,
        CASE WHEN ${sortKey} = 'next_billing'  AND ${order} = 'desc' THEN s.next_billing END DESC,
        CASE WHEN ${sortKey} = 'contract_end'  AND ${order} = 'asc'  THEN s.contract_end END ASC,
        CASE WHEN ${sortKey} = 'contract_end'  AND ${order} = 'desc' THEN s.contract_end END DESC,
        CASE WHEN ${sortKey} = 'created_at'    AND ${order} = 'asc'  THEN s.created_at   END ASC,
        CASE WHEN ${sortKey} = 'created_at'    AND ${order} = 'desc' THEN s.created_at   END DESC,
        CASE WHEN ${sortKey} = 'updated_at'    AND ${order} = 'asc'  THEN s.updated_at   END ASC,
        CASE WHEN ${sortKey} = 'updated_at'    AND ${order} = 'desc' THEN s.updated_at   END DESC,

        -- stable tiebreak
        s.created_at DESC
    `;

    const normalized = rows.map((s: any) => ({
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

    const costNum = typeof cost === 'string' ? Number(cost) : cost;
    const statusDb: 'active' | 'pending' | 'cancelled' =
      (status && ['active', 'pending', 'cancelled'].includes(status)) ? status : 'active';

    // IMPORTANT: do NOT reference last_payment_status here to avoid schema mismatch
    const { rows } = await sql<{ id: number }>`
      INSERT INTO subscriptions (
        company, service, cost, billing, next_billing, contract_end,
        category, manager, renewal_alert, status, payment_method, notes
      ) VALUES (
        ${company}, ${service}, ${costNum ?? null}, ${billing},
        ${nextBilling || null}, ${contractEnd || null},
        ${category || null}, ${manager || null}, ${renewalAlert ?? 30},
        ${statusDb}, ${paymentMethod || null}, ${notes || null}
      )
      RETURNING id
    `;

    const id = rows[0]?.id;

    if (id && Array.isArray(tags) && tags.length > 0) {
      for (const tag of tags) {
        await sql`
          INSERT INTO subscription_tags (subscription_id, tag)
          VALUES (${id}, ${tag})
        `;
      }
    }

    return NextResponse.json({ id }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to create subscription';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
