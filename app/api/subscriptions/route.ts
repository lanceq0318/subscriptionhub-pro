import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { rows: subscriptions } = await sql`
      SELECT 
        s.*,
        array_agg(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL) as tags,
        COUNT(DISTINCT a.id) as attachment_count,
        json_agg(DISTINCT jsonb_build_object(
          'id', p.id,
          'date', p.payment_date,
          'amount', p.amount,
          'status', p.status,
          'method', p.method,
          'reference', p.reference
        )) FILTER (WHERE p.id IS NOT NULL) as payments
      FROM subscriptions s
      LEFT JOIN subscription_tags t ON s.id = t.subscription_id
      LEFT JOIN attachments a ON s.id = a.subscription_id
      LEFT JOIN payments p ON s.id = p.subscription_id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `;

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      company, service, cost, billing, nextBilling, contractEnd,
      category, manager, renewalAlert, status, paymentMethod,
      usage, notes, tags, lastPaymentStatus
    } = body;

    // Insert subscription
    const { rows } = await sql`
      INSERT INTO subscriptions (
        company, service, cost, billing, next_billing, contract_end,
        category, manager, renewal_alert, status, payment_method,
        usage, notes, last_payment_status
      ) VALUES (
        ${company}, ${service}, ${cost}, ${billing}, ${nextBilling || null},
        ${contractEnd || null}, ${category || null}, ${manager || null},
        ${renewalAlert || 30}, ${status || 'active'}, ${paymentMethod || null},
        ${usage || null}, ${notes || null}, ${lastPaymentStatus || 'pending'}
      ) RETURNING id
    `;

    const subscriptionId = rows[0].id;

    // Insert tags
    if (tags && tags.length > 0) {
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
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}