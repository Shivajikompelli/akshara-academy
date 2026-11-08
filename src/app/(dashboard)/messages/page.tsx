'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
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
  RefreshCw,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  Send,
  Eye,
} from 'lucide-react'
import { formatDate } from '@/lib/formatters'
import { toast } from 'sonner'

interface MessageLogRow {
  id: string
  student_id: string | null
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
}

export default function MessageLogPage() {
  const [logs, setLogs] = useState<MessageLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed' | 'queued'>('all')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from('message_log')
        .select(`
          id,
          student_id,
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
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      // Ensure proper typing for joined relation
      const mapped = (data || []).map((row: any) => ({
        ...row,
        students: Array.isArray(row.students) ? row.students[0] : row.students,
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

  const filteredLogs = useMemo(() => {
    if (statusFilter === 'all') return logs
    return logs.filter((l) => l.status === statusFilter)
  }, [logs, statusFilter])

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
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
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
            Audit history of WhatsApp absent alerts and notifications sent to parents.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={fetchLogs}
          disabled={loading}
          className="min-h-[44px] gap-2 border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 font-bold shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            All ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('sent')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
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
            className={`px-3 py-1.5 rounded-md transition-colors ${
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
            className={`px-3 py-1.5 rounded-md transition-colors ${
              statusFilter === 'queued'
                ? 'bg-white text-amber-800 font-bold shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            Queued ({logs.filter((l) => l.status === 'queued').length})
          </button>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 shadow-xs">
          <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-sm font-medium">Loading message logs...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center shadow-xs">
          <MessageSquare className="size-10 mx-auto text-slate-400 mb-3" />
          <h3 className="text-base font-semibold text-slate-900">No message logs found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {statusFilter !== 'all'
              ? 'No messages match the chosen status filter.'
              : 'Messages will appear here once WhatsApp alerts are triggered from the attendance screen.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-semibold text-slate-700">Date</TableHead>
                <TableHead className="font-semibold text-slate-700">Student</TableHead>
                <TableHead className="font-semibold text-slate-700">Class</TableHead>
                <TableHead className="font-semibold text-slate-700">Kind</TableHead>
                <TableHead className="font-semibold text-slate-700">Status</TableHead>
                <TableHead className="font-semibold text-slate-700">Details / Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => {
                const createdTime = new Date(log.created_at).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })

                return (
                  <TableRow key={log.id} className="hover:bg-slate-50/70">
                    {/* Date */}
                    <TableCell className="py-3.5 whitespace-nowrap text-xs text-slate-700">
                      <div className="font-semibold text-slate-900">
                        {formatDate(log.related_date)}
                      </div>
                      <div className="text-[11px] text-slate-400">{createdTime}</div>
                    </TableCell>

                    {/* Student */}
                    <TableCell className="py-3.5">
                      <div className="font-semibold text-slate-900 text-sm">
                        {log.students?.full_name || 'Unknown Student'}
                      </div>
                      <div className="font-mono text-xs text-slate-500">
                        {log.students?.phone || '-'}
                      </div>
                    </TableCell>

                    {/* Class */}
                    <TableCell className="py-3.5 whitespace-nowrap">
                      <Badge variant="outline" className="font-semibold text-blue-800 bg-blue-50 border-blue-200 text-xs">
                        {log.students?.class_level || '-'}
                      </Badge>
                    </TableCell>

                    {/* Kind */}
                    <TableCell className="py-3.5 whitespace-nowrap text-xs text-slate-700">
                      <span className="capitalize font-medium">
                        {log.kind === 'absent_alert' ? 'Absent Alert' : 'Fee Reminder'}
                      </span>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3.5 whitespace-nowrap">
                      {getStatusBadge(log.status, log.wa_message_id)}
                    </TableCell>

                    {/* Details / Error */}
                    <TableCell className="py-3.5 text-xs text-slate-600 max-w-xs">
                      {log.error ? (
                        <div className="text-rose-600 font-medium truncate" title={log.error}>
                          {log.error}
                        </div>
                      ) : log.wa_message_id ? (
                        <div className="font-mono text-[11px] text-slate-400 truncate" title={log.wa_message_id}>
                          ID: {log.wa_message_id}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

