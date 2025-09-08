// app/api/subscriptions/[id]/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { rows } = await sql`
      SELECT * FROM subscriptions 
      WHERE id = ${params.id}
    `;
    
    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Failed to fetch subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
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
      tags,
      notes,
      pricingType,
      lastPaymentStatus,
    } = body;

    // Convert dates to strings or null
    const nextBillingStr = nextBilling ? String(nextBilling) : null;
    const contractEndStr = contractEnd ? String(contractEnd) : null;

    await sql`
      UPDATE subscriptions
      SET 
        company=${company},
        service=${service},
        cost=${cost},
        billing=${billing},
        next_billing=${nextBillingStr},
        contract_end=${contractEndStr},
        category=${category},
        manager=${manager},
        renewal_alert=${renewalAlert},
        status=${status},
        payment_method=${paymentMethod},
        tags=${JSON.stringify(tags || [])},
        notes=${notes},
        pricing_type=${pricingType || 'fixed'},
        last_payment_status=${lastPaymentStatus}
      WHERE id = ${params.id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update subscription:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await sql`
      DELETE FROM subscription