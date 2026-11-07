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
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-full ${
                isDeactivating ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
              }`}
            >
              {isDeactivating ? (
                <UserX className="size-5" />
              ) : (
                <UserCheck className="size-5" />
              )}
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {isDeactivating ? 'Deactivate Student' : 'Reactivate Student'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-600 pt-2 text-sm leading-relaxed">
            {isDeactivating ? (
              <>
                Are you sure you want to deactivate{' '}
                <strong className="text-slate-900">{student.full_name}</strong> ({student.class_level})?
                They will be excluded from daily attendance marking and active fee reminders. Their history is preserved.
              </>
            ) : (
              <>
                Reactivate <strong className="text-slate-900">{student.full_name}</strong> (
                {student.class_level})? They will immediately appear on the daily attendance screen.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="pt-3 gap-2">
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
            disabled={loading}
            onClick={onConfirm}
            className={`min-h-[44px] text-white font-medium ${
              isDeactivating
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
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

