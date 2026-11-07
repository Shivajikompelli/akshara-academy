import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verify Authentication JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || supabaseAnonKey

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Parse and Validate Request Payload
    const { class_level, date } = await req.json()

    if (!class_level || !date) {
      return new Response(JSON.stringify({ error: 'Missing class_level or date' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Only allow dates that are today or yesterday (evaluating in IST and UTC)
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istNow = new Date(now.getTime() + istOffset)
    const todayIST = istNow.toISOString().split('T')[0]
    const yesterdayIST = new Date(istNow.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const todayUTC = now.toISOString().split('T')[0]
    const yesterdayUTC = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const allowedDates = new Set([todayIST, yesterdayIST, todayUTC, yesterdayUTC])
    if (!allowedDates.has(date)) {
      return new Response(
        JSON.stringify({
          error: `Alerts can only be sent for today (${todayIST}) or yesterday (${yesterdayIST}).`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // 3. Load students of this class who are active
    const { data: classStudents, error: studentsError } = await adminClient
      .from('students')
      .select('id, full_name, class_level, phone, whatsapp_opt_in')
      .eq('class_level', class_level)
      .eq('status', 'active')

    if (studentsError) throw studentsError

    if (!classStudents || classStudents.length === 0) {
      return new Response(
        JSON.stringify({
          dry_run: true,
          sent: 0,
          failed: 0,
          already_sent: 0,
          skipped_no_consent: [],
          message: 'No active students found in this class.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // 4. Load attendance records for this date for these students
    const studentIds = classStudents.map((s) => s.id)
    const { data: attendanceRecords, error: attError } = await adminClient
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
      return new Response(
        JSON.stringify({
          dry_run: true,
          sent: 0,
          failed: 0,
          already_sent: 0,
          skipped_no_consent: [],
          message: 'No absent students for this date.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // 5. Categorize students: with WhatsApp consent vs skipped without consent
    const eligibleStudents = absentStudents.filter((s) => s.whatsapp_opt_in)
    const skippedNoConsentNames = absentStudents
      .filter((s) => !s.whatsapp_opt_in)
      .map((s) => s.full_name)

    // Check DRY-RUN mode (defaults to true)
    const isDryRun = Deno.env.get('WHATSAPP_DRY_RUN') !== 'false'
    const graphApiVersion = Deno.env.get('WHATSAPP_GRAPH_API_VERSION') || 'v21.0'
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || ''
    const token = Deno.env.get('WHATSAPP_TOKEN') || ''
    const templateLang = Deno.env.get('WHATSAPP_TEMPLATE_LANG') || 'en'

    let sentCount = 0
    let failedCount = 0
    let alreadySentCount = 0

    // 6. Process eligible students one by one
    for (const student of eligibleStudents) {
      // Step A: FIRST insert a message_log row.
      // The unique index message_log_dedupe (student_id, kind, related_date) where status <> 'failed'
      // prevents duplicates. If already sent, the insert will fail with unique violation.
      const { data: logRow, error: logInsertError } = await adminClient
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
        // Unique conflict or duplicate -> mark as already_sent
        if (
          logInsertError.code === '23505' ||
          logInsertError.message?.toLowerCase().includes('duplicate') ||
          logInsertError.message?.toLowerCase().includes('unique')
        ) {
          alreadySentCount++
          continue
        }
        // Other unexpected insert error
        console.error(`Log insert failed for student ${student.full_name}:`, logInsertError)
        failedCount++
        continue
      }

      const logId = logRow.id

      // Step B: Send WhatsApp alert (or Dry Run)
      if (isDryRun) {
        // DRY RUN: update message_log as sent with wa_message_id = 'dry-run'
        await adminClient
          .from('message_log')
          .update({
            status: 'sent',
            wa_message_id: 'dry-run',
          })
          .eq('id', logId)

        sentCount++
      } else {
        // LIVE CALL TO META GRAPH API
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
            await adminClient
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

            await adminClient
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
          await adminClient
            .from('message_log')
            .update({
              status: 'failed',
              error: errorText,
            })
            .eq('id', logId)

          failedCount++
        }
      }

      // Delay ~200 ms between messages
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    return new Response(
      JSON.stringify({
        dry_run: isDryRun,
        sent: sentCount,
        failed: failedCount,
        already_sent: alreadySentCount,
        skipped_no_consent: skippedNoConsentNames,
        total_absentees: absentStudents.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err: unknown) {
    console.error('Edge Function unhandled error:', err)
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
