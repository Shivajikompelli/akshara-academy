'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/formatters'
import { CLASS_OPTIONS } from '@/types/database'
import {
  FileSpreadsheet,
  Download,
  Printer,
  RefreshCw,
  Wallet,
  Building2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import type {
  BalanceSheetClassRow,
  BalanceSheetModeSummary,
  BalanceSheetLedgerRow,
} from '@/app/api/export-fees/route'

interface BalanceSheetData {
  scope_title: string
  generated_on: string
  summary: {
    total_records: number
    total_due: number
    total_paid: number
    total_balance: number
    overdue_balance: number
    pending_balance: number
    collection_pct: number
    paid_count: number
    partial_count: number
    pending_count: number
    overdue_count: number
  }
  mode_breakdown: BalanceSheetModeSummary[]
  class_breakdown: BalanceSheetClassRow[]
  ledger: BalanceSheetLedgerRow[]
}

interface ExportBalanceSheetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultMonth: string
  defaultViewAllMonths: boolean
  defaultClassFilter: string
  defaultStatusFilter: string
}

export function ExportBalanceSheetDialog({
  open,
  onOpenChange,
  defaultMonth,
  defaultViewAllMonths,
  defaultClassFilter,
  defaultStatusFilter,
}: ExportBalanceSheetDialogProps) {
  const [scopeMode, setScopeMode] = useState<'month' | 'all'>(
    defaultViewAllMonths ? 'all' : 'month'
  )
  const [classFilter, setClassFilter] = useState<string>(defaultClassFilter || 'all')
  const [statusFilter, setStatusFilter] = useState<string>(defaultStatusFilter || 'all')
  const [loading, setLoading] = useState<boolean>(false)
  const [report, setReport] = useState<BalanceSheetData | null>(null)

  const effectiveMonth = scopeMode === 'all' ? 'all' : defaultMonth || 'all'

  const fetchBalanceSheet = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        month: effectiveMonth,
        class_level: classFilter,
        status: statusFilter,
        format: 'json',
      })
      const res = await fetch(`/api/export-fees?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) {
        const errObj = typeof data.error === 'object' && data.error !== null ? data.error : null
        throw new Error(errObj?.message || (typeof data.error === 'string' ? data.error : 'Failed to calculate balance sheet'))
      }
      setReport(data as BalanceSheetData)
    } catch (err: unknown) {
      console.error('Balance sheet fetch error:', err)
      const msg = err instanceof Error ? err.message : 'Failed to load balance sheet'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [effectiveMonth, classFilter, statusFilter])

  useEffect(() => {
    if (!open) return
    let ignore = false

    async function load() {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          month: effectiveMonth,
          class_level: classFilter,
          status: statusFilter,
          format: 'json',
        })
        const res = await fetch(`/api/export-fees?${params.toString()}`)
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Failed to calculate balance sheet')
        }
        if (!ignore) {
          setReport(data as BalanceSheetData)
        }
      } catch (err: unknown) {
        if (!ignore) {
          console.error('Balance sheet fetch error:', err)
          const msg = err instanceof Error ? err.message : 'Failed to load balance sheet'
          toast.error(msg)
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      ignore = true
    }
  }, [open, effectiveMonth, classFilter, statusFilter])

  const csvDownloadUrl = `/api/export-fees?${new URLSearchParams({
    month: effectiveMonth,
    class_level: classFilter,
    status: statusFilter,
    format: 'csv',
  }).toString()}`

  function escapeHtml(raw: string | number | null | undefined): string {
    return String(raw ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function handlePrintBalanceSheet() {
    if (!report) return
    const printWin = window.open('', '_blank', 'width=960,height=800')
    if (!printWin) {
      toast.error('Please allow pop-ups to print or save as PDF.')
      return
    }

    const modeRowsHtml = report.mode_breakdown
      .map(
        (m) => `
        <tr>
          <td>${escapeHtml(m.label)}</td>
          <td style="text-align:right;font-weight:700;">${escapeHtml(formatCurrency(m.amount))}</td>
          <td style="text-align:right;">${escapeHtml(m.count)}</td>
        </tr>`
      )
      .join('')

    const classRowsHtml = report.class_breakdown
      .map(
        (c) => `
        <tr>
          <td style="font-weight:700;">${escapeHtml(c.class_level)}</td>
          <td style="text-align:right;">${escapeHtml(c.students_count)}</td>
          <td style="text-align:right;">${escapeHtml(formatCurrency(c.total_due))}</td>
          <td style="text-align:right;color:#047857;font-weight:700;">${escapeHtml(formatCurrency(c.total_paid))}</td>
          <td style="text-align:right;color:${c.total_balance > 0 ? '#9A4A00' : '#047857'};font-weight:700;">${escapeHtml(formatCurrency(c.total_balance))}</td>
          <td style="text-align:right;">${escapeHtml(c.overdue_count)}</td>
          <td style="text-align:right;">${escapeHtml(c.collection_pct)}%</td>
        </tr>`
      )
      .join('')

    const ledgerRowsHtml = report.ledger
      .map(
        (r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td style="font-weight:700;">${escapeHtml(r.full_name)}</td>
          <td>${escapeHtml(r.class_level)}</td>
          <td>${escapeHtml(r.phone)}</td>
          <td>${escapeHtml(r.period_label)}</td>
          <td style="text-align:right;">${escapeHtml(formatCurrency(r.amount_due))}</td>
          <td style="text-align:right;color:#047857;font-weight:700;">${escapeHtml(formatCurrency(r.amount_paid))}</td>
          <td style="text-align:right;color:${r.balance > 0 ? '#9A4A00' : '#047857'};font-weight:700;">${escapeHtml(formatCurrency(r.balance))}</td>
          <td>${escapeHtml(r.payment_modes)}</td>
          <td style="text-transform:uppercase;font-size:11px;font-weight:700;">${escapeHtml(r.status)}</td>
        </tr>`
      )
      .join('')

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Akshara Academy — Fee Balance Sheet (${escapeHtml(report.scope_title)})</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1F2438; margin: 24px; font-size: 13px; }
    h1 { font-size: 20px; margin: 0 0 4px 0; color: #5B45E0; }
    h2 { font-size: 14px; margin: 20px 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px; color: #1F2438; border-bottom: 2px solid #E9D5FF; padding-bottom: 4px; }
    .meta { color: #5A6378; font-size: 12px; margin-bottom: 16px; }
    .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
    .card { border: 1px solid #E9D5FF; border-radius: 12px; padding: 12px; background: #F8F9FE; }
    .card-label { font-size: 11px; text-transform: uppercase; color: #5A6378; font-weight: 700; }
    .card-val { font-size: 18px; font-weight: 700; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
    th, td { border: 1px solid #E2E8F0; padding: 7px 10px; text-align: left; }
    th { background: #F4F2FD; font-weight: 700; color: #1F2438; }
    tfoot td { background: #F4F2FD; font-weight: 700; border-top: 2px solid #5B45E0; }
    @media print { body { margin: 10mm; } }
  </style>
</head>
<body>
  <h1>AKSHARA ACADEMY — FEE BALANCE SHEET</h1>
  <div class="meta">
    Period: <strong>${escapeHtml(report.scope_title)}</strong> &nbsp;|&nbsp;
    Class: <strong>${escapeHtml(classFilter === 'all' ? 'All Classes' : classFilter)}</strong> &nbsp;|&nbsp;
    Status: <strong>${escapeHtml(statusFilter.toUpperCase())}</strong> &nbsp;|&nbsp;
    Generated: <strong>${escapeHtml(report.generated_on)}</strong>
  </div>

  <div class="cards">
    <div class="card">
      <div class="card-label">Total Billed</div>
      <div class="card-val">${escapeHtml(formatCurrency(report.summary.total_due))}</div>
    </div>
    <div class="card">
      <div class="card-label">Total Collected (${escapeHtml(report.summary.collection_pct)}%)</div>
      <div class="card-val" style="color:#047857;">${escapeHtml(formatCurrency(report.summary.total_paid))}</div>
    </div>
    <div class="card">
      <div class="card-label">Total Balance Due</div>
      <div class="card-val" style="color:#9A4A00;">${escapeHtml(formatCurrency(report.summary.total_balance))}</div>
    </div>
    <div class="card">
      <div class="card-label">Overdue Receivables</div>
      <div class="card-val" style="color:#9A4A00;">${escapeHtml(formatCurrency(report.summary.overdue_balance))} (${escapeHtml(report.summary.overdue_count)})</div>
    </div>
  </div>

  <h2>1. Payment Mode Reconciliation (Cash vs UPI vs Bank)</h2>
  <table>
    <thead>
      <tr>
        <th>Payment Mode</th>
        <th style="text-align:right;">Amount Collected</th>
        <th style="text-align:right;">Receipts Count</th>
      </tr>
    </thead>
    <tbody>${modeRowsHtml}</tbody>
  </table>

  <h2>2. Class-Wise Balance Sheet Breakdown</h2>
  <table>
    <thead>
      <tr>
        <th>Class</th>
        <th style="text-align:right;">Students</th>
        <th style="text-align:right;">Total Billed</th>
        <th style="text-align:right;">Collected</th>
        <th style="text-align:right;">Balance Due</th>
        <th style="text-align:right;">Overdue</th>
        <th style="text-align:right;">Collected %</th>
      </tr>
    </thead>
    <tbody>${classRowsHtml}</tbody>
    <tfoot>
      <tr>
        <td>TOTAL</td>
        <td style="text-align:right;">${escapeHtml(report.summary.total_records)}</td>
        <td style="text-align:right;">${escapeHtml(formatCurrency(report.summary.total_due))}</td>
        <td style="text-align:right;color:#047857;">${escapeHtml(formatCurrency(report.summary.total_paid))}</td>
        <td style="text-align:right;color:#9A4A00;">${escapeHtml(formatCurrency(report.summary.total_balance))}</td>
        <td style="text-align:right;">${escapeHtml(report.summary.overdue_count)}</td>
        <td style="text-align:right;">${escapeHtml(report.summary.collection_pct)}%</td>
      </tr>
    </tfoot>
  </table>

  <h2>3. Student Fee Ledger (${escapeHtml(report.ledger.length)} Records)</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Student Name</th>
        <th>Class</th>
        <th>Phone</th>
        <th>Period</th>
        <th style="text-align:right;">Billed</th>
        <th style="text-align:right;">Paid</th>
        <th style="text-align:right;">Balance</th>
        <th>Mode</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>${ledgerRowsHtml}</tbody>
    <tfoot>
      <tr>
        <td colspan="5">GRAND TOTAL</td>
        <td style="text-align:right;">${escapeHtml(formatCurrency(report.summary.total_due))}</td>
        <td style="text-align:right;color:#047857;">${escapeHtml(formatCurrency(report.summary.total_paid))}</td>
        <td style="text-align:right;color:#9A4A00;">${escapeHtml(formatCurrency(report.summary.total_balance))}</td>
        <td colspan="2">${escapeHtml(report.summary.collection_pct)}% Collected</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`

    printWin.document.open()
    printWin.document.write(html)
    printWin.document.close()
    printWin.focus()
    printWin.print()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full max-w-3xl max-h-[92dvh] sm:max-h-[88dvh] flex flex-col p-0 gap-0 overflow-hidden bg-white border border-[var(--card-border)] shadow-2xl rounded-[20px] sm:rounded-[24px]"
        showCloseButton={true}
      >
        {/* Fixed Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-[var(--card-border)]/80 bg-white shrink-0 pr-12">
          <DialogHeader className="gap-1 text-left">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-[14px] bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center shrink-0 shadow-2xs">
                  <FileSpreadsheet className="size-5 stroke-[2.2]" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-[var(--text)] tracking-tight">
                    Fee Balance Sheet & Export
                  </DialogTitle>
                  <DialogDescription className="text-xs text-[var(--text-secondary)]">
                    Reconcile collections, pending dues, payment modes, and class-wise totals
                  </DialogDescription>
                </div>
              </div>

              <button
                type="button"
                onClick={fetchBalanceSheet}
                disabled={loading}
                className="size-9 rounded-[10px] border border-[var(--card-border)] bg-white text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--primary-soft)] flex items-center justify-center cursor-pointer transition-colors shrink-0 shadow-2xs"
                title="Recalculate balance sheet"
              >
                <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 space-y-4 overscroll-contain thin-scrollbar">

        {/* 1. Scope & Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
          {/* Period Scope */}
          <div className="relative">
            <select
              aria-label="Report Period"
              value={scopeMode}
              onChange={(e) => setScopeMode(e.target.value as 'month' | 'all')}
              className="w-full min-h-[44px] pl-3 pr-8 rounded-[12px] border border-[var(--card-border)] bg-[var(--primary-soft)]/50 text-xs sm:text-sm font-bold text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer appearance-none truncate"
            >
              <option value="month">
                Period: Selected Month ({defaultMonth || 'Current'})
              </option>
              <option value="all">Period: All Months (Cumulative)</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] pointer-events-none" />
          </div>

          {/* Class Filter */}
          <div className="relative">
            <select
              aria-label="Filter by Class"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full min-h-[44px] pl-3 pr-8 rounded-[12px] border border-[var(--card-border)] bg-white text-xs sm:text-sm font-bold text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer appearance-none truncate"
            >
              <option value="all">Class: All Classes</option>
              {CLASS_OPTIONS.map((cls) => (
                <option key={cls} value={cls}>
                  Class: {cls}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              aria-label="Filter by Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full min-h-[44px] pl-3 pr-8 rounded-[12px] border border-[var(--card-border)] bg-white text-xs sm:text-sm font-bold text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer appearance-none truncate"
            >
              <option value="all">Status: All Fee Records</option>
              <option value="pending">Status: Unpaid / Pending Only</option>
              <option value="paid">Status: Paid Only</option>
              <option value="overdue">Status: Overdue Only</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] pointer-events-none" />
          </div>
        </div>

        {loading || !report ? (
          <div className="py-12 text-center text-sm font-bold text-[var(--text-secondary)] space-y-2">
            <RefreshCw className="size-6 animate-spin mx-auto text-[var(--primary)]" />
            <p>Calculating fee balance sheet...</p>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* 2. Executive Balance Sheet Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Total Billed */}
              <div className="p-3.5 rounded-[16px] bg-[var(--primary-soft)] border border-[var(--card-border)] space-y-0.5">
                <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                  Total Billed
                </span>
                <span className="text-lg sm:text-xl font-bold text-[var(--text)] block truncate">
                  {formatCurrency(report.summary.total_due)}
                </span>
                <span className="text-xs text-[var(--text-secondary)] block">
                  {report.summary.total_records} student records
                </span>
              </div>

              {/* Total Collected */}
              <div className="p-3.5 rounded-[16px] bg-[var(--present-bg)] border border-[var(--present)]/30 space-y-0.5">
                <span className="text-[11px] font-bold text-[var(--present-text)] uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  <span>Collected ({report.summary.collection_pct}%)</span>
                </span>
                <span className="text-lg sm:text-xl font-bold text-[var(--present-text)] block truncate">
                  {formatCurrency(report.summary.total_paid)}
                </span>
                <span className="text-xs text-[var(--present-text)] block">
                  {report.summary.paid_count} paid • {report.summary.partial_count} partial
                </span>
              </div>

              {/* Total Balance (Receivables) */}
              <div className="p-3.5 rounded-[16px] bg-[var(--attention-bg)] border border-[var(--attention)]/30 space-y-0.5">
                <span className="text-[11px] font-bold text-[var(--attention-text)] uppercase tracking-wider flex items-center gap-1">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>Balance Due</span>
                </span>
                <span className="text-lg sm:text-xl font-bold text-[var(--attention-text)] block truncate">
                  {formatCurrency(report.summary.total_balance)}
                </span>
                <span className="text-xs text-[var(--attention-text)] block">
                  Total uncollected
                </span>
              </div>

              {/* Overdue vs Pending Split */}
              <div className="p-3.5 rounded-[16px] bg-slate-50 border border-[var(--card-border)] space-y-0.5">
                <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                  Overdue Split
                </span>
                <span className="text-lg sm:text-xl font-bold text-[var(--attention-text)] block truncate">
                  {formatCurrency(report.summary.overdue_balance)}
                </span>
                <span className="text-xs text-[var(--text-secondary)] block truncate">
                  {report.summary.overdue_count} overdue • {formatCurrency(report.summary.pending_balance)} upcoming
                </span>
              </div>
            </div>

            {/* 3. Payment Mode Reconciliation (Cash vs UPI vs Bank) */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Wallet className="size-4 text-[var(--primary)]" />
                <h4 className="text-sm font-bold text-[var(--text)]">
                  Collection by Payment Mode ({report.scope_title})
                </h4>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {report.mode_breakdown.map((m) => (
                  <div
                    key={m.mode}
                    className="p-3 rounded-[14px] bg-white border border-[var(--card-border)] flex flex-col justify-between"
                  >
                    <span className="text-xs font-bold text-[var(--text-secondary)]">
                      {m.label}
                    </span>
                    <span className="text-base sm:text-lg font-bold text-[var(--text)] mt-1">
                      {formatCurrency(m.amount)}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {m.count} {m.count === 1 ? 'receipt' : 'receipts'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Class-Wise Balance Sheet Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Building2 className="size-4 text-[var(--primary)]" />
                  <h4 className="text-sm font-bold text-[var(--text)]">
                    Class-Wise Balance Breakdown
                  </h4>
                </div>
                <span className="text-xs text-[var(--text-secondary)]">
                  {report.class_breakdown.length} classes
                </span>
              </div>

              {report.class_breakdown.length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--text-secondary)] bg-[var(--primary-soft)]/30 rounded-[16px] border border-dashed border-[var(--card-border)]">
                  No fee records found for the selected filters.
                </div>
              ) : (
                <div className="rounded-[16px] border border-[var(--card-border)] overflow-hidden bg-white">
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-xs sm:text-sm text-left border-collapse">
                      <thead className="bg-[var(--primary-soft)] text-[var(--text)] font-bold sticky top-0 border-b border-[var(--card-border)]">
                        <tr>
                          <th className="py-2.5 px-3">Class</th>
                          <th className="py-2.5 px-2 text-right">Students</th>
                          <th className="py-2.5 px-3 text-right">Billed</th>
                          <th className="py-2.5 px-3 text-right">Collected</th>
                          <th className="py-2.5 px-3 text-right">Balance</th>
                          <th className="py-2.5 px-3 text-right hidden sm:table-cell">Paid %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F2F8]">
                        {report.class_breakdown.map((cls) => (
                          <tr key={cls.class_level} className="hover:bg-[var(--primary-soft)]/30">
                            <td className="py-2.5 px-3 font-bold text-[var(--text)]">
                              {cls.class_level}
                            </td>
                            <td className="py-2.5 px-2 text-right text-[var(--text-secondary)]">
                              {cls.students_count}
                            </td>
                            <td className="py-2.5 px-3 text-right font-normal text-[var(--text)]">
                              {formatCurrency(cls.total_due)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-[var(--present-text)]">
                              {formatCurrency(cls.total_paid)}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-bold ${
                                cls.total_balance > 0
                                  ? 'text-[var(--attention-text)]'
                                  : 'text-[var(--present-text)]'
                              }`}
                            >
                              {formatCurrency(cls.total_balance)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-[var(--text-secondary)] hidden sm:table-cell">
                              {cls.collection_pct}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-[var(--primary-soft)] font-bold text-[var(--text)] border-t-2 border-[var(--card-border)]">
                        <tr>
                          <td className="py-2.5 px-3">TOTAL</td>
                          <td className="py-2.5 px-2 text-right">
                            {report.summary.total_records}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {formatCurrency(report.summary.total_due)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[var(--present-text)]">
                            {formatCurrency(report.summary.total_paid)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[var(--attention-text)]">
                            {formatCurrency(report.summary.total_balance)}
                          </td>
                          <td className="py-2.5 px-3 text-right hidden sm:table-cell">
                            {report.summary.collection_pct}%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Footer (Always Visible on Screen) */}
      <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-[var(--card-border)]/80 bg-white shrink-0 shadow-[0_-4px_16px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:justify-between items-stretch sm:items-center gap-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="min-h-[44px] px-4 rounded-[12px] font-bold text-xs sm:text-sm border border-[var(--card-border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--primary-soft)] cursor-pointer order-3 sm:order-1"
        >
          Close
        </button>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 order-1 sm:order-2">
          {/* Secondary Action: Print / Save PDF */}
          <button
            type="button"
            onClick={handlePrintBalanceSheet}
            disabled={loading || !report}
            className="min-h-[44px] px-4 rounded-[12px] font-bold text-xs sm:text-sm border border-[var(--card-border)] text-[var(--primary)] bg-white hover:bg-[var(--primary-soft)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 transition-colors"
          >
            <Printer className="size-4" />
            <span>Print / Save PDF</span>
          </button>

          {/* Primary Action: Download Excel / CSV Balance Sheet */}
          <a
            href={csvDownloadUrl}
            download
            onClick={() =>
              toast.success('Downloading Fee Balance Sheet (.csv for Excel)...')
            }
            className="min-h-[44px] px-5 rounded-[12px] font-bold text-xs sm:text-sm bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-[0.98]"
          >
            <Download className="size-4" />
            <span>Download Excel (.csv)</span>
          </a>
        </div>
      </div>
    </DialogContent>
  </Dialog>
)
}

