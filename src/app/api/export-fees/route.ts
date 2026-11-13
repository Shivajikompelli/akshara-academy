import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/auth'
import { apiError } from '@/lib/api-response'

function getMonthDateRange(monthStr: string): { start: string; endExclusive: string } {
  const [y, m] = monthStr.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const nextDt = new Date(y, m, 1)
  const endExclusive = `${nextDt.getFullYear()}-${String(nextDt.getMonth() + 1).padStart(2, '0')}-01`
  return { start, endExclusive }
}

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

function formatDateText(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
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

function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""'
  if (typeof val === 'number') return `"${val}"`
  let str = String(val)
  // Neutralize spreadsheet formula triggers (=, +, -, @, tab, CR) against CSV Formula Injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  return `"${str.replace(/"/g, '""')}"`
}

function getTodayIST(): string {
  const now = new Date()
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const istDate = new Date(now.getTime() + istOffsetMs)
  return istDate.toISOString().split('T')[0]
}

function getDaysOverdue(dueDate: string, todayStr: string): number {
  if (!todayStr || dueDate >= todayStr) return 0
  const dueTime = new Date(dueDate).getTime()
  const nowTime = new Date(todayStr).getTime()
  return Math.max(0, Math.floor((nowTime - dueTime) / (1000 * 60 * 60 * 24)))
}

export interface BalanceSheetClassRow {
  class_level: string
  students_count: number
  total_due: number
  total_paid: number
  total_balance: number
  overdue_count: number
  collection_pct: number
}

export interface BalanceSheetModeSummary {
  mode: string
  label: string
  amount: number
  count: number
}

