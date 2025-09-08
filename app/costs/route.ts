// app/api/costs/route.ts
export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { sql } from '@/app/lib/db';

export async function POST(req: Request) {
  try {
    const { subscriptionId, period, amount, source } = await req.json();

    if (!subscriptionId || !period || typeof amount !== 'number') {
      return NextResponse.json({ error: 'subscriptionId, period, amount are required' }, { status: 400 });
    }

    const db = sql();

    await db`
      INSERT INTO subscription_costs (subscription_id, period, amount, source)
      VALUES (${subscriptionId}, ${period}, ${amount}, ${source || 'manual'})
      ON CONFLICT (subscription_id, period)
      DO UPDATE SET amount = EXCLUDED.amount, source = EXCLUDED.source;
    `;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
