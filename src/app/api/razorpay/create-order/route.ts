import { type NextRequest } from 'next/server'
import { verifyApiAuth } from '@/lib/auth'
import { apiError, apiSuccess } from '@/lib/api-response'
import { AppError, ValidationError } from '@/lib/errors'

export async function POST(req: NextRequest) {
  try {
    // 1. Verify User Session & Manager Authorization
    const auth = await verifyApiAuth(req)
    if (!auth.authorized) {
      return auth.response
    }

    // 2. Parse & Validate Payload
    const body = await req.json()
    const { fee_id, student_id, amount } = body

    if (!fee_id || !student_id || !amount || Number(amount) <= 0) {
      throw new ValidationError('Valid fee_id, student_id, and positive amount are required.')
    }

    const keyId = process.env.RAZORPAY_KEY_ID?.trim()
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim()
    const amountInPaise = Math.round(Number(amount) * 100)

    // 3. Fallback: If Razorpay keys are not configured yet, return a Test Simulation Order
    if (!keyId || !keySecret || keyId === 'rzp_test_placeholder') {
      const mockOrderId = `order_mock_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`
      return apiSuccess({
        orderId: mockOrderId,
        amount: amountInPaise,
        currency: 'INR',
        keyId: keyId || 'rzp_test_placeholder',
        isMock: true,
        message: 'Razorpay keys not configured. Running in Test Simulation mode.',
      })
    }

    // 4. Create real Razorpay order via Razorpay API
    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const receiptId = `fee_${fee_id.slice(0, 8)}_${Date.now().toString().slice(-6)}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: receiptId,
          notes: {
            fee_id,
            student_id,
            source: 'Akshara Academy Portal',
          },
        }),
        signal: controller.signal,
      })

      const data = await res.json()

      if (!res.ok || !data?.id) {
        console.error('Razorpay order creation failed:', data)
        const errorDesc = data?.error?.description || 'Failed to create Razorpay order'
        return apiError(new AppError({ message: errorDesc, statusCode: 502 }), req)
      }

      return apiSuccess({
        orderId: data.id,
        amount: data.amount,
        currency: data.currency,
        keyId,
        isMock: false,
      })
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (err: unknown) {
    return apiError(err, req)
  }
}
