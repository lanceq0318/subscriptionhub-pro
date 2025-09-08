// app/api/subscriptions/[id]/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number.parseInt(params.id, 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const body = await req.json();

    // Required
    const company = String(body.company || '').trim();
    const service = String(body.service || '').trim();
    const cost = Number(body.cost);
    const billing: 'monthly' | 'quarterly' | 'yearly' =
      body.billing === 'yearly' || body.billing === 'quarterly' ? body.billing : 'monthly';
    if (!company || !service || !Number.isFinite(cost)) {
      return NextResponse.json({ error: 'Missing or invalid fields (company, service, cost)' }, { status: 400 });
    }

    // Optional / normalized
    const nextBilling = body.nextBilling ? new Date(body.nextBilling) : null;
    const contractEnd = body.contractEnd ? new Date(body.contractEnd) : null;
    const category = body.category ?? null;
    const manager = body.manager ?? null;
    const renewalAlert = Number.isFinite(Number(body.renewalAlert)) ? Number(body.renewalAlert) : 30;
    const status: 'active' | 'pending' | 'cancelled' =
      body.status === 'pending' || body.status === 'cancelled' ? body.status : 'active';
    const paymentMethod = body.paymentMethod ?? null;
    const tags: string[] | null = Array.isArray(body.tags) ? body.tags : null;
    const notes = body.notes ?? null;
    const pricingType: 'fixed' | 'variable' = body.pricingType === 'variable' ? 'variable' : 'fixed';
    const department = body.department ?? null;
    const costCenter = body.costCenter ?? null;
    const vendor = body.vendor ?? null;
    const accountNumber = body.accountNumber ?? null;
    const autoRenew = !!body.autoRenew;
    const budget = Number.isFinite(Number(body.budget)) ? Number(body.budget) : null;
    const lastPaymentStatus: 'paid' | 'pending' | 'overdue' =
      body.lastPaymentStatus === 'paid' || body.lastPaymentStatus === 'overdue'
        ? body.lastPaymentStatus
        : 'pending';

    const { rowCount } = await sql`
      UPDATE subscriptions SET
        company=${company},
        service=${service},
        cost=${cost},
        billing=${billing},
        next_billing=${nextBilling},
        contract_end=${contractEnd},
        category=${category},
        manager=${manager},
        renewal_alert=${renewalAlert},
        status=${status},
        payment_method=${paymentMethod},
        tags=${tags},
        notes=${notes},
        pricing_type=${pricingType},
        department=${department},
        cost_center=${costCenter},
        vendor=${vendor},
        account_number=${accountNumber},
        auto_renew=${autoRenew},
        budget=${budget},
        last_payment_status=${lastPaymentStatus}
      WHERE id=${id}
    `;
    if (rowCount === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ id });
  } catch (err) {
    console.error('subscriptions PUT error', err);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number.parseInt(params.id, 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }
    await sql`DELETE FROM subscriptions WHERE id=${id}`;
    return NextResponse.json({ id });
  } catch (err) {
    console.error('subscriptions DELETE error', err);
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
  }
}
