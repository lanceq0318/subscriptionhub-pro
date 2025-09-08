// app/api/subscriptions/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

type Row = {
  id: number;
  company: string;
  service: string;
  cost: number | string;
  billing: 'monthly' | 'quarterly' | 'yearly';
  nextBilling: string | null;
  contractEnd: string | null;
  category: string | null;
  manager: string | null;
  renewalAlert: number | null;
  status: 'active' | 'pending' | 'cancelled';
  paymentMethod: string | null;
  tags: string[] | null;
  notes: string | null;
  pricingType: 'fixed' | 'variable' | null;
  currentMonthCost: number | null;
  lastMonthCost: number | null;
  costHistory: { period: string; amount: number }[];
  payments: {
    id: number;
    date: string;
    amount: number;
    status: 'paid' | 'pending' | 'overdue';
    method: string | null;
    reference: string | null;
  }[];
  lastPaymentStatus: 'paid' | 'pending' | 'overdue' | null;
  attachment_count: number;
};

e// app/api/subscriptions/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

// ... your existing GET here ...

export async function POST(req: Request) {
  try {
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

    const { rows } = await sql<{ id: number }>`
      INSERT INTO subscriptions (
        company, service, cost, billing, next_billing, contract_end,
        category, manager, renewal_alert, status, payment_method, tags, notes,
        pricing_type, department, cost_center, vendor, account_number,
        auto_renew, budget, last_payment_status
      ) VALUES (
        ${company}, ${service}, ${cost}, ${billing}, ${nextBilling}, ${contractEnd},
        ${category}, ${manager}, ${renewalAlert}, ${status}, ${paymentMethod}, ${tags}, ${notes},
        ${pricingType}, ${department}, ${costCenter}, ${vendor}, ${accountNumber},
        ${autoRenew}, ${budget}, ${lastPaymentStatus}
      )
      RETURNING id;
    `;

    return NextResponse.json({ id: rows[0].id }, { status: 201 });
  } catch (err) {
    console.error('subscriptions POST error', err);
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}
