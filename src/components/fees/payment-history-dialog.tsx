'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate, formatPeriod } from '@/lib/formatters'
import {
  Receipt,
  History,
  AlertCircle,
  Trash2,
  Edit2,
  AlertTriangle,
  Calendar,
} from 'lucide-react'
import { toast } from 'sonner'
import type { FeeSummaryRow, FeePayment } from '@/types/database'

interface PaymentHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fee: FeeSummaryRow | null
  onFeeUpdated: () => void
}

export function PaymentHistoryDialog({
  open,
  onOpenChange,
  fee,
  onFeeUpdated,
}: PaymentHistoryDialogProps) {
  const [payments, setPayments] = useState<FeePayment[]>([])
  const [studentPastFees, setStudentPastFees] = useState<FeeSummaryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Edit Amount Due State (allowed only if 0 payments)
  const [isEditingAmount, setIsEditingAmount] = useState(false)
  const [newAmountDue, setNewAmountDue] = useState<number>(0)
  const [updatingAmount, setUpdatingAmount] = useState(false)

  // Delete Payment Confirmation State
  const [paymentToDelete, setPaymentToDelete] = useState<FeePayment | null>(null)
  const [deletingPayment, setDeletingPayment] = useState(false)

  const feeId = fee?.fee_id
  const studentId = fee?.student_id
  const initialAmountDue = fee?.amount_due ?? 0

  // Fetch current fee payments
  const fetchPayments = useCallback(async () => {
    if (!feeId) return
    setLoading(true)
    setErrorMsg(null)
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from('fee_payments')
        .select('*')
        .eq('fee_id', feeId)
        .order('paid_on', { ascending: false })

      if (error) throw error
      setPayments(data || [])
    } catch (err: unknown) {
      console.error('Failed to load payments:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load payments.')
    } finally {
      setLoading(false)
    }
  }, [feeId])

  // Fetch student's past fee rows (previous months)
  const fetchStudentPastFees = useCallback(async () => {
    if (!studentId) return
    setLoadingHistory(true)
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from('fee_summary')
        .select('*')
        .eq('student_id', studentId)
        .order('period', { ascending: false })

      if (error) throw error
      setStudentPastFees(
        (data || []).map((row) => ({
          fee_id: String(row.fee_id),
          student_id: String(row.student_id),
          full_name: String(row.full_name),
          period: String(row.period),
          amount_due: Number(row.amount_due) || 0,
          due_date: String(row.due_date),
          amount_paid: Number(row.amount_paid) || 0,
          balance: Number(row.balance) || 0,
          status: row.status as FeeSummaryRow['status'],
        }))
      )
    } catch (err: unknown) {
      console.error('Failed to load past fee history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }, [studentId])

  useEffect(() => {
    let ignore = false
    const timer = setTimeout(() => {
      if (ignore) return
      if (open && feeId) {
        setIsEditingAmount(false)
        setNewAmountDue(initialAmountDue)
        setPaymentToDelete(null)
        void fetchPayments()
        void fetchStudentPastFees()
      } else {
        setPayments([])
        setStudentPastFees([])
      }
    }, 0)
    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [open, feeId, initialAmountDue, fetchPayments, fetchStudentPastFees])

  if (!fee) return null

  const liveAmountPaid = loading
    ? fee.amount_paid
    : payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  const liveBalance = fee.amount_due - liveAmountPaid

  // Delete payment action
  async function handleDeletePayment() {
    if (!paymentToDelete) return
    setDeletingPayment(true)
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('fee_payments')
        .delete()
        .eq('id', paymentToDelete.id)

      if (error) throw error

      toast.success(
        `Payment of ${formatCurrency(paymentToDelete.amount)} deleted.`
      )
      setPaymentToDelete(null)
      await fetchPayments()
      await fetchStudentPastFees()
      onFeeUpdated()
    } catch (err: unknown) {
      console.error('Failed to delete payment:', err)
      const msg = err instanceof Error ? err.message : 'Failed to delete payment.'
      toast.error(msg)
    } finally {
      setDeletingPayment(false)
    }
  }

  // Update Amount Due action (allowed ONLY if 0 payments)
  async function handleUpdateAmountDue() {
    if (!fee) return
    if (payments.length > 0 || liveAmountPaid > 0) {
      toast.error('Amount due cannot be edited after payments have been recorded.')
      return
    }

    if (newAmountDue <= 0) {
      toast.error('Fee amount must be greater than 0.')
      return
    }

    if (
      !window.confirm(
        `Are you sure you want to update the fee amount from ${formatCurrency(
          fee.amount_due
        )} to ${formatCurrency(newAmountDue)}?`
      )
    ) {
      return
    }

    setUpdatingAmount(true)
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('fees')
        .update({ amount_due: newAmountDue })
        .eq('id', fee.fee_id)

      if (error) throw error

      toast.success(
        `Fee amount updated to ${formatCurrency(newAmountDue)} for ${fee.full_name}!`
      )
      setIsEditingAmount(false)
      onFeeUpdated()
      onOpenChange(false)
    } catch (err: unknown) {
      console.error('Failed to update amount due:', err)
      const msg = err instanceof Error ? err.message : 'Failed to update fee amount.'
      toast.error(msg)
    } finally {
      setUpdatingAmount(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="w-full max-w-xl max-h-[92dvh] sm:max-h-[88dvh] flex flex-col p-0 gap-0 overflow-hidden bg-white border border-[var(--card-border)] shadow-2xl rounded-[20px] sm:rounded-[24px]"
          showCloseButton={true}
        >
          {/* Fixed Header */}
          <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-[var(--card-border)]/80 bg-white shrink-0 pr-12">
            <DialogHeader className="gap-1 text-left">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-[14px] bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center shrink-0 shadow-2xs">
                  <History className="size-5 stroke-[2.2]" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-[var(--text)] tracking-tight">
                    Fee Details & History
                  </DialogTitle>
                  <DialogDescription className="text-xs text-[var(--text-secondary)]">
                    {fee.full_name} • {formatPeriod(fee.period)}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 space-y-5 overscroll-contain thin-scrollbar">
            {errorMsg && (
              <div className="p-3.5 bg-[var(--attention-bg)] text-[var(--attention-text)] text-xs rounded-[12px] border border-[var(--attention)]/30 flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}
            {/* 1. Summary Box */}
            <div className="p-3.5 bg-[var(--primary-soft)]/40 rounded-xl border border-[var(--card-border)] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)] font-medium">Fee Period</span>
                <span className="font-bold text-[var(--text)]">{formatPeriod(fee.period)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)] font-medium">Due Date</span>
                <span className="font-bold text-[var(--text)]">{formatDate(fee.due_date)}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--card-border)]/60 text-center text-xs">
                <div>
                  <span className="text-[var(--text-secondary)] block text-xs">Due</span>
                  <span className="font-bold text-[var(--text)]">
                    {formatCurrency(fee.amount_due)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)] block text-xs">Paid</span>
                  <span className="font-bold text-[var(--present-text)]">
                    {formatCurrency(liveAmountPaid)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)] block text-xs">Balance</span>
                  <span className="font-extrabold text-[var(--attention-text)]">
                    {formatCurrency(liveBalance)}
                  </span>
                </div>
              </div>

              {/* Edit Amount Due (allowed ONLY if no payments) */}
              {payments.length === 0 && liveAmountPaid === 0 && (
                <div className="pt-2 border-t border-[var(--card-border)]/60">
                  {isEditingAmount ? (
                    <div className="space-y-2 bg-[var(--primary-soft)] p-3 rounded-lg border border-[var(--primary)]/30">
                      <Label className="text-xs font-semibold text-[var(--text)]">
                        Edit Amount Due (₹)
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          step="10"
                          value={newAmountDue}
                          onChange={(e) => setNewAmountDue(Number(e.target.value))}
                          className="h-10 text-sm font-bold bg-white"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleUpdateAmountDue}
                          disabled={updatingAmount}
                          className="h-10 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold cursor-pointer"
                        >
                          {updatingAmount ? 'Saving...' : 'Save'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingAmount(false)}
                          className="h-10 cursor-pointer"
                        >
                          Cancel
                        </Button>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Allowed before any payment is recorded (e.g. for scholarships or discounts).
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditingAmount(true)}
                      className="text-xs text-[var(--primary)] hover:underline font-semibold flex items-center gap-1 cursor-pointer pt-1"
                    >
                      <Edit2 className="size-3.5" />
                      <span>Edit fee amount (no payments recorded yet)</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 2. Current Month's Payments */}
            <div>
              <div className="flex items-center justify-between pb-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Payments for {formatPeriod(fee.period)} ({payments.length})
                </h4>
              </div>

              {loading ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Loading payments...
                </div>
              ) : payments.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-xl bg-slate-50/50">
                  <Receipt className="size-7 mx-auto text-slate-300 mb-1" />
                  <p>No payments recorded yet for this fee period.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between text-xs hover:border-slate-300 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {formatCurrency(p.amount)}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-xs uppercase font-bold text-slate-700 bg-slate-100"
                          >
                            {p.mode}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500">
                          Paid on {formatDate(p.paid_on)}
                          {p.reference ? ` • Ref: ${p.reference}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Delete payment action */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setPaymentToDelete(p)}
                          className="size-8 text-slate-400 hover:text-[var(--attention-text)] hover:bg-[var(--attention-bg)] cursor-pointer"
                          title="Delete payment made by mistake"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Student's Past Fee History (Previous Months) */}
            <div className="pt-2 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 flex items-center gap-1.5">
                <Calendar className="size-3.5 text-slate-500" />
                <span>All Months History for {fee.full_name}</span>
              </h4>

              {loadingHistory ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  Loading history...
                </div>
              ) : studentPastFees.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No other fee records found.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {studentPastFees.map((pastFee) => {
                    const isCurrent = pastFee.fee_id === fee.fee_id
                    return (
                      <div
                        key={pastFee.fee_id}
                        className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                          isCurrent
                            ? 'bg-[var(--primary-soft)] border-[var(--primary)]/30'
                            : 'bg-white border-[var(--card-border)]/70'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[var(--text)]">
                              {formatPeriod(pastFee.period)}
                            </span>
                            {isCurrent && (
                              <Badge className="bg-[var(--primary)] text-white text-xs px-1.5 py-0 font-bold">
                                Current
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 block">
                            Due: {formatCurrency(pastFee.amount_due)} • Paid: {formatCurrency(pastFee.amount_paid)}
                          </span>
                        </div>

                        <div className="text-right">
                          <span
                            className={`font-bold block ${
                              pastFee.balance > 0 ? 'text-[var(--attention-text)]' : 'text-emerald-700'
                            }`}
                          >
                            {pastFee.balance > 0
                              ? `Bal: ${formatCurrency(pastFee.balance)}`
                              : 'Cleared'}
                          </span>
                          <span className="text-xs text-slate-400 capitalize">
                            {pastFee.status}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-[var(--card-border)]/80 bg-white shrink-0 shadow-[0_-4px_16px_rgba(0,0,0,0.03)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full min-h-[44px] rounded-[12px] font-bold text-sm border border-[var(--card-border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--primary-soft)] cursor-pointer"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Payment Confirm Dialog */}
      {paymentToDelete && (
        <Dialog
          open={!!paymentToDelete}
          onOpenChange={(isOpen) => !isOpen && setPaymentToDelete(null)}
        >
          <DialogContent className="max-w-sm bg-white p-6 rounded-[24px] border border-[var(--card-border)] shadow-lg">
            <DialogHeader>
              <div className="flex items-center gap-2 text-[var(--attention-text)]">
                <AlertTriangle className="size-5" />
                <DialogTitle className="text-base font-bold text-[var(--text)]">
                  Delete Payment?
                </DialogTitle>
              </div>
              <DialogDescription className="text-[var(--text-secondary)] text-xs pt-1">
                Are you sure you want to delete this payment of{' '}
                <strong>{formatCurrency(paymentToDelete.amount)}</strong> recorded on{' '}
                {formatDate(paymentToDelete.paid_on)}? This will restore the student&apos;s
                outstanding balance.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaymentToDelete(null)}
                disabled={deletingPayment}
                className="min-h-[44px] px-4 rounded-[12px] font-bold text-xs cursor-pointer border border-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--primary-soft)]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDeletePayment}
                disabled={deletingPayment}
                className="min-h-[44px] px-4 rounded-[12px] bg-[#9A4A00] hover:bg-[#853E00] text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                {deletingPayment ? 'Deleting...' : 'Yes, Delete Payment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
