import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
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
        notes TEXT,
        last_payment_status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS subscription_tags (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE CASCADE,
        tag VARCHAR(50) NOT NULL
      );
    `;

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

    await sql`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        payment_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL,
        method VARCHAR(50),
        reference VARCHAR(100)
      );
    `;

    -- helpful indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON subscriptions(next_billing);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_last_payment_status ON subscriptions(last_payment_status);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON subscriptions(company);`;

    return NextResponse.json({ message: 'Database initialized successfully' });
  } catch (error) {
    console.error('Database initialization error:', error);
    return NextResponse.json({ error: 'Failed to initialize database' }, { status: 500 });
  }
}
