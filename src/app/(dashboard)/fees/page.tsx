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
  ArrowUpDown,
  Building,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { RecordPaymentDialog } from '@/components/fees/record-payment-dialog'
import { PaymentHistoryDialog } from '@/components/fees/payment-history-dialog'
import { CLASS_OPTIONS, type FeeSummaryRow } from '@/types/database'
import { toast } from 'sonner'

export default function FeesPage() {
  const [fees, setFees] = useState<FeeSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingFees, setGeneratingFees] = useState(false)
  const [todayStr, setTodayStr] = useState<string>('')

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'pending' | 'partial' | 'paid'>('all')
  const [classFilter, setClassFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'overdue' | 'name' | 'balance'>('overdue')

  // Dialog states
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [selectedFee, setSelectedFee] = useState<FeeSummaryRow | null>(null)

  useEffect(() => {
    setTodayStr(new Date().toISOString().split('T')[0])
  }, [])

  // Calculate days overdue for a given due_date
  const getDaysOverdue = useCallback((dueDate: string) => {
    const today = new Date().toISOString().split('T')[0]
    if (dueDate >= today) return 0
    const dueTime = new Date(dueDate).getTime()
    const nowTime = new Date(today).getTime()
    return Math.max(0, Math.floor((nowTime - dueTime) / (1000 * 60 * 60 * 24)))
  }, [])

  // Fetch fees from fee_summary view and enrich with student class & phone
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

      const enriched: FeeSummaryRow[] = (summaryData || []).map((row: any) => {
        const studentInfo = studentsMap.get(row.student_id)
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

  // Generate monthly fees for active students
  async function handleGenerateMonthlyFees() {
    setGeneratingFees(true)
    const supabase = createClient()

    try {
      // First attempt RPC call to generate_monthly_fees
      const { data, error } = await supabase.rpc('generate_monthly_fees')

      if (error) {
        // Fallback: manually insert monthly fees for active students where monthly_fee > 0
        const now = new Date()
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .split('T')[0]

        const { data: activeStudents, error: fetchErr } = await supabase
          .from('students')
          .select('id, monthly_fee, fee_due_day')
          .eq('status', 'active')
          .gt('monthly_fee', 0)

        if (fetchErr) throw fetchErr

        if (activeStudents && activeStudents.length > 0) {
          const rows = activeStudents.map((s) => {
            const dueDay = Math.min(28, Math.max(1, s.fee_due_day || 5))
            const due = new Date(now.getFullYear(), now.getMonth(), dueDay)
              .toISOString()
              .split('T')[0]
            return {
              student_id: s.id,
              period: firstOfMonth,
              amount_due: s.monthly_fee,
              due_date: due,
            }
          })

          const { error: insertErr } = await supabase
            .from('fees')
            .upsert(rows, { onConflict: 'student_id, period' })

          if (insertErr) throw insertErr
        }
      }

      toast.success('Monthly fees generated successfully for active students!')
      await fetchFeesData()
    } catch (err: unknown) {
      console.error('Failed to generate fees:', err)
      const msg = err instanceof Error ? err.message : 'Failed to generate monthly fees'
      toast.error(msg)
    } finally {
      setGeneratingFees(false)
    }
  }

  // Extract distinct periods for period filter
  const availablePeriods = useMemo(() => {
    const set = new Set<string>()
    fees.forEach((f) => {
      if (f.period) set.add(f.period)
    })
    return Array.from(set).sort().reverse()
  }, [fees])

  // Filter and sort fees
  const filteredFees = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()

    return fees
      .filter((item) => {
        // Status filter
        if (statusFilter !== 'all' && item.status !== statusFilter) {
          return false
        }

        // Class filter
        if (classFilter !== 'all' && item.class_level !== classFilter) {
          return false
        }

        // Period filter
        if (periodFilter !== 'all' && item.period !== periodFilter) {
          return false
        }

        // Search query
        if (query) {
          const matchName = item.full_name?.toLowerCase().includes(query)
          const matchParent = item.parent_name?.toLowerCase().includes(query)
          const matchPhone = item.phone?.toLowerCase().includes(query)
          const matchClass = item.class_level?.toLowerCase().includes(query)
          if (!matchName && !matchParent && !matchPhone && !matchClass) {
            return false
          }
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
        // Default: Sort by days overdue descending
        const overdueA = a.status === 'overdue' ? getDaysOverdue(a.due_date) : -1
        const overdueB = b.status === 'overdue' ? getDaysOverdue(b.due_date) : -1

        if (overdueA !== overdueB) {
          return overdueB - overdueA
        }

        // Secondary sort: balance descending
        return b.balance - a.balance
      })
  }, [fees, statusFilter, classFilter, periodFilter, searchQuery, sortBy, getDaysOverdue])

  // Overall Financial Stats
  const stats = useMemo(() => {
    let totalDue = 0
    let totalPaid = 0
    let totalBalance = 0
    let overdueCount = 0
    let overdueBalance = 0

    fees.forEach((f) => {
      totalDue += f.amount_due
      totalPaid += f.amount_paid
      totalBalance += f.balance
      if (f.status === 'overdue') {
        overdueCount++
        overdueBalance += f.balance
      }
    })

    return {
      totalDue,
      totalPaid,
      totalBalance,
      overdueCount,
      overdueBalance,
    }
  }, [fees])

  // Open Record Payment
  function handleOpenRecordPayment(fee: FeeSummaryRow) {
    setSelectedFee(fee)
    setPaymentDialogOpen(true)
  }

  // Open History
  function handleOpenHistory(fee: FeeSummaryRow) {
    setSelectedFee(fee)
    setHistoryDialogOpen(true)
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
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Fees Dashboard</h1>
            <Badge variant="secondary" className="text-xs bg-slate-200 text-slate-800 font-semibold">
              {fees.length} Records
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Track tuition fee collection, record payments, and manage overdue balances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={fetchFeesData}
            disabled={loading}
            className="min-h-[44px] gap-2 border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            type="button"
            onClick={handleGenerateMonthlyFees}
            disabled={generatingFees || loading}
            className="min-h-[44px] gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm"
          >
            <PlusCircle className="size-4" />
            <span>{generatingFees ? 'Generating...' : 'Generate Monthly Fees'}</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block uppercase">Total Expected</span>
          <span className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 block">
            {formatCurrency(stats.totalDue)}
          </span>
          <span className="text-[11px] text-slate-400">Total fees billed</span>
        </div>

        <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 shadow-xs">
          <span className="text-xs font-semibold text-emerald-800 block uppercase">Collected</span>
          <span className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1 block">
            {formatCurrency(stats.totalPaid)}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium">Received so far</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block uppercase">Total Balance</span>
          <span className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 block">
            {formatCurrency(stats.totalBalance)}
          </span>
          <span className="text-[11px] text-slate-400">Uncollected fees</span>
        </div>

        <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-300 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800 uppercase">Overdue</span>
            <Badge className="bg-rose-600 text-white font-bold text-[10px] px-1.5 py-0.2">
              {stats.overdueCount} Students
            </Badge>
          </div>
          <span className="text-xl sm:text-2xl font-bold text-rose-700 mt-1 block">
            {formatCurrency(stats.overdueBalance)}
          </span>
          <span className="text-[11px] text-rose-600 font-medium">Requires immediate follow-up</span>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 font-bold shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            All ({fees.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('overdue')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              statusFilter === 'overdue'
                ? 'bg-white text-rose-800 font-bold shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            Overdue ({fees.filter((f) => f.status === 'overdue').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              statusFilter === 'pending'
                ? 'bg-white text-slate-800 font-bold shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            Pending ({fees.filter((f) => f.status === 'pending').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('partial')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              statusFilter === 'partial'
                ? 'bg-white text-amber-800 font-bold shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            Partial ({fees.filter((f) => f.status === 'partial').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('paid')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              statusFilter === 'paid'
                ? 'bg-white text-emerald-800 font-bold shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            Paid ({fees.filter((f) => f.status === 'paid').length})
          </button>
        </div>

        {/* Search, Class, Period and Sort Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          {/* Search Input */}
          <div className="sm:col-span-5 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              placeholder="Search student, parent, or class..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11 text-base bg-white border-slate-300"
            />
          </div>

          {/* Class Filter */}
          <div className="sm:col-span-3">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">All Classes</option>
              {CLASS_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Period Filter */}
          <div className="sm:col-span-2">
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">All Months</option>
              {availablePeriods.map((p) => (
                <option key={p} value={p}>
                  {formatDate(p)}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="sm:col-span-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="overdue">Sort: Overdue First</option>
              <option value="balance">Sort: Highest Balance</option>
              <option value="name">Sort: Student Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Fees Table / Card List */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 shadow-xs">
          <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-sm font-medium">Loading fee records...</p>
        </div>
      ) : filteredFees.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center shadow-xs">
          <Receipt className="size-10 mx-auto text-slate-400 mb-3" />
          <h3 className="text-base font-bold text-slate-900">No fee records found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {fees.length === 0
              ? 'Click "Generate Monthly Fees" above to create fee records for all active students.'
              : 'Try clearing your search query or status filters.'}
          </p>
          {fees.length === 0 && (
            <div className="mt-4">
              <Button
                onClick={handleGenerateMonthlyFees}
                disabled={generatingFees}
                className="min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                <PlusCircle className="size-4 mr-1.5" /> Generate Monthly Fees
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-700">Student</TableHead>
                  <TableHead className="font-semibold text-slate-700">Period</TableHead>
                  <TableHead className="font-semibold text-slate-700">Amount Due</TableHead>
                  <TableHead className="font-semibold text-slate-700">Paid</TableHead>
                  <TableHead className="font-semibold text-slate-700">Balance</TableHead>
                  <TableHead className="font-semibold text-slate-700">Due Date</TableHead>
                  <TableHead className="font-semibold text-slate-700">Status</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFees.map((row) => (
                  <TableRow key={row.fee_id} className="hover:bg-slate-50/70">
                    {/* Student */}
                    <TableCell className="py-3.5">
                      <div className="font-bold text-slate-900 text-sm">{row.full_name}</div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        {row.class_level && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0.1 bg-blue-50 text-blue-700 border-blue-200">
                            {row.class_level}
                          </Badge>
                        )}
                        <span>{row.parent_name}</span>
                        {row.phone && <span className="font-mono text-slate-400">({row.phone})</span>}
                      </div>
                    </TableCell>

                    {/* Period */}
                    <TableCell className="py-3.5 whitespace-nowrap text-xs text-slate-700 font-medium">
                      {formatDate(row.period)}
                    </TableCell>

                    {/* Amount Due */}
                    <TableCell className="py-3.5 whitespace-nowrap text-sm font-semibold text-slate-800">
                      {formatCurrency(row.amount_due)}
                    </TableCell>

                    {/* Paid */}
                    <TableCell className="py-3.5 whitespace-nowrap text-sm font-bold text-emerald-700">
                      {formatCurrency(row.amount_paid)}
                    </TableCell>

                    {/* Balance */}
                    <TableCell className="py-3.5 whitespace-nowrap text-sm font-bold">
                      <span className={row.balance > 0 ? 'text-rose-600' : 'text-slate-400'}>
                        {formatCurrency(row.balance)}
                      </span>
                    </TableCell>

                    {/* Due Date */}
                    <TableCell className="py-3.5 whitespace-nowrap text-xs text-slate-600">
                      {formatDate(row.due_date)}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3.5 whitespace-nowrap">
                      {getStatusBadge(row.status, row.due_date)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {row.status !== 'paid' ? (
                          <Button
                            size="sm"
                            onClick={() => handleOpenRecordPayment(row)}
                            className="min-h-[36px] bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs gap-1.5 cursor-pointer"
                          >
                            <CreditCard className="size-3.5" /> Record Payment
                          </Button>
                        ) : (
                          <span className="text-xs text-emerald-700 font-semibold px-2 py-1 bg-emerald-50 rounded-md border border-emerald-200">
                            Paid in Full
                          </span>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenHistory(row)}
                          className="min-h-[36px] text-xs border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                          title="Payment History"
                        >
                          <History className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredFees.map((row) => (
              <div
                key={row.fee_id}
                className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-base text-slate-900 leading-tight">
                      {row.full_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {row.class_level && (
                        <Badge variant="outline" className="text-xs font-semibold text-blue-800 bg-blue-50 border-blue-200">
                          {row.class_level}
                        </Badge>
                      )}
                      <span className="text-xs text-slate-500">{formatDate(row.period)}</span>
                    </div>
                  </div>

                  {getStatusBadge(row.status, row.due_date)}
                </div>

                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-50 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Due</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(row.amount_due)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Paid</span>
                    <span className="font-semibold text-emerald-700">{formatCurrency(row.amount_paid)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Balance</span>
                    <span className={`font-bold ${row.balance > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                      {formatCurrency(row.balance)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Due by: {formatDate(row.due_date)}</span>
                  <span>Parent: {row.parent_name}</span>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  {row.status !== 'paid' ? (
                    <Button
                      type="button"
                      onClick={() => handleOpenRecordPayment(row)}
                      className="flex-1 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm gap-2"
                    >
                      <CreditCard className="size-4" />
                      <span>Record Payment</span>
                    </Button>
                  ) : (
                    <div className="flex-1 text-center py-2 text-xs font-bold text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
                      Paid in Full
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenHistory(row)}
                    className="min-h-[44px] px-3.5 border-slate-300 text-slate-700 hover:bg-slate-50"
                    title="View History"
                  >
                    <History className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
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

      {/* Payment History Dialog */}
      <PaymentHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        fee={selectedFee}
      />
    </div>
  )
}
