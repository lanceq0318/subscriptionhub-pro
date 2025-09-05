// app/api/subscriptions/[id]/route.ts
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number.parseInt(params.id, 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

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
      notes,
      tags,
      lastPaymentStatus,
    } = body as {
      company?: string;
      service?: string;
      cost?: number;
      billing?: 'monthly' | 'yearly' | 'quarterly';
      nextBilling?: string | null;
      contractEnd?: string | null;
      category?: string | null;
      manager?: string | null;
      renewalAlert?: number;
      status?: 'active' | 'pending' | 'cancelled';
      paymentMethod?: string | null;
      notes?: string | null;
      tags?: string[];
      lastPaymentStatus?: 'paid' | 'pending' | 'overdue';
    };

    // Update subscription row
    await sql`
      UPDATE subscriptions
      SET
        company = ${company},
        service = ${service},
        cost = ${cost},
        billing = ${billing},
        next_billing = ${nextBilling || null},
        contract_end = ${contractEnd || null},
        category = ${category || null},
        manager = ${manager || null},
        renewal_alert = ${renewalAlert ?? 30},
        status = ${status || 'active'},
        payment_method = ${paymentMethod || null},
        notes = ${notes || null},
        last_payment_status = ${lastPaymentStatus || 'pending'},
        updated_at = NOW()
      WHERE id = ${id}
    `;

    // Replace tags
    await sql`DELETE FROM subscription_tags WHERE subscription_id = ${id}`;
    if (Array.isArray(tags) && tags.length > 0) {
      for (const tag of tags) {
        await sql`
          INSERT INTO subscription_tags (subscription_id, tag)
          VALUES (${id}, ${tag})
        `;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    );
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

    // ON DELETE CASCADE on FKs will clean up related rows
    await sql`DELETE FROM subscriptions WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    return NextResponse.json(
      { error: 'Failed to delete subscription' },
      { status: 500 }
    );
  }
}
