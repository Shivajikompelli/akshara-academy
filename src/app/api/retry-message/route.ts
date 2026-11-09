import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

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
    // 1. Verify User Authentication
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: please sign in.' },
        { status: 401 }
      )
    }

    // 2. Parse payload: message_log_id (single) or message_log_ids (bulk)
    const body = await req.json()
    const { message_log_id, message_log_ids } = body

    const targetIds: string[] = []
    if (message_log_id && typeof message_log_id === 'string') {
      targetIds.push(message_log_id)
    } else if (Array.isArray(message_log_ids) && message_log_ids.length > 0) {
      targetIds.push(...message_log_ids)
    }

    if (targetIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing message_log_id or message_log_ids' },
        { status: 400 }
      )
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
        students (
          id,
          full_name,
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
      return NextResponse.json({
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

    for (const log of logs) {
      const student = Array.isArray(log.students) ? log.students[0] : log.students
      const fee = Array.isArray(log.fees) ? log.fees[0] : log.fees

      if (!student) {
        failedCount++
        details.push({ id: log.id, student_name: 'Unknown', status: 'failed', error: 'Student record missing' })
        continue
      }

      if (!student.whatsapp_opt_in) {
        failedCount++
        details.push({
          id: log.id,
          student_name: student.full_name,
          status: 'failed',
          error: 'Parent has not opted in for WhatsApp messages',
        })
        continue
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
          let metaPayload: any

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
          const metaRes = await fetch(metaUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(metaPayload),
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

      // Small delay between calls
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    return NextResponse.json({
      dry_run: isDryRun,
      retried_count: logs.length,
      success_count: successCount,
      failed_count: failedCount,
      details,
    })
  } catch (error: unknown) {
    console.error('Fatal retry-message error:', error)
    const msg = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

