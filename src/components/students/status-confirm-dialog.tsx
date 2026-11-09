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
import { UserX, UserCheck } from 'lucide-react'
import type { Student } from '@/types/database'

interface StatusConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: Student | null
  loading: boolean
  onConfirm: () => void
}

export function StatusConfirmDialog({
  open,
  onOpenChange,
  student,
  loading,
  onConfirm,
}: StatusConfirmDialogProps) {
  if (!student) return null

  const isDeactivating = student.status === 'active'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white p-6 rounded-[24px] border border-[var(--card-border)] shadow-lg">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div
              className={`size-10 rounded-full flex items-center justify-center shrink-0 ${
                isDeactivating
                  ? 'bg-[var(--attention-bg)] text-[var(--attention-text)] border border-[var(--attention)]/30'
                  : 'bg-[var(--present-bg)] text-[var(--present-text)] border border-[var(--present)]/30'
              }`}
            >
              {isDeactivating ? (
                <UserX className="size-5" />
              ) : (
                <UserCheck className="size-5" />
              )}
            </div>
            <DialogTitle className="text-lg font-bold text-[var(--text)]">
              {isDeactivating ? 'Deactivate Student' : 'Reactivate Student'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-[var(--text-secondary)] pt-2 text-sm leading-relaxed font-normal">
            {isDeactivating ? (
              <>
                Are you sure you want to deactivate{' '}
                <strong className="text-[var(--text)]">{student.full_name}</strong> ({student.class_level})?
                They will be excluded from daily attendance marking and active fee reminders. Their history is preserved.
              </>
            ) : (
              <>
                Reactivate <strong className="text-[var(--text)]">{student.full_name}</strong> (
                {student.class_level})? They will immediately appear on the daily attendance screen.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="pt-3 gap-3 flex flex-row justify-end">
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
            disabled={loading}
            onClick={onConfirm}
            className={`min-h-[44px] px-6 rounded-[12px] text-white font-bold text-sm cursor-pointer shadow-xs ${
              isDeactivating
                ? 'bg-[#9A4A00] hover:bg-[#853E00]'
                : 'bg-[var(--present)] hover:bg-[var(--present-text)]'
            }`}
          >
            {loading
              ? 'Updating...'
              : isDeactivating
              ? 'Confirm Deactivation'
              : 'Confirm Reactivation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
