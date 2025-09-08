// app/api/payments/route.ts
export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { sql } from '@/app/lib/db';

type Payment = {
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  method?: string;
  reference?: string;
  invoiceNumber?: string;
  notes?: string;
};

export async function POST(req: Request) {
  try {
    const { subscriptionId, payment } = (await req.json()) as {
      subscriptionId: number;
      payment: Payment;
    };

    if (!subscriptionId || !payment) {
      return NextResponse.json({ error: 'subscriptionId and payment are required' }, { status: 400 });
    }

    const db = sql();

    await db`
      INSERT INTO payments (
        subscription_id, date, amount, status, method, reference, invoice_number, notes
      ) VALUES (
        ${subscriptionId},
        ${payment.date},
        ${payment.amount},
        ${payment.status},
        ${payment.method || null},
        ${payment.reference || null},
        ${payment.invoiceNumber || null},
        ${payment.notes || null}
      );
    `;

    await db`
      UPDATE subscriptions
         SET last_payment_status = ${payment.status}
       WHERE id = ${subscriptionId};
    `;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
