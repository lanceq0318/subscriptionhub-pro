import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  try {
    // Create subscriptions table with all fields including new financial ones
    const { error: subscriptionsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS subscriptions (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          company VARCHAR(200) NOT NULL,
          name VARCHAR(200) NOT NULL,
          cost DECIMAL(10, 2) NOT NULL,
          renewal_date DATE,
          status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
          category VARCHAR(100),
          payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue')),
          description TEXT,
          department VARCHAR(100),
          cost_center VARCHAR(50),
          vendor VARCHAR(200),
          account_number VARCHAR(100),
          auto_renew BOOLEAN DEFAULT false,
          budget DECIMAL(10, 2),
          contract_start_date DATE,
          contract_end_date DATE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    })

    if (subscriptionsError) {
      console.error('Error creating subscriptions table:', subscriptionsError)
      throw subscriptionsError
    }

    // Create payments table
    const { error: paymentsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS payments (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
          amount DECIMAL(10, 2) NOT NULL,
          payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          payment_method VARCHAR(50) DEFAULT 'credit_card' CHECK (payment_method IN ('credit_card', 'bank_transfer', 'check', 'cash', 'other')),
          invoice_number VARCHAR(100) UNIQUE,
          payment_reference VARCHAR(200),
          notes TEXT,
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    })

    if (paymentsError) {
      console.error('Error creating payments table:', paymentsError)
      throw paymentsError
    }

    // Create financial_reports table
    const { error: reportsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS financial_reports (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name VARCHAR(200) NOT NULL,
          period VARCHAR(20) CHECK (period IN ('monthly', 'quarterly', 'yearly', 'custom')),
          start_date DATE,
          end_date DATE,
          report_data JSONB,
          created_by VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    })

    if (reportsError) {
      console.error('Error creating financial_reports table:', reportsError)
      throw reportsError
    }

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON subscriptions(company)',
      'CREATE INDEX IF NOT EXISTS idx_subscriptions_department ON subscriptions(department)',
      'CREATE INDEX IF NOT EXISTS idx_subscriptions_vendor ON subscriptions(vendor)',
      'CREATE INDEX IF NOT EXISTS idx_subscriptions_cost_center ON subscriptions(cost_center)',
      'CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)',
      'CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_status ON subscriptions(payment_status)',
      'CREATE INDEX IF NOT EXISTS idx_subscriptions_category ON subscriptions(category)',
      'CREATE INDEX IF NOT EXISTS idx_subscriptions_renewal_date ON subscriptions(renewal_date)',
      'CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments(subscription_id)',
      'CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date)',
      'CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)',
      'CREATE INDEX IF NOT EXISTS idx_payments_invoice_number ON payments(invoice_number)',
      'CREATE INDEX IF NOT EXISTS idx_financial_reports_created_at ON financial_reports(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_financial_reports_period ON financial_reports(period)'
    ]

    for (const index of indexes) {
      const { error } = await supabase.rpc('exec_sql', { sql: index })
      if (error) {
        console.error(`Error creating index: ${index}`, error)
      }
    }

    // Create views for common queries
    const { error: viewError1 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE VIEW subscription_summary AS
        SELECT 
          s.*,
          COUNT(p.id) as payment_count,
          SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END) as total_paid,
          MAX(p.payment_date) as last_payment_date
        FROM subscriptions s
        LEFT JOIN payments p ON s.id = p.subscription_id
        GROUP BY s.id;
      `
    })

    if (viewError1) {
      console.error('Error creating subscription_summary view:', viewError1)
    }

    const { error: viewError2 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE VIEW department_spending AS
        SELECT 
          department,
          COUNT(DISTINCT id) as subscription_count,
          SUM(CASE WHEN status = 'active' THEN cost ELSE 0 END) as monthly_spend,
          SUM(budget) as total_budget
        FROM subscriptions
        WHERE department IS NOT NULL
        GROUP BY department;
      `
    })

    if (viewError2) {
      console.error('Error creating department_spending view:', viewError2)
    }

    const { error: viewError3 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE VIEW vendor_summary AS
        SELECT 
          vendor,
          COUNT(DISTINCT s.id) as subscription_count,
          SUM(CASE WHEN s.status = 'active' THEN s.cost ELSE 0 END) as monthly_spend,
          COUNT(DISTINCT p.id) as payment_count,
          SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END) as total_paid
        FROM subscriptions s
        LEFT JOIN payments p ON s.id = p.subscription_id
        WHERE vendor IS NOT NULL
        GROUP BY vendor;
      `
    })

    if (viewError3) {
      console.error('Error creating vendor_summary view:', viewError3)
    }

    // Create trigger function for updated_at
    const { error: triggerFuncError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `
    })

    if (triggerFuncError) {
      console.error('Error creating trigger function:', triggerFuncError)
    }

    // Create triggers for updated_at columns
    const triggers = [
      `CREATE TRIGGER update_subscriptions_updated_at 
        BEFORE UPDATE ON subscriptions 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_payments_updated_at 
        BEFORE UPDATE ON payments 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column()`
    ]

    for (const trigger of triggers) {
      const { error } = await supabase.rpc('exec_sql', { sql: trigger })
      if (error) {
        console.error(`Error creating trigger: ${trigger}`, error)
      }
    }

    // Enable Row Level Security (RLS)
    const rlsTables = ['subscriptions', 'payments', 'financial_reports']
    
    for (const table of rlsTables) {
      const { error } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`
      })
      if (error) {
        console.error(`Error enabling RLS for ${table}:`, error)
      }
    }

    // Create RLS policies
    const policies = [
      {
        table: 'subscriptions',
        name: 'Enable all operations for authenticated users',
        sql: `CREATE POLICY "Enable all operations for authenticated users" ON subscriptions
              FOR ALL USING (auth.role() = 'authenticated')`
      },
      {
        table: 'payments',
        name: 'Enable all operations for authenticated users',
        sql: `CREATE POLICY "Enable all operations for authenticated users" ON payments
              FOR ALL USING (auth.role() = 'authenticated')`
      },
      {
        table: 'financial_reports',
        name: 'Enable all operations for authenticated users',
        sql: `CREATE POLICY "Enable all operations for authenticated users" ON financial_reports
              FOR ALL USING (auth.role() = 'authenticated')`
      }
    ]

    for (const policy of policies) {
      const { error } = await supabase.rpc('exec_sql', { sql: policy.sql })
      if (error && !error.message?.includes('already exists')) {
        console.error(`Error creating policy for ${policy.table}:`, error)
      }
    }

    // Insert sample data (optional - for testing)
    const { error: sampleDataError } = await supabase
      .from('subscriptions')
      .upsert([
        {
          company: 'Acme Corp',
          name: 'Microsoft 365 Business',
          cost: 1250.00,
          renewal_date: '2025-03-01',
          status: 'active',
          category: 'Software',
          payment_status: 'paid',
          description: 'Business productivity suite',
          department: 'IT',
          cost_center: 'IT-001',
          vendor: 'Microsoft',
          account_number: 'MS-12345',
          auto_renew: true,
          budget: 15000.00,
          contract_start_date: '2024-03-01',
          contract_end_date: '2025-03-01'
        },
        {
          company: 'Acme Corp',
          name: 'Slack Enterprise',
          cost: 850.00,
          renewal_date: '2025-02-15',
          status: 'active',
          category: 'Communication',
          payment_status: 'paid',
          description: 'Team communication platform',
          department: 'Operations',
          cost_center: 'OPS-001',
          vendor: 'Slack Technologies',
          account_number: 'SLK-67890',
          auto_renew: true,
          budget: 10200.00,
          contract_start_date: '2024-02-15',
          contract_end_date: '2025-02-15'
        },
        {
          company: 'TechStart Inc',
          name: 'AWS Cloud Services',
          cost: 3500.00,
          renewal_date: '2025-01-31',
          status: 'active',
          category: 'Infrastructure',
          payment_status: 'pending',
          description: 'Cloud hosting and services',
          department: 'Engineering',
          cost_center: 'ENG-001',
          vendor: 'Amazon Web Services',
          account_number: 'AWS-11111',
          auto_renew: false,
          budget: 42000.00,
          contract_start_date: '2024-01-31',
          contract_end_date: '2025-01-31'
        }
      ], { onConflict: 'company,name' })

    if (sampleDataError) {
      console.error('Error inserting sample data:', sampleDataError)
    }

    // Add sample payments for testing
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('id, cost')
      .limit(3)

    if (subs && subs.length > 0) {
      const samplePayments = subs.map((sub, index) => ({
        subscription_id: sub.id,
        amount: sub.cost,
        payment_date: new Date(Date.now() - (index * 30 * 24 * 60 * 60 * 1000)).toISOString(),
        payment_method: ['credit_card', 'bank_transfer', 'check'][index % 3],
        invoice_number: `INV-2025-${String(index + 1).padStart(4, '0')}`,
        payment_reference: `PAY-${Date.now()}-${index}`,
        notes: `Payment for subscription - Month ${index + 1}`,
        status: 'completed'
      }))

      const { error: paymentError } = await supabase
        .from('payments')
        .upsert(samplePayments, { onConflict: 'invoice_number' })

      if (paymentError) {
        console.error('Error inserting sample payments:', paymentError)
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Database initialized successfully with financial features',
      tables: ['subscriptions', 'payments', 'financial_reports'],
      views: ['subscription_summary', 'department_spending', 'vendor_summary']
    })

  } catch (error) {
    console.error('Database initialization error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize database', details: error },
      { status: 500 }
    )
  }
}

// Optional: GET endpoint to check database status
export async function GET() {
  try {
    // Check if tables exist
    const tables = ['subscriptions', 'payments', 'financial_reports']
    const tableStatus = {}

    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })

      tableStatus[table] = {
        exists: !error,
        rowCount: count || 0,
        error: error?.message
      }
    }

    // Check views
    const views = ['subscription_summary', 'department_spending', 'vendor_summary']
    const viewStatus = {}

    for (const view of views) {
      const { error } = await supabase
        .from(view)
        .select('*')
        .limit(1)

      viewStatus[view] = {
        exists: !error,
        error: error?.message
      }
    }

    return NextResponse.json({
      status: 'Database status check',
      tables: tableStatus,
      views: viewStatus,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json(
      { error: 'Failed to check database status', details: error },
      { status: 500 }
    )
  }
}