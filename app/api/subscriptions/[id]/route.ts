// app/api/subscriptions/[id]/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Cache table columns across invocations
let subsColumnsCache:
  | null
  | Record<string, { data_type: string; udt_name: string }> = null;

async function getSubscriptionsColumns() {
  if (subsColumnsCache) return subsColumnsCache;
  const rows = await sql/* sql */`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
  `;
  const map: Record<string, { data_type: string; udt_name: string }> = {};
  for (const r of rows as any[]) {
    map[r.column_name] = { data_type: r.data_type, udt_name: r.udt_name };
  }
  subsColumnsCache = map;
  // Helpful once: see what columns you actually have
  // console.log('subscriptions columns:', subsColumnsCache);
  return subsColumnsCache;
}

function normalizeTags(input: unknown): string[] | null {
  if (input === undefined) return null; // not provided -> leave unchanged
  if (input === null) return [];        // explicit empty
  if (Array.isArray(input)) {
    return input
      .filter((v): v is string => typeof v === 'string')
      .map(s => s.trim())
      .filter(Boolean);
  }
  // If wrong type, coerce to [] (or throw 400 if you prefer)
  return [];
}

function pick<K extends string>(present: Record<string, any>, candidates: K[]): K | null {
  for (const c of candidates) if (c in present) return c as K;
  return null;
}

async function updateSubscription(req: Request, id: string) {
  const cols = await getSubscriptionsColumns();
  const body = await req.json().catch(() => ({} as any));

  // --- Choose actual column names that exist in your DB ---
  const nameCol = pick(cols, ['name', 'title', 'label', 'subscription_name']);
  const priceCol = pick(cols, ['price', 'amount', 'amount_cents', 'monthly_price', 'cost']);
  const tagsCol  = 'tags' in cols ? 'tags' : null;
  const updatedAtCol = 'updated_at' in cols ? 'updated_at' : null;

  // --- Gather incoming values (support common aliases) ---
  const incomingName =
    body.name ?? body.title ?? body.label ?? body.subscription_name;
  const incomingPrice =
    body.price ?? body.amount ?? body.amount_cents ?? body.monthly_price ?? body.cost;
  const tagsArrOrNull = normalizeTags(body.tags);

  // --- Build dynamic UPDATE ---
  const setClauses: string[] = [];
  const params: any[] = [];
  let i = 1;

  if (nameCol !== null && incomingName !== undefined) {
    setClauses.push(`"${nameCol}" = $${i++}`);
    params.push(incomingName === null ? null : String(incomingName));
  }

  if (priceCol !== null && incomingPrice !== undefined) {
    const dtype = cols[priceCol].data_type; // 'integer' | 'numeric' | 'text' | etc.
    if (dtype === 'integer' || dtype === 'bigint') {
      setClauses.push(`"${priceCol}" = $${i++}::${dtype}`);
      params.push(incomingPrice);
    } else if (
      dtype === 'numeric' ||
      dtype === 'double precision' ||
      dtype === 'real'
    ) {
      setClauses.push(`"${priceCol}" = $${i++}::numeric`);
      params.push(incomingPrice);
    } else {
      // treat as text-like
      setClauses.push(`"${priceCol}" = $${i++}`);
      params.push(incomingPrice === null ? null : String(incomingPrice));
    }
  }

  if (tagsCol !== null && tagsArrOrNull !== null) {
    const tagsJson = JSON.stringify(tagsArrOrNull);
    const t = cols[tagsCol];
    if (t.data_type === 'ARRAY' && t.udt_name === '_text') {
      // Convert JSON -> text[]
      setClauses.push(
        `"${tagsCol}" = COALESCE(ARRAY(SELECT jsonb_array_elements_text($${i++}::jsonb)), '{}'::text[])`
      );
      params.push(tagsJson);
    } else if (t.data_type === 'json' || t.data_type === 'jsonb') {
      setClauses.push(`"${tagsCol}" = $${i++}::jsonb`);
      params.push(tagsJson);
    } else {
      // Unexpected type: store as stringified JSON to avoid crashing
      setClauses.push(`"${tagsCol}" = $${i++}`);
      params.push(tagsJson);
    }
  }

  if (updatedAtCol) {
    setClauses.push(`"${updatedAtCol}" = NOW()`);
  }

  if (setClauses.length === 0) {
    return NextResponse.json(
      { error: 'No updatable fields found for provided payload.' },
      { status: 400 }
    );
  }

  const q = `UPDATE "subscriptions" SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`;
  params.push(id);

  const rows = (await sql(q, params)) as any[];
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    return await updateSubscription(req, params.id);
  } catch (err) {
    console.error('Failed to update subscription:', err);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  // Make PUT behave like PATCH (partial updates)
  return PATCH(req, ctx);
}

// If you run on Edge with Neon HTTP, you can uncomment:
// export const runtime = 'edge';
