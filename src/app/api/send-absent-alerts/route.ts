import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

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
    // 1. Verify User Session
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

    // 2. Parse Payload
    const body = await req.json()
    const { class_level, date } = body

    if (!class_level || !date) {
      return NextResponse.json(
        { error: 'Missing class_level or date' },
        { status: 400 }
      )
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
      return NextResponse.json(
        {
          error: `Alerts can only be sent for today (${todayIST}) or yesterday (${yesterdayIST}).`,
        },
        { status: 400 }
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
      return NextResponse.json({
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
      return NextResponse.json({
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

    const isDryRun = process.env.WHATSAPP_DRY_RUN !== 'false'
    const graphApiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || 'v21.0'
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || ''
    const token = process.env.WHATSAPP_TOKEN || ''
    const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'en'

    let sentCount = 0
    let failedCount = 0
    let alreadySentCount = 0

    // 6. Process eligible students
    for (const student of eligibleStudents) {
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
          continue
        }
        console.error(`Log insert failed for student ${student.full_name}:`, logInsertError)
        failedCount++
        continue
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
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    return NextResponse.json({
      dry_run: isDryRun,
      sent: sentCount,
      failed: failedCount,
      already_sent: alreadySentCount,
      skipped_no_consent: skippedNoConsentNames,
      total_absentees: absentStudents.length,
    })
  } catch (err: unknown) {
    console.error('API send-absent-alerts error:', err)
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
