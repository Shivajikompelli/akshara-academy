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
  CheckCircle2,
  Clock,
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

  // Fetch current fee payments
  const fetchPayments = useCallback(async () => {
    if (!fee?.fee_id) return
    setLoading(true)
    setErrorMsg(null)
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from('fee_payments')
        .select('*')
        .eq('fee_id', fee.fee_id)
        .order('paid_on', { ascending: false })

      if (error) throw error
      setPayments(data || [])
    } catch (err: unknown) {
      console.error('Failed to load payments:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load payments.')
    } finally {
      setLoading(false)
    }
  }, [fee?.fee_id])

  // Fetch student's past fee rows (previous months)
  const fetchStudentPastFees = useCallback(async () => {
    if (!fee?.student_id) return
    setLoadingHistory(true)
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from('fee_summary')
        .select('*')
        .eq('student_id', fee.student_id)
        .order('period', { ascending: false })

      if (error) throw error
      setStudentPastFees(
        (data || []).map((row: any) => ({
          fee_id: row.fee_id,
          student_id: row.student_id,
          full_name: row.full_name,
          period: row.period,
          amount_due: Number(row.amount_due) || 0,
          due_date: row.due_date,
          amount_paid: Number(row.amount_paid) || 0,
          balance: Number(row.balance) || 0,
          status: row.status as any,
        }))
      )
    } catch (err: unknown) {
      console.error('Failed to load past fee history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }, [fee?.student_id])

  useEffect(() => {
    if (open && fee?.fee_id) {
      fetchPayments()
      fetchStudentPastFees()
      setIsEditingAmount(false)
      setNewAmountDue(fee.amount_due)
      setPaymentToDelete(null)
    } else {
      setPayments([])
      setStudentPastFees([])
    }
  }, [open, fee?.fee_id, fetchPayments, fetchStudentPastFees, fee?.amount_due])

  if (!fee) return null

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
    if (payments.length > 0 || fee.amount_paid > 0) {
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
        <DialogContent className="max-w-xl bg-white p-6 max-h-[90vh] overflow-y-auto rounded-[24px] border border-[var(--card-border)] shadow-lg">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="size-10 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center shrink-0">
                <History className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-[var(--text)]">
                  Fee Details & History
                </DialogTitle>
                <DialogDescription className="text-[var(--text-secondary)] text-xs">
                  {fee.full_name} • {formatPeriod(fee.period)}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-md border border-red-200 flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-5 py-1">
            {/* 1. Summary Box */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Fee Period</span>
                <span className="font-bold text-slate-800">{formatPeriod(fee.period)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Due Date</span>
                <span className="font-bold text-slate-800">{formatDate(fee.due_date)}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-center text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Due</span>
                  <span className="font-bold text-slate-800">
                    {formatCurrency(fee.amount_due)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Paid</span>
                  <span className="font-bold text-emerald-700">
                    {formatCurrency(fee.amount_paid)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Balance</span>
                  <span className="font-extrabold text-rose-700">
                    {formatCurrency(fee.balance)}
                  </span>
                </div>
              </div>

              {/* Edit Amount Due (allowed ONLY if no payments) */}
              {payments.length === 0 && fee.amount_paid === 0 && (
                <div className="pt-2 border-t border-slate-200">
                  {isEditingAmount ? (
                    <div className="space-y-2 bg-blue-50/60 p-3 rounded-lg border border-blue-200">
                      <Label className="text-xs font-semibold text-blue-900">
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
                          className="h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
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
                      <p className="text-[11px] text-blue-700">
                        Allowed before any payment is recorded (e.g. for scholarships or discounts).
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditingAmount(true)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer pt-1"
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
                            className="text-[10px] uppercase font-bold text-slate-700 bg-slate-100"
                          >
                            {p.mode}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500">
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
                          className="size-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
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
                            ? 'bg-blue-50/50 border-blue-200'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">
                              {formatPeriod(pastFee.period)}
                            </span>
                            {isCurrent && (
                              <Badge className="bg-blue-600 text-white text-[9px] px-1 py-0 font-bold">
                                Current
                              </Badge>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 block">
                            Due: {formatCurrency(pastFee.amount_due)} • Paid: {formatCurrency(pastFee.amount_paid)}
                          </span>
                        </div>

                        <div className="text-right">
                          <span
                            className={`font-bold block ${
                              pastFee.balance > 0 ? 'text-rose-600' : 'text-emerald-700'
                            }`}
                          >
                            {pastFee.balance > 0
                              ? `Bal: ${formatCurrency(pastFee.balance)}`
                              : 'Cleared'}
                          </span>
                          <span className="text-[10px] text-slate-400 capitalize">
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

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full min-h-[44px] cursor-pointer"
            >
              Close
            </Button>
          </DialogFooter>
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
              <div className="flex items-center gap-2 text-[var(--absent-text)]">
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
                className="min-h-[44px] px-4 rounded-[12px] bg-[var(--absent)] hover:bg-[var(--absent-text)] text-white font-bold text-xs cursor-pointer shadow-xs"
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
