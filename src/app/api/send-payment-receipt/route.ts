import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { generateReceiptPngResponse } from '@/lib/receipt-image'
import { verifyApiAuth } from '@/lib/auth'
import { getTodayIST } from '@/lib/formatters'
import { apiError, apiSuccess } from '@/lib/api-response'
import { NotFoundError, ValidationError } from '@/lib/errors'

function formatPeriodIST(periodStr: string): string {
  try {
    const [year, month] = periodStr.split('-')
    const d = new Date(parseInt(year), parseInt(month) - 1, 1)
    return d.toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    })
  } catch {
    return periodStr
  }
}

function formatDateIST(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-')
    const d = new Date(parseInt(year), parseInt(month) - 1, 1)
    d.setDate(parseInt(day))
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    })
  } catch {
    return dateStr
  }
}

async function uploadReceiptPngToMeta(params: {
  graphApiVersion: string
  phoneNumberId: string
  waToken: string
  pngBlob: Blob
  receiptNo: string
}): Promise<string | null> {
  const { graphApiVersion, phoneNumberId, waToken, pngBlob, receiptNo } = params
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const mediaUrl = `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/media`
    const formData = new FormData()
    formData.append('messaging_product', 'whatsapp')
    formData.append('type', 'image/png')
    formData.append('file', pngBlob, `Akshara_Receipt_${receiptNo.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`)

    const mediaRes = await fetch(mediaUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${waToken}`,
      },
      body: formData,
      signal: controller.signal,
    })

    const mediaJson = await mediaRes.json()
    if (mediaRes.ok && mediaJson?.id) {
      return String(mediaJson.id)
    }
    console.warn('Meta media upload warning:', mediaJson)
    return null
  } catch (err) {
    console.warn('Failed to upload receipt PNG to Meta:', err)
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verify User Session & Manager Authorization
    const auth = await verifyApiAuth(req)
    if (!auth.authorized) {
      return auth.response
    }
    const supabase = await createClient()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const dbClient = serviceRoleKey
      ? createAdminClient(supabaseUrl, serviceRoleKey)
      : supabase

    // 2. Parse payload
    const body = await req.json()
    const {
      student_id,
      fee_id,
      payment_id,
      amount_paid,
      paid_on,
      period,
      mode,
      reference,
    } = body

    if (!student_id || !fee_id || !amount_paid) {
      throw new ValidationError('Missing required payment details (student_id, fee_id, amount_paid).')
    }

    // 3. Load student phone, class, & WhatsApp opt-in
    const { data: student, error: studentErr } = await dbClient
      .from('students')
      .select('id, full_name, class_level, phone, whatsapp_opt_in')
      .eq('id', student_id)
      .single()

    if (studentErr || !student) {
      throw new NotFoundError('Student')
    }

    if (!student.whatsapp_opt_in) {
      return apiSuccess({
        sent: false,
        skipped_no_consent: true,
        message: `${student.full_name}'s parent has not opted in to WhatsApp messages.`,
      })
    }

    const isDryRun = process.env.WHATSAPP_DRY_RUN === 'true' || !process.env.WHATSAPP_TOKEN
    const graphApiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || 'v21.0'
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || ''
    const waToken = process.env.WHATSAPP_TOKEN || ''
    const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'en'
    const templateName =
      process.env.WHATSAPP_RECEIPT_TEMPLATE_NAME || 'payment_receipt_v1'

    const shortCode = payment_id
      ? String(payment_id).slice(0, 6).toUpperCase()
      : String(Date.now()).slice(-6)
    const modeLabel = String(mode || 'cash').toUpperCase()
    const receiptCodeOnly = reference?.trim() ? reference.trim() : `REC-${shortCode}`
    const receiptRef = `${receiptCodeOnly} (${modeLabel})`

    const paidDateStr = paid_on || getTodayIST()

    // 4. Insert message_log row with payment_id and kind='payment_receipt'
    let logId: string | null = null
    const { data: primaryLogRow, error: primaryLogErr } = await dbClient
      .from('message_log')
      .insert({
        student_id: student.id,
        fee_id,
        payment_id: payment_id || null,
        kind: 'payment_receipt',
        template_name: templateName,
        status: 'queued',
        related_date: paidDateStr,
      })
      .select('id')
      .single()

    if (!primaryLogErr && primaryLogRow) {
      logId = primaryLogRow.id
    } else {
      const { data: secondaryRow, error: secondaryErr } = await dbClient
        .from('message_log')
        .insert({
          student_id: student.id,
          fee_id,
          kind: 'payment_receipt',
          template_name: templateName,
          status: 'queued',
          related_date: paidDateStr,
        })
        .select('id')
        .single()

      if (!secondaryErr && secondaryRow) {
        logId = secondaryRow.id
      } else {
        const { data: fallbackRow } = await dbClient
          .from('message_log')
          .insert({
            student_id: student.id,
            fee_id,
            kind: 'fee_reminder',
            template_name: templateName,
            status: 'queued',
            related_date: paidDateStr,
          })
          .select('id')
          .single()

        if (fallbackRow) {
          logId = fallbackRow.id
        }
      }
    }

    // 5. Generate Receipt PNG Image & Send via WhatsApp
    const cleanPhone = student.phone.replace(/^\+/, '')
    const amountStr = String(Math.round(Number(amount_paid)))
    const formattedPeriod = formatPeriodIST(period || paidDateStr)
    const formattedPaidDate = formatDateIST(paidDateStr)

    if (isDryRun) {
      if (logId) {
        await dbClient
          .from('message_log')
          .update({
            status: 'sent',
            wa_message_id: 'dry-run',
          })
          .eq('id', logId)
      }

      return apiSuccess({
        dry_run: true,
        sent: true,
        receipt_no: receiptRef,
        student_name: student.full_name,
      })
    }

    try {
      const imgResponse = generateReceiptPngResponse({
        studentName: student.full_name,
        classLevel: student.class_level || 'Student',
        amountPaid: amountStr,
        period: formattedPeriod,
        paidDate: formattedPaidDate,
        receiptNo: receiptCodeOnly,
        paymentMode: modeLabel,
      })
      const pngBlob = await imgResponse.blob()

      const mediaId = await uploadReceiptPngToMeta({
        graphApiVersion,
        phoneNumberId,
        waToken,
        pngBlob,
        receiptNo: receiptCodeOnly,
      })

      const metaUrl = `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`

      const bodyParameters = [
        { type: 'text', text: student.full_name },
        { type: 'text', text: amountStr },
        { type: 'text', text: formattedPeriod },
        { type: 'text', text: formattedPaidDate },
        { type: 'text', text: receiptRef },
      ]

      const componentsWithImage = mediaId
        ? [
            {
              type: 'header',
              parameters: [
                {
                  type: 'image',
                  image: { id: mediaId },
                },
              ],
            },
            {
              type: 'body',
              parameters: bodyParameters,
            },
          ]
        : [
            {
              type: 'body',
              parameters: bodyParameters,
            },
          ]

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 12000)

      let metaRes: Response
      let metaJson: { messages?: Array<{ id: string }>; error?: { message?: string; error_user_msg?: string } }

      try {
        metaRes = await fetch(metaUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${waToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: cleanPhone,
            type: 'template',
            template: {
              name: templateName,
              language: { code: templateLang },
              components: componentsWithImage,
            },
          }),
          signal: controller.signal,
        })
        metaJson = await metaRes.json()

        // Fallback: if template in Meta was created without a Header image slot
        if (!metaRes.ok && mediaId) {
          metaRes = await fetch(metaUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${waToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: cleanPhone,
              type: 'template',
              template: {
                name: templateName,
                language: { code: templateLang },
                components: [
                  {
                    type: 'body',
                    parameters: bodyParameters,
                  },
                ],
              },
            }),
            signal: controller.signal,
          })
          metaJson = await metaRes.json()
        }
      } finally {
        clearTimeout(timeoutId)
      }

      if (metaRes.ok && metaJson.messages && metaJson.messages.length > 0) {
        const waMsgId = metaJson.messages[0].id
        if (logId) {
          await dbClient
            .from('message_log')
            .update({
              status: 'sent',
              wa_message_id: waMsgId,
            })
            .eq('id', logId)
        }

        return apiSuccess({
          dry_run: false,
          sent: true,
          receipt_no: receiptRef,
          wa_message_id: waMsgId,
          student_name: student.full_name,
        })
      } else {
        const errorMsg =
          metaJson?.error?.message ||
          metaJson?.error?.error_user_msg ||
          'Meta API returned error'

        if (logId) {
          await dbClient
            .from('message_log')
            .update({
              status: 'failed',
              error: errorMsg,
            })
            .eq('id', logId)
        }

        return apiSuccess({
          dry_run: false,
          sent: false,
          receipt_no: receiptRef,
          error: errorMsg,
        })
      }
    } catch (callErr: unknown) {
      const errStr = callErr instanceof Error ? callErr.message : 'Network error'
      if (logId) {
        await dbClient
          .from('message_log')
          .update({
            status: 'failed',
            error: errStr,
          })
          .eq('id', logId)
      }

      return apiSuccess({
        dry_run: false,
        sent: false,
        receipt_no: receiptRef,
        error: errStr,
      })
    }
  } catch (err: unknown) {
    return apiError(err, req)
  }
}

