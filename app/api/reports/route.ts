import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'monthly'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const department = searchParams.get('department')
    const category = searchParams.get('category')

    // Fetch subscriptions with payments
    let query = supabase
      .from('subscriptions')
      .select(`
        *,
        payments (
          amount,
          payment_date,
          status
        )
      `)

    if (department) {
      query = query.eq('department', department)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data: subscriptions, error } = await query

    if (error) throw error

    // Process data for reporting
    const report = generateFinancialReport(subscriptions || [], {
      period,
      startDate: startDate || getDefaultStartDate(period),
      endDate: endDate || new Date().toISOString(),
    })

    return NextResponse.json(report)
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}

function generateFinancialReport(subscriptions: any[], options: any) {
  const { period, startDate, endDate } = options

  // Calculate totals
  const totalActiveSubscriptions = subscriptions.filter(s => s.status === 'active').length
  const totalMonthlySpend = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + (s.cost || 0), 0)
  
  const totalAnnualBudget = subscriptions.reduce((sum, s) => sum + (s.budget || 0), 0)
  
  // Calculate payments in period
  const paymentsInPeriod = subscriptions.flatMap(s => 
    (s.payments || []).filter((p: any) => 
      p.status === 'completed' &&
      p.payment_date >= startDate &&
      p.payment_date <= endDate
    )
  )
  
  const totalPaidInPeriod = paymentsInPeriod.reduce((sum, p) => sum + p.amount, 0)

  // Group by department
  const departmentBreakdown = subscriptions.reduce((acc, sub) => {
    const dept = sub.department || 'Unassigned'
    if (!acc[dept]) {
      acc[dept] = {
        count: 0,
        monthlySpend: 0,
        annualBudget: 0,
        paidInPeriod: 0
      }
    }
    
    acc[dept].count++
    if (sub.status === 'active') {
      acc[dept].monthlySpend += sub.cost || 0
    }
    acc[dept].annualBudget += sub.budget || 0
    
    // Add payments for this subscription in period
    const subPayments = (sub.payments || [])
      .filter((p: any) => 
        p.status === 'completed' &&
        p.payment_date >= startDate &&
        p.payment_date <= endDate
      )
      .reduce((sum: number, p: any) => sum + p.amount, 0)
    
    acc[dept].paidInPeriod += subPayments
    
    return acc
  }, {} as any)

  // Group by category
  const categoryBreakdown = subscriptions.reduce((acc, sub) => {
    const cat = sub.category || 'Other'
    if (!acc[cat]) {
      acc[cat] = {
        count: 0,
        monthlySpend: 0,
        annualBudget: 0,
        paidInPeriod: 0
      }
    }
    
    acc[cat].count++
    if (sub.status === 'active') {
      acc[cat].monthlySpend += sub.cost || 0
    }
    acc[cat].annualBudget += sub.budget || 0
    
    // Add payments for this subscription in period
    const subPayments = (sub.payments || [])
      .filter((p: any) => 
        p.status === 'completed' &&
        p.payment_date >= startDate &&
        p.payment_date <= endDate
      )
      .reduce((sum: number, p: any) => sum + p.amount, 0)
    
    acc[cat].paidInPeriod += subPayments
    
    return acc
  }, {} as any)

  // Group by vendor
  const vendorBreakdown = subscriptions.reduce((acc, sub) => {
    const vendor = sub.vendor || 'Unknown Vendor'
    if (!acc[vendor]) {
      acc[vendor] = {
        count: 0,
        monthlySpend: 0,
        totalPaid: 0,
        subscriptions: []
      }
    }
    
    acc[vendor].count++
    if (sub.status === 'active') {
      acc[vendor].monthlySpend += sub.cost || 0
    }
    
    const totalPaid = (sub.payments || [])
      .filter((p: any) => p.status === 'completed')
      .reduce((sum: number, p: any) => sum + p.amount, 0)
    
    acc[vendor].totalPaid += totalPaid
    acc[vendor].subscriptions.push(sub.name)
    
    return acc
  }, {} as any)

  // Calculate budget utilization
  const budgetUtilization = totalAnnualBudget > 0 
    ? (totalPaidInPeriod / totalAnnualBudget) * 100 
    : 0

  // Top spending categories
  const topCategories = Object.entries(categoryBreakdown)
    .sort((a: any, b: any) => b[1].monthlySpend - a[1].monthlySpend)
    .slice(0, 5)
    .map(([name, data]: any) => ({
      name,
      monthlySpend: data.monthlySpend,
      count: data.count
    }))

  // Top vendors
  const topVendors = Object.entries(vendorBreakdown)
    .sort((a: any, b: any) => b[1].totalPaid - a[1].totalPaid)
    .slice(0, 5)
    .map(([name, data]: any) => ({
      name,
      totalPaid: data.totalPaid,
      count: data.count
    }))

  return {
    period,
    dateRange: {
      start: startDate,
      end: endDate
    },
    summary: {
      totalActiveSubscriptions,
      totalMonthlySpend,
      totalAnnualBudget,
      totalPaidInPeriod,
      budgetUtilization,
      averageCostPerSubscription: totalActiveSubscriptions > 0 
        ? totalMonthlySpend / totalActiveSubscriptions 
        : 0
    },
    breakdowns: {
      byDepartment: departmentBreakdown,
      byCategory: categoryBreakdown,
      byVendor: vendorBreakdown
    },
    topMetrics: {
      topCategories,
      topVendors
    },
    generatedAt: new Date().toISOString()
  }
}

function getDefaultStartDate(period: string): string {
  const now = new Date()
  switch (period) {
    case 'monthly':
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    case 'quarterly':
      const quarter = Math.floor(now.getMonth() / 3)
      return new Date(now.getFullYear(), quarter * 3, 1).toISOString()
    case 'yearly':
      return new Date(now.getFullYear(), 0, 1).toISOString()
    default:
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Save report for future reference
    const { data, error } = await supabase
      .from('financial_reports')
      .insert([{
        name: body.name || `Report - ${new Date().toLocaleDateString()}`,
        period: body.period,
        start_date: body.startDate,
        end_date: body.endDate,
        report_data: body.reportData,
        created_by: body.createdBy || 'System',
        created_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error saving report:', error)
    return NextResponse.json({ error: 'Failed to save report' }, { status: 500 })
  }
}