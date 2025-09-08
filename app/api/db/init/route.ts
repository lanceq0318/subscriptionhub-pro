// app/api/db/init/route.ts
export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { sql } from '@/app/lib/db';

export async function POST() {
  try {
    const db = sql();

    // subscriptions
    await db`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id                SERIAL PRIMARY KEY,
        company           TEXT NOT NULL,
        service           TEXT NOT NULL,
        cost              NUMERIC NOT NULL,
        billing           TEXT NOT NULL CHECK (billing IN ('monthly','yearly','quarterly')),
        next_billing      DATE,
        contract_end      DATE,
        category          TEXT,
        manager           TEXT,
        renewal_alert     INT NOT NULL DEFAULT 30,
        status            TEXT NOT NULL CHECK (status IN ('active','pending','cancelled')),
        payment_method    TEXT NOT NULL,
        tags              JSONB NOT NULL DEFAULT '[]'::jsonb,
        notes             TEXT,
        last_payment_status TEXT CHECK (last_payment_status IN ('paid','pending','overdue')),
        pricing_type      TEXT CHECK (pricing_type IN ('fixed','variable')),
        department        TEXT,
        cost_center       TEXT,
        vendor            TEXT,
        account_number    TEXT,
        auto_renew        BOOLEAN DEFAULT FALSE,
        budget            NUMERIC
      );
    `;

    // payments
    await db`
      CREATE TABLE IF NOT EXISTS payments (
        id               BIGSERIAL PRIMARY KEY,
        subscription_id  INT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
        date             TIMESTAMPTZ NOT NULL DEFAULT now(),
        amount           NUMERIC NOT NULL,
        status           TEXT NOT NULL CHECK (status IN ('paid','pending','overdue')),
        method           TEXT,
        reference        TEXT,
        invoice_number   TEXT,
        notes            TEXT
      );
    `;

    // per-month actuals for variable/fixed subs
    await db`
      CREATE TABLE IF NOT EXISTS subscription_costs (
        id               BIGSERIAL PRIMARY KEY,
        subscription_id  INT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
        period           DATE NOT NULL,
        amount           NUMERIC NOT NULL,
        source           TEXT DEFAULT 'manual'
      );
    `;
    await db`
      CREATE UNIQUE INDEX IF NOT EXISTS subscription_costs_uniq
      ON subscription_costs (subscription_id, period);
    `;

    return NextResponse.json({ ok: true, created: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
