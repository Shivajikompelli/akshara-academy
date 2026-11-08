import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Schedule config constant: days after due_date to trigger reminders
const REMINDER_OFFSETS_DAYS = [0, 2] // Offset 0 (on due date), Offset 2 (2 days after due date)

// Helper: Get Asia/Kolkata current date string (YYYY-MM-DD)
function getTodayIST(): string {
  const now = new Date()
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const istDate = new Date(now.getTime() + istOffsetMs)
  return istDate.toISOString().split('T')[0]
}

// Helper: Format period into "November 2026" in IST
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

// Helper: Format due date into "5 Nov 2026" in IST
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

// Helper: Calculate days difference (date1 - date2)
function getDaysDifference(targetDate: string, baseDate: string): number {
  const t = new Date(targetDate).getTime()
  const b = new Date(baseDate).getTime()
  return Math.floor((t - b) / (1000 * 60 * 60 * 24))
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const cronSecret = process.env.CRON_SECRET || ''

    // 1. Verify Caller: Authenticated user OR scheduler service role key
    const authHeader = req.headers.get('Authorization')
    let isAuthorized = false

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim()
      if (
        (serviceRoleKey && token === serviceRoleKey) ||
        (cronSecret && token === cronSecret)
      ) {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      const supabase = await createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (!authError && user) {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: invalid or expired session.' },
        { status: 401 }
      )
    }

    const adminClient = serviceRoleKey
      ? createAdminClient(supabaseUrl, serviceRoleKey)
      : await createClient()

    // 2. Parse payload
    let studentIdFilter: string | undefined
    let dryPreview = false

    try {
      const body = await req.json()
      studentIdFilter = body?.student_id
      dryPreview = !!body?.dry_preview
    } catch {
      // Body optional for cron scheduler
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
      return NextResponse.json({
        dry_run: process.env.WHATSAPP_DRY_RUN !== 'false',
        sent: 0,
        failed: 0,
        already_sent: 0,
        skipped_no_consent: 0,
        sent_students: [],
        failed_students: [],
        already_sent_students: [],
        skipped_no_consent_students: [],
        preview_recipients: [],
        message: 'No unpaid fees found.',
      })
    }

    // 5. Load Active Students for these fees
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

    // Filter fees down to active students
    const activeStudentFees = unpaidFees
      .filter((f: any) => studentsMap.has(f.student_id))
      // Sort by period ascending so oldest fee comes first
      .sort((a: any, b: any) => a.period.localeCompare(b.period))

    // 6. Fetch previous fee_reminder logs for these fees to check schedule
    const feeIds = activeStudentFees.map((f: any) => f.fee_id)
    const { data: existingLogs, error: logsError } = await adminClient
      .from('message_log')
      .select('id, student_id, fee_id, status, related_date')
      .eq('kind', 'fee_reminder')
      .neq('status', 'failed')
      .in('fee_id', feeIds)

    if (logsError) throw logsError

    // Group earlier sent logs by fee_id
    const logsByFee = new Map<string, any[]>()
    // Track students who already had a reminder logged today
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

    // Also check if any student had another reminder logged today (even if different fee)
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

    // To ensure: At most ONE fee reminder per student per day,
    // and if a student has several eligible fees, send for the oldest one only:
    const evaluatedStudents = new Set<string>()

    for (const fee of activeStudentFees) {
      const student = studentsMap.get(fee.student_id)
      if (!student) continue

      // If student already has an eligible fee selected in this run, skip newer fees
      if (evaluatedStudents.has(student.id)) {
        continue
      }

      // Check opt-in
      if (!student.whatsapp_opt_in) {
        if (!skippedNoConsentStudents.includes(student.full_name)) {
          skippedNoConsentStudents.push(student.full_name)
        }
        evaluatedStudents.add(student.id)
        continue
      }

      // Check if already reminded today (one per student per day rule)
      if (studentsRemindedToday.has(student.id)) {
        if (!alreadySentStudents.includes(student.full_name)) {
          alreadySentStudents.push(student.full_name)
        }
        evaluatedStudents.add(student.id)
        continue
      }

      const earlierLogs = logsByFee.get(fee.fee_id) || []
      const sentCount = earlierLogs.length

      // Never send more than 2 reminders per fee row
      if (sentCount >= REMINDER_OFFSETS_DAYS.length) {
        continue
      }

      // Schedule Check (skipped if manual single student reminder)
      if (!studentIdFilter) {
        // days since due_date in IST
        const daysSinceDue = getDaysDifference(todayIST, fee.due_date)
        const offsetsReached = REMINDER_OFFSETS_DAYS.filter(
          (offset) => daysSinceDue >= offset
        ).length

        // Reminder is due when sentCount < offsetsReached
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

    // 8. Handle DRY PREVIEW request
    if (dryPreview) {
      const isDryRun = process.env.WHATSAPP_DRY_RUN !== 'false'
      return NextResponse.json({
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
      })
    }

    // 9. Send WhatsApp Reminders
    const isDryRun = process.env.WHATSAPP_DRY_RUN !== 'false'
    const graphApiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || 'v21.0'
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || ''
    const waToken = process.env.WHATSAPP_TOKEN || ''
    const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'en'
    const templateName =
      process.env.WHATSAPP_FEE_TEMPLATE_NAME || 'fee_reminder_v1'

    const sentStudents: string[] = []
    const failedStudents: string[] = []

    for (const item of eligibleQueue) {
      const { fee, student } = item

      // Step A: INSERT message_log row first
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
        // Unique conflict on (student_id, kind, related_date)
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

      // Delay 200 ms between messages
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    return NextResponse.json({
      dry_run: isDryRun,
      sent: sentStudents.length,
      failed: failedStudents.length,
      already_sent: alreadySentStudents.length,
      skipped_no_consent: skippedNoConsentStudents.length,
      sent_students: sentStudents,
      failed_students: failedStudents,
      already_sent_students: alreadySentStudents,
      skipped_no_consent_students: skippedNoConsentStudents,
    })
  } catch (error: unknown) {
    console.error('send-fee-reminders API error:', error)
    const msg = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
