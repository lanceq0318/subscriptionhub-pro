import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { rows: subscriptions } = await sql`
      SELECT 
        s.*,
        array_agg(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL) AS tags,
        COUNT(DISTINCT a.id) AS attachment_count,
        json_agg(DISTINCT jsonb_build_object(
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
      ORDER BY s.created_at DESC;
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
      notes, tags, lastPaymentStatus
    } = body;

    let subscriptionId: number;

    // Use a transaction so the row + tags are atomic
    await sql.begin(async (tx) => {
      const { rows } = await tx`
        INSERT INTO subscriptions (
          company, service, cost, billing, next_billing, contract_end,
          category, manager, renewal_alert, status, payment_method,
          notes, last_payment_status
        ) VALUES (
          ${company}, ${service}, ${cost}, ${billing},
          ${nextBilling || null}, ${contractEnd || null},
          ${category || null}, ${manager || null}, ${renewalAlert || 30},
          ${status || 'active'}, ${paymentMethod || null},
          ${notes || null}, ${lastPaymentStatus || 'pending'}
        ) RETURNING id;
      `;
      subscriptionId = rows[0].id;

      if (Array.isArray(tags) && tags.length > 0) {
        for (const tag of tags) {
          await tx`
            INSERT INTO subscription_tags (subscription_id, tag)
            VALUES (${subscriptionId}, ${tag});
          `;
        }
      }
    });

    // Return the same aggregated shape as GET for consistency
    const { rows } = await sql`
      SELECT 
        s.*,
        array_agg(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL) AS tags,
        COUNT(DISTINCT a.id) AS attachment_count,
        json_agg(DISTINCT jsonb_build_object(
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
      WHERE s.id = ${subscriptionId}
      GROUP BY s.id;
    `;

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}
