// app/api/db/init/route.ts
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
<<<<<<< HEAD
    // Core tables
=======
    // Create subscriptions table
>>>>>>> parent of b79e0e7 (Complete subscription tracker with authentication and database)
    await sql`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        company TEXT NOT NULL,
        service TEXT NOT NULL,
        cost NUMERIC(12,2) NOT NULL DEFAULT 0,
        billing TEXT NOT NULL CHECK (billing IN ('monthly','yearly','quarterly')),
        next_billing DATE,
        contract_end DATE,
<<<<<<< HEAD
        category TEXT,
        manager TEXT,
        renewal_alert INTEGER NOT NULL DEFAULT 30,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','cancelled')),
        payment_method TEXT,
=======
        category VARCHAR(50),
        manager VARCHAR(100),
        renewal_alert INTEGER DEFAULT 30,
        status VARCHAR(20) DEFAULT 'active',
        payment_method VARCHAR(50),
        usage INTEGER,
>>>>>>> parent of b79e0e7 (Complete subscription tracker with authentication and database)
        notes TEXT,
        last_payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (last_payment_status IN ('paid','pending','overdue')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

<<<<<<< HEAD
    // Make sure legacy column is gone (frontend & routes no longer use it)
    await sql`ALTER TABLE subscriptions DROP COLUMN IF EXISTS usage;`;

=======
    // Create tags table
>>>>>>> parent of b79e0e7 (Complete subscription tracker with authentication and database)
    await sql`
      CREATE TABLE IF NOT EXISTS subscription_tags (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
        tag TEXT NOT NULL
      );
    `;

    // Create attachments table
    await sql`
      CREATE TABLE IF NOT EXISTS attachments (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('contract','invoice','other')),
        size INTEGER,
        upload_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        mime_type TEXT,
        data BYTEA
      );
    `;

    // Create payments table
    await sql`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
        payment_date DATE NOT NULL,
        amount NUMERIC(12,2) NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('paid','pending','overdue')),
        method TEXT,
        reference TEXT
      );
    `;

<<<<<<< HEAD
    // Helpful indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON subscriptions(next_billing);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_last_payment_status ON subscriptions(last_payment_status);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON subscriptions(created_at);`;

    await sql`CREATE INDEX IF NOT EXISTS idx_subscription_tags_subscription_id ON subscription_tags(subscription_id);`;

    await sql`CREATE INDEX IF NOT EXISTS idx_attachments_subscription_id ON attachments(subscription_id);`;

    await sql`CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments(subscription_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);`;

    return NextResponse.json({ ok: true, message: 'Database initialized/updated' });
  } catch (err) {
    console.error('Error initializing database:', err);
    return NextResponse.json(
      { error: 'Failed to initialize database' },
      { status: 500 }
    );
=======
    return NextResponse.json({ message: 'Database initialized successfully' });
  } catch (error) {
    console.error('Database initialization error:', error);
    return NextResponse.json({ error: 'Failed to initialize database' }, { status: 500 });
>>>>>>> parent of b79e0e7 (Complete subscription tracker with authentication and database)
  }
}