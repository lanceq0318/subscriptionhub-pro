import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    const body = await request.json();
    const {
      company, service, cost, billing, nextBilling, contractEnd,
      category, manager, renewalAlert, status, paymentMethod,
      notes, tags, lastPaymentStatus
    } = body;

    await sql.begin(async (tx) => {
      // Update subscription
      await tx`
        UPDATE subscriptions
        SET company = ${company},
            service = ${service},
            cost = ${cost},
            billing = ${billing},
            next_billing = ${nextBilling || null},
            contract_end = ${contractEnd || null},
            category = ${category || null},
            manager = ${manager || null},
            renewal_alert = ${renewalAlert || 30},
            status = ${status || 'active'},
            payment_method = ${paymentMethod || null},
            notes = ${notes || null},
            last_payment_status = ${lastPaymentStatus || 'pending'},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id};
      `;

      // Replace tags
      await tx`DELETE FROM subscription_tags WHERE subscription_id = ${id};`;

      if (Array.isArray(tags) && tags.length > 0) {
        for (const tag of tags) {
          await tx`
            INSERT INTO subscription_tags (subscription_id, tag)
            VALUES (${id}, ${tag});
          `;
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    await sql`DELETE FROM subscriptions WHERE id = ${id};`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
  }
}
