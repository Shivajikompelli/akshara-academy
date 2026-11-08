'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  CreditCard,
  Search,
  RefreshCw,
  AlertTriangle,
  History,
  PlusCircle,
  Receipt,
  Calendar,
  BellRing,
  MoreVertical,
  AlertCircle,
} from 'lucide-react'
import { formatCurrency, formatDate, formatPeriod } from '@/lib/formatters'
import { RecordPaymentDialog } from '@/components/fees/record-payment-dialog'
import { PaymentHistoryDialog } from '@/components/fees/payment-history-dialog'
import { SendFeeRemindersDialog } from '@/components/fees/send-fee-reminders-dialog'
import { StatusBadge } from '@/components/ui/status-badge'
import { InitialsAvatar } from '@/components/ui/initials-avatar'
import { CLASS_OPTIONS, type FeeSummaryRow } from '@/types/database'
import { toast } from 'sonner'

interface FeeRowMenuProps {
  fee: FeeSummaryRow
  onRecordPayment?: () => void
  onSendReminder: () => void
  onViewHistory: () => void
}

function FeeRowMenu({
  fee,
  onRecordPayment,
  onSendReminder,
  onViewHistory,
}: FeeRowMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((prev) => !prev)
        }}
        aria-label="Fee actions menu"
        className="size-11 rounded-[12px] border border-[var(--card-border)] bg-white text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--primary-soft)] flex items-center justify-center cursor-pointer transition-colors shrink-0"
      >
        <MoreVertical className="size-4.5" />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-12 z-50 w-56 rounded-[16px] bg-white border border-[var(--card-border)] p-1.5 shadow-lg space-y-1 animate-in fade-in-0 zoom-in-95"
        >
          {fee.status !== 'paid' && onRecordPayment && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onRecordPayment()
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-bold text-[var(--primary)] hover:bg-[var(--primary-soft)] cursor-pointer text-left transition-colors"
            >
              <CreditCard className="size-4" />
              <span>Record payment</span>
            </button>
          )}

          {fee.status !== 'paid' && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onSendReminder()
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-bold text-[var(--text)] hover:bg-[var(--primary-soft)] cursor-pointer text-left transition-colors"
            >
              <BellRing className="size-4 text-[var(--primary)]" />
              <span>Send WhatsApp reminder</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onViewHistory()
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--primary-soft)] cursor-pointer text-left transition-colors"
          >
            <History className="size-4" />
            <span>Payment history & past fees</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default function FeesPage() {
  const [fees, setFees] = useState<FeeSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingFees, setGeneratingFees] = useState(false)
  const [todayStr, setTodayStr] = useState<string>('')

  // 1. Month Controls (default current month)
  const [selectedMonth, setSelectedMonth] = useState<string>('')

  // Filters & Search
  // Tabs: All / Pending / Paid, with an Overdue filter chip
  const [statusTab, setStatusTab] = useState<'all' | 'pending' | 'paid'>('all')
  const [overdueChipActive, setOverdueChipActive] = useState(false)
  const [classFilter, setClassFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewAllMonths, setViewAllMonths] = useState(false)

  // Dialog states
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [selectedFee, setSelectedFee] = useState<FeeSummaryRow | null>(null)

  // Reminder Dialog states
  const [remindersDialogOpen, setRemindersDialogOpen] = useState(false)
  const [selectedSingleStudent, setSelectedSingleStudent] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    const now = new Date()
    setTodayStr(now.toISOString().split('T')[0])
    const currentYear = now.getFullYear()
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0')
    setSelectedMonth(`${currentYear}-${currentMonth}`)
  }, [])

  // Calculate days overdue for a given due_date
  const getDaysOverdue = useCallback((dueDate: string) => {
    if (!todayStr || dueDate >= todayStr) return 0
    const dueTime = new Date(dueDate).getTime()
    const nowTime = new Date(todayStr).getTime()
    return Math.max(0, Math.floor((nowTime - dueTime) / (1000 * 60 * 60 * 24)))
  }, [todayStr])

  // Fetch fees from fee_summary view and enrich with student class, phone, and reminder counts
  const fetchFeesData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      // 1. Fetch fee_summary rows
      const { data: summaryData, error: summaryError } = await supabase
        .from('fee_summary')
        .select('*')

      if (summaryError) throw summaryError

      // 2. Fetch student details to enrich class and parent phone
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, class_level, parent_name, phone')

      if (studentsError) throw studentsError

      const studentsMap = new Map<string, { class_level: string; parent_name: string; phone: string }>()
      ;(studentsData || []).forEach((s) => {
        studentsMap.set(s.id, {
          class_level: s.class_level,
          parent_name: s.parent_name,
          phone: s.phone,
        })
      })

      // 3. Fetch message_log for fee reminders to enrich reminder count & last sent date
      const { data: reminderLogs } = await supabase
        .from('message_log')
        .select('fee_id, status, related_date, created_at')
        .eq('kind', 'fee_reminder')
        .neq('status', 'failed')
        .not('fee_id', 'is', null)

      const remindersMap = new Map<string, { count: number; lastDate: string | null }>()
      ;(reminderLogs || []).forEach((r) => {
        if (!r.fee_id) return
        const prev = remindersMap.get(r.fee_id) || { count: 0, lastDate: null }
        prev.count += 1
        const dateVal = r.related_date || (r.created_at ? r.created_at.split('T')[0] : null)
        if (!prev.lastDate || (dateVal && dateVal > prev.lastDate)) {
          prev.lastDate = dateVal
        }
        remindersMap.set(r.fee_id, prev)
      })

      const enriched: FeeSummaryRow[] = (summaryData || []).map((row) => {
        const studentInfo = studentsMap.get(row.student_id)
        const reminderInfo = remindersMap.get(row.fee_id)
        return {
          fee_id: row.fee_id,
          student_id: row.student_id,
          full_name: row.full_name,
          period: row.period,
          amount_due: Number(row.amount_due) || 0,
          due_date: row.due_date,
          amount_paid: Number(row.amount_paid) || 0,
          balance: Number(row.balance) || 0,
          status: row.status as 'paid' | 'partial' | 'pending' | 'overdue',
          class_level: studentInfo?.class_level,
          parent_name: studentInfo?.parent_name,
          phone: studentInfo?.phone,
          reminders_sent: reminderInfo?.count || 0,
          last_reminder_date: reminderInfo?.lastDate || null,
        }
      })

      setFees(enriched)
    } catch (err: unknown) {
      console.error('Failed to load fees:', err)
      const msg = err instanceof Error ? err.message : 'Failed to load fees dashboard'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFeesData()
  }, [fetchFeesData])

  // "Generate fees for this month" action
  async function handleGenerateMonthlyFees() {
    if (!selectedMonth) return
    setGeneratingFees(true)
    const supabase = createClient()
    const targetMonthDate = `${selectedMonth}-01`

    try {
      const { data, error } = await supabase.rpc('generate_monthly_fees', {
        p_month: targetMonthDate,
      })

      if (error) {
        const [y, m] = selectedMonth.split('-').map(Number)
        const { data: activeStudents, error: fetchErr } = await supabase
          .from('students')
          .select('id, monthly_fee, fee_due_day')
          .eq('status', 'active')
          .gt('monthly_fee', 0)

        if (fetchErr) throw fetchErr

        if (activeStudents && activeStudents.length > 0) {
          const rows = activeStudents.map((s) => {
            const dueDay = Math.min(28, Math.max(1, s.fee_due_day || 5))
            const due = new Date(y, m - 1, dueDay).toISOString().split('T')[0]
            return {
              student_id: s.id,
              period: targetMonthDate,
              amount_due: s.monthly_fee,
              due_date: due,
            }
          })

          const { error: insertErr } = await supabase
            .from('fees')
            .upsert(rows, { onConflict: 'student_id, period' })

          if (insertErr) throw insertErr
        }
        toast.success(`Generated monthly fees for ${formatPeriod(targetMonthDate)}!`)
      } else {
        const rowsCreated = typeof data === 'number' ? data : 0
        if (rowsCreated > 0) {
          toast.success(
            `Generated ${rowsCreated} fee row(s) for ${formatPeriod(targetMonthDate)}!`
          )
        } else {
          toast.info(
            `All active students already have fee rows for ${formatPeriod(targetMonthDate)}.`
          )
        }
      }

      await fetchFeesData()
    } catch (err: unknown) {
      console.error('Failed to generate fees:', err)
      const msg = err instanceof Error ? err.message : 'Failed to generate monthly fees'
      toast.error(msg)
    } finally {
      setGeneratingFees(false)
    }
  }

  // Fees for the selected month
  const monthFees = useMemo(() => {
    if (!selectedMonth) return []
    return fees.filter((f) => f.period.startsWith(selectedMonth))
  }, [fees, selectedMonth])

  // Summary figures for the selected month
  const monthStats = useMemo(() => {
    let totalDue = 0
    let totalPaid = 0
    let totalBalance = 0
    let overdueCount = 0

    monthFees.forEach((f) => {
      totalDue += f.amount_due
      totalPaid += f.amount_paid
      totalBalance += f.balance
      if (f.status === 'overdue') {
        overdueCount++
      }
    })

    return {
      totalDue,
      totalPaid,
      totalBalance,
      overdueCount,
    }
  }, [monthFees])

  // Filtered & Sorted Fees List (Default sort: overdue first, longest overdue at top)
  const filteredFees = useMemo(() => {
    const baseList = viewAllMonths ? fees : monthFees

    return baseList
      .filter((fee) => {
        // Overdue filter chip takes precedence if toggled on
        if (overdueChipActive && fee.status !== 'overdue') {
          return false
        }

        // Tabs: All / Pending / Paid
        if (statusTab === 'paid' && fee.status !== 'paid') {
          return false
        }
        if (statusTab === 'pending' && fee.status === 'paid') {
          return false
        }

        // Class filter
        if (classFilter !== 'all' && fee.class_level !== classFilter) {
          return false
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim()
          const nameMatch = fee.full_name.toLowerCase().includes(q)
          const phoneMatch = fee.phone?.toLowerCase().includes(q)
          if (!nameMatch && !phoneMatch) return false
        }

        return true
      })
      .sort((a, b) => {
        // Default sort stays overdue first, longest overdue at the top
        const overdueA = a.status === 'overdue' ? getDaysOverdue(a.due_date) : -1
        const overdueB = b.status === 'overdue' ? getDaysOverdue(b.due_date) : -1

        if (overdueA !== overdueB) {
          return overdueB - overdueA
        }

        return b.balance - a.balance
      })
  }, [fees, monthFees, viewAllMonths, statusTab, overdueChipActive, classFilter, searchQuery, getDaysOverdue])

  function handleOpenRecordPayment(fee: FeeSummaryRow) {
    setSelectedFee(fee)
    setPaymentDialogOpen(true)
  }

  function handleOpenHistory(fee: FeeSummaryRow) {
    setSelectedFee(fee)
    setHistoryDialogOpen(true)
  }

  function handleOpenSingleReminder(fee: FeeSummaryRow) {
    setSelectedSingleStudent({ id: fee.student_id, name: fee.full_name })
    setRemindersDialogOpen(true)
  }

  return (
    <div className="space-y-6 max-w-[960px] mx-auto pb-16">
      {/* 1. TOP HEADER & MONTH SUMMARY CARD */}
      <div className="bg-white p-5 sm:p-6 rounded-[24px] border border-[var(--card-border)] shadow-2xs space-y-6">
        {/* Header line & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
              Fees Dashboard
            </h1>
            <p className="text-sm font-normal text-[var(--text-secondary)] mt-0.5">
              Track student fee collections, record payments, and manage WhatsApp reminders.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={fetchFeesData}
              disabled={loading}
              className="size-11 rounded-[12px] border border-[var(--card-border)] bg-white text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--primary-soft)] flex items-center justify-center cursor-pointer transition-colors"
              title="Refresh fees"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Send Reminders Now Button */}
            <button
              type="button"
              onClick={() => {
                setSelectedSingleStudent(null)
                setRemindersDialogOpen(true)
              }}
              disabled={loading}
              className="min-h-[44px] px-4 rounded-[12px] border-2 border-[var(--card-border)] bg-white text-[var(--primary)] hover:bg-[var(--primary-soft)] font-bold text-sm flex items-center gap-2 cursor-pointer transition-colors"
            >
              <BellRing className="size-4" />
              <span>Send reminders</span>
            </button>

            {/* Generate Monthly Fees Button */}
            <button
              type="button"
              onClick={handleGenerateMonthlyFees}
              disabled={generatingFees || loading || !selectedMonth}
              className="min-h-[44px] px-5 rounded-[12px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-sm flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              <PlusCircle className="size-4" />
              <span>
                {generatingFees ? 'Generating...' : 'Generate fees for this month'}
              </span>
            </button>
          </div>
        </div>

        {/* Month Selector Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-[var(--card-border)]/50">
          <div className="flex items-center gap-2.5">
            <Calendar className="size-4 text-[var(--text-secondary)] shrink-0" />
            <label htmlFor="monthSelector" className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Month:
            </label>
            <input
              id="monthSelector"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-10 px-3 rounded-[12px] border border-[var(--card-border)] bg-white text-sm font-bold text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setViewAllMonths(!viewAllMonths)}
              className={`text-xs font-bold px-3.5 py-1.5 rounded-full border transition-all cursor-pointer ${
                viewAllMonths
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)]/30'
                  : 'bg-white text-[var(--text-secondary)] border-[var(--card-border)] hover:bg-[var(--primary-soft)]'
              }`}
            >
              {viewAllMonths ? 'Showing All Months' : 'Showing Selected Month Only'}
            </button>
          </div>
        </div>

        {/* SUMMARY CARD: Collected vs Outstanding for the month, in large type */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[var(--card-border)]/50">
          {/* Collected (in large type) */}
          <div className="p-4 sm:p-5 rounded-[20px] bg-[var(--present-bg)] border border-[var(--present)]/20 space-y-1">
            <span className="text-xs font-bold text-[var(--present-text)] uppercase tracking-wider block">
              Collected
            </span>
            <span className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--present-text)] block">
              {formatCurrency(viewAllMonths ? fees.reduce((a, b) => a + b.amount_paid, 0) : monthStats.totalPaid)}
            </span>
            <span className="text-xs text-[var(--present-text)] opacity-80 font-normal block">
              Total received {viewAllMonths ? 'across all months' : `for ${formatPeriod(selectedMonth + '-01')}`}
            </span>
          </div>

          {/* Outstanding (in large type) */}
          <div className="p-4 sm:p-5 rounded-[20px] bg-white border border-[var(--card-border)] space-y-1">
            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
              Outstanding
            </span>
            <span className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text)] block">
              {formatCurrency(viewAllMonths ? fees.reduce((a, b) => a + b.balance, 0) : monthStats.totalBalance)}
            </span>
            <span className="text-xs text-[var(--text-secondary)] font-normal block">
              Uncollected balance
            </span>
          </div>

          {/* Total Due & Overdue Students */}
          <div className="p-4 sm:p-5 rounded-[20px] bg-[var(--absent-bg)] border border-[var(--absent)]/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--absent-text)] uppercase tracking-wider block">
                Overdue
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--absent)] text-white text-xs font-bold">
                {viewAllMonths ? fees.filter((f) => f.status === 'overdue').length : monthStats.overdueCount} Students
              </span>
            </div>
            <span className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--absent-text)] block">
              {viewAllMonths ? fees.filter((f) => f.status === 'overdue').length : monthStats.overdueCount} Overdue
            </span>
            <span className="text-xs text-[var(--absent-text)] font-normal block">
              Total Billed: <strong>{formatCurrency(viewAllMonths ? fees.reduce((a, b) => a + b.amount_due, 0) : monthStats.totalDue)}</strong>
            </span>
          </div>
        </div>

        {/* Hint if zero fee rows for the selected month */}
        {!loading && monthFees.length === 0 && !viewAllMonths && (
          <div className="p-4 bg-[var(--warn-bg)] border border-[var(--warn)]/30 rounded-[16px] text-[var(--warn-text)] text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="size-5 shrink-0" />
              <span>
                No fee records found for <strong>{formatPeriod(selectedMonth + '-01')}</strong>. Tap{' '}
                <strong>&quot;Generate fees for this month&quot;</strong> to generate records for all active students.
              </span>
            </div>
            <button
              type="button"
              onClick={handleGenerateMonthlyFees}
              disabled={generatingFees}
              className="min-h-[40px] px-4 rounded-[12px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs cursor-pointer shrink-0 self-start sm:self-auto"
            >
              Generate Now
            </button>
          </div>
        )}
      </div>

      {/* 2. TABS: All / Pending / Paid, with an Overdue filter chip */}
      <div className="bg-white p-5 rounded-[24px] border border-[var(--card-border)] shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Tabs: All / Pending / Paid */}
          <div className="flex items-center gap-1.5 p-1 bg-[var(--primary-soft)] rounded-[14px]">
            <button
              type="button"
              onClick={() => {
                setStatusTab('all')
                setOverdueChipActive(false)
              }}
              className={`px-4 py-2 rounded-[10px] text-sm font-bold transition-all cursor-pointer ${
                statusTab === 'all' && !overdueChipActive
                  ? 'bg-white text-[var(--text)] shadow-2xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              All ({fees.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusTab('pending')
                setOverdueChipActive(false)
              }}
              className={`px-4 py-2 rounded-[10px] text-sm font-bold transition-all cursor-pointer ${
                statusTab === 'pending' && !overdueChipActive
                  ? 'bg-white text-[var(--text)] shadow-2xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              Pending ({fees.filter((f) => f.status !== 'paid').length})
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusTab('paid')
                setOverdueChipActive(false)
              }}
              className={`px-4 py-2 rounded-[10px] text-sm font-bold transition-all cursor-pointer ${
                statusTab === 'paid' && !overdueChipActive
                  ? 'bg-white text-[var(--present-text)] shadow-2xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              Paid ({fees.filter((f) => f.status === 'paid').length})
            </button>
          </div>

          {/* Overdue Filter Chip */}
          <button
            type="button"
            onClick={() => setOverdueChipActive(!overdueChipActive)}
            className={`min-h-[44px] px-4 rounded-full font-bold text-xs flex items-center gap-2 cursor-pointer transition-all self-start sm:self-auto ${
              overdueChipActive
                ? 'bg-[var(--absent)] text-white shadow-xs'
                : 'bg-[var(--absent-bg)] text-[var(--absent-text)] border border-[var(--absent)]/30 hover:border-[var(--absent)]'
            }`}
          >
            <AlertTriangle className="size-3.5" />
            <span>Overdue Only ({fees.filter((f) => f.status === 'overdue').length})</span>
          </button>
        </div>

        {/* Search & Class Dropdown */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-[var(--card-border)]/50">
          {/* Search box (name or phone) */}
          <div className="sm:col-span-8 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)]" />
            <input
              type="text"
              placeholder="Search by student name or parent phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-[12px] border border-[var(--card-border)] bg-white text-base text-[var(--text)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          {/* Class Filter */}
          <div className="sm:col-span-4">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full h-11 px-3 rounded-[12px] border border-[var(--card-border)] bg-white text-base font-bold text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer"
            >
              <option value="all">All Classes</option>
              {CLASS_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. FEES LIST (Desktop Table & Mobile Cards) */}
      {loading ? (
        <div className="p-12 text-center text-sm font-bold text-[var(--text-secondary)] bg-white rounded-[24px] border border-[var(--card-border)] shadow-2xs">
          <RefreshCw className="size-6 animate-spin mx-auto text-[var(--primary)] mb-2" />
          <span>Loading fees records...</span>
        </div>
      ) : filteredFees.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-[24px] border border-dashed border-[var(--card-border)] shadow-2xs">
          <Receipt className="size-10 mx-auto text-[var(--text-secondary)] opacity-50 mb-2" />
          <h3 className="font-bold text-[var(--text)] text-base">No fee records match your filters</h3>
          <p className="text-sm font-normal text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
            Try adjusting your search query, status tabs, or selected month.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-[24px] border border-[var(--card-border)] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--card-border)]/60 bg-[var(--primary-soft)]/50">
                    <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Student</th>
                    <th className="py-4 px-3 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Class</th>
                    <th className="py-4 px-3 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Parent Phone</th>
                    <th className="py-4 px-3 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] text-right">Amount</th>
                    <th className="py-4 px-3 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] text-right">Balance</th>
                    <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Due Date</th>
                    <th className="py-4 px-3 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Status</th>
                    <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--card-border)]/50">
                  {filteredFees.map((fee) => {
                    const isUnpaidOrPartial = fee.status !== 'paid'
                    return (
                      <tr
                        key={fee.fee_id}
                        className="hover:bg-[var(--primary-soft)]/30 cursor-pointer transition-colors"
                        onClick={() => handleOpenHistory(fee)}
                      >
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <InitialsAvatar name={fee.full_name} size="sm" />
                            <div>
                              <span className="font-bold text-base text-[var(--text)] block">
                                {fee.full_name}
                              </span>
                              <span className="text-xs font-normal text-[var(--text-secondary)] block">
                                Parent: {fee.parent_name || 'N/A'}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-3 text-sm font-bold text-[var(--text)]">
                          {fee.class_level || '-'}
                        </td>

                        <td className="py-4 px-3 text-sm font-normal text-[var(--text-secondary)] font-mono">
                          {fee.phone || '-'}
                        </td>

                        <td className="py-4 px-3 text-sm font-semibold text-[var(--text)] text-right">
                          {formatCurrency(fee.amount_due)}
                        </td>

                        <td className="py-4 px-3 text-base font-bold text-right">
                          <span className={fee.balance > 0 ? 'text-[var(--absent-text)]' : 'text-[var(--text-secondary)]'}>
                            {formatCurrency(fee.balance)}
                          </span>
                        </td>

                        <td className="py-4 px-4 text-sm font-normal text-[var(--text-secondary)]">
                          <span>{formatDate(fee.due_date)}</span>
                          <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
                            <BellRing className="size-3 text-[var(--text-secondary)]" />
                            <span>
                              Reminders: {fee.reminders_sent || 0}/2
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-3">
                          <StatusBadge
                            status={fee.status}
                            daysOverdue={getDaysOverdue(fee.due_date)}
                          />
                        </td>

                        <td className="py-4 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {/* "Record payment" is the row's ONE visible action */}
                            {isUnpaidOrPartial && (
                              <button
                                type="button"
                                onClick={() => handleOpenRecordPayment(fee)}
                                className="min-h-[44px] px-4 rounded-[12px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-sm flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                              >
                                <CreditCard className="size-4" />
                                <span>Record payment</span>
                              </button>
                            )}

                            {/* Row Menu: "Send reminder" and history move into this menu */}
                            <FeeRowMenu
                              fee={fee}
                              onRecordPayment={isUnpaidOrPartial ? () => handleOpenRecordPayment(fee) : undefined}
                              onSendReminder={() => handleOpenSingleReminder(fee)}
                              onViewHistory={() => handleOpenHistory(fee)}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredFees.map((fee) => {
              const isUnpaidOrPartial = fee.status !== 'paid'
              return (
                <div
                  key={fee.fee_id}
                  onClick={() => handleOpenHistory(fee)}
                  className="bg-white p-5 rounded-[20px] border border-[var(--card-border)] shadow-2xs space-y-3 cursor-pointer active:bg-[var(--primary-soft)]/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar name={fee.full_name} size="sm" />
                      <div>
                        <h3 className="font-bold text-[var(--text)] text-base">{fee.full_name}</h3>
                        <p className="text-xs font-normal text-[var(--text-secondary)] mt-0.5">
                          {fee.class_level || 'Student'} • {fee.phone || 'No phone'}
                        </p>
                      </div>
                    </div>
                    <StatusBadge
                      status={fee.status}
                      daysOverdue={getDaysOverdue(fee.due_date)}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-[var(--primary-soft)]/40 rounded-[14px] text-center text-xs">
                    <div>
                      <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase block">Due</span>
                      <span className="font-bold text-[var(--text)] text-sm">
                        {formatCurrency(fee.amount_due)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase block">Paid</span>
                      <span className="font-bold text-[var(--present-text)] text-sm">
                        {formatCurrency(fee.amount_paid)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase block">Balance</span>
                      <span className="font-bold text-[var(--absent-text)] text-sm">
                        {formatCurrency(fee.balance)}
                      </span>
                    </div>
                  </div>

                  {/* Due Date & Reminders */}
                  <div className="text-xs text-[var(--text-secondary)] flex items-center justify-between pt-1">
                    <span>Due: <strong>{formatDate(fee.due_date)}</strong></span>
                    <span className="flex items-center gap-1 font-medium">
                      <BellRing className="size-3 text-[var(--text-secondary)]" />
                      Reminders: {fee.reminders_sent || 0}/2
                    </span>
                  </div>

                  {/* Actions: "Record payment" as visible action + row menu */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--card-border)]/50" onClick={(e) => e.stopPropagation()}>
                    {isUnpaidOrPartial && (
                      <button
                        type="button"
                        onClick={() => handleOpenRecordPayment(fee)}
                        className="min-h-[44px] px-4 rounded-[12px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-sm flex items-center gap-1.5 cursor-pointer shadow-xs flex-1 justify-center"
                      >
                        <CreditCard className="size-4" />
                        <span>Record payment</span>
                      </button>
                    )}

                    <FeeRowMenu
                      fee={fee}
                      onRecordPayment={isUnpaidOrPartial ? () => handleOpenRecordPayment(fee) : undefined}
                      onSendReminder={() => handleOpenSingleReminder(fee)}
                      onViewHistory={() => handleOpenHistory(fee)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        fee={selectedFee}
        onPaymentRecorded={fetchFeesData}
      />

      {/* Payment History & Edit Amount Dialog */}
      <PaymentHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        fee={selectedFee}
        onFeeUpdated={fetchFeesData}
      />

      {/* Scheduled Fee Reminders / Single Reminder Dialog */}
      <SendFeeRemindersDialog
        open={remindersDialogOpen}
        onOpenChange={setRemindersDialogOpen}
        onCompleted={fetchFeesData}
        singleStudentId={selectedSingleStudent?.id}
        singleStudentName={selectedSingleStudent?.name}
      />
    </div>
  )
}
