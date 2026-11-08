'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/formatters'
import {
  BellRing,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Info,
  RefreshCw,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

export interface PreviewRecipient {
  student_id: string
  fee_id: string
  student_name: string
  class_level: string
  balance: number
  period: string
  due_date: string
  reminder_number: number
}

export interface ReminderSummary {
  dry_run: boolean
  sent: number
  failed: number
  already_sent: number
  skipped_no_consent: number
  sent_students: string[]
  failed_students: string[]
  already_sent_students: string[]
  skipped_no_consent_students: string[]
}

interface SendFeeRemindersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCompleted: () => void
  singleStudentId?: string
  singleStudentName?: string
}

export function SendFeeRemindersDialog({
  open,
  onOpenChange,
  onCompleted,
  singleStudentId,
  singleStudentName,
}: SendFeeRemindersDialogProps) {
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [previewData, setPreviewData] = useState<{
    dry_run: boolean
    preview_recipients: PreviewRecipient[]
    skipped_no_consent_students: string[]
    already_sent_students: string[]
    total_eligible: number
  } | null>(null)

  const [result, setResult] = useState<ReminderSummary | null>(null)

  // Fetch preview when dialog opens
  useEffect(() => {
    if (open) {
      setResult(null)
      fetchPreview()
    } else {
      setPreviewData(null)
      setResult(null)
    }
  }, [open, singleStudentId])

  async function fetchPreview() {
    setLoadingPreview(true)
    try {
      const res = await fetch('/api/send-fee-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dry_preview: true,
          student_id: singleStudentId || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch reminder preview')
      }
      setPreviewData(data)
    } catch (err: unknown) {
      console.error('Preview error:', err)
      const msg = err instanceof Error ? err.message : 'Failed to preview reminders'
      toast.error(msg)
      onOpenChange(false)
    } finally {
      setLoadingPreview(false)
    }
  }

  async function handleSendReminders() {
    setSending(true)
    try {
      const res = await fetch('/api/send-fee-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: singleStudentId || undefined,
        }),
      })

      const data: ReminderSummary = await res.json()
      if (!res.ok) {
        throw new Error((data as any).error || 'Failed to send fee reminders')
      }

      setResult(data)
      onCompleted()

      if (data.sent > 0) {
        toast.success(
          data.dry_run
            ? `Dry run: Simulated reminders for ${data.sent} parent(s)!`
            : `Sent WhatsApp fee reminders to ${data.sent} parent(s)!`
        )
      } else if (data.already_sent > 0 && data.failed === 0) {
        toast.info('Eligible students have already received a reminder today.')
      }
    } catch (err: unknown) {
      console.error('Send error:', err)
      const msg = err instanceof Error ? err.message : 'Failed to send reminders'
      toast.error(msg)
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-blue-100 text-blue-700">
              <BellRing className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {singleStudentName
                  ? `Send Fee Reminder: ${singleStudentName}`
                  : 'Send Scheduled Fee Reminders'}
              </DialogTitle>
              <DialogDescription className="text-slate-600 text-xs">
                {singleStudentName
                  ? 'Manual WhatsApp fee reminder for this student.'
                  : 'Sends due fee reminders based on schedule (Day 0 on due date, Day 2 after due date).'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Loading State */}
        {loadingPreview ? (
          <div className="py-12 text-center text-xs text-slate-500 space-y-2">
            <RefreshCw className="size-6 animate-spin mx-auto text-blue-600" />
            <p>Evaluating fee schedule and WhatsApp consent in Asia/Kolkata time...</p>
          </div>
        ) : result ? (
          /* Result View */
          <div className="space-y-4 py-2">
            {/* Dry Run Banner */}
            {result.dry_run && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2">
                  <Info className="size-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Dry Run Mode active:</strong> Messages are logged in database. No real WhatsApp messages were sent.
                  </span>
                </div>
                <Badge className="bg-amber-200 text-amber-900 border-0 text-[10px]">
                  DRY RUN
                </Badge>
              </div>
            )}

            {/* Counts Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-[11px] text-emerald-700 font-semibold block uppercase">
                  Sent
                </span>
                <span className="text-2xl font-bold text-emerald-800 mt-0.5 block">
                  {result.sent}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-600 font-semibold block uppercase">
                  Already Sent
                </span>
                <span className="text-2xl font-bold text-slate-800 mt-0.5 block">
                  {result.already_sent}
                </span>
              </div>

              <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                <span className="text-[11px] text-rose-700 font-semibold block uppercase">
                  Failed
                </span>
                <span className="text-2xl font-bold text-rose-800 mt-0.5 block">
                  {result.failed}
                </span>
              </div>

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <span className="text-[11px] text-amber-700 font-semibold block uppercase">
                  No Consent
                </span>
                <span className="text-2xl font-bold text-amber-800 mt-0.5 block">
                  {result.skipped_no_consent}
                </span>
              </div>
            </div>

            {/* List of Sent Students */}
            {result.sent_students.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span>Successfully Notified ({result.sent_students.length}):</span>
                </span>
                <div className="p-2.5 bg-emerald-50/50 rounded-lg border border-emerald-100 text-xs text-slate-700 max-h-32 overflow-y-auto">
                  {result.sent_students.map((s, idx) => (
                    <div key={idx} className="py-0.5 flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      <span className="font-medium text-slate-900">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* List of Failed Students */}
            {result.failed_students.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                  <XCircle className="size-4 text-rose-600" />
                  <span>Failed ({result.failed_students.length}):</span>
                </span>
                <div className="p-2.5 bg-rose-50/50 rounded-lg border border-rose-200 text-xs text-rose-900 max-h-32 overflow-y-auto">
                  {result.failed_students.map((err, idx) => (
                    <div key={idx} className="py-0.5">
                      • {err}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="w-full min-h-[44px] cursor-pointer"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* Preview Confirmation View */
          <div className="space-y-4 py-2">
            {previewData?.dry_run && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2">
                  <Info className="size-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Dry Run Mode:</strong> Reminders will be logged as dry-run. No real messages will reach Meta.
                  </span>
                </div>
                <Badge className="bg-amber-200 text-amber-900 border-0 text-[10px]">
                  DRY RUN
                </Badge>
              </div>
            )}

            {/* Eligible Recipients List */}
            <div>
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="size-3.5 text-blue-600" />
                  <span>Recipients Due for Reminder ({previewData?.preview_recipients.length || 0})</span>
                </span>
              </div>

              {!previewData || previewData.preview_recipients.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 border border-dashed rounded-xl">
                  <CheckCircle2 className="size-8 mx-auto text-emerald-500 mb-1" />
                  <p className="font-semibold text-slate-700">No fee reminders are due today.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Either fees are not yet at offset 0 (due date) or offset 2, or reminders were already sent today.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {previewData.preview_recipients.map((r) => (
                    <div
                      key={r.fee_id}
                      className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {r.student_name}
                          </span>
                          <Badge variant="outline" className="text-[10px] bg-slate-50">
                            {r.class_level}
                          </Badge>
                          <Badge
                            className={
                              r.reminder_number === 1
                                ? 'bg-blue-100 text-blue-800 border-0 text-[10px]'
                                : 'bg-rose-100 text-rose-800 border-0 text-[10px]'
                            }
                          >
                            Reminder {r.reminder_number} of 2
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {r.period} • Due on {r.due_date}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-rose-700 block">
                          {formatCurrency(r.balance)}
                        </span>
                        <span className="text-[10px] text-slate-400">Balance</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Skipped for No Consent */}
            {previewData && previewData.skipped_no_consent_students.length > 0 && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-1">
                <span className="font-bold text-amber-900 block">
                  Skipped (No WhatsApp Consent): {previewData.skipped_no_consent_students.length} student(s)
                </span>
                <p className="text-[11px] text-amber-800">
                  {previewData.skipped_no_consent_students.join(', ')}
                </p>
              </div>
            )}

            {/* Already Sent Today */}
            {previewData && previewData.already_sent_students.length > 0 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <span className="font-bold text-slate-700 block">
                  Already Reminded Today: {previewData.already_sent_students.length} student(s)
                </span>
                <p className="text-[11px] text-slate-500">
                  {previewData.already_sent_students.join(', ')}
                </p>
              </div>
            )}

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={sending}
                className="min-h-[44px] cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSendReminders}
                disabled={
                  sending ||
                  !previewData ||
                  previewData.preview_recipients.length === 0
                }
                className="min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 cursor-pointer"
              >
                <Send className="size-4" />
                <span>
                  {sending
                    ? 'Sending reminders...'
                    : `Confirm & Send ${previewData?.preview_recipients.length || 0} Reminders`}
                </span>
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

