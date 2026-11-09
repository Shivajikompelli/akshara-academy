'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { InitialsAvatar } from '@/components/ui/initials-avatar'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { type Student } from '@/types/database'
import {
  Edit,
  Phone,
  MessageSquare,
  Building,
  CreditCard,
  FileText,
} from 'lucide-react'

interface StudentDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: Student | null
  onEdit: (student: Student) => void
}

export function StudentDetailsDialog({
  open,
  onOpenChange,
  student,
  onEdit,
}: StudentDetailsDialogProps) {
  if (!student) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white p-5 sm:p-6 rounded-[24px] border border-[var(--card-border)] shadow-xl inset-0 sm:inset-auto fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 space-y-4">
        {/* Top Header Row with Edit Button in the top right corner */}
        <DialogHeader className="p-0 border-b border-[var(--card-border)]/60 pb-3">
          <div className="flex items-center justify-between gap-3 pr-6">
            <div>
              <DialogTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                Student Details
              </DialogTitle>
              <DialogDescription className="sr-only">
                Full profile and contact details for {student.full_name}
              </DialogDescription>
            </div>

            {/* Edit button in top right corner */}
            <button
              type="button"
              onClick={() => {
                onOpenChange(false)
                onEdit(student)
              }}
              className="min-h-[38px] px-3.5 rounded-[12px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors active:scale-[0.98]"
            >
              <Edit className="size-3.5 stroke-[2.5]" />
              <span>Edit</span>
            </button>
          </div>
        </DialogHeader>

        {/* Hero / Identity Tile */}
        <div className="flex items-center gap-4 p-4 rounded-[16px] bg-[var(--primary-soft)]/50 border border-[var(--card-border)]/60">
          <InitialsAvatar name={student.full_name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight text-[var(--text)]">
                {student.full_name}
              </h2>
              {student.admission_no && (
                <span className="text-xs font-semibold text-[var(--text-secondary)] bg-white px-2 py-0.5 rounded-full border border-[var(--card-border)] shadow-2xs">
                  #{student.admission_no}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="font-semibold text-sm text-[var(--text)]">
                {student.class_level}
              </span>
              {student.status === 'active' ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--present-bg)] text-[var(--present-text)] border border-[var(--present)]/30">
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-[var(--text-secondary)] border border-[var(--card-border)]/60">
                  Inactive
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bento Sub-Cards */}
        <div className="space-y-3">
          {/* 1. Academic Details */}
          <div className="p-4 rounded-[16px] bg-white border border-[var(--card-border)] shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              <Building className="size-3.5 text-[var(--primary)]" />
              <span>Academic Details</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-[var(--text-secondary)] block">Class Level</span>
                <span className="font-semibold text-[var(--text)]">{student.class_level}</span>
              </div>
              <div>
                <span className="text-xs text-[var(--text-secondary)] block">School</span>
                <span className="font-semibold text-[var(--text)]">
                  {student.school || 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-xs text-[var(--text-secondary)] block">Admission Date</span>
                <span className="font-semibold text-[var(--text)]">
                  {student.admission_date ? formatDate(student.admission_date) : 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-xs text-[var(--text-secondary)] block">Admission No</span>
                <span className="font-semibold text-[var(--text)]">
                  {student.admission_no || 'None'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Parent & Contact Details */}
          <div className="p-4 rounded-[16px] bg-white border border-[var(--card-border)] shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              <Phone className="size-3.5 text-[var(--primary)]" />
              <span>Parent & Contact</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-[var(--text-secondary)] block">Parent Name</span>
                <span className="font-semibold text-[var(--text)]">{student.parent_name}</span>
              </div>
              <div>
                <span className="text-xs text-[var(--text-secondary)] block">Phone Number</span>
                <a
                  href={`tel:${student.phone}`}
                  className="font-bold text-[var(--primary)] hover:underline inline-flex items-center gap-1.5 font-mono"
                >
                  <Phone className="size-3.5 text-[var(--text-secondary)]" />
                  <span>{student.phone}</span>
                </a>
              </div>
              <div>
                <span className="text-xs text-[var(--text-secondary)] block">WhatsApp Alerts</span>
                {student.whatsapp_opt_in ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--whatsapp-bg)] text-[var(--whatsapp-text)] text-xs font-bold border border-[var(--whatsapp)]/30 mt-0.5">
                    <MessageSquare className="size-3 text-[var(--whatsapp)]" />
                    <span>Opted In</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 text-[var(--text-secondary)] text-xs font-medium border border-[var(--card-border)] mt-0.5">
                    Not Opted In
                  </span>
                )}
              </div>
              <div>
                <span className="text-xs text-[var(--text-secondary)] block">Address</span>
                <span className="font-medium text-[var(--text)]">
                  {student.address || 'Not specified'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Fee Structure */}
          <div className="p-4 rounded-[16px] bg-white border border-[var(--card-border)] shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              <CreditCard className="size-3.5 text-[var(--primary)]" />
              <span>Fee Structure</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-[var(--text-secondary)] block">Monthly Tuition Fee</span>
                <span className="text-base font-bold text-[var(--text)]">
                  {formatCurrency(student.monthly_fee || 0)}
                </span>
              </div>
              <div>
                <span className="text-xs text-[var(--text-secondary)] block">Fee Due Day</span>
                <span className="font-semibold text-[var(--text)]">
                  Day {student.fee_due_day || 5} of every month
                </span>
              </div>
            </div>
          </div>

          {/* 4. Notes (if present) */}
          {student.notes && (
            <div className="p-4 rounded-[16px] bg-white border border-[var(--card-border)] shadow-2xs space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                <FileText className="size-3.5 text-[var(--primary)]" />
                <span>Notes</span>
              </div>
              <p className="text-xs text-[var(--text)] whitespace-pre-wrap">{student.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
