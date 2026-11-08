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
  CheckCircle2,
  Clock,
  Send,
  Eye,
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

export default function MessageLogPage() {
  const [logs, setLogs] = useState<MessageLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [retryingAll, setRetryingAll] = useState(false)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed' | 'queued'>('all')
  const [kindFilter, setKindFilter] = useState<'all' | 'absent_alert' | 'fee_reminder'>('all')

  // Selected Log for Details Modal
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

      const mapped = (data || []).map((row: any) => ({
        ...row,
        students: Array.isArray(row.students) ? row.students[0] : row.students,
        fees: Array.isArray(row.fees) ? row.fees[0] : row.fees,
      }))

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
        const nameMatch = l.students?.full_name.toLowerCase().includes(q)
        const phoneMatch = l.students?.phone.toLowerCase().includes(q)
        if (!nameMatch && !phoneMatch) return false
      }
      return true
    })
  }, [logs, statusFilter, kindFilter, searchQuery])

  const failedCountInView = useMemo(() => {
    return filteredLogs.filter((l) => l.status === 'failed').length
  }, [filteredLogs])

  function getStatusBadge(status: string, waId: string | null) {
    switch (status) {
      case 'sent':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-0 font-semibold text-xs flex items-center gap-1">
            <CheckCircle2 className="size-3" />
            <span>Sent {waId === 'dry-run' ? '(Dry Run)' : ''}</span>
          </Badge>
        )
      case 'failed':
        return (
          <Badge className="bg-rose-100 text-rose-800 border-0 font-semibold text-xs flex items-center gap-1">
            <AlertCircle className="size-3" />
            <span>Failed</span>
          </Badge>
        )
      case 'delivered':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-0 font-semibold text-xs flex items-center gap-1">
            <Send className="size-3" />
            <span>Delivered</span>
          </Badge>
        )
      case 'read':
        return (
          <Badge className="bg-purple-100 text-purple-800 border-0 font-semibold text-xs flex items-center gap-1">
            <Eye className="size-3" />
            <span>Read</span>
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-0 font-medium text-xs flex items-center gap-1">
            <Clock className="size-3" />
            <span>Queued</span>
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
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Message Log</h1>
            <Badge variant="secondary" className="text-xs bg-slate-200 text-slate-800 font-semibold">
              {logs.length} Total
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Audit history of WhatsApp absent alerts and fee reminders, with retry capability for failed deliveries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {failedCountInView > 0 && (
            <Button
              type="button"
              onClick={handleRetryAllFailed}
              disabled={retryingAll || loading}
              className="min-h-[44px] gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-xs"
            >
              <RotateCcw className={`size-3.5 ${retryingAll ? 'animate-spin' : ''}`} />
              <span>{retryingAll ? 'Retrying...' : `Retry all failed (${failedCountInView})`}</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={fetchLogs}
            disabled={loading}
            className="min-h-[44px] gap-2 border-slate-300 text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        {/* Row 1: Kind & Status tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Kind Filter */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setKindFilter('all')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                kindFilter === 'all'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              All Kinds ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setKindFilter('absent_alert')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                kindFilter === 'absent_alert'
                  ? 'bg-white text-blue-800 font-bold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              Absent Alerts ({logs.filter((l) => l.kind === 'absent_alert').length})
            </button>
            <button
              type="button"
              onClick={() => setKindFilter('fee_reminder')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                kindFilter === 'fee_reminder'
                  ? 'bg-white text-emerald-800 font-bold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              Fee Reminders ({logs.filter((l) => l.kind === 'fee_reminder').length})
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              All Status
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('sent')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                statusFilter === 'sent'
                  ? 'bg-white text-emerald-800 font-bold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              Sent ({logs.filter((l) => l.status === 'sent').length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('failed')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                statusFilter === 'failed'
                  ? 'bg-white text-rose-800 font-bold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              Failed ({logs.filter((l) => l.status === 'failed').length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('queued')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                statusFilter === 'queued'
                  ? 'bg-white text-amber-800 font-bold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              Queued ({logs.filter((l) => l.status === 'queued').length})
            </button>
          </div>
        </div>

        {/* Row 2: Search Input */}
        <div className="relative pt-1 border-t border-slate-100">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by student name or parent phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-11 text-sm bg-white"
          />
        </div>
      </div>

      {/* Main Table (Desktop) / Cards (Mobile) */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 shadow-xs">
          <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-sm font-medium">Loading message audit logs...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center shadow-xs">
          <MessageSquare className="size-10 mx-auto text-slate-400 mb-3" />
          <h3 className="text-base font-semibold text-slate-900">No message logs match your filters</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search query, status tabs, or kind filter.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="font-bold text-slate-700 text-xs">Date</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs">Student</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs">Class</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs">Kind & Context</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs">Status</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs">Delivery Details / Error</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => {
                  const isRetrying = retryingId === log.id

                  return (
                    <TableRow
                      key={log.id}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      onClick={() => setSelectedLog(log)}
                    >
                      {/* Date */}
                      <TableCell className="py-3.5 whitespace-nowrap text-xs text-slate-700">
                        <div className="font-bold text-slate-900">
                          {formatDate(log.related_date || log.created_at?.split('T')[0])}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(log.created_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </TableCell>

                      {/* Student */}
                      <TableCell className="py-3.5">
                        <div className="font-bold text-slate-900 text-sm">
                          {log.students?.full_name || 'Unknown Student'}
                        </div>
                        <div className="font-mono text-xs text-slate-500">
                          {log.students?.phone || '-'}
                        </div>
                      </TableCell>

                      {/* Class */}
                      <TableCell className="py-3.5 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className="font-semibold text-blue-800 bg-blue-50 border-blue-200 text-xs"
                        >
                          {log.students?.class_level || '-'}
                        </Badge>
                      </TableCell>

                      {/* Kind & Context */}
                      <TableCell className="py-3.5 whitespace-nowrap text-xs">
                        {log.kind === 'absent_alert' ? (
                          <div>
                            <Badge className="bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-semibold">
                              Absent Alert
                            </Badge>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              Absent on {formatDate(log.related_date)}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <Badge className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
                              Fee Reminder
                            </Badge>
                            <span className="text-[11px] text-slate-700 font-bold block mt-0.5">
                              Fee: {formatPeriod(log.fees?.period || log.related_date)}
                            </span>
                          </div>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-3.5 whitespace-nowrap">
                        {getStatusBadge(log.status, log.wa_message_id)}
                      </TableCell>

                      {/* Error or Message ID */}
                      <TableCell className="py-3.5 text-xs text-slate-600 max-w-xs">
                        {log.error ? (
                          <div className="text-rose-600 font-medium truncate" title={log.error}>
                            {log.error}
                          </div>
                        ) : log.wa_message_id ? (
                          <div
                            className="font-mono text-[11px] text-slate-400 truncate"
                            title={log.wa_message_id}
                          >
                            ID: {log.wa_message_id}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell
                        className="py-3.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {log.status === 'failed' ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleRetrySingle(log.id)}
                            disabled={isRetrying}
                            className="min-h-[34px] px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <RotateCcw className={`size-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                            <span>{isRetrying ? 'Retrying...' : 'Retry'}</span>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedLog(log)}
                            className="min-h-[34px] px-2.5 text-slate-500 hover:text-slate-800 text-xs cursor-pointer"
                          >
                            Details
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredLogs.map((log) => {
              const isRetrying = retryingId === log.id

              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 cursor-pointer active:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">
                        {log.students?.full_name || 'Unknown Student'}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {log.students?.class_level || 'Student'} • {log.students?.phone || '-'}
                      </p>
                    </div>
                    {getStatusBadge(log.status, log.wa_message_id)}
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg text-xs space-y-1 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Type</span>
                      <span className="font-semibold text-slate-800 capitalize">
                        {log.kind === 'absent_alert' ? 'Absent Alert' : 'Fee Reminder'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Related Context</span>
                      <span className="font-bold text-slate-900">
                        {log.kind === 'absent_alert'
                          ? `Absent on ${formatDate(log.related_date)}`
                          : `Fee: ${formatPeriod(log.fees?.period || log.related_date)}`}
                      </span>
                    </div>

                    {log.error && (
                      <div className="pt-1 border-t border-slate-200 text-rose-600 font-medium">
                        Error: {log.error}
                      </div>
                    )}
                  </div>

                  <div
                    className="flex items-center justify-between pt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[11px] text-slate-400">
                      {formatDate(log.created_at?.split('T')[0])}{' '}
                      {new Date(log.created_at).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    {log.status === 'failed' ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleRetrySingle(log.id)}
                        disabled={isRetrying}
                        className="min-h-[38px] px-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs gap-1.5 cursor-pointer shadow-xs"
                      >
                        <RotateCcw className={`size-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                        <span>{isRetrying ? 'Retrying...' : 'Retry'}</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedLog(log)}
                        className="min-h-[38px] px-3 text-slate-600 text-xs cursor-pointer"
                      >
                        Details
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Message Details Modal */}
      {selectedLog && (
        <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
          <DialogContent className="max-w-md bg-white p-6">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-slate-100 text-slate-700">
                  <MessageSquare className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-slate-900">
                    Message Details
                  </DialogTitle>
                  <DialogDescription className="text-slate-600 text-xs">
                    Audit log record ID: <code className="font-mono text-[10px]">{selectedLog.id}</code>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3.5 py-1 text-xs">
              {/* Recipient Box */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Student</span>
                  <span className="font-bold text-slate-900">
                    {selectedLog.students?.full_name || 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Class</span>
                  <span className="font-semibold text-slate-800">
                    {selectedLog.students?.class_level || '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Recipient Phone</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {selectedLog.students?.phone || '-'}
                  </span>
                </div>
              </div>

              {/* Message Payload Meta */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Message Type</span>
                  <Badge variant="outline" className="capitalize text-[11px] font-bold">
                    {selectedLog.kind === 'absent_alert' ? 'Absent Alert' : 'Fee Reminder'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Template Name</span>
                  <code className="font-mono text-slate-800 text-[11px] font-bold">
                    {selectedLog.template_name}
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Context Date / Period</span>
                  <span className="font-bold text-slate-900">
                    {selectedLog.kind === 'absent_alert'
                      ? formatDate(selectedLog.related_date)
                      : formatPeriod(selectedLog.fees?.period || selectedLog.related_date)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Logged At</span>
                  <span className="text-slate-700">
                    {formatDate(selectedLog.created_at?.split('T')[0])}{' '}
                    {new Date(selectedLog.created_at).toLocaleTimeString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Delivery Status & Meta ID / Error */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Current Status</span>
                  {getStatusBadge(selectedLog.status, selectedLog.wa_message_id)}
                </div>

                {selectedLog.wa_message_id && (
                  <div className="text-[11px]">
                    <span className="text-slate-400 block">WhatsApp Message ID:</span>
                    <span className="font-mono text-slate-700 select-all break-all">
                      {selectedLog.wa_message_id}
                    </span>
                  </div>
                )}

                {selectedLog.error && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-md text-rose-800 text-[11px] space-y-1">
                    <span className="font-bold block flex items-center gap-1">
                      <AlertTriangle className="size-3.5 text-rose-600" />
                      Failure Error:
                    </span>
                    <p className="font-mono break-all">{selectedLog.error}</p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              {selectedLog.status === 'failed' && (
                <Button
                  type="button"
                  onClick={() => handleRetrySingle(selectedLog.id)}
                  disabled={retryingId === selectedLog.id}
                  className="min-h-[44px] bg-rose-600 hover:bg-rose-700 text-white font-bold gap-2 cursor-pointer"
                >
                  <RotateCcw className={`size-4 ${retryingId === selectedLog.id ? 'animate-spin' : ''}`} />
                  <span>{retryingId === selectedLog.id ? 'Retrying...' : 'Retry Message Now'}</span>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedLog(null)}
                className="min-h-[44px] cursor-pointer"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
