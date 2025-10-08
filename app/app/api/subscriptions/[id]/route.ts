import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { SubscriptionUpdateSchema, parseJson } from '@/app/lib/validation';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number.parseInt(params.id, 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const json = await parseJson<any>(request);
    const parsed = SubscriptionUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const {
      company, service, cost, billing,
      nextBilling, contractEnd, category, manager,
      renewalAlert, status, paymentMethod, tags, notes,
      lastPaymentStatus,
    } = parsed.data;

    await sql`
      UPDATE subscriptions
      SET
        company = COALESCE(${company}, company),
        service = COALESCE(${service}, service),
        cost = COALESCE(${cost}, cost),
        billing = COALESCE(${billing}, billing),
        next_billing = COALESCE(${nextBilling || null}, next_billing),
        contract_end = COALESCE(${contractEnd || null}, contract_end),
        category = COALESCE(${category || null}, category),
        manager = COALESCE(${manager || null}, manager),
        renewal_alert = COALESCE(${renewalAlert ?? null}, renewal_alert),
        status = COALESCE(${status || null}, status),
        payment_method = COALESCE(${paymentMethod || null}, payment_method),
        notes = COALESCE(${notes || null}, notes),
        last_payment_status = COALESCE(${lastPaymentStatus || null}, last_payment_status),
        updated_at = NOW()
      WHERE id = ${id}
    `;

    if (Array.isArray(tags)) {
      await sql`DELETE FROM subscription_tags WHERE subscription_id = ${id}`;
      if (tags.length) {
        for (const tag of tags) {
          await sql`
            INSERT INTO subscription_tags (subscription_id, tag)
            VALUES (${id}, ${tag})
          `;
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number.parseInt(params.id, 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    // Safe manual cascade
    await sql`DELETE FROM payments WHERE subscription_id = ${id}`;
    await sql`DELETE FROM attachments WHERE subscription_id = ${id}`;
    await sql`DELETE FROM subscription_tags WHERE subscription_id = ${id}`;
    await sql`DELETE FROM subscriptions WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
  }
}