export interface BalanceSheetLedgerRow {
  fee_id: string
  student_id: string
  admission_no: string
  full_name: string
  class_level: string
  school: string
  parent_name: string
  phone: string
  period: string
  period_label: string
  due_date: string
  amount_due: number
  amount_paid: number
  balance: number
  status: string
  days_overdue: number
  payment_modes: string
  last_paid_on: string | null
  references: string
}

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') || 'all' // e.g. '2026-11' or 'all'
    const classFilter = searchParams.get('class_level') || 'all'
    const statusFilter = searchParams.get('status') || 'all' // 'all' | 'pending' | 'paid' | 'overdue'
    const format = searchParams.get('format') || 'csv' // 'csv' | 'json'

    const todayIST = getTodayIST()

    // 2. Fetch fee_summary rows
    let summaryQuery = dbClient.from('fee_summary').select('*')
    if (month !== 'all' && /^\d{4}-\d{2}$/.test(month)) {
      const { start, endExclusive } = getMonthDateRange(month)
      summaryQuery = summaryQuery.gte('period', start).lt('period', endExclusive)
    } else {
      summaryQuery = summaryQuery.limit(5000)
    }

    const { data: summaryData, error: summaryError } = await summaryQuery
    if (summaryError) throw summaryError

    // 3. Fetch student details
    const { data: studentsData, error: studentsError } = await dbClient
      .from('students')
      .select('id, admission_no, full_name, class_level, school, parent_name, phone')

    if (studentsError) throw studentsError

    const studentsMap = new Map<
      string,
      {
        admission_no: string | null
        full_name: string
        class_level: string
        school: string | null
        parent_name: string
        phone: string
      }
    >()
    ;(studentsData || []).forEach((s) => {
      studentsMap.set(s.id, {
        admission_no: s.admission_no,
        full_name: s.full_name,
        class_level: s.class_level,
        school: s.school,
        parent_name: s.parent_name,
        phone: s.phone,
      })
    })

    // 4. Filter fee rows by class_level and status
    const filteredSummary = (summaryData || []).filter((row) => {
      const st = studentsMap.get(row.student_id)
      const cls = st?.class_level || 'Unassigned'
      if (classFilter !== 'all' && cls !== classFilter) {
        return false
      }
      if (statusFilter === 'paid' && row.status !== 'paid') {
        return false
      }
      if (statusFilter === 'pending' && row.status === 'paid') {
        return false
      }
      if (statusFilter === 'overdue' && row.status !== 'overdue') {
        return false
      }
      return true
    })

    // 5. Fetch fee_payments for the matching fee_ids to calculate Cash / UPI / Bank split
    const feeIds = filteredSummary.map((r) => r.fee_id).filter(Boolean)
    interface PaymentRow {
      id: string
      fee_id: string
      amount: number
      paid_on: string
      mode: string
      reference: string | null
    }
    let paymentsData: PaymentRow[] = []

    if (feeIds.length > 0) {
      // Chunk feeIds in batches of 500 if large
      const chunkSize = 500
      for (let i = 0; i < feeIds.length; i += chunkSize) {
        const chunk = feeIds.slice(i, i + chunkSize)
        const { data: pRows, error: pErr } = await dbClient
          .from('fee_payments')
          .select('id, fee_id, amount, paid_on, mode, reference')
          .in('fee_id', chunk)
          .order('paid_on', { ascending: false })

        if (pErr) throw pErr
        if (pRows) {
          paymentsData = paymentsData.concat(pRows as PaymentRow[])
        }
      }
    }

    // Group payments by fee_id and by mode
    const paymentsByFee = new Map<string, PaymentRow[]>()
    const modeTotals = new Map<string, { amount: number; count: number }>([
      ['cash', { amount: 0, count: 0 }],
      ['upi', { amount: 0, count: 0 }],
      ['bank', { amount: 0, count: 0 }],
    ])

    paymentsData.forEach((p) => {
      const list = paymentsByFee.get(p.fee_id) || []
      list.push(p)
      paymentsByFee.set(p.fee_id, list)

      const modeKey = (p.mode || 'cash').toLowerCase()
      const current = modeTotals.get(modeKey) || { amount: 0, count: 0 }
      current.amount += Number(p.amount) || 0
      current.count += 1
      modeTotals.set(modeKey, current)
    })

    // 6. Build Ledger Rows & Aggregate Metrics
    let totalDue = 0
    let totalPaid = 0
    let totalBalance = 0
    let overdueBalance = 0
    let pendingBalance = 0
    let paidCount = 0
    let partialCount = 0
    let pendingCount = 0
    let overdueCount = 0

    const allUniqueStudentIds = new Set<string>()
    const allOverdueStudentIds = new Set<string>()

    const classStatsMap = new Map<
      string,
      {
        studentIds: Set<string>
        overdueStudentIds: Set<string>
        total_due: number
        total_paid: number
        total_balance: number
      }
    >()

    const ledgerRows: BalanceSheetLedgerRow[] = filteredSummary.map((row) => {
      const st = studentsMap.get(row.student_id)
      const feePayments = paymentsByFee.get(row.fee_id) || []
      const amountDue = Number(row.amount_due) || 0
      const amountPaid = Number(row.amount_paid) || 0
      const balance = Number(row.balance) || 0
      const status = String(row.status || 'pending')
      const daysOverdue = status === 'overdue' ? getDaysOverdue(row.due_date, todayIST) : 0
      const classLevel = st?.class_level || 'Unassigned'

      totalDue += amountDue
      totalPaid += amountPaid
      totalBalance += balance
      if (row.student_id) allUniqueStudentIds.add(row.student_id)

      if (status === 'paid') paidCount++
      else if (status === 'partial') {
        partialCount++
        pendingBalance += balance
      } else if (status === 'overdue') {
        overdueCount++
        overdueBalance += balance
        if (row.student_id) allOverdueStudentIds.add(row.student_id)
      } else {
        pendingCount++
        pendingBalance += balance
      }

      const clsStat = classStatsMap.get(classLevel) || {
        studentIds: new Set<string>(),
        overdueStudentIds: new Set<string>(),
        total_due: 0,
        total_paid: 0,
        total_balance: 0,
      }
      if (row.student_id) clsStat.studentIds.add(row.student_id)
      clsStat.total_due += amountDue
      clsStat.total_paid += amountPaid
      clsStat.total_balance += balance
      if (status === 'overdue' && row.student_id) clsStat.overdueStudentIds.add(row.student_id)
      classStatsMap.set(classLevel, clsStat)

      const uniqueModes = Array.from(
        new Set(feePayments.map((p) => (p.mode || 'cash').toUpperCase()))
      ).join(', ')

      const lastPaidOn = feePayments.length > 0 ? feePayments[0].paid_on : null
      const refs = feePayments
        .map((p) => p.reference?.trim())
        .filter(Boolean)
        .join('; ')

      return {
        fee_id: row.fee_id,
        student_id: row.student_id,
        admission_no: st?.admission_no || '-',
        full_name: row.full_name,
        class_level: classLevel,
        school: st?.school || '-',
        parent_name: st?.parent_name || '-',
        phone: st?.phone || '-',
        period: row.period,
        period_label: formatPeriodText(row.period),
        due_date: row.due_date,
        amount_due: amountDue,
        amount_paid: amountPaid,
        balance,
        status,
        days_overdue: daysOverdue,
        payment_modes: uniqueModes || '-',
        last_paid_on: lastPaidOn,
        references: refs || '-',
      }
    })

    // Sort ledger rows: natural class sort, then student name
    ledgerRows.sort((a, b) => {
      const numA = parseInt(a.class_level.replace(/\D/g, ''), 10) || 99
      const numB = parseInt(b.class_level.replace(/\D/g, ''), 10) || 99
      if (numA !== numB) return numA - numB
      return a.full_name.localeCompare(b.full_name)
    })

    // Build sorted Class-Wise Balance Sheet rows
    const classBreakdown: BalanceSheetClassRow[] = Array.from(classStatsMap.entries())
      .map(([class_level, st]) => ({
        class_level,
        students_count: st.studentIds.size,
        total_due: st.total_due,
        total_paid: st.total_paid,
        total_balance: st.total_balance,
        overdue_count: st.overdueStudentIds.size,
        collection_pct:
          st.total_due > 0 ? Math.round((st.total_paid / st.total_due) * 1000) / 10 : 0,
      }))
      .sort((a, b) => {
        const numA = parseInt(a.class_level.replace(/\D/g, ''), 10) || 99
        const numB = parseInt(b.class_level.replace(/\D/g, ''), 10) || 99
        return numA - numB
      })

    const modeLabels: Record<string, string> = {
      cash: 'Cash in Hand',
      upi: 'UPI Transfers',
      bank: 'Bank Transfers',
      online: 'Online Payments',
    }

    const modeBreakdown: BalanceSheetModeSummary[] = Array.from(modeTotals.entries()).map(
      ([mode, info]) => ({
        mode,
        label: modeLabels[mode] || mode.toUpperCase(),
        amount: info.amount,
        count: info.count,
      })
    )

    const collectionPct =
      totalDue > 0 ? Math.round((totalPaid / totalDue) * 1000) / 10 : 0

    const scopeTitle =
      month === 'all' ? 'All Months (Cumulative)' : formatPeriodText(`${month}-01`)

    // 7. Return JSON if requested by the in-app Balance Sheet preview dialog
    if (format === 'json') {
      return NextResponse.json({
        scope_title: scopeTitle,
        generated_on: todayIST,
        filters: {
          month,
          class_level: classFilter,
          status: statusFilter,
        },
        summary: {
          total_records: ledgerRows.length,
          total_due: totalDue,
          total_paid: totalPaid,
          total_balance: totalBalance,
          overdue_balance: overdueBalance,
          pending_balance: pendingBalance,
          collection_pct: collectionPct,
          paid_count: paidCount,
          partial_count: partialCount,
          pending_count: pendingCount,
          overdue_count: overdueCount,
        },
        mode_breakdown: modeBreakdown,
        class_breakdown: classBreakdown,
        ledger: ledgerRows,
      })
    }

    // 8. Generate Multi-Section Balance Sheet CSV (with UTF-8 BOM for Excel)
    const lines: string[] = []
    const row = (cells: Array<string | number | null | undefined>) =>
      lines.push(cells.map(escapeCsvCell).join(','))

    row(['AKSHARA ACADEMY — FEE BALANCE SHEET & COLLECTION REPORT'])
    row(['Report Period', scopeTitle, 'Class Filter', classFilter === 'all' ? 'All Classes' : classFilter])
    row(['Status Filter', statusFilter.toUpperCase(), 'Generated On', formatDateText(todayIST)])
    lines.push('')

    // SECTION 1: EXECUTIVE BALANCE SHEET SUMMARY
    row(['1. EXECUTIVE BALANCE SHEET SUMMARY (IN INR)'])
    row(['Metric', 'Amount (Rs.)', 'Records / Notes'])
    row(['Total Fees Billed (Expected Revenue)', totalDue, `${ledgerRows.length} fee records`])
    row(['Total Fees Collected (Realized Revenue)', totalPaid, `${paidCount} paid, ${partialCount} partial`])
    row(['Total Outstanding Balance (Receivables)', totalBalance, `${overdueCount + pendingCount + partialCount} unpaid/partial`])
    row(['  - Overdue Receivables (Past Due Date)', overdueBalance, `${overdueCount} overdue records`])
    row(['  - Upcoming / Pending Receivables', pendingBalance, `${pendingCount + partialCount} pending/partial`])
    row(['Collection Efficiency (%)', `${collectionPct}%`, 'Collected / Billed'])
    lines.push('')

    // SECTION 2: PAYMENT MODE RECONCILIATION (CASH VS UPI VS BANK)
    row(['2. COLLECTION BY PAYMENT MODE (RECONCILIATION)'])
    row(['Payment Mode', 'Amount Collected (Rs.)', 'Receipts Count'])
    modeBreakdown.forEach((m) => {
      row([m.label, m.amount, m.count])
    })
    row([
      'TOTAL PAYMENTS RECORDED',
      modeBreakdown.reduce((acc, m) => acc + m.amount, 0),
      modeBreakdown.reduce((acc, m) => acc + m.count, 0),
    ])
    lines.push('')

    // SECTION 3: CLASS-WISE BALANCE SHEET
    row(['3. CLASS-WISE BALANCE SHEET BREAKDOWN'])
    row([
      'Class',
      'Students',
      'Total Billed (Rs.)',
      'Collected (Rs.)',
      'Outstanding Balance (Rs.)',
      'Overdue Students',
      'Collection %',
    ])
    classBreakdown.forEach((c) => {
      row([
        c.class_level,
        c.students_count,
        c.total_due,
        c.total_paid,
        c.total_balance,
        c.overdue_count,
        `${c.collection_pct}%`,
      ])
    })
    row([
      'TOTAL (ALL CLASSES)',
      allUniqueStudentIds.size,
      totalDue,
      totalPaid,
      totalBalance,
      allOverdueStudentIds.size,
      `${collectionPct}%`,
    ])
    lines.push('')

    // SECTION 4: STUDENT-BY-STUDENT FEE LEDGER
    row(['4. DETAILED STUDENT FEE LEDGER'])
    row([
      'S.No',
      'Admission No',
      'Student Name',
      'Class',
      'School',
      'Parent Name',
      'Phone',
      'Fee Month',
      'Due Date',
      'Amount Due (Rs.)',
      'Amount Paid (Rs.)',
      'Balance (Rs.)',
      'Status',
      'Days Overdue',
      'Payment Mode(s)',
      'Last Paid Date',
      'Receipt / Reference',
    ])

    ledgerRows.forEach((item, idx) => {
      row([
        idx + 1,
        item.admission_no,
        item.full_name,
        item.class_level,
        item.school,
        item.parent_name,
        item.phone,
        item.period_label,
        formatDateText(item.due_date),
        item.amount_due,
        item.amount_paid,
        item.balance,
        item.status.toUpperCase(),
        item.days_overdue,
        item.payment_modes,
        formatDateText(item.last_paid_on),
        item.references,
      ])
    })

    // Grand Total Row at bottom of ledger
    row([
      '',
      '',
      'GRAND TOTAL',
      `${allUniqueStudentIds.size} Students (${ledgerRows.length} Records)`,
      '',
      '',
      '',
      '',
      '',
      totalDue,
      totalPaid,
      totalBalance,
      `${collectionPct}% Collected`,
      '',
      '',
      '',
      '',
    ])

    const csvContent = '\uFEFF' + lines.join('\r\n')
    const safeMonth = (month === 'all' ? 'All_Months' : month).replace(/[^a-zA-Z0-9_-]/g, '_')
    const safeClass = (classFilter === 'all' ? 'All_Classes' : classFilter).replace(/[^a-zA-Z0-9_-]/g, '_')
    const filename = `Akshara_Fee_Balance_Sheet_${safeMonth}_${safeClass}.csv`

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'digest' in err &&
      (err as { digest?: string }).digest === 'HANGING_PROMISE_REJECTION'
    ) {
      throw err
    }
    return apiError(err, req)
  }
}

