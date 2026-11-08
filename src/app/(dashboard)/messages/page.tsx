'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { InitialsAvatar } from '@/components/ui/initials-avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  RefreshCw,
  MessageSquare,
  AlertCircle,
  CheckCheck,
  Clock,
  RotateCcw,
  Search,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { formatDate, formatPeriod } from '@/lib/formatters'
import { toast } from 'sonner'

interface MessageLogRow {
  id: string
  student_id: string | null
  fee_id: string | null
  kind: 'absent_alert' | 'fee_reminder'
  template_name: string
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
  wa_message_id: string | null
  error: string | null
  related_date: string | null
  created_at: string
  students: {
    id: string
    full_name: string
    class_level: string
    phone: string
  } | null
  fees: {
    id: string
    period: string
    amount_due: number
  } | null
}

function renderWhatsAppTemplateText(log: MessageLogRow): string {
  const studentName = log.students?.full_name || 'Student'
  const dateStr = formatDate(log.related_date || log.created_at?.split('T')[0])

  if (log.kind === 'absent_alert') {
    return `Dear Parent, please be informed that your child ${studentName} was marked ABSENT today (${dateStr}) at Akshara Academy. Please contact the administration if you have questions.`
  }

  const periodStr = formatPeriod(log.fees?.period || log.related_date)
  const amountStr = log.fees?.amount_due ? `₹${log.fees.amount_due}` : 'the pending balance'

  return `Dear Parent, this is a reminder from Akshara Academy regarding ${studentName}'s tuition fee for ${periodStr}. Outstanding amount: ${amountStr}. Due date: ${dateStr}. Kindly arrange payment at your earliest convenience.`
}

