import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { PaymentSchema, parseJson } from '@/app/lib/validation';

export const runtime = 'nodejs';

function addInterval(date: Date, billing: 'monthly'|'quarterly'|'yearly'): Date {
  const d = new Date(date);
  if (billing === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (billing === 'quarterly') d.setMonth(d.getMonth() + 3);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number.parseInt(params.id, 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const json = await parseJson<any>(request);
    const parsed = PaymentSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }
    const { date, amount, status, method, reference } = parsed.data;

    // 1) Create payment
    await sql`
      INSERT INTO payments (subscription_id, payment_date, amount, status, method, reference)
      VALUES (${id}, ${date}, ${amount}, ${status}, ${method || null}, ${reference || null})
    `;

    // 2) Fetch current cadence + next_billing
    const sub = await sql<{ billing: 'monthly'|'quarterly'|'yearly'; next_billing: string | null }>`
      SELECT billing, next_billing FROM subscriptions WHERE id = ${id} LIMIT 1
    `;
    if (!sub.rows.length) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }
    const billing = sub.rows[0].billing;
    const currentNext = sub.rows[0].next_billing ? new Date(sub.rows[0].next_billing) : null;
    const paidAt = new Date(date);

    // 3) Advance next_billing so it is strictly AFTER the payment date
    let next = currentNext ?? addInterval(paidAt, billing); // if null, seed to next cycle from paid date
    while (next <= paidAt) next = addInterval(next, billing);

    await sql`
      UPDATE subscriptions
      SET next_billing = ${next.toISOString()}, last_payment_status = ${status}, updated_at = NOW()
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true, nextBilling: next.toISOString() });
  } catch (error) {
    console.error('Error marking as paid:', error);
    return NextResponse.json({ error: 'Failed to mark as paid' }, { status: 500 });
  }
}
