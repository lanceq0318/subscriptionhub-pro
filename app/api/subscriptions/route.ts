import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const runtime = 'nodejs';

type Row = {
  id: number;
  company: string;
  service: string;
  cost: string;                // numeric as string
  billing: string;
  next_billing: string | Date | null;
  contract_end: string | Date | null;
  category: string | null;
  manager: string | null;
  renewal_alert: number | null;
  status: string;
  payment_method: string | null;
  tags: unknown;
  notes: string | null;
  last_payment_status: string | null;
  pricing_type: string | null;
};

export async function GET() {
  try {
    // Ensure columns/tables we rely on exist (idempotent)
    await sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS pricing_type text;`;
    await sql`
      CREATE TABLE IF NOT EXISTS subscription_costs (
        id bigserial PRIMARY KEY,
        subscription_id integer NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
        period date NOT NULL,
        amount numeric(12,2) NOT NULL,
        source text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (subscription_id, period)
      );
    `;

    // Base subs
    const subsRes = await sql<Row>`
      SELECT id, company, service, cost, billing, next_billing, contract_end, category,
             manager, renewal_alert, status, payment_method, tags, notes,
             last_payment_status, pricing_type
      FROM subscriptions
      ORDER BY id DESC;
    `;

    // Load costs for last 13 months (so we can compute "current" + "last")
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 12, 1).toISOString().slice(0, 10);

    const costsRes = await sql<{ subscription_id: number; period: string; amount: string }>`
      SELECT subscription_id, period::text, amount::text
      FROM subscription_costs
      WHERE period >= ${start}
      ORDER BY subscription_id, period ASC;
    `;

    const bySub = new Map<number, Array<{ period: string; amount: number }>>();
    for (const r of costsRes.rows) {
      const arr = bySub.get(r.subscription_id) ?? [];
      arr.push({ period: r.period, amount: Number(r.amount) });
      bySub.set(r.subscription_id, arr);
    }

    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);

    const data = subsRes.rows.map((r) => {
      const hist = bySub.get(r.id) ?? [];
      const current = hist.find(h => h.period === firstOfThisMonth)?.amount ?? null;
      const last = hist.find(h => h.period === firstOfLastMonth)?.amount ?? null;

      // Normalize tags coming from jsonb or text[] or stringified JSON
      const tags = (() => {
        if (Array.isArray(r.tags)) return r.tags as string[];
        if (typeof r.tags === 'string') {
          try { return JSON.parse(r.tags) as string[]; } catch { return []; }
        }
        return [];
      })();

      return {
        id: r.id,
        company: r.company as 'Kisamos' | 'Mizzen' | 'Fertmax' | 'Shantaram' | 'Relia Ship',
        service: r.service,
        cost: Number(r.cost),
        billing: (r.billing as 'monthly' | 'yearly' | 'quarterly') ?? 'monthly',
        nextBilling: r.next_billing,
        contractEnd: r.contract_end,
        category: r.category ?? 'Software',
        manager: r.manager ?? '',
        renewalAlert: r.renewal_alert ?? 30,
        status: (r.status as 'active' | 'pending' | 'cancelled') ?? 'active',
        paymentMethod: r.payment_method ?? 'Credit Card',
        tags,
        notes: r.notes ?? '',
        lastPaymentStatus: (r.last_payment_status as 'paid' | 'pending' | 'overdue') ?? 'pending',
        pricingType: (r.pricing_type as 'fixed' | 'variable') ?? 'fixed',

        // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
        // NEW fields the UI reads to show variable-month figures:
        currentMonthCost: current,
        lastMonthCost: last,
        costHistory: hist,          // [{ period: 'YYYY-MM-01', amount: number }]
        // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

        // still optional in UI; safe default:
        attachment_count: 0
      };
    });

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('GET /api/subscriptions error', err);
    return NextResponse.json({ error: err?.message ?? 'Unexpected error' }, { status: 500 });
  }
}
