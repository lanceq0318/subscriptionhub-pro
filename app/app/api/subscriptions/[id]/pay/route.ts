import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { PaymentSchema, parseJson } from '@/app/lib/validation';

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

    await sql`
      INSERT INTO payments (subscription_id, payment_date, amount, status, method, reference)
      VALUES (${id}, ${date}, ${amount}, ${status}, ${method || null}, ${reference || null})
    `;

    // Always set last_payment_status to the provided status
    await sql`
      UPDATE subscriptions
      SET last_payment_status = ${status}, updated_at = NOW()
      WHERE id = ${id}
    `;

    // advance next_billing based on billing cadence
    await sql`
      UPDATE subscriptions
      SET next_billing = COALESCE(next_billing, CURRENT_DATE) + CASE billing
        WHEN 'monthly' THEN INTERVAL '1 month'
        WHEN 'quarterly' THEN INTERVAL '3 months'
        WHEN 'yearly' THEN INTERVAL '1 year'
        ELSE INTERVAL '1 month'
      END
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking as paid:', error);
    return NextResponse.json({ error: 'Failed to mark as paid' }, { status: 500 });
  }
}
