// app/api/subscriptions/[id]/route.ts
export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { sql } from '@/app/lib/db';

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  try {
    const id = Number(ctx.params.id);
    const body = await req.json();
    const db = sql();

    const {
      company, service, cost, billing,
      nextBilling, contractEnd, category, manager,
      renewalAlert, status, paymentMethod,
      tags = [], notes = null,
      lastPaymentStatus, pricingType,
      department, costCenter, vendor, accountNumber,
      autoRenew, budget
    } = body;

    await db`
      UPDATE subscriptions
         SET company = ${company},
             service = ${service},
             cost = ${cost},
             billing = ${billing},
             next_billing = ${nextBilling || null},
             contract_end = ${contractEnd || null},
             category = ${category || null},
             manager = ${manager || null},
             renewal_alert = ${renewalAlert},
             status = ${status},
             payment_method = ${paymentMethod},
             tags = ${JSON.stringify(tags)}::jsonb,
             notes = ${notes},
             last_payment_status = ${lastPaymentStatus},
             pricing_type = ${pricingType},
             department = ${department},
             cost_center = ${costCenter},
             vendor = ${vendor},
             account_number = ${accountNumber},
             auto_renew = ${autoRenew},
             budget = ${budget}
       WHERE id = ${id};
    `;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  try {
    const id = Number(ctx.params.id);
    const db = sql();
    await db`DELETE FROM subscriptions WHERE id = ${id};`;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
