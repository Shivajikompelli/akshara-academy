'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MessageSquare, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { Student } from '@/types/database'

interface SendConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  absentStudents: { student: Student; status: 'absent' }[]
  loading: boolean
  onConfirm: () => void
}

export function SendConfirmDialog({
  open,
  onOpenChange,
  absentStudents,
  loading,
  onConfirm,
}: SendConfirmDialogProps) {
  const eligible = absentStudents.filter((a) => a.student.whatsapp_opt_in)
  const skipped = absentStudents.filter((a) => !a.student.whatsapp_opt_in)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white p-6 rounded-[24px] border border-[var(--card-border)] shadow-lg">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center shrink-0">
              <MessageSquare className="size-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-[var(--text)]">
              Send WhatsApp Absent Alerts?
            </DialogTitle>
          </div>
          <DialogDescription className="text-[var(--text-secondary)] pt-1 text-sm font-normal">
            Attendance will be saved first, then WhatsApp absent alert messages will be queued.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Eligible Students List */}
          <div className="p-4 rounded-[16px] bg-[var(--whatsapp-bg)] border border-[var(--whatsapp)]/30 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[var(--whatsapp-text)]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-[var(--whatsapp)]" />
                <span>Send WhatsApp alert to {eligible.length} parent{eligible.length === 1 ? '' : 's'}:</span>
              </span>
              <span className="font-mono">{eligible.length}</span>
            </div>

            {eligible.length > 0 ? (
              <ul className="text-xs text-[var(--text)] space-y-1.5 pl-5 list-disc max-h-36 overflow-y-auto">
                {eligible.map((item) => (
                  <li key={item.student.id}>
                    <span className="font-bold">{item.student.full_name}</span> &rarr; {item.student.parent_name} ({item.student.phone})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[var(--text-secondary)] italic">
                None of the absent students have WhatsApp alert consent.
              </p>
            )}
          </div>

          {/* Skipped Students List (No consent) */}
          {skipped.length > 0 && (
            <div className="p-4 rounded-[16px] bg-[var(--attention-bg)] border border-[var(--attention)]/30 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--attention-text)]">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="size-4 text-[var(--attention-text)]" />
                  <span>
                    {skipped.length} student{skipped.length === 1 ? '' : 's'} skipped (no WhatsApp consent):
                  </span>
                </span>
                <span className="font-mono">{skipped.length}</span>
              </div>
              <ul className="text-xs text-[var(--text-secondary)] space-y-1 pl-5 list-disc max-h-24 overflow-y-auto">
                {skipped.map((item) => (
                  <li key={item.student.id}>
                    <span>{item.student.full_name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 gap-3 flex flex-row justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
            className="min-h-[44px] px-5 rounded-[12px] font-bold text-sm border border-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--primary-soft)] cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={loading || eligible.length === 0}
            onClick={onConfirm}
            className="min-h-[44px] px-6 rounded-[12px] font-bold text-sm bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white shadow-xs cursor-pointer disabled:opacity-40"
          >
            {loading ? 'Sending Alerts...' : `Confirm & Send (${eligible.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

