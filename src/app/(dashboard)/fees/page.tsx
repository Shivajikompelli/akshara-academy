'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CreditCard,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  PlusCircle,
  Receipt,
  Calendar,
  BellRing,
  Info,
} from 'lucide-react'
import { formatCurrency, formatDate, formatPeriod } from '@/lib/formatters'
import { RecordPaymentDialog } from '@/components/fees/record-payment-dialog'
import { PaymentHistoryDialog } from '@/components/fees/payment-history-dialog'
import { SendFeeRemindersDialog } from '@/components/fees/send-fee-reminders-dialog'
import { CLASS_OPTIONS, type FeeSummaryRow } from '@/types/database'
import { toast } from 'sonner'

export default function FeesPage() {
  const [fees, setFees] = useState<FeeSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingFees, setGeneratingFees] = useState(false)
  const [todayStr, setTodayStr] = useState<string>('')

  // 1. Month Controls (default current month)
  const [selectedMonth, setSelectedMonth] = useState<string>('')

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'pending' | 'partial' | 'paid'>('all')
  const [classFilter, setClassFilter] = useState('all')
  const [viewAllMonths, setViewAllMonths] = useState(false)
  const [sortBy, setSortBy] = useState<'overdue' | 'name' | 'balance'>('overdue')

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

      const enriched: FeeSummaryRow[] = (summaryData || []).map((row: any) => {
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

  // Summary cards for the selected month
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

  // Filtered & Sorted Fees List
  const filteredFees = useMemo(() => {
    const baseList = viewAllMonths ? fees : monthFees

    return baseList
      .filter((fee) => {
        if (statusFilter !== 'all' && fee.status !== statusFilter) {
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
        if (sortBy === 'name') {
          return a.full_name.localeCompare(b.full_name)
        }
        if (sortBy === 'balance') {
          return b.balance - a.balance
        }

        const overdueA = a.status === 'overdue' ? getDaysOverdue(a.due_date) : -1
        const overdueB = b.status === 'overdue' ? getDaysOverdue(b.due_date) : -1

        if (overdueA !== overdueB) {
          return overdueB - overdueA
        }

        return b.balance - a.balance
      })
  }, [fees, monthFees, viewAllMonths, statusFilter, classFilter, searchQuery, sortBy, getDaysOverdue])

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

  function getStatusBadge(status: string, dueDate: string) {
    const days = getDaysOverdue(dueDate)

    switch (status) {
      case 'paid':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0 font-semibold text-xs flex items-center gap-1">
            <CheckCircle2 className="size-3" />
            <span>Paid</span>
          </Badge>
        )
      case 'overdue':
        return (
          <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border border-rose-300 font-bold text-xs flex items-center gap-1">
            <AlertTriangle className="size-3 text-rose-600" />
            <span>Overdue ({days}d)</span>
          </Badge>
        )
      case 'partial':
        return (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border border-amber-300 font-semibold text-xs flex items-center gap-1">
            <Clock className="size-3 text-amber-600" />
            <span>Partial</span>
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-0 font-medium text-xs flex items-center gap-1">
            <Clock className="size-3 text-slate-500" />
            <span>Pending</span>
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* 1. TOP HEADER & MONTH CONTROLS */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Fees Dashboard</h1>
              <Badge variant="secondary" className="text-xs bg-slate-200 text-slate-800 font-semibold">
                {viewAllMonths ? `${fees.length} Total` : `${monthFees.length} in ${formatPeriod(selectedMonth + '-01')}`}
              </Badge>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Track fee collections, record receipts, and manage scheduled WhatsApp fee reminders.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={fetchFeesData}
              disabled={loading}
              className="min-h-[44px] gap-2 border-slate-300 text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>

            {/* Send Reminders Now Button */}
            <Button
              type="button"
              onClick={() => {
                setSelectedSingleStudent(null)
                setRemindersDialogOpen(true)
              }}
              disabled={loading}
              className="min-h-[44px] gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer"
            >
              <BellRing className="size-4" />
              <span>Send reminders now</span>
            </Button>

            <Button
              type="button"
              onClick={handleGenerateMonthlyFees}
              disabled={generatingFees || loading || !selectedMonth}
              className="min-h-[44px] gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs cursor-pointer"
            >
              <PlusCircle className="size-4" />
              <span>
                {generatingFees
                  ? 'Generating...'
                  : `Generate fees for this month`}
              </span>
            </Button>
          </div>
        </div>

        {/* Month Selector Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-slate-500 shrink-0" />
            <label htmlFor="monthSelector" className="text-xs font-bold text-slate-700">
              Selected Month:
            </label>
            <input
              id="monthSelector"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-9 px-3 rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewAllMonths(!viewAllMonths)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors cursor-pointer ${
                viewAllMonths
                  ? 'bg-blue-50 text-blue-800 border-blue-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {viewAllMonths ? 'Showing All Months' : 'Showing Selected Month Only'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. SUMMARY CARDS FOR THE SELECTED MONTH */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Due */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block uppercase">
            Total Due {viewAllMonths ? '' : `(${formatPeriod(selectedMonth + '-01')})`}
          </span>
          <span className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 block">
            {formatCurrency(viewAllMonths ? fees.reduce((a, b) => a + b.amount_due, 0) : monthStats.totalDue)}
          </span>
          <span className="text-[11px] text-slate-400">Total fees billed</span>
        </div>

        {/* Collected */}
        <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 shadow-xs">
          <span className="text-xs font-semibold text-emerald-800 block uppercase">Collected</span>
          <span className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1 block">
            {formatCurrency(viewAllMonths ? fees.reduce((a, b) => a + b.amount_paid, 0) : monthStats.totalPaid)}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium">Received so far</span>
        </div>

        {/* Outstanding Balance */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block uppercase">Outstanding</span>
          <span className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 block">
            {formatCurrency(viewAllMonths ? fees.reduce((a, b) => a + b.balance, 0) : monthStats.totalBalance)}
          </span>
          <span className="text-[11px] text-slate-400">Uncollected fees</span>
        </div>

        {/* Overdue Count */}
        <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-300 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800 uppercase">Overdue</span>
            <Badge className="bg-rose-600 text-white font-bold text-[10px] px-1.5 py-0.2">
              {viewAllMonths
                ? fees.filter((f) => f.status === 'overdue').length
                : monthStats.overdueCount}{' '}
              Students
            </Badge>
          </div>
          <span className="text-xl sm:text-2xl font-bold text-rose-700 mt-1 block">
            {viewAllMonths
              ? `${fees.filter((f) => f.status === 'overdue').length} Overdue`
              : `${monthStats.overdueCount} Overdue`}
          </span>
          <span className="text-[11px] text-rose-600 font-medium">Requires immediate follow-up</span>
        </div>
      </div>

      {/* Hint if zero fee rows for the selected month */}
      {!loading && monthFees.length === 0 && !viewAllMonths && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="size-5 text-amber-600 shrink-0" />
            <span>
              No fee records found for <strong>{formatPeriod(selectedMonth + '-01')}</strong>. Tap{' '}
              <strong>&quot;Generate fees for this month&quot;</strong> to generate records for all active students.
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleGenerateMonthlyFees}
            disabled={generatingFees}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer shrink-0 ml-3"
          >
            Generate Now
          </Button>
        </div>
      )}

      {/* 3. FILTERS & SEARCH TOOLBAR */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 font-bold shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            All ({fees.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('paid')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              statusFilter === 'paid'
                ? 'bg-white text-emerald-800 font-bold shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            Paid ({fees.filter((f) => f.status === 'paid').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              statusFilter === 'pending'
                ? 'bg-white text-slate-900 font-bold shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            Pending ({fees.filter((f) => f.status === 'pending').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('partial')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              statusFilter === 'partial'
                ? 'bg-white text-amber-800 font-bold shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            Partial ({fees.filter((f) => f.status === 'partial').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('overdue')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              statusFilter === 'overdue'
                ? 'bg-white text-rose-800 font-bold shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            Overdue ({fees.filter((f) => f.status === 'overdue').length})
          </button>
        </div>

        {/* Search, Class Dropdown & Sort */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          {/* Search box (name or phone) */}
          <div className="sm:col-span-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by student name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11 text-sm bg-white"
            />
          </div>

          {/* Class Filter */}
          <div className="sm:col-span-3">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              <option value="all">All Classes</option>
              {CLASS_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Dropdown (Default: Overdue first, longest overdue at top) */}
          <div className="sm:col-span-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              <option value="overdue">Sort: Overdue First</option>
              <option value="balance">Sort: Highest Balance</option>
              <option value="name">Sort: Student Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. FEES LIST (Cards on mobile, Table on desktop) */}
      {loading ? (
        <div className="p-12 text-center text-sm text-slate-500 bg-white rounded-xl border border-slate-200">
          <RefreshCw className="size-6 animate-spin mx-auto text-blue-600 mb-2" />
          <span>Loading fees records...</span>
        </div>
      ) : filteredFees.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
          <Receipt className="size-10 mx-auto text-slate-300 mb-2" />
          <h3 className="font-bold text-slate-800 text-base">No fee records match your filters</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search query, status tabs, or selected month.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="font-bold text-slate-700 text-xs">Student</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs">Class</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs">Parent Phone</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs text-right">Amount Due</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs text-right">Paid</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs text-right">Balance</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs">Due Date & Reminders</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs">Status</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFees.map((fee) => {
                  const isUnpaidOrPartial = fee.status !== 'paid'
                  return (
                    <TableRow
                      key={fee.fee_id}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      onClick={() => handleOpenHistory(fee)}
                    >
                      <TableCell className="font-bold text-slate-900 text-sm py-3.5">
                        {fee.full_name}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 font-medium">
                        {fee.class_level || '-'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 font-mono">
                        {fee.phone || '-'}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-slate-800 text-right">
                        {formatCurrency(fee.amount_due)}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-emerald-700 text-right">
                        {formatCurrency(fee.amount_paid)}
                      </TableCell>
                      <TableCell className="text-xs font-extrabold text-right">
                        <span className={fee.balance > 0 ? 'text-rose-600' : 'text-slate-400'}>
                          {formatCurrency(fee.balance)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        <span className="font-medium">{formatDate(fee.due_date)}</span>
                        {/* Reminders sent: N of 2, last on DATE */}
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <BellRing className="size-3 text-slate-400" />
                          <span>
                            Reminders sent: {fee.reminders_sent || 0} of 2
                            {fee.last_reminder_date ? `, last on ${formatDate(fee.last_reminder_date)}` : ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(fee.status, fee.due_date)}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {isUnpaidOrPartial && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenSingleReminder(fee)}
                              className="min-h-[38px] px-2.5 text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100 font-semibold text-xs gap-1 cursor-pointer"
                              title="Send WhatsApp fee reminder to parent"
                            >
                              <BellRing className="size-3.5 text-blue-600" />
                              <span>Remind</span>
                            </Button>
                          )}

                          {isUnpaidOrPartial ? (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleOpenRecordPayment(fee)}
                              className="min-h-[38px] px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 cursor-pointer shadow-xs"
                            >
                              <CreditCard className="size-3.5" />
                              <span>Record payment</span>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenHistory(fee)}
                              className="min-h-[38px] px-3 text-slate-600 text-xs gap-1.5 cursor-pointer"
                            >
                              <History className="size-3.5" />
                              <span>History</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredFees.map((fee) => {
              const isUnpaidOrPartial = fee.status !== 'paid'
              return (
                <div
                  key={fee.fee_id}
                  onClick={() => handleOpenHistory(fee)}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 cursor-pointer active:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{fee.full_name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {fee.class_level || 'Student'} • {fee.phone || 'No phone'}
                      </p>
                    </div>
                    {getStatusBadge(fee.status, fee.due_date)}
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-2 bg-slate-50 rounded-lg text-center text-xs border border-slate-100">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Due</span>
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(fee.amount_due)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Paid</span>
                      <span className="font-semibold text-emerald-700">
                        {formatCurrency(fee.amount_paid)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Balance</span>
                      <span className="font-bold text-rose-700">
                        {formatCurrency(fee.balance)}
                      </span>
                    </div>
                  </div>

                  {/* Reminders sent: N of 2 */}
                  <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
                    <span>Due: <strong>{formatDate(fee.due_date)}</strong></span>
                    <span className="flex items-center gap-1 font-medium">
                      <BellRing className="size-3 text-slate-400" />
                      Reminders: {fee.reminders_sent || 0}/2
                      {fee.last_reminder_date ? ` (${formatDate(fee.last_reminder_date)})` : ''}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    {isUnpaidOrPartial && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenSingleReminder(fee)}
                        className="min-h-[40px] px-3 text-blue-700 border-blue-200 bg-blue-50 font-semibold text-xs gap-1.5 cursor-pointer"
                      >
                        <BellRing className="size-3.5 text-blue-600" />
                        <span>Remind</span>
                      </Button>
                    )}

                    {isUnpaidOrPartial ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleOpenRecordPayment(fee)}
                        className="min-h-[40px] px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 cursor-pointer shadow-xs"
                      >
                        <CreditCard className="size-3.5" />
                        <span>Record payment</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenHistory(fee)}
                        className="min-h-[40px] px-3 text-slate-600 text-xs gap-1.5 cursor-pointer"
                      >
                        <History className="size-3.5" />
                        <span>History</span>
                      </Button>
                    )}
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
