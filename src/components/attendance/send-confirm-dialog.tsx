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
      <DialogContent className="max-w-lg bg-white p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-emerald-100 text-emerald-700">
              <MessageSquare className="size-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Send WhatsApp Absent Alerts?
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-600 pt-1 text-sm">
            Attendance will be saved first, then WhatsApp absent alert messages will be queued.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Eligible Students List */}
          <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/60 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <span>Send WhatsApp alert to {eligible.length} parent{eligible.length === 1 ? '' : 's'}:</span>
              </span>
              <span className="font-mono">{eligible.length}</span>
            </div>

            {eligible.length > 0 ? (
              <ul className="text-xs text-slate-800 space-y-1 pl-5 list-disc max-h-36 overflow-y-auto">
                {eligible.map((item) => (
                  <li key={item.student.id}>
                    <span className="font-semibold">{item.student.full_name}</span> &rarr; {item.student.parent_name} ({item.student.phone})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 italic">
                None of the absent students have WhatsApp alert consent.
              </p>
            )}
          </div>

          {/* Skipped Students List (No consent) */}
          {skipped.length > 0 && (
            <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="size-4 text-amber-600" />
                  <span>
                    {skipped.length} student{skipped.length === 1 ? '' : 's'} skipped (no WhatsApp consent):
                  </span>
                </span>
                <span className="font-mono">{skipped.length}</span>
              </div>
              <ul className="text-xs text-slate-700 space-y-0.5 pl-5 list-disc max-h-24 overflow-y-auto">
                {skipped.map((item) => (
                  <li key={item.student.id}>
                    <span>{item.student.full_name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={loading || eligible.length === 0}
            onClick={onConfirm}
            className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {loading ? 'Sending Alerts...' : `Confirm & Send (${eligible.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
