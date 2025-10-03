// app/api/db/init/route.ts
export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { sql } from '@/app/lib/db';

export async function POST() {
  try {
<<<<<<< HEAD
<<<<<<< HEAD
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
=======
=======
>>>>>>> parent of b79e0e7 (Complete subscription tracker with authentication and database)
    // Create subscriptions table
    await sql`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        company VARCHAR(50) NOT NULL,
        service VARCHAR(255) NOT NULL,
        cost DECIMAL(10, 2) NOT NULL,
        billing VARCHAR(20) NOT NULL,
        next_billing DATE,
        contract_end DATE,
        category VARCHAR(50),
        manager VARCHAR(100),
        renewal_alert INTEGER DEFAULT 30,
        status VARCHAR(20) DEFAULT 'active',
        payment_method VARCHAR(50),
        usage INTEGER,
        notes TEXT,
        last_payment_status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create tags table
    await sql`
      CREATE TABLE IF NOT EXISTS subscription_tags (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE CASCADE,
        tag VARCHAR(50) NOT NULL
      );
    `;

    // Create attachments table
    await sql`
      CREATE TABLE IF NOT EXISTS attachments (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50),
        size INTEGER,
        mime_type VARCHAR(100),
        data TEXT,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create payments table
    await sql`
>>>>>>> parent of b79e0e7 (Complete subscription tracker with authentication and database)
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

<<<<<<< HEAD
<<<<<<< HEAD
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
=======
=======
>>>>>>> parent of b79e0e7 (Complete subscription tracker with authentication and database)
    return NextResponse.json({ message: 'Database initialized successfully' });
  } catch (error) {
    console.error('Database initialization error:', error);
    return NextResponse.json({ error: 'Failed to initialize database' }, { status: 500 });
>>>>>>> parent of b79e0e7 (Complete subscription tracker with authentication and database)
  }
}