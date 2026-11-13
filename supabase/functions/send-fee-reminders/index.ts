import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = new Set([
  Deno.env.get('ALLOWED_ORIGIN') || 'https://akshara-academy-eta.vercel.app',
  'http://localhost:3000',
])

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || ''
  const allowOrigin = ALLOWED_ORIGINS.has(origin)
    ? origin
    : 'https://akshara-academy-eta.vercel.app'
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function safeCompareSecret(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const bufA = enc.encode(a)
  const bufB = enc.encode(b)
  if (bufA.byteLength !== bufB.byteLength || bufA.byteLength === 0) return false
  let diff = 0
  for (let i = 0; i < bufA.byteLength; i++) {
    diff |= bufA[i] ^ bufB[i]
  }
  return diff === 0
}

function isAuthorizedEdgeUser(user: {
  email?: string | null
  email_confirmed_at?: string | null
  app_metadata?: Record<string, unknown>
} | null): boolean {
  if (!user || !user.email) return false
  const appRole = user.app_metadata?.role
  if (appRole === 'blocked' || appRole === 'disabled') return false

  const rawAllowlist = Deno.env.get('ADMIN_ALLOWED_EMAILS') || ''
  const allowedEmails = rawAllowlist
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (allowedEmails.length > 0 && !allowedEmails.includes(user.email.toLowerCase())) {
    return false
  }
  return true
}

// Config constant: days after due_date to send reminders
const REMINDER_OFFSETS_DAYS = [0, 2]

function getTodayIST(): string {
  const now = new Date()
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const istDate = new Date(now.getTime() + istOffsetMs)
  return istDate.toISOString().split('T')[0]
}

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

