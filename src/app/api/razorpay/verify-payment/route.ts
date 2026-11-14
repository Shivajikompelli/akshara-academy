import { type NextRequest } from 'next/server'
import crypto from 'node:crypto'
import { verifyApiAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { apiError, apiSuccess } from '@/lib/api-response'
import { ValidationError, NotFoundError } from '@/lib/errors'
import { getTodayIST } from '@/lib/formatters'

export async function POST(req: NextRequest) {
  try {
    // 1. Verify User Session & Manager Authorization
    const auth = await verifyApiAuth(req)
    if (!auth.authorized) {
      return auth.response
    }

    const body = await req.json()
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      fee_id,
      student_id,
      amount,
      paid_on,
      period,
      send_receipt = true,
      isMock = false,
    } = body

    if (!fee_id || !student_id || !amount || !razorpay_payment_id) {
      throw new ValidationError('Missing required payment details (fee_id, student_id, amount, razorpay_payment_id).')
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim()

    // 2. Verify Razorpay Signature if not in mock/simulation mode
    if (!isMock && keySecret) {
      if (!razorpay_order_id || !razorpay_signature) {
        throw new ValidationError('Order ID and signature are required for payment verification.')
      }

      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex')

      if (generatedSignature !== razorpay_signature) {
        console.error('Razorpay signature mismatch:', {
          generated: generatedSignature,
          received: razorpay_signature,
        })
        throw new ValidationError('Invalid Razorpay payment signature. Payment cannot be verified.')
      }
    }

    // 3. Database Clients
    const supabase = await createClient()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const dbClient = serviceRoleKey
      ? createAdminClient(supabaseUrl, serviceRoleKey)
      : supabase

    // Verify student exists
    const { data: student, error: studentErr } = await dbClient
      .from('students')
      .select('id, full_name, class_level, phone, whatsapp_opt_in')
      .eq('id', student_id)
      .single()

    if (studentErr || !student) {
      throw new NotFoundError('Student')
    }

    // 4. Insert Payment Record into fee_payments
    const paymentDate = paid_on || getTodayIST()
    const finalRef = razorpay_payment_id

    const { data: paymentRow, error: paymentErr } = await dbClient
      .from('fee_payments')
      .insert({
        fee_id,
        amount: Number(amount),
        paid_on: paymentDate,
        mode: 'upi',
        reference: finalRef,
        recorded_by: auth.user?.id || null,
      })
      .select('id')
      .single()

    if (paymentErr || !paymentRow) {
      console.error('Failed to insert fee payment:', paymentErr)
      throw new Error(paymentErr?.message || 'Failed to record payment in database.')
    }

    // 5. Send WhatsApp Receipt if requested
    let receiptSent = false
    let receiptResult = null

    if (send_receipt && student.whatsapp_opt_in) {
      try {
        const origin = req.nextUrl.origin
        const receiptRes = await fetch(`${origin}/api/send-payment-receipt`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Forward authorization cookies
            cookie: req.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            student_id,
            fee_id,
            payment_id: paymentRow.id,
            amount_paid: Number(amount),
            paid_on: paymentDate,
            period: period || paymentDate,
            mode: 'UPI',
            reference: finalRef,
          }),
        })

        if (receiptRes.ok) {
          receiptResult = await receiptRes.json()
          receiptSent = Boolean(receiptResult?.sent)
        }
      } catch (receiptErr) {
        console.warn('Background receipt sending warning:', receiptErr)
      }
    }

    return apiSuccess({
      success: true,
      payment_id: paymentRow.id,
      reference: finalRef,
      receipt_sent: receiptSent,
      receipt_info: receiptResult,
      is_mock: isMock,
    })
  } catch (err: unknown) {
    return apiError(err, req)
  }
}
