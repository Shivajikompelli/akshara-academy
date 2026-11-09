'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  CreditCard,
  Search,
  RefreshCw,
  History,
  PlusCircle,
  Receipt,
  BellRing,
  MoreVertical,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar, 
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

  // Month Controls (default current month)
  const [selectedMonth, setSelectedMonth] = useState<string>('')

  useEffect(() => {
    let ignore = false
    const timer = setTimeout(() => {
      if (ignore) return
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0')
      setTodayStr(now.toISOString().split('T')[0])
      setSelectedMonth(`${currentYear}-${currentMonth}`)
    }, 0)
    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [])

  // Filters & Search: Tabs: All / Pending / Paid, with an Overdue filter chip
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

  // Fee Actions menu state
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false)
  const actionsMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setActionsMenuOpen(false)
      }
    }
    if (actionsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [actionsMenuOpen])



  // Adjust month by step (-1 or +1)
  function adjustMonth(delta: number) {
    if (!selectedMonth) return
    const [year, month] = selectedMonth.split('-').map(Number)
    const dt = new Date(year, month - 1 + delta, 1)
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    setSelectedMonth(`${y}-${m}`)
  }

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
      const { data: summaryData, error: summaryError } = await supabase
        .from('fee_summary')
        .select('*')

      if (summaryError) throw summaryError

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
    let ignore = false

    async function loadFees() {
      const supabase = createClient()

      try {
        const { data: summaryData, error: summaryError } = await supabase
          .from('fee_summary')
          .select('*')

        if (summaryError) throw summaryError

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

        if (!ignore) {
          setFees(enriched)
        }
      } catch (err: unknown) {
        if (!ignore) {
          console.error('Failed to load fees:', err)
          const msg = err instanceof Error ? err.message : 'Failed to load fees dashboard'
          toast.error(msg)
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    void loadFees()

    return () => {
      ignore = true
    }
  }, [])

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
        if (overdueChipActive && fee.status !== 'overdue') {
          return false
        }
        if (statusTab === 'paid' && fee.status !== 'paid') {
          return false
        }
        if (statusTab === 'pending' && fee.status === 'paid') {
          return false
        }
        if (classFilter !== 'all' && fee.class_level !== classFilter) {
          return false
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim()
          const nameMatch = fee.full_name.toLowerCase().includes(q)
          const phoneMatch = fee.phone?.toLowerCase().includes(q)
          if (!nameMatch && !phoneMatch) return false
        }
        return true
      })
      .sort((a, b) => {
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
    <div className="space-y-4 max-w-[1100px] mx-auto pb-10">
      {/* 1. TOP HEADER (Clean, unboxed) */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text)] truncate">
            Fees Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchFeesData}
            disabled={loading}
            className="size-10 sm:size-11 rounded-[12px] border border-[var(--card-border)] bg-white text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--primary-soft)] flex items-center justify-center cursor-pointer transition-colors shrink-0"
            title="Refresh fees"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Fee Actions Dropdown */}
          <div className="relative inline-block" ref={actionsMenuRef}>
            <button
              type="button"
              onClick={() => setActionsMenuOpen((v) => !v)}
              className="min-h-[40px] sm:min-h-[44px] px-3 sm:px-4 rounded-[12px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 cursor-pointer shadow-xs transition-colors shrink-0"
            >
              <span>Fee Actions</span>
              <ChevronDown className={`size-4 transition-transform ${actionsMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {actionsMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-60 rounded-[16px] bg-white border border-[var(--card-border)] shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95">
                <button
                  type="button"
                  onClick={() => {
                    setActionsMenuOpen(false)
                    setSelectedSingleStudent(null)
                    setRemindersDialogOpen(true)
                  }}
                  disabled={loading}
                  className="w-full min-h-[44px] px-3 rounded-[10px] text-left text-sm font-semibold text-[var(--text)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <BellRing className="size-4 text-[var(--primary)] shrink-0" />
                  <span>Send reminders</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActionsMenuOpen(false)
                    handleGenerateMonthlyFees()
                  }}
                  disabled={generatingFees || loading || !selectedMonth}
                  className="w-full min-h-[44px] px-3 rounded-[10px] text-left text-sm font-semibold text-[var(--text)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] flex items-center gap-2.5 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <PlusCircle className="size-4 text-[var(--primary)] shrink-0" />
                  <span>{generatingFees ? 'Generating...' : 'Generate fees for month'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. SUMMARY CARD: Collected vs Outstanding for the month, in large type */}
      <div className="bg-white p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] border border-[var(--card-border)] shadow-2xs space-y-3.5 max-w-[760px]">
        {/* Month Navigation Strip */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => adjustMonth(-1)}
              className="size-9 sm:size-10 rounded-[10px] sm:rounded-[12px] border border-[var(--card-border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] flex items-center justify-center cursor-pointer transition-colors shrink-0"
              title="Previous Month"
            >
              <ChevronLeft className="size-4" />
            </button>

            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-[10px] sm:rounded-[12px] bg-[var(--primary-soft)]/50 border border-[var(--card-border)]/60">
              <Calendar className="size-3.5 sm:size-4 text-[var(--primary)] shrink-0" />
              <span className="font-bold text-xs sm:text-sm text-[var(--text)] whitespace-nowrap">
                {selectedMonth ? formatPeriod(`${selectedMonth}-01`) : 'Select Month'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => adjustMonth(1)}
              className="size-9 sm:size-10 rounded-[10px] sm:rounded-[12px] border border-[var(--card-border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] flex items-center justify-center cursor-pointer transition-colors shrink-0"
              title="Next Month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setViewAllMonths(!viewAllMonths)}
              className={`text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border transition-all cursor-pointer ${
                viewAllMonths
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)]/30'
                  : 'bg-white text-[var(--text-secondary)] border-[var(--card-border)] hover:bg-[var(--primary-soft)]'
              }`}
            >
              {viewAllMonths ? 'All Months' : 'Selected Month'}
            </button>
          </div>
        </div>

        {/* 3 Metrics Beside Each Other in a 3-column row */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3.5 pt-3 border-t border-[var(--card-border)]/50">
          {/* Collected */}
          <div className="bg-[var(--present-bg)]/50 rounded-[14px] p-2 sm:p-3 space-y-0.5 border border-[var(--present)]/20">
            <span className="text-[10px] sm:text-xs font-bold text-[var(--present-text)] uppercase tracking-wider block truncate">
              Collected
            </span>
            <span className="text-base sm:text-2xl font-bold tracking-tight text-[var(--present-text)] block truncate">
              {formatCurrency(viewAllMonths ? fees.reduce((a, b) => a + b.amount_paid, 0) : monthStats.totalPaid)}
            </span>
            <span className="text-[10px] sm:text-xs text-[var(--text-secondary)] font-normal block truncate">
              Received {viewAllMonths ? 'all time' : 'this month'}
            </span>
          </div>

          {/* Outstanding */}
          <div className="bg-slate-50 rounded-[14px] p-2 sm:p-3 space-y-0.5 border border-[var(--card-border)]">
            <span className="text-[10px] sm:text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block truncate">
              Outstanding
            </span>
            <span className="text-base sm:text-2xl font-bold tracking-tight text-[var(--text)] block truncate">
              {formatCurrency(viewAllMonths ? fees.reduce((a, b) => a + b.balance, 0) : monthStats.totalBalance)}
            </span>
            <span className="text-[10px] sm:text-xs text-[var(--text-secondary)] font-normal block truncate">
              Uncollected balance
            </span>
          </div>

          {/* Overdue */}
          <div className="bg-[var(--attention-bg)]/60 rounded-[14px] p-2 sm:p-3 space-y-0.5 border border-[var(--attention)]/30">
            <span className="text-[10px] sm:text-xs font-bold text-[var(--attention-text)] uppercase tracking-wider block truncate">
              Overdue
            </span>
            <span className="text-base sm:text-2xl font-bold tracking-tight text-[var(--attention-text)] block truncate">
              {viewAllMonths ? fees.filter((f) => f.status === 'overdue').length : monthStats.overdueCount} Overdue
            </span>
            <span className="text-[10px] sm:text-xs text-[var(--attention-text)] font-normal block truncate">
              Billed: {formatCurrency(viewAllMonths ? fees.reduce((a, b) => a + b.amount_due, 0) : monthStats.totalDue)}
            </span>
          </div>
        </div>

        {/* Zero Fee Records Hint */}
        {!loading && monthFees.length === 0 && !viewAllMonths && (
          <div className="p-4 bg-[var(--attention-bg)] border border-[var(--attention)]/30 rounded-[16px] text-[var(--attention-text)] text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="size-5 shrink-0" />
              <span>
                No fee records found for <strong>{selectedMonth ? formatPeriod(`${selectedMonth}-01`) : 'this month'}</strong>.
              </span>
            </div>
            <button
              type="button"
              onClick={handleGenerateMonthlyFees}
              disabled={generatingFees}
              className="min-h-[40px] px-4 rounded-[12px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs cursor-pointer shrink-0"
            >
              Generate Fees Now
            </button>
          </div>
        )}
      </div>

      {/* 3. SEARCH & FILTERS: 2-column dropdowns on mobile, flex on desktop */}
      <div className="space-y-2.5 pt-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Search */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)]" />
            <input
              type="text"
              placeholder="Search student or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-9 pr-3 rounded-[12px] border border-[var(--card-border)] bg-white text-sm text-[var(--text)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-2xs"
            />
          </div>

          {/* 2-Column Dropdowns on mobile, flex on desktop */}
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
            {/* Status Dropdown */}
            <div className="relative w-full sm:w-48">
              <select
                id="fees-status-filter"
                aria-label="Filter by Status"
                value={overdueChipActive ? 'overdue' : statusTab}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === 'overdue') {
                    setOverdueChipActive(true)
                    setStatusTab('all')
                  } else {
                    setOverdueChipActive(false)
                    setStatusTab(val as 'all' | 'pending' | 'paid')
                  }
                }}
                className="w-full min-h-[44px] pl-3 pr-8 rounded-[12px] border border-[var(--card-border)] bg-white text-xs sm:text-sm font-semibold text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer shadow-xs appearance-none truncate transition-colors"
              >
                <option value="all">Status: All ({fees.length})</option>
                <option value="pending">Status: Pending ({fees.filter((f) => f.status !== 'paid').length})</option>
                <option value="paid">Status: Paid ({fees.filter((f) => f.status === 'paid').length})</option>
                <option value="overdue">Status: Overdue ({fees.filter((f) => f.status === 'overdue').length})</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] pointer-events-none" />
            </div>

            {/* Class Dropdown */}
            <div className="relative w-full sm:w-44">
              <select
                value={classFilter}
                aria-label="Filter by Class"
                onChange={(e) => setClassFilter(e.target.value)}
                className="w-full min-h-[44px] pl-3 pr-8 rounded-[12px] border border-[var(--card-border)] bg-white text-xs sm:text-sm font-semibold text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer shadow-xs appearance-none truncate transition-colors"
              >
                <option value="all">Class: All Classes</option>
                {CLASS_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    Class: {c}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. FEE ROWS (Clean responsive rows without horizontal scrollbar) */}
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
        <div className="space-y-3">
          {filteredFees.map((fee) => {
            const isUnpaidOrPartial = fee.status !== 'paid'
            const days = getDaysOverdue(fee.due_date)

            return (
              <div
                key={fee.fee_id}
                onClick={() => handleOpenHistory(fee)}
                className="bg-white p-4 sm:p-5 rounded-[20px] border border-[var(--card-border)]/70 shadow-2xs hover:border-[var(--primary)]/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
              >
                {/* Left: Avatar + Student info */}
                <div className="flex items-center gap-3.5 min-w-0 md:w-1/3">
                  <InitialsAvatar name={fee.full_name} size="md" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-[var(--text)] truncate">
                        {fee.full_name}
                      </span>
                    </div>
                    <div className="text-sm font-normal text-[var(--text-secondary)] mt-0.5 truncate flex items-center gap-1.5">
                      <span>{fee.class_level || 'Class -'}</span>
                      <span className="opacity-40">·</span>
                      <span className="font-mono text-xs">{fee.phone || 'No phone'}</span>
                    </div>
                  </div>
                </div>

                {/* Middle: Amount, Balance & Due Date */}
                <div className="flex items-center justify-between sm:justify-start gap-6 text-sm md:w-1/3">
                  <div>
                    <span className="text-xs font-normal text-[var(--text-secondary)] block">Due</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-semibold text-[var(--text)]">
                        {formatCurrency(fee.amount_due)}
                      </span>
                      <span className="text-[var(--text-secondary)] opacity-40">/</span>
                      <span className={`font-bold ${fee.balance > 0 ? 'text-[var(--attention-text)]' : 'text-[var(--present-text)]'}`}>
                        {formatCurrency(fee.balance)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-normal text-[var(--text-secondary)] block">Due Date</span>
                    <span className="font-medium text-[var(--text)] mt-0.5 block">
                      {formatDate(fee.due_date)}
                    </span>
                    <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
                      <BellRing className="size-3 text-[var(--text-secondary)]" />
                      <span>Reminders: {fee.reminders_sent || 0}/2</span>
                    </div>
                  </div>
                </div>

                {/* Right: Status badge & Actions */}
                <div
                  className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--card-border)]/40 md:w-1/3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <StatusBadge status={fee.status} daysOverdue={days} />

                  <div className="flex items-center gap-2">
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

                    {/* Row Menu: "Send reminder" and history */}
                    <FeeRowMenu
                      fee={fee}
                      onRecordPayment={isUnpaidOrPartial ? () => handleOpenRecordPayment(fee) : undefined}
                      onSendReminder={() => handleOpenSingleReminder(fee)}
                      onViewHistory={() => handleOpenHistory(fee)}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
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
