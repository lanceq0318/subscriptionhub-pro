import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const subscriptionId = searchParams.get('subscriptionId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = supabase
      .from('payments')
      .select(`
        *,
        subscriptions (
          company,
          name,
          department,
          vendor
        )
      `)

    if (subscriptionId) {
      query = query.eq('subscription_id', subscriptionId)
    }

    if (startDate) {
      query = query.gte('payment_date', startDate)
    }

    if (endDate) {
      query = query.lte('payment_date', endDate)
    }

    const { data, error } = await query.order('payment_date', { ascending: false })

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.subscriptionId || !body.amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Generate invoice number if not provided
    const invoiceNumber = body.invoiceNumber || `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    const { data, error } = await supabase
      .from('payments')
      .insert([{
        subscription_id: body.subscriptionId,
        amount: body.amount,
        payment_date: body.paymentDate || new Date().toISOString(),
        payment_method: body.paymentMethod || 'credit_card',
        invoice_number: invoiceNumber,
        payment_reference: body.paymentReference,
        notes: body.notes,
        status: body.status || 'pending'
      }])
      .select()
      .single()

    if (error) throw error

    // Update subscription payment status if needed
    if (body.status === 'completed') {
      await supabase
        .from('subscriptions')
        .update({ 
          payment_status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', body.subscriptionId)
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error creating payment:', error)
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json(
        { error: 'Missing payment ID' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('payments')
      .update({
        amount: body.amount,
        payment_date: body.paymentDate,
        payment_method: body.paymentMethod,
        invoice_number: body.invoiceNumber,
        payment_reference: body.paymentReference,
        notes: body.notes,
        status: body.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', body.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating payment:', error)
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Missing payment ID' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting payment:', error)
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 })
  }
}