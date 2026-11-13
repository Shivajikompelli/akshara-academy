'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/formatters'
import {
  BellRing,
  Send,
  CheckCircle2,
  XCircle,
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
  singleFeeId?: string
}

export function SendFeeRemindersDialog({
  open,
  onOpenChange,
  onCompleted,
  singleStudentId,
  singleStudentName,
  singleFeeId,
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
    let ignore = false

    async function loadPreview() {
      if (!open) {
        setPreviewData(null)
        setResult(null)
        return
      }
      setResult(null)
      setLoadingPreview(true)
      try {
        const res = await fetch('/api/send-fee-reminders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dry_preview: true,
            student_id: singleStudentId || undefined,
            fee_id: singleFeeId || undefined,
          }),
        })

        const data = await res.json()
        if (!res.ok) {
          const errObj = typeof data.error === 'object' && data.error !== null ? data.error : null
          throw new Error(errObj?.message || (typeof data.error === 'string' ? data.error : 'Failed to fetch reminder preview'))
        }
        if (!ignore) {
          setPreviewData(data)
        }
      } catch (err: unknown) {
        if (!ignore) {
          console.error('Preview error:', err)
          const msg = err instanceof Error ? err.message : 'Failed to preview reminders'
          toast.error(msg)
          onOpenChange(false)
        }
      } finally {
        if (!ignore) {
          setLoadingPreview(false)
        }
      }
    }

    void loadPreview()
    return () => {
      ignore = true
    }
  }, [open, singleStudentId, singleFeeId, onOpenChange])

  async function handleSendReminders() {
    setSending(true)
    try {
      const res = await fetch('/api/send-fee-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: singleStudentId || undefined,
          fee_id: singleFeeId || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        const errObj = typeof data.error === 'object' && data.error !== null ? data.error : null
        throw new Error(errObj?.message || (typeof data.error === 'string' ? data.error : 'Failed to send fee reminders'))
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
      <DialogContent
        className="p-0 gap-0 overflow-hidden bg-white border border-[var(--card-border)] shadow-2xl rounded-[20px] sm:rounded-[24px] w-[calc(100%-1.5rem)] sm:max-w-xl max-h-[88dvh] flex flex-col"
        showCloseButton={true}
      >
        {/* Fixed Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-[var(--card-border)]/80 bg-white shrink-0 pr-12">
          <DialogHeader className="gap-1 text-left">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-[14px] bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center shrink-0 shadow-2xs">
                <BellRing className="size-5 stroke-[2.2] text-[var(--primary)]" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-[var(--text)] tracking-tight">
                  {singleStudentName
                    ? `Send Fee Reminder: ${singleStudentName}`
                    : 'Send Scheduled Fee Reminders'}
                </DialogTitle>
                <DialogDescription className="text-xs text-[var(--text-secondary)]">
                  {singleStudentName
                    ? 'Manual WhatsApp fee reminder for this student.'
                    : 'Sends due fee reminders based on schedule (Day 0 on due date, Day 2 after due date).'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6 space-y-4 overscroll-contain">

        {/* Loading State */}
        {loadingPreview ? (
          <div className="py-12 text-center text-xs text-[var(--text-secondary)] space-y-2">
            <RefreshCw className="size-6 animate-spin mx-auto text-[var(--primary)]" />
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
                <Badge className="bg-amber-200 text-amber-900 border-0 text-xs">
                  DRY RUN
                </Badge>
              </div>
            )}

            {/* Counts Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-xs text-emerald-700 font-semibold block uppercase">
                  Sent
                </span>
                <span className="text-2xl font-bold text-emerald-800 mt-0.5 block">
                  {result.sent}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-xs text-slate-600 font-semibold block uppercase">
                  Already Sent
                </span>
                <span className="text-2xl font-bold text-slate-800 mt-0.5 block">
                  {result.already_sent}
                </span>
              </div>

              <div className="p-3 bg-[var(--attention-bg)] rounded-lg border border-[var(--attention)]/30">
                <span className="text-xs text-[var(--attention-text)] font-semibold block uppercase">
                  Failed
                </span>
                <span className="text-2xl font-bold text-[var(--attention-text)] mt-0.5 block">
                  {result.failed}
                </span>
              </div>

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <span className="text-xs text-amber-700 font-semibold block uppercase">
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
                <span className="text-xs font-bold text-[var(--attention-text)] flex items-center gap-1.5">
                  <XCircle className="size-4 text-[var(--attention-text)]" />
                  <span>Failed ({result.failed_students.length}):</span>
                </span>
                <div className="p-2.5 bg-[var(--attention-bg)] rounded-lg border border-[var(--attention)]/30 text-xs text-[var(--attention-text)] max-h-32 overflow-y-auto">
                  {result.failed_students.map((err, idx) => (
                    <div key={idx} className="py-0.5">
                      • {err}
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                <Badge className="bg-amber-200 text-amber-900 border-0 text-xs">
                  DRY RUN
                </Badge>
              </div>
            )}

            {/* Eligible Recipients List */}
            <div>
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-xs font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="size-3.5 text-[var(--primary)]" />
                  <span>Recipients Due for Reminder ({previewData?.preview_recipients.length || 0})</span>
                </span>
              </div>

              {!previewData || previewData.preview_recipients.length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--text-secondary)] bg-[var(--primary-soft)]/40 border border-dashed border-[var(--card-border)] rounded-xl">
                  <CheckCircle2 className="size-8 mx-auto text-[var(--present)] mb-1" />
                  <p className="font-semibold text-[var(--text)]">No fee reminders are due today.</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Either fees are not yet at offset 0 (due date) or offset 2, or reminders were already sent today.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {previewData.preview_recipients.map((r) => (
                    <div
                      key={r.fee_id}
                      className="p-3 bg-white rounded-lg border border-[var(--card-border)] shadow-2xs flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[var(--text)] text-sm">
                            {r.student_name}
                          </span>
                          <Badge variant="outline" className="text-xs bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--card-border)]">
                            {r.class_level}
                          </Badge>
                          <Badge
                            className={
                              r.reminder_number === 1
                                ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-0 text-xs'
                                : 'bg-[var(--attention-bg)] text-[var(--attention-text)] border border-[var(--attention)]/30 text-xs'
                            }
                          >
                            Reminder {r.reminder_number}{r.reminder_number <= 2 ? ' of 2' : ''}
                          </Badge>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          {r.period} • Due on {r.due_date}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-[var(--attention-text)] block">
                          {formatCurrency(r.balance)}
                        </span>
                        <span className="text-xs text-[var(--text-secondary)]">Balance</span>
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
                <p className="text-xs text-amber-800">
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
                <p className="text-xs text-slate-500">
                  {previewData.already_sent_students.join(', ')}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky Footer (Always Visible on Screen) */}
      <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-t border-[var(--card-border)]/80 bg-white shrink-0 shadow-[0_-4px_16px_rgba(0,0,0,0.03)]">
        {result ? (
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full min-h-[44px] rounded-[12px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold cursor-pointer"
          >
            Done
          </Button>
        ) : (
          <div className="flex items-center gap-2.5 sm:gap-3 justify-end w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sending}
              className="min-h-[44px] flex-1 sm:flex-initial px-5 rounded-[12px] font-bold text-xs sm:text-sm border border-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--primary-soft)] cursor-pointer"
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
              className="min-h-[44px] flex-1 sm:flex-initial px-6 rounded-[12px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs sm:text-sm gap-2 cursor-pointer shadow-md active:scale-[0.98] transition-all disabled:opacity-40"
            >
              <Send className="size-4" />
              <span>
                {sending
                  ? 'Sending reminders...'
                  : `Confirm & Send ${previewData?.preview_recipients.length || 0} Reminders`}
              </span>
            </Button>
          </div>
        )}
      </div>
    </DialogContent>
  </Dialog>
)
}

