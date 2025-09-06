// app/api/db/migrate-variable-costs/route.ts
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 1) Add pricing_type to subscriptions
    await sql`
      ALTER TABLE subscriptions
      ADD COLUMN IF NOT EXISTS pricing_type text NOT NULL DEFAULT 'fixed'
    `;

    // 2) Create monthly actuals table
    await sql`
      CREATE TABLE IF NOT EXISTS subscription_costs (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
        period DATE NOT NULL,                          -- first day of the month
        amount NUMERIC(12,2) NOT NULL,
        currency TEXT DEFAULT 'USD',
        source TEXT DEFAULT 'manual',                  -- manual | import | api
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // 3) Helpful indexes
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uniq_costs_subscription_period ON subscription_costs(subscription_id, period)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_costs_period ON subscription_costs(period)`;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('migrate-variable-costs error:', e);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}
