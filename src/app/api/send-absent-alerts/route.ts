import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyApiAuth } from '@/lib/auth'
import { apiError, apiSuccess } from '@/lib/api-response'
import { ValidationError } from '@/lib/errors'

function formatDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-')
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
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

    // 2. Parse Payload
    const body = await req.json()
    const { class_level, date } = body

    if (!class_level || !date) {
      throw new ValidationError('Missing class_level or date')
    }

    // Only allow dates that are today or yesterday
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istNow = new Date(now.getTime() + istOffset)
    const todayIST = istNow.toISOString().split('T')[0]
    const yesterdayIST = new Date(istNow.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const todayUTC = now.toISOString().split('T')[0]
    const yesterdayUTC = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const allowedDates = new Set([todayIST, yesterdayIST, todayUTC, yesterdayUTC])
    if (!allowedDates.has(date)) {
      throw new ValidationError(
        `Alerts can only be sent for today (${todayIST}) or yesterday (${yesterdayIST}).`
      )
    }

    // 3. Load students of this class who are active
    const { data: classStudents, error: studentsError } = await supabase
      .from('students')
      .select('id, full_name, class_level, phone, whatsapp_opt_in')
      .eq('class_level', class_level)
      .eq('status', 'active')

    if (studentsError) throw studentsError

    if (!classStudents || classStudents.length === 0) {
      return apiSuccess({
        dry_run: true,
        sent: 0,
        failed: 0,
        already_sent: 0,
        skipped_no_consent: [],
        message: 'No active students found in this class.',
      })
    }

    // 4. Load attendance for this date
    const studentIds = classStudents.map((s) => s.id)
    const { data: attendanceRecords, error: attError } = await supabase
      .from('attendance')
      .select('student_id, status')
      .eq('att_date', date)
      .in('student_id', studentIds)

    if (attError) throw attError

    const absentStudentIds = new Set(
      (attendanceRecords || [])
        .filter((r) => r.status === 'absent')
        .map((r) => r.student_id)
    )

    const absentStudents = classStudents.filter((s) => absentStudentIds.has(s.id))

    if (absentStudents.length === 0) {
      return apiSuccess({
        dry_run: true,
        sent: 0,
        failed: 0,
        already_sent: 0,
        skipped_no_consent: [],
        message: 'No absent students for this date.',
      })
    }

    // 5. Categorize students
    const eligibleStudents = absentStudents.filter((s) => s.whatsapp_opt_in)
    const skippedNoConsentNames = absentStudents
      .filter((s) => !s.whatsapp_opt_in)
      .map((s) => s.full_name)

    const isDryRun = process.env.WHATSAPP_DRY_RUN === 'true' || !process.env.WHATSAPP_TOKEN
    const graphApiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || 'v21.0'
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || ''
    const token = process.env.WHATSAPP_TOKEN || ''
    const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'en'

    let sentCount = 0
    let failedCount = 0
    let alreadySentCount = 0
    const BATCH_SIZE = 5

    // 6. Process eligible students in small batches
    async function processAbsentStudent(student: (typeof eligibleStudents)[number]) {
      // Step A: Insert message_log row first
      const { data: logRow, error: logInsertError } = await supabase
        .from('message_log')
        .insert({
          student_id: student.id,
          kind: 'absent_alert',
          template_name: 'absent_alert_v1',
          status: 'queued',
          related_date: date,
        })
        .select('id')
        .single()

      if (logInsertError) {
        if (
          logInsertError.code === '23505' ||
          logInsertError.message?.toLowerCase().includes('duplicate') ||
          logInsertError.message?.toLowerCase().includes('unique')
        ) {
          alreadySentCount++
          return
        }
        console.error(`Log insert failed for student ${student.full_name}:`, logInsertError)
        failedCount++
        return
      }

      const logId = logRow.id

      // Step B: Send WhatsApp alert or Dry Run
      if (isDryRun) {
        await supabase
          .from('message_log')
          .update({
            status: 'sent',
            wa_message_id: 'dry-run',
          })
          .eq('id', logId)

        sentCount++
      } else {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        try {
          const cleanPhone = student.phone.replace(/^\+/, '')
          const formattedDateText = formatDate(date)

          const metaUrl = `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`
          const metaPayload = {
            messaging_product: 'whatsapp',
            to: cleanPhone,
            type: 'template',
            template: {
              name: 'absent_alert_v1',
              language: { code: templateLang },
              components: [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: student.full_name },
                    { type: 'text', text: formattedDateText },
                  ],
                },
              ],
            },
          }

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
            await supabase
              .from('message_log')
              .update({
                status: 'sent',
                wa_message_id: waMsgId,
              })
              .eq('id', logId)

            sentCount++
          } else {
            const errorMsg =
              metaJson.error?.message ||
              metaJson.error?.error_user_msg ||
              JSON.stringify(metaJson) ||
              'Meta API returned error'

            await supabase
              .from('message_log')
              .update({
                status: 'failed',
                error: errorMsg,
              })
              .eq('id', logId)

            failedCount++
          }
        } catch (err: unknown) {
          const errorText = err instanceof Error ? err.message : 'Network error calling Meta API'
          await supabase
            .from('message_log')
            .update({
              status: 'failed',
              error: errorText,
            })
            .eq('id', logId)

          failedCount++
        } finally {
          clearTimeout(timeoutId)
        }
      }
    }

    for (let i = 0; i < eligibleStudents.length; i += BATCH_SIZE) {
      const batch = eligibleStudents.slice(i, i + BATCH_SIZE)
      await Promise.all(batch.map((student) => processAbsentStudent(student)))
      if (i + BATCH_SIZE < eligibleStudents.length) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }

    return apiSuccess({
      dry_run: isDryRun,
      sent: sentCount,
      failed: failedCount,
      already_sent: alreadySentCount,
      skipped_no_consent: skippedNoConsentNames,
      total_absentees: absentStudents.length,
    })
  } catch (err: unknown) {
    return apiError(err, req)
  }
}


