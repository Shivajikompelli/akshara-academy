import { type NextRequest } from 'next/server'
import { generateReceiptPngResponse } from '@/lib/receipt-image'
import { verifyApiAuth } from '@/lib/auth'
import { apiError } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    // 1. Verify caller is an authenticated & authorized Academy Manager
    const auth = await verifyApiAuth(req)
    if (!auth.authorized) {
      return auth.response
    }

    const { searchParams } = new URL(req.url)

    const studentName = (searchParams.get('student') || 'Student').slice(0, 80)
    const classLevel = (searchParams.get('class') || 'Student').slice(0, 30)
    const amountPaid = (searchParams.get('amount') || '0').slice(0, 20)
    const period = (searchParams.get('period') || '-').slice(0, 40)
    const paidDate = (searchParams.get('date') || '-').slice(0, 40)
    const receiptNo = (searchParams.get('receipt') || 'REC-PAID').slice(0, 40)
    const paymentMode = (searchParams.get('mode') || 'CASH').slice(0, 20)

    const imgRes = generateReceiptPngResponse({
      studentName,
      classLevel,
      amountPaid,
      period,
      paidDate,
      receiptNo,
      paymentMode,
    })
    imgRes.headers.set('Cache-Control', 'private, max-age=3600')
    return imgRes
  } catch (err: unknown) {
    return apiError(err, req)
  }
}

