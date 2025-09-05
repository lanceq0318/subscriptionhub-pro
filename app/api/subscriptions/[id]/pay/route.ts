import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

type PaymentInput = {
  date: string;                       // ISO string from client
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  method?: string | null;
  reference?: string | null;
};

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number.parseInt(params.id, 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const body = (await request.json()) as PaymentInput;

    // Basic validation
    if (!body || !body.date || typeof body.amount !== 'number' || !body.status) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const paymentDate = new Date(body.date);

    // 1) Insert the payment
    await sql`
      INSERT INTO payments (subscription_id, payment_date, amount, status, method, reference)
      VALUES (${id}, ${paymentDate.toISOString()}, ${body.amount}, ${body.status}, ${body.method || null}, ${body.reference || null})
    `;

    // 2) Update subscription payment status
    await sql`
      UPDATE subscriptions
      SET last_payment_status = ${body.status}, updated_at = NOW()
      WHERE id = ${id}
    `;

    // 3) If paid, roll next_billing forward based on billing cycle
    if (body.status === 'paid') {
      // monthly
      await sql`
        UPDATE subscriptions
        SET next_billing = COALESCE(next_billing, CURRENT_DATE) + INTERVAL '1 month'
        WHERE id = ${id} AND billing = 'monthly'
      `;
      // quarterly
      await sql`
        UPDATE subscriptions
        SET next_billing = COALESCE(next_billing, CURRENT_DATE) + INTERVAL '3 months'
        WHERE id = ${id} AND billing = 'quarterly'
      `;
      // yearly
      await sql`
        UPDATE subscriptions
        SET next_billing = COALESCE(next_billing, CURRENT_DATE) + INTERVAL '1 year'
        WHERE id = ${id} AND billing = 'yearly'
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking as paid:', error);
    return NextResponse.json({ error: 'Failed to mark as paid' }, { status: 500 });
  }
}