export default function MessageLogPage() {
  const [logs, setLogs] = useState<MessageLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [retryingAll, setRetryingAll] = useState(false)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed' | 'queued'>('all')
  const [kindFilter, setKindFilter] = useState<'all' | 'absent_alert' | 'fee_reminder'>('all')

  // Selected Log for Details Modal with WhatsApp preview bubble
  const [selectedLog, setSelectedLog] = useState<MessageLogRow | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from('message_log')
        .select(`
          id,
          student_id,
          fee_id,
          kind,
          template_name,
          status,
          wa_message_id,
          error,
          related_date,
          created_at,
          students (
            id,
            full_name,
            class_level,
            phone
          ),
          fees (
            id,
            period,
            amount_due
          )
        `)
        .order('created_at', { ascending: false })
        .limit(150)

      if (error) throw error

      const mapped = (data || []).map((row) => ({
        ...row,
        students: Array.isArray(row.students) ? row.students[0] : row.students,
        fees: Array.isArray(row.fees) ? row.fees[0] : row.fees,
      })) as MessageLogRow[]

      setLogs(mapped)
    } catch (err: unknown) {
      console.error('Failed to load message log:', err)
      const msg = err instanceof Error ? err.message : 'Failed to load message log'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Retry a single failed message
  async function handleRetrySingle(logId: string) {
    setRetryingId(logId)
    try {
      const res = await fetch('/api/retry-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_log_id: logId }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to retry message')
      }

      if (data.success_count > 0) {
        toast.success(
          data.dry_run
            ? 'Dry run: Message simulated as sent.'
            : 'WhatsApp message retried and sent successfully!'
        )
      } else {
        const firstErr = data.details?.[0]?.error || 'Delivery failed on retry.'
        toast.error(`Retry failed: ${firstErr}`)
      }

      await fetchLogs()
      if (selectedLog && selectedLog.id === logId) {
        setSelectedLog(null)
      }
    } catch (err: unknown) {
      console.error('Retry error:', err)
      const msg = err instanceof Error ? err.message : 'Failed to retry message'
      toast.error(msg)
    } finally {
      setRetryingId(null)
    }
  }

  // Bulk retry all failed messages in current view
  async function handleRetryAllFailed() {
    const failedIds = filteredLogs
      .filter((l) => l.status === 'failed')
      .map((l) => l.id)

    if (failedIds.length === 0) {
      toast.info('No failed messages to retry.')
      return
    }

    if (
      !window.confirm(
        `Are you sure you want to retry sending all ${failedIds.length} failed messages?`
      )
    ) {
      return
    }

    setRetryingAll(true)
    try {
      const res = await fetch('/api/retry-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_log_ids: failedIds }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to retry messages')
      }

      toast.success(
        `Retried ${data.retried_count} messages: ${data.success_count} succeeded, ${data.failed_count} failed.`
      )
      await fetchLogs()
    } catch (err: unknown) {
      console.error('Bulk retry error:', err)
      const msg = err instanceof Error ? err.message : 'Failed to retry messages'
      toast.error(msg)
    } finally {
      setRetryingAll(false)
    }
  }

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) {
        return false
      }
      if (kindFilter !== 'all' && l.kind !== kindFilter) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const nameMatch = l.students?.full_name?.toLowerCase().includes(q)
        const phoneMatch = l.students?.phone?.toLowerCase().includes(q)
        if (!nameMatch && !phoneMatch) return false
      }
      return true
    })
  }, [logs, statusFilter, kindFilter, searchQuery])

  const failedCountInView = useMemo(() => {
    return filteredLogs.filter((l) => l.status === 'failed').length
  }, [filteredLogs])

  function getStatusPill(status: string, waId: string | null) {
    switch (status) {
      case 'sent':
      case 'delivered':
      case 'read':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--present-bg)] text-[var(--present-text)] border border-[var(--present)]/30">
            <CheckCheck className="size-3.5 stroke-[2.5]" />
            <span>Sent {waId === 'dry-run' ? '(Dry Run)' : ''}</span>
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--absent-bg)] text-[var(--absent-text)] border border-[var(--absent)]/30">
            <AlertCircle className="size-3.5 stroke-[2.5]" />
            <span>Failed</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-[var(--text-secondary)] border border-[var(--card-border)]/60">
            <Clock className="size-3.5" />
            <span>Queued</span>
          </span>
        )
    }
  }

  return (
    <div className="space-y-6 max-w-[960px] mx-auto pb-16">
      {/* 1. TOP HEADER (Clean, unboxed) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
              Message Log
            </h1>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--card-border)]/60">
              {logs.length} Total
            </span>
          </div>
          <p className="text-sm font-normal text-[var(--text-secondary)] mt-0.5">
            Audit history of WhatsApp absent alerts and fee reminders with live retry capability.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {failedCountInView > 0 && (
            <button
              type="button"
              onClick={handleRetryAllFailed}
              disabled={retryingAll || loading}
              className="min-h-[44px] px-5 rounded-[12px] bg-[var(--absent)] hover:bg-[var(--absent-text)] text-white font-bold text-sm flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
            >
              <RotateCcw className={`size-4 ${retryingAll ? 'animate-spin' : ''}`} />
              <span>{retryingAll ? 'Retrying...' : `Retry all failed (${failedCountInView})`}</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="size-11 rounded-[12px] border border-[var(--card-border)] bg-white text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--primary-soft)] flex items-center justify-center cursor-pointer transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. FILTER PILLS (All / Absent alerts / Fee reminders, status filter) & Search */}
      <div className="space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search by student name or parent phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-10 pr-4 rounded-[12px] border border-[var(--card-border)] bg-white text-base text-[var(--text)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-2xs"
          />
        </div>

        {/* Filter Pills row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Kind filter pills: All / Absent alerts / Fee reminders */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mr-1 shrink-0">
              Type:
            </span>
            <button
              type="button"
              onClick={() => setKindFilter('all')}
              className={`min-h-[36px] px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
                kindFilter === 'all'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'bg-white text-[var(--text-secondary)] border border-[var(--card-border)] hover:bg-[var(--primary-soft)]'
              }`}
            >
              All Types ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setKindFilter('absent_alert')}
              className={`min-h-[36px] px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
                kindFilter === 'absent_alert'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'bg-white text-[var(--text-secondary)] border border-[var(--card-border)] hover:bg-[var(--primary-soft)]'
              }`}
            >
              Absent Alerts ({logs.filter((l) => l.kind === 'absent_alert').length})
            </button>
            <button
              type="button"
              onClick={() => setKindFilter('fee_reminder')}
              className={`min-h-[36px] px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
                kindFilter === 'fee_reminder'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'bg-white text-[var(--text-secondary)] border border-[var(--card-border)] hover:bg-[var(--primary-soft)]'
              }`}
            >
              Fee Reminders ({logs.filter((l) => l.kind === 'fee_reminder').length})
            </button>
          </div>

          {/* Status filter pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mr-1 shrink-0">
              Status:
            </span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`min-h-[36px] px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'bg-white text-[var(--text-secondary)] border border-[var(--card-border)] hover:bg-[var(--primary-soft)]'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('sent')}
              className={`min-h-[36px] px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'sent'
                  ? 'bg-[var(--present)] text-white shadow-xs'
                  : 'bg-white text-[var(--text-secondary)] border border-[var(--card-border)] hover:bg-[var(--primary-soft)]'
              }`}
            >
              Sent ({logs.filter((l) => l.status === 'sent').length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('failed')}
              className={`min-h-[36px] px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'failed'
                  ? 'bg-[var(--absent)] text-white shadow-xs'
                  : 'bg-white text-[var(--absent-text)] border border-[var(--absent)]/30 hover:border-[var(--absent)]'
              }`}
            >
              Failed ({logs.filter((l) => l.status === 'failed').length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('queued')}
              className={`min-h-[36px] px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'queued'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-white text-[var(--text-secondary)] border border-[var(--card-border)] hover:bg-[var(--primary-soft)]'
              }`}
            >
              Queued ({logs.filter((l) => l.status === 'queued').length})
            </button>
          </div>
        </div>
      </div>

      {/* 3. MESSAGE LOG ROWS */}
      {loading ? (
        <div className="bg-white rounded-[24px] border border-[var(--card-border)] p-12 text-center text-[var(--text-secondary)] shadow-2xs">
          <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-[var(--primary)]" />
          <p className="text-sm font-bold">Loading message audit logs...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white rounded-[24px] border border-dashed border-[var(--card-border)] p-12 text-center shadow-2xs">
          <MessageSquare className="size-10 mx-auto text-[var(--text-secondary)] opacity-50 mb-3" />
          <h3 className="text-base font-bold text-[var(--text)]">No message logs match your filters</h3>
          <p className="text-sm font-normal text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
            Try adjusting your search query, status pills, or message type filter.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const isRetrying = retryingId === log.id
            const isFailed = log.status === 'failed'

            return (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className={`bg-white rounded-[20px] border p-4 sm:p-5 shadow-2xs hover:border-[var(--primary)]/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer ${
                  isFailed ? 'border-[var(--absent)]/40 bg-[var(--absent-bg)]/30' : 'border-[var(--card-border)]/70'
                }`}
              >
                {/* Left: Avatar + Student info */}
                <div className="flex items-center gap-3.5 min-w-0 md:w-5/12">
                  <InitialsAvatar
                    name={log.students?.full_name || 'Student'}
                    size="md"
                    className={isFailed ? 'bg-[var(--absent)]/15 text-[var(--absent-text)] border-[var(--absent)]/30' : ''}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-base text-[var(--text)] truncate">
                        {log.students?.full_name || 'Unknown Student'}
                      </span>
                      {log.students?.class_level && (
                        <span className="text-xs font-bold text-[var(--primary)] bg-[var(--primary-soft)] px-2 py-0.5 rounded-full shrink-0">
                          {log.students.class_level}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-normal text-[var(--text-secondary)] mt-0.5 truncate flex items-center gap-1.5 font-mono">
                      <span>{log.students?.phone || 'No phone'}</span>
                    </div>
                  </div>
                </div>

                {/* Middle: Message Kind & Delivery Date */}
                <div className="text-sm md:w-4/12 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--text)]">
                      {log.kind === 'absent_alert' ? 'Absent Alert' : 'Fee Reminder'}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      ({formatDate(log.related_date || log.created_at?.split('T')[0])})
                    </span>
                  </div>

                  {isFailed && log.error ? (
                    <p className="text-xs font-bold text-[var(--absent-text)] truncate" title={log.error}>
                      Error: {log.error}
                    </p>
                  ) : (
                    <p className="text-xs text-[var(--text-secondary)] font-mono truncate">
                      {log.wa_message_id ? `ID: ${log.wa_message_id}` : 'Queued for sending'}
                    </p>
                  )}
                </div>

                {/* Right: Status pill & Action */}
                <div
                  className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--card-border)]/40 md:w-3/12"
                  onClick={(e) => e.stopPropagation()}
                >
                  {getStatusPill(log.status, log.wa_message_id)}

                  <div className="flex items-center gap-2">
                    {isFailed ? (
                      <button
                        type="button"
                        onClick={() => handleRetrySingle(log.id)}
                        disabled={isRetrying}
                        className="min-h-[40px] px-3.5 rounded-[12px] bg-[var(--absent)] hover:bg-[var(--absent-text)] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
                      >
                        <RotateCcw className={`size-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                        <span>{isRetrying ? 'Retrying...' : 'Retry'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="min-h-[40px] px-3.5 rounded-[12px] text-xs font-bold border border-[var(--card-border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--primary-soft)] cursor-pointer transition-colors"
                      >
                        Preview
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 4. WHATSAPP-STYLE PREVIEW BUBBLE DIALOG */}
      {selectedLog && (
        <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
          <DialogContent className="max-w-md bg-white p-6 rounded-[24px] border border-[var(--card-border)] shadow-xl">
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <div className="size-10 rounded-full bg-[var(--whatsapp-bg)] text-[var(--whatsapp-text)] flex items-center justify-center shrink-0">
                  <MessageSquare className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-[var(--text)]">
                    WhatsApp Message Preview
                  </DialogTitle>
                  <DialogDescription className="text-[var(--text-secondary)] text-xs">
                    {selectedLog.students?.full_name || 'Student'} • {selectedLog.students?.phone || '-'}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* WhatsApp Chat Preview Bubble */}
              <div className="p-4 rounded-[20px] bg-[#EFEAE2] border border-[#DDD6CE] space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block text-center">
                  WhatsApp Cloud API Template Message
                </span>

                {/* The Bubble */}
                <div className="max-w-[88%] ml-auto bg-[var(--whatsapp-bg)] text-[var(--whatsapp-text)] rounded-[18px] rounded-tr-[4px] p-4 shadow-sm space-y-2 border border-[var(--whatsapp)]/20">
                  <p className="text-sm font-normal text-slate-900 leading-relaxed whitespace-pre-wrap">
                    {renderWhatsAppTemplateText(selectedLog)}
                  </p>

                  <div className="flex items-center justify-end gap-1.5 text-[11px] text-[var(--whatsapp-text)] font-medium pt-1">
                    <span>
                      {new Date(selectedLog.created_at).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {selectedLog.status === 'sent' || selectedLog.status === 'delivered' ? (
                      <CheckCheck className="size-4 stroke-[2.5]" />
                    ) : selectedLog.status === 'failed' ? (
                      <AlertCircle className="size-3.5 text-[var(--absent)]" />
                    ) : (
                      <Clock className="size-3.5" />
                    )}
                  </div>
                </div>
              </div>

              {/* Status details & Error Box */}
              <div className="p-4 rounded-[16px] bg-[var(--primary-soft)]/50 border border-[var(--card-border)]/60 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">Template:</span>
                  <code className="font-mono font-bold text-[var(--text)]">
                    {selectedLog.template_name}
                  </code>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">Status:</span>
                  {getStatusPill(selectedLog.status, selectedLog.wa_message_id)}
                </div>

                {selectedLog.wa_message_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">Meta Message ID:</span>
                    <span className="font-mono text-[var(--text)] truncate max-w-[200px]" title={selectedLog.wa_message_id}>
                      {selectedLog.wa_message_id}
                    </span>
                  </div>
                )}

                {/* Error text for failed row */}
                {selectedLog.status === 'failed' && selectedLog.error && (
                  <div className="p-3 bg-[var(--absent-bg)] border border-[var(--absent)]/30 rounded-[12px] text-[var(--absent-text)] space-y-1 mt-2">
                    <span className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="size-4" />
                      Failure Reason:
                    </span>
                    <p className="font-mono text-xs break-all">{selectedLog.error}</p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2 gap-3 flex flex-row justify-end">
              {/* Retry button for failed row */}
              {selectedLog.status === 'failed' && (
                <button
                  type="button"
                  onClick={() => handleRetrySingle(selectedLog.id)}
                  disabled={retryingId === selectedLog.id}
                  className="min-h-[44px] px-6 rounded-[12px] bg-[var(--absent)] hover:bg-[var(--absent-text)] text-white font-bold text-sm flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <RotateCcw className={`size-4 ${retryingId === selectedLog.id ? 'animate-spin' : ''}`} />
                  <span>{retryingId === selectedLog.id ? 'Retrying...' : 'Retry Message Now'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="min-h-[44px] px-5 rounded-[12px] font-bold text-sm border border-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--primary-soft)] cursor-pointer"
              >
                Close
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
