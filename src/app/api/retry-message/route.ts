import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { generateReceiptPngResponse } from '@/lib/receipt-image'
import { verifyApiAuth } from '@/lib/auth'
import { apiError, apiSuccess } from '@/lib/api-response'
import { ValidationError } from '@/lib/errors'

function formatPeriodText(periodStr: string): string {
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

function formatDateText(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-')
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
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

export async function POST(req: NextRequest) {
  try {
    // 1. Verify User Authentication & Manager Authorization
    const auth = await verifyApiAuth(req)
    if (!auth.authorized) {
      return auth.response
    }
    const supabase = await createClient()

    // 2. Parse payload: message_log_id (single) or message_log_ids (bulk)
    const body = await req.json()
    const { message_log_id, message_log_ids } = body

    const targetIds: string[] = []
    if (message_log_id && typeof message_log_id === 'string') {
      targetIds.push(message_log_id)
    } else if (Array.isArray(message_log_ids) && message_log_ids.length > 0) {
      targetIds.push(
        ...message_log_ids
          .filter((id): id is string => typeof id === 'string')
          .slice(0, 100)
      )
    }

    if (targetIds.length === 0) {
      throw new ValidationError('Missing message_log_id or message_log_ids')
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

    const dbClient = serviceRoleKey
      ? createAdminClient(supabaseUrl, serviceRoleKey)
      : supabase

    // 3. Fetch failed message_log rows with student and fee details
    const { data: logs, error: logsError } = await dbClient
      .from('message_log')
      .select(`
        id,
        student_id,
        fee_id,
        kind,
        template_name,
        status,
        related_date,
        created_at,
        students (
          id,
          full_name,
          class_level,
          phone,
          whatsapp_opt_in,
          status
        ),
        fees (
          id,
          period,
          amount_due,
          due_date
        )
      `)
      .in('id', targetIds)
      .eq('status', 'failed')

    if (logsError) throw logsError

    if (!logs || logs.length === 0) {
      return apiSuccess({
        retried_count: 0,
        success_count: 0,
        failed_count: 0,
        message: 'No eligible failed messages found to retry.',
      })
    }

    const isDryRun = process.env.WHATSAPP_DRY_RUN === 'true' || !process.env.WHATSAPP_TOKEN
    const graphApiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || 'v21.0'
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || ''
    const token = process.env.WHATSAPP_TOKEN || ''
    const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'en'

    let successCount = 0
    let failedCount = 0
    const details: Array<{ id: string; student_name: string; status: string; error?: string }> = []
    const BATCH_SIZE = 5

    async function processRetryLog(log: NonNullable<typeof logs>[number]) {
      const student = Array.isArray(log.students) ? log.students[0] : log.students
      const fee = Array.isArray(log.fees) ? log.fees[0] : log.fees

      if (!student) {
        failedCount++
        details.push({ id: log.id, student_name: 'Unknown', status: 'failed', error: 'Student record missing' })
        return
      }

      if (!student.whatsapp_opt_in) {
        failedCount++
        details.push({
          id: log.id,
          student_name: student.full_name,
          status: 'failed',
          error: 'Parent has not opted in for WhatsApp messages',
        })
        return
      }

      const cleanPhone = student.phone.replace(/^\+/, '')

      if (isDryRun) {
        // Dry-run retry
        await dbClient
          .from('message_log')
          .update({
            status: 'sent',
            wa_message_id: 'dry-run',
            error: null,
          })
          .eq('id', log.id)

        successCount++
        details.push({ id: log.id, student_name: student.full_name, status: 'sent' })
      } else {
        try {
          let metaPayload: Record<string, unknown>

          if (log.kind === 'absent_alert') {
            const dateText = formatDateText(log.related_date || '')
            metaPayload = {
              messaging_product: 'whatsapp',
              to: cleanPhone,
              type: 'template',
              template: {
                name: log.template_name || 'absent_alert_v1',
                language: { code: templateLang },
                components: [
                  {
                    type: 'body',
                    parameters: [
                      { type: 'text', text: student.full_name },
                      { type: 'text', text: dateText },
                    ],
                  },
                ],
              },
            }
          } else if (
            log.kind === 'payment_receipt' ||
            log.template_name?.toLowerCase().includes('receipt')
          ) {
            let amountPaid = fee?.amount_due ? Math.round(Number(fee.amount_due)) : 0
            let periodText = fee?.period ? formatPeriodText(fee.period) : formatPeriodText(log.related_date || '')
            let paidDateText = formatDateText(log.related_date || '')
            let paymentMode = 'CASH'
            let receiptCode = `REC-${log.id.slice(0, 6).toUpperCase()}`

            // Try to resolve the exact payment installment row for this receipt
            let matchedPayment: {
              id: string
              amount: number
              paid_on: string
              mode: string | null
              reference: string | null
            } | null = null

            // Check if payment_id column exists on message_log for this row
            const { data: logWithPayment } = await dbClient
              .from('message_log')
              .select('payment_id')
              .eq('id', log.id)
              .maybeSingle()

            const linkedPaymentId = (logWithPayment as { payment_id?: string | null } | null)?.payment_id

            if (linkedPaymentId) {
              const { data: pRow } = await dbClient
                .from('fee_payments')
                .select('id, amount, paid_on, mode, reference')
                .eq('id', linkedPaymentId)
                .maybeSingle()
              if (pRow) matchedPayment = pRow
            }

            if (!matchedPayment && fee?.id) {
              const { data: feePayments } = await dbClient
                .from('fee_payments')
                .select('id, amount, paid_on, mode, reference, created_at')
                .eq('fee_id', fee.id)
                .order('created_at', { ascending: false })

              if (feePayments && feePayments.length > 0) {
                matchedPayment =
                  feePayments.find((p) => p.paid_on === log.related_date) || feePayments[0]
              }
            }

            if (matchedPayment) {
              amountPaid = Math.round(Number(matchedPayment.amount) || amountPaid)
              paidDateText = formatDateText(matchedPayment.paid_on || log.related_date || '')
              paymentMode = String(matchedPayment.mode || 'cash').toUpperCase()
              receiptCode = matchedPayment.reference?.trim()
                ? matchedPayment.reference.trim()
                : `REC-${matchedPayment.id.slice(0, 6).toUpperCase()}`
            } else if (fee?.id) {
              const { data: sumRow } = await dbClient
                .from('fee_summary')
                .select('amount_paid, period')
                .eq('fee_id', fee.id)
                .single()

              if (sumRow) {
                amountPaid = Math.round(Number(sumRow.amount_paid) || amountPaid)
                periodText = formatPeriodText(sumRow.period)
              }
            }

            const receiptRef = `${receiptCode} (${paymentMode})`

            let mediaId: string | null = null
            try {
              const imgRes = generateReceiptPngResponse({
                studentName: student.full_name,
                classLevel: student.class_level || 'Student',
                amountPaid: String(amountPaid),
                period: periodText,
                paidDate: paidDateText,
                receiptNo: receiptCode,
                paymentMode,
              })
              const pngBlob = await imgRes.blob()
              const mediaUrl = `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/media`
              const formData = new FormData()
              formData.append('messaging_product', 'whatsapp')
              formData.append('type', 'image/png')
              formData.append('file', pngBlob, `Akshara_Receipt_${receiptCode.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`)
              const mediaUploadRes = await fetch(mediaUrl, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
              })
              const mediaUploadJson = await mediaUploadRes.json()
              if (mediaUploadRes.ok && mediaUploadJson?.id) {
                mediaId = String(mediaUploadJson.id)
              }
            } catch {
              // Proceed without header image if upload fails
            }

            const bodyParameters = [
              { type: 'text', text: student.full_name },
              { type: 'text', text: String(amountPaid) },
              { type: 'text', text: periodText },
              { type: 'text', text: paidDateText },
              { type: 'text', text: receiptRef },
            ]

            metaPayload = {
              messaging_product: 'whatsapp',
              to: cleanPhone,
              type: 'template',
              template: {
                name: log.template_name || process.env.WHATSAPP_RECEIPT_TEMPLATE_NAME || 'payment_receipt_v1',
                language: { code: templateLang },
                components: mediaId
                  ? [
                      {
                        type: 'header',
                        parameters: [{ type: 'image', image: { id: mediaId } }],
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
                    ],
              },
            }
          } else {
            // fee_reminder
            // Fetch fee balance from fee_summary view
            let balance = 0
            let periodText = ''
            let dueDateText = ''

            if (fee?.id) {
              const { data: sumRow } = await dbClient
                .from('fee_summary')
                .select('balance, period, due_date')
                .eq('fee_id', fee.id)
                .single()

              if (sumRow) {
                balance = Math.round(Number(sumRow.balance) || 0)
                periodText = formatPeriodText(sumRow.period)
                dueDateText = formatDateText(sumRow.due_date)
              }
            }

            if (!periodText && log.related_date) {
              periodText = formatPeriodText(log.related_date)
            }

            metaPayload = {
              messaging_product: 'whatsapp',
              to: cleanPhone,
              type: 'template',
              template: {
                name: log.template_name || process.env.WHATSAPP_FEE_TEMPLATE_NAME || 'fee_reminder_v1',
                language: { code: templateLang },
                components: [
                  {
                    type: 'body',
                    parameters: [
                      { type: 'text', text: student.full_name },
                      { type: 'text', text: String(balance || 0) },
                      { type: 'text', text: periodText },
                      { type: 'text', text: dueDateText || formatDateText(log.related_date || '') },
                    ],
                  },
                ],
              },
            }
          }

          const metaUrl = `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 10000)

          try {
            const metaRes = await fetch(metaUrl, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(metaPayload),
              signal: controller.signal,
            })

            const metaJson = await metaRes.json()

            if (metaRes.ok && metaJson.messages && metaJson.messages.length > 0) {
              const waMsgId = metaJson.messages[0].id
              await dbClient
                .from('message_log')
                .update({
                  status: 'sent',
                  wa_message_id: waMsgId,
                  error: null,
                })
                .eq('id', log.id)

              successCount++
              details.push({ id: log.id, student_name: student.full_name, status: 'sent' })
            } else {
              const errorMsg =
                metaJson?.error?.message ||
                metaJson?.error?.error_user_msg ||
                'Meta Cloud API returned an error'

              console.error(`Retry failed for ${student.full_name}:`, metaJson)

              await dbClient
                .from('message_log')
                .update({
                  status: 'failed',
                  error: errorMsg,
                })
                .eq('id', log.id)

              failedCount++
              details.push({
                id: log.id,
                student_name: student.full_name,
                status: 'failed',
                error: errorMsg,
              })
            }
          } finally {
            clearTimeout(timeoutId)
          }
        } catch (callErr: unknown) {
          const errStr = callErr instanceof Error ? callErr.message : 'Network error'
          console.error(`Retry error for ${student.full_name}:`, callErr)

          await dbClient
            .from('message_log')
            .update({
              status: 'failed',
              error: errStr,
            })
            .eq('id', log.id)

          failedCount++
          details.push({
            id: log.id,
            student_name: student.full_name,
            status: 'failed',
            error: errStr,
          })
        }
      }
    }

    for (let i = 0; i < logs.length; i += BATCH_SIZE) {
      const batch = logs.slice(i, i + BATCH_SIZE)
      await Promise.all(batch.map((log) => processRetryLog(log)))
      if (i + BATCH_SIZE < logs.length) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }

    return apiSuccess({
      dry_run: isDryRun,
      retried_count: logs.length,
      success_count: successCount,
      failed_count: failedCount,
      details,
    })
  } catch (error: unknown) {
    return apiError(error, req)
  }
}

