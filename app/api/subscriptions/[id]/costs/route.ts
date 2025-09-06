// app/api/subscriptions/[id]/costs/route.ts
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

type UpsertCostBody = {
  period: string; // 'YYYY-MM-01' (first day of month)
  amount: number;
  currency?: string;
  source?: 'manual' | 'import' | 'api';
  notes?: string;
};

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number.parseInt(params.id, 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const { rows } = await sql<any>`
      SELECT id, period, amount, currency, source, notes, created_at AS "createdAt"
      FROM subscription_costs
      WHERE subscription_id = ${id}
      ORDER BY period DESC
    `;

    const normalized = rows.map((r: any) => ({
      ...r,
      amount: typeof r.amount === 'string' ? Number(r.amount) : r.amount,
    }));

    return NextResponse.json(normalized);
  } catch (e) {
    console.error('GET costs error:', e);
    return NextResponse.json({ error: 'Failed to fetch costs' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number.parseInt(params.id, 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const body = (await request.json()) as UpsertCostBody;
    if (!body?.period || typeof body.amount !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Normalize to first of month
    const d = new Date(body.period);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Invalid period date' }, { status: 400 });
    }
    const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;

    await sql`
      INSERT INTO subscription_costs (subscription_id, period, amount, currency, source, notes)
      VALUES (${id}, ${period}, ${body.amount}, ${body.currency || 'USD'}, ${body.source || 'manual'}, ${body.notes || null})
      ON CONFLICT (subscription_id, period)
      DO UPDATE SET
        amount = EXCLUDED.amount,
        currency = EXCLUDED.currency,
        source = EXCLUDED.source,
        notes = EXCLUDED.notes,
        created_at = NOW()
    `;

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('POST costs error:', e);
    return NextResponse.json({ error: 'Failed to upsert cost' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number.parseInt(params.id, 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period'); // 'YYYY-MM-01'
    if (!period) {
      return NextResponse.json({ error: 'period query param required' }, { status: 400 });
    }

    await sql`
      DELETE FROM subscription_costs
      WHERE subscription_id = ${id} AND period = ${period}
    `;

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('DELETE costs error:', e);
    return NextResponse.json({ error: 'Failed to delete cost' }, { status: 500 });
  }
}
