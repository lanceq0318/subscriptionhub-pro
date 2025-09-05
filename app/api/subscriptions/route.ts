// app/api/subscriptions/route.ts
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { rows: subscriptions } = await sql<{
      id: number;
      company: string;
      service: string;
      cost: string; // numeric comes back as string
      billing: 'monthly' | 'yearly' | 'quarterly';
      next_billing: string | null;
      contract_end: string | null;
      category: string | null;
      manager: string | null;
      renewal_alert: number;
      status: 'active' | 'pending' | 'cancelled';
      payment_method: string | null;
      notes: string | null;
      last_payment_status: 'paid' | 'pending' | 'overdue';
      created_at: string;
      updated_at: string;
      tags: string[] | null;
      attachment_count: string; // count returns as string
      payments: {
        id: number;
        date: string;
        amount: string;
        status: 'paid' | 'pending' | 'overdue';
        method: string | null;
        reference: string | null;
      }[] | null;
    }>`
      SELECT 
        s.*,
        ARRAY_AGG(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL) AS tags,
        COUNT(DISTINCT a.id) AS attachment_count,
        JSON_AGG(DISTINCT JSONB_BUILD_OBJECT(
          'id', p.id,
          'date', p.payment_date,
          'amount', p.amount,
          'status', p.status,
          'method', p.method,
          'reference', p.reference
        )) FILTER (WHERE p.id IS NOT NULL) AS payments
      FROM subscriptions s
      LEFT JOIN subscription_tags t ON s.id = t.subscription_id
      LEFT JOIN attachments a ON s.id = a.subscription_id
      LEFT JOIN payments p ON s.id = p.subscription_id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `;

    // Normalize numeric strings to numbers where it helps the client
    const normalized = subscriptions.map((s) => ({
      ...s,
      cost: Number(s.cost),
      attachment_count: Number(s.attachment_count),
    }));

    return NextResponse.json(normalized);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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
      notes,
      tags,
      lastPaymentStatus,
    } = body as {
      company: string;
      service: string;
      cost: number;
      billing: 'monthly' | 'yearly' | 'quarterly';
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

    // Insert subscription
    const { rows } = await sql<{ id: number }>`
      INSERT INTO subscriptions (
        company, service, cost, billing, next_billing, contract_end,
        category, manager, renewal_alert, status, payment_method,
        notes, last_payment_status
      ) VALUES (
        ${company}, ${service}, ${cost}, ${billing},
        ${nextBilling || null}, ${contractEnd || null},
        ${category || null}, ${manager || null},
        ${renewalAlert ?? 30}, ${status || 'active'},
        ${paymentMethod || null}, ${notes || null},
        ${lastPaymentStatus || 'pending'}
      )
      RETURNING id
    `;

    const subscriptionId = rows[0].id;

    // Insert tags (best-effort; if this fails the subscription still exists)
    if (Array.isArray(tags) && tags.length > 0) {
      for (const tag of tags) {
        await sql`
          INSERT INTO subscription_tags (subscription_id, tag)
          VALUES (${subscriptionId}, ${tag})
        `;
      }
    }

    return NextResponse.json({ id: subscriptionId, ...body });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}