function getDaysDifference(targetDate: string, baseDate: string): number {
  const t = new Date(targetDate).getTime()
  const b = new Date(baseDate).getTime()
  return Math.floor((t - b) / (1000 * 60 * 60 * 24))
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verify Authentication: user JWT or scheduler service role key
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const cronSecret = Deno.env.get('CRON_SECRET') || ''
    const token = authHeader.replace('Bearer ', '').trim()

    let isAuthorized = false

    // Never allow anon key to match service key check; use constant-time comparison
    if (
      token &&
      token !== supabaseAnonKey &&
      ((supabaseServiceKey && safeCompareSecret(token, supabaseServiceKey)) ||
        (cronSecret && safeCompareSecret(token, cronSecret)))
    ) {
      isAuthorized = true
    } else {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const {
        data: { user },
        error: userError,
      } = await userClient.auth.getUser()
      if (!userError && user && isAuthorizedEdgeUser(user)) {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized: invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!supabaseServiceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is missing in Edge Function runtime')
      return new Response(JSON.stringify({ error: 'An internal server error occurred.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // 2. Parse Payload
    let studentIdFilter: string | undefined
    let dryPreview = false

    try {
      const body = await req.json()
      studentIdFilter = body?.student_id
      dryPreview = !!body?.dry_preview
    } catch {
      // Body is optional for scheduled cron
    }

    const todayIST = getTodayIST()

    // 3. First call generate_monthly_fees() for current month (safe to repeat)
    try {
      await adminClient.rpc('generate_monthly_fees')
    } catch (rpcErr) {
      console.warn('generate_monthly_fees RPC call warning:', rpcErr)
    }

    // 4. Query fee_summary where balance > 0
    let feeQuery = adminClient
      .from('fee_summary')
      .select('fee_id, student_id, full_name, period, amount_due, due_date, balance, status')
      .gt('balance', 0)

    if (studentIdFilter) {
      feeQuery = feeQuery.eq('student_id', studentIdFilter)
    }

    const { data: unpaidFees, error: feesError } = await feeQuery
    if (feesError) throw feesError

    if (!unpaidFees || unpaidFees.length === 0) {
      return new Response(
        JSON.stringify({
          dry_run: Deno.env.get('WHATSAPP_DRY_RUN') !== 'false',
          sent: 0,
          failed: 0,
          already_sent: 0,
          skipped_no_consent: 0,
          sent_students: [],
          failed_students: [],
          already_sent_students: [],
          skipped_no_consent_students: [],
          preview_recipients: [],
          message: 'No unpaid fees found requiring reminders.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Load Active Students
    const studentIds = Array.from(new Set(unpaidFees.map((f: any) => f.student_id)))
    const { data: students, error: studentsError } = await adminClient
      .from('students')
      .select('id, full_name, class_level, phone, whatsapp_opt_in, status')
      .in('id', studentIds)
      .eq('status', 'active')

    if (studentsError) throw studentsError

    const studentsMap = new Map<string, any>()
    ;(students || []).forEach((s: any) => {
      studentsMap.set(s.id, s)
    })

    const activeStudentFees = unpaidFees
      .filter((f: any) => studentsMap.has(f.student_id))
      // Oldest fee first
      .sort((a: any, b: any) => a.period.localeCompare(b.period))

    // 6. Fetch previous fee_reminder logs for these fees
    const feeIds = activeStudentFees.map((f: any) => f.fee_id)
    const { data: existingLogs, error: logsError } = await adminClient
      .from('message_log')
      .select('id, student_id, fee_id, status, related_date')
      .eq('kind', 'fee_reminder')
      .neq('status', 'failed')
      .in('fee_id', feeIds)

    if (logsError) throw logsError

    const logsByFee = new Map<string, any[]>()
    const studentsRemindedToday = new Set<string>()

    ;(existingLogs || []).forEach((log: any) => {
      if (log.fee_id) {
        const list = logsByFee.get(log.fee_id) || []
        list.push(log)
        logsByFee.set(log.fee_id, list)
      }
      if (log.related_date === todayIST && log.student_id) {
        studentsRemindedToday.add(log.student_id)
      }
    })

    const { data: todayLogs } = await adminClient
      .from('message_log')
      .select('student_id')
      .eq('kind', 'fee_reminder')
      .eq('related_date', todayIST)
      .neq('status', 'failed')
      .in('student_id', studentIds)

    ;(todayLogs || []).forEach((tl: any) => {
      if (tl.student_id) studentsRemindedToday.add(tl.student_id)
    })

    // 7. Evaluate eligibility per student & schedule
    const skippedNoConsentStudents: string[] = []
    const alreadySentStudents: string[] = []
    const eligibleQueue: Array<{
      fee: any
      student: any
      reminderNumber: number
    }> = []

    const evaluatedStudents = new Set<string>()

    for (const fee of activeStudentFees) {
      const student = studentsMap.get(fee.student_id)
      if (!student) continue

      if (evaluatedStudents.has(student.id)) {
        continue
      }

      if (!student.whatsapp_opt_in) {
        if (!skippedNoConsentStudents.includes(student.full_name)) {
          skippedNoConsentStudents.push(student.full_name)
        }
        evaluatedStudents.add(student.id)
        continue
      }

      if (studentsRemindedToday.has(student.id)) {
        if (!alreadySentStudents.includes(student.full_name)) {
          alreadySentStudents.push(student.full_name)
        }
        evaluatedStudents.add(student.id)
        continue
      }

      const earlierLogs = logsByFee.get(fee.fee_id) || []
      const sentCount = earlierLogs.length

      if (sentCount >= REMINDER_OFFSETS_DAYS.length) {
        continue
      }

      if (!studentIdFilter) {
        const daysSinceDue = getDaysDifference(todayIST, fee.due_date)
        const offsetsReached = REMINDER_OFFSETS_DAYS.filter(
          (offset) => daysSinceDue >= offset
        ).length

        if (sentCount >= offsetsReached) {
          continue
        }
      }

      const reminderNumber = sentCount + 1
      eligibleQueue.push({
        fee,
        student,
        reminderNumber,
      })
      evaluatedStudents.add(student.id)
    }

    // 8. Handle DRY PREVIEW
    if (dryPreview) {
      const isDryRun = Deno.env.get('WHATSAPP_DRY_RUN') !== 'false'
      return new Response(
        JSON.stringify({
          dry_run: isDryRun,
          preview_recipients: eligibleQueue.map((item) => ({
            student_id: item.student.id,
            fee_id: item.fee.fee_id,
            student_name: item.student.full_name,
            class_level: item.student.class_level,
            balance: item.fee.balance,
            period: formatPeriodIST(item.fee.period),
            due_date: formatDateIST(item.fee.due_date),
            reminder_number: item.reminderNumber,
          })),
          skipped_no_consent_students: skippedNoConsentStudents,
          already_sent_students: alreadySentStudents,
          total_eligible: eligibleQueue.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 9. Send WhatsApp Reminders
    const isDryRun = Deno.env.get('WHATSAPP_DRY_RUN') !== 'false'
    const graphApiVersion = Deno.env.get('WHATSAPP_GRAPH_API_VERSION') || 'v21.0'
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || ''
    const waToken = Deno.env.get('WHATSAPP_TOKEN') || ''
    const templateLang = Deno.env.get('WHATSAPP_TEMPLATE_LANG') || 'en'
    const templateName =
      Deno.env.get('WHATSAPP_FEE_TEMPLATE_NAME') || 'fee_reminder_v1'

    const sentStudents: string[] = []
    const failedStudents: string[] = []

    for (const item of eligibleQueue) {
      const { fee, student } = item

      // Step A: Insert message_log row first
      const { data: logRow, error: logInsertError } = await adminClient
        .from('message_log')
        .insert({
          student_id: student.id,
          fee_id: fee.fee_id,
          kind: 'fee_reminder',
          template_name: templateName,
          status: 'queued',
          related_date: todayIST,
        })
        .select('id')
        .single()

      if (logInsertError) {
        if (
          logInsertError.code === '23505' ||
          logInsertError.message?.toLowerCase().includes('duplicate') ||
          logInsertError.message?.toLowerCase().includes('unique')
        ) {
          if (!alreadySentStudents.includes(student.full_name)) {
            alreadySentStudents.push(student.full_name)
          }
          continue
        }

        console.error(`Log insert failed for ${student.full_name}:`, logInsertError)
        failedStudents.push(`${student.full_name}: ${logInsertError.message}`)
        continue
      }

      const logId = logRow.id

      // Step B: Send WhatsApp alert or Dry Run
      if (isDryRun) {
        await adminClient
          .from('message_log')
          .update({
            status: 'sent',
            wa_message_id: 'dry-run',
          })
          .eq('id', logId)

        sentStudents.push(student.full_name)
      } else {
        try {
          const cleanPhone = student.phone.replace(/^\+/, '')
          const balanceStr = String(Math.round(fee.balance))
          const formattedPeriod = formatPeriodIST(fee.period)
          const formattedDueDate = formatDateIST(fee.due_date)

          const metaUrl = `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`
          const metaPayload = {
            messaging_product: 'whatsapp',
            to: cleanPhone,
            type: 'template',
            template: {
              name: templateName,
              language: { code: templateLang },
              components: [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: student.full_name },
                    { type: 'text', text: balanceStr },
                    { type: 'text', text: formattedPeriod },
                    { type: 'text', text: formattedDueDate },
                  ],
                },
              ],
            },
          }

          const metaRes = await fetch(metaUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${waToken}`,
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

            sentStudents.push(student.full_name)
          } else {
            const errorMsg =
              metaJson?.error?.message ||
              metaJson?.error?.error_user_msg ||
              'Meta API returned error'

            console.error(`Meta API failure for ${student.full_name}:`, metaJson)

            await adminClient
              .from('message_log')
              .update({
                status: 'failed',
                error: errorMsg,
              })
              .eq('id', logId)

            failedStudents.push(`${student.full_name}: ${errorMsg}`)
          }
        } catch (callErr: unknown) {
          const errStr =
            callErr instanceof Error ? callErr.message : 'Network error'
          console.error(`Call error for ${student.full_name}:`, callErr)

          await adminClient
            .from('message_log')
            .update({
              status: 'failed',
              error: errStr,
            })
            .eq('id', logId)

          failedStudents.push(`${student.full_name}: ${errStr}`)
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    return new Response(
      JSON.stringify({
        dry_run: isDryRun,
        sent: sentStudents.length,
        failed: failedStudents.length,
        already_sent: alreadySentStudents.length,
        skipped_no_consent: skippedNoConsentStudents.length,
        sent_students: sentStudents,
        failed_students: failedStudents,
        already_sent_students: alreadySentStudents,
        skipped_no_consent_students: skippedNoConsentStudents,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('send-fee-reminders Edge Function error:', error)
    return new Response(JSON.stringify({ error: 'An internal server error occurred.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
