import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Normalize "tags" from the incoming JSON.
// - returns null  -> "not provided" (do not change column)
// - returns []    -> explicitly empty array
// - returns [...] -> string[] (filtered & trimmed)
function normalizeTags(input: unknown): string[] | null {
  if (input === undefined) return null;         // don't touch DB column
  if (input === null) return [];                // explicit empty
  if (Array.isArray(input)) {
    return input
      .filter((v): v is string => typeof v === 'string')
      .map(s => s.trim())
      .filter(Boolean);
  }
  // Wrong type: coerce to empty to be safe (or throw 400 if you prefer)
  return [];
}

async function updateSubscription(req: Request, id: string) {
  const body = await req.json().catch(() => ({}));

  // Normalize optional fields (add more as needed)
  const name  = typeof body.name  === 'string' || body.name === null ? body.name : undefined;
  const price = typeof body.price === 'number' || typeof body.price === 'string' || body.price === null
    ? body.price
    : undefined;

  // tags: null -> not provided (keep existing), [] or ["a"] -> set in DB
  const tagsArrOrNull = normalizeTags(body.tags);
  const tagsJson: string | null = tagsArrOrNull === null ? null : JSON.stringify(tagsArrOrNull);

  // Perform partial update.
  // - For text[] tags: convert JSON -> text[] with jsonb_array_elements_text
  // - If tagsJson is null, we leave tags unchanged (CASE branch)
  const rows = await sql/* sql */`
    UPDATE subscriptions
    SET
      name  = COALESCE(${name ?? null}, name),
      price = COALESCE(${price ?? null}::numeric, price),
      tags  = CASE
                WHEN ${tagsJson}::jsonb IS NULL THEN tags
                ELSE COALESCE(
                       ARRAY(SELECT jsonb_array_elements_text(${tagsJson}::jsonb)),
                       '{}'::text[]
                     )
              END,
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *;
  `;

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
  // Allow PUT to behave like PATCH (partial update)
  return PATCH(req, ctx);
}

// Optional in Edge runtimes; keep if you’re using Neon HTTP on Edge.
// export const runtime = 'edge';
