// app/api/subscriptions/[id]/route.ts
<<<<<<< HEAD
=======
import { sql } from '@vercel/postgres';
>>>>>>> parent of fdb4560 (Imporvement)
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
<<<<<<< HEAD
<<<<<<< HEAD
    return await updateSubscription(req, params.id);
  } catch (err) {
    console.error('Failed to update subscription:', err);
=======
    const id = parseInt(params.id);
    const body = await request.json();
    const {
      company, service, cost, billing, nextBilling, contractEnd,
      category, manager, renewalAlert, status, paymentMethod,
      usage, notes, tags, lastPaymentStatus
    } = body;

    // Update subscription
    await sql`
      UPDATE subscriptions
      SET company = ${company}, service = ${service}, cost = ${cost},
          billing = ${billing}, next_billing = ${nextBilling || null},
          contract_end = ${contractEnd || null}, category = ${category || null},
          manager = ${manager || null}, renewal_alert = ${renewalAlert || 30},
          status = ${status || 'active'}, payment_method = ${paymentMethod || null},
          usage = ${usage || null}, notes = ${notes || null},
          last_payment_status = ${lastPaymentStatus || 'pending'},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    // Update tags (delete and re-insert)
    await sql`DELETE FROM subscription_tags WHERE subscription_id = ${id}`;
    if (tags && tags.length > 0) {
      for (const tag of tags) {
        await sql`
          INSERT INTO subscription_tags (subscription_id, tag)
          VALUES (${id}, ${tag})
        `;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating subscription:', error);
>>>>>>> parent of b79e0e7 (Complete subscription tracker with authentication and database)
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  // Make PUT behave like PATCH (partial updates)
  return PATCH(req, ctx);
=======
    const id = Number.parseInt(params.id, 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

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
    } = body as {
      company?: string;
      service?: string;
      cost?: number;
      billing?: 'monthly' | 'yearly' | 'quarterly';
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

    // Update subscription row
    await sql`
      UPDATE subscriptions
      SET
        company = ${company},
        service = ${service},
        cost = ${cost},
        billing = ${billing},
        next_billing = ${nextBilling || null},
        contract_end = ${contractEnd || null},
        category = ${category || null},
        manager = ${manager || null},
        renewal_alert = ${renewalAlert ?? 30},
        status = ${status || 'active'},
        payment_method = ${paymentMethod || null},
        notes = ${notes || null},
        last_payment_status = ${lastPaymentStatus || 'pending'},
        updated_at = NOW()
      WHERE id = ${id}
    `;

    // Replace tags
    await sql`DELETE FROM subscription_tags WHERE subscription_id = ${id}`;
    if (Array.isArray(tags) && tags.length > 0) {
      for (const tag of tags) {
        await sql`
          INSERT INTO subscription_tags (subscription_id, tag)
          VALUES (${id}, ${tag})
        `;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
<<<<<<< HEAD
    const id = Number.parseInt(params.id, 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    // ON DELETE CASCADE on FKs will clean up related rows
    await sql`DELETE FROM subscriptions WHERE id = ${id}`;

=======
    const id = parseInt(params.id);
    await sql`DELETE FROM subscriptions WHERE id = ${id}`;
>>>>>>> parent of b79e0e7 (Complete subscription tracker with authentication and database)
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    return NextResponse.json(
      { error: 'Failed to delete subscription' },
      { status: 500 }
    );
  }
<<<<<<< HEAD
>>>>>>> parent of fdb4560 (Imporvement)
}

// If you run on Edge with Neon HTTP, you can uncomment:
// export const runtime = 'edge';
=======
}
>>>>>>> parent of b79e0e7 (Complete subscription tracker with authentication and database)
