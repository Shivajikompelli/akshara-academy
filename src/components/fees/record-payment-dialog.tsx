'use client'

import { useState } from 'react'
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
import { formatCurrency, formatDate } from '@/lib/formatters'
import { CreditCard, AlertTriangle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { FeeSummaryRow } from '@/types/database'

interface RecordPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fee: FeeSummaryRow | null
  onPaymentRecorded: () => void
}

type PaymentMode = 'cash' | 'upi' | 'bank'

interface RecordPaymentFormProps {
  fee: FeeSummaryRow
  onClose: () => void
  onPaymentRecorded: () => void
}

function RecordPaymentForm({
  fee,
  onClose,
  onPaymentRecorded,
}: RecordPaymentFormProps) {
  const [amount, setAmount] = useState<number>(
    fee.balance > 0 ? fee.balance : fee.amount_due
  )
  const [paidOn, setPaidOn] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [mode, setMode] = useState<PaymentMode>('cash')
  const [reference, setReference] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [confirmOverpayment, setConfirmOverpayment] = useState(false)

  const isOverpayment = amount > fee.balance
  const todayStr = new Date().toISOString().split('T')[0]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!amount || amount <= 0) {
      setErrorMsg('Payment amount must be greater than 0.')
      return
    }

    if (paidOn > todayStr) {
      setErrorMsg('Payment date cannot be in the future.')
      return
    }

    if (isOverpayment && !confirmOverpayment) {
      setErrorMsg(
        `Amount (₹${amount}) exceeds remaining balance of ${formatCurrency(
          fee.balance
        )}. Please check the confirmation box below to proceed with overpayment.`
      )
      return
    }

    setLoading(true)
    setErrorMsg(null)
    const supabase = createClient()

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase.from('fee_payments').insert({
        fee_id: fee.fee_id,
        amount: Number(amount),
        paid_on: paidOn || todayStr,
        mode,
        reference: reference.trim() || null,
        recorded_by: user?.id || null,
      })

      if (error) throw error

      toast.success(
        `Payment of ${formatCurrency(amount)} recorded for ${fee.full_name}!`
      )
      onPaymentRecorded()
      onClose()
    } catch (err: unknown) {
      console.error('Failed to record payment:', err)
      const msg = err instanceof Error ? err.message : 'Failed to record payment.'
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-emerald-100 text-emerald-800">
            <CreditCard className="size-5" />
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900">
            Record Fee Payment
          </DialogTitle>
        </div>
        <DialogDescription className="text-slate-600 text-xs">
          Record a fee receipt for <strong>{fee.full_name}</strong> (
          {fee.class_level || 'Student'})
        </DialogDescription>
      </DialogHeader>

      {errorMsg && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-start gap-2">
          <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Student Fee Context */}
      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Fee Period</span>
          <span className="font-semibold text-slate-800">
            {formatDate(fee.period)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Due Date</span>
          <span className="font-semibold text-slate-800">
            {formatDate(fee.due_date)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Total Due</span>
            <span className="font-semibold text-slate-800">
              {formatCurrency(fee.amount_due)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Paid So Far</span>
            <span className="font-semibold text-emerald-700">
              {formatCurrency(fee.amount_paid)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Balance</span>
            <span className="font-bold text-rose-700">
              {formatCurrency(fee.balance)}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Amount Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="amount" className="text-xs font-semibold text-slate-700">
              Payment Amount (₹) *
            </Label>
            {fee.balance > 0 && (
              <button
                type="button"
                onClick={() => setAmount(fee.balance)}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
              >
                Pay full balance ({formatCurrency(fee.balance)})
              </button>
            )}
          </div>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400 font-bold">
              ₹
            </span>
            <Input
              id="amount"
              type="number"
              min="1"
              step="1"
              required
              value={amount || ''}
              onChange={(e) => {
                const val = Number(e.target.value)
                setAmount(val)
                if (val <= fee.balance) {
                  setConfirmOverpayment(false)
                }
              }}
              className="pl-8 h-11 text-base font-bold text-slate-900"
              disabled={loading}
            />
          </div>

          {/* Overpayment warning & confirmation */}
          {isOverpayment ? (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Overpayment warning:</strong> Amount (
                  {formatCurrency(amount)}) is greater than the outstanding
                  balance ({formatCurrency(fee.balance)}).
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-amber-950 pt-1">
                <input
                  type="checkbox"
                  checked={confirmOverpayment}
                  onChange={(e) => setConfirmOverpayment(e.target.checked)}
                  className="size-4 rounded text-blue-600 border-amber-300 cursor-pointer"
                />
                <span>Confirm overpayment amount</span>
              </label>
            </div>
          ) : amount < fee.balance && amount > 0 ? (
            <p className="text-[11px] text-amber-700 font-medium">
              Partial payment: Remaining balance will be{' '}
              {formatCurrency(fee.balance - amount)}.
            </p>
          ) : null}
        </div>

        {/* Payment Date */}
        <div className="space-y-1.5">
          <Label htmlFor="paid_on" className="text-xs font-semibold text-slate-700">
            Payment Date *
          </Label>
          <Input
            id="paid_on"
            type="date"
            required
            max={todayStr}
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
            className="h-11 text-base"
            disabled={loading}
          />
          <p className="text-[11px] text-slate-400">Future dates are blocked.</p>
        </div>

        {/* Payment Mode */}
        <div className="space-y-1.5">
          <Label htmlFor="mode" className="text-xs font-semibold text-slate-700">
            Payment Mode *
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { key: 'cash', label: 'Cash' },
                { key: 'upi', label: 'UPI' },
                { key: 'bank', label: 'Bank Transfer' },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={`h-11 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  mode === m.key
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reference / Txn ID */}
        <div className="space-y-1.5">
          <Label
            htmlFor="reference"
            className="text-xs font-semibold text-slate-700"
          >
            Transaction Reference / Notes
          </Label>
          <Input
            id="reference"
            type="text"
            placeholder="e.g. UPI Ref #, Cheque #, Receipt #"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="h-11 text-sm"
            disabled={loading}
          />
        </div>

        <DialogFooter className="pt-2 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="min-h-[44px] cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || (isOverpayment && !confirmOverpayment)}
            className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
          >
            {loading ? 'Recording...' : 'Record Payment'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  fee,
  onPaymentRecorded,
}: RecordPaymentDialogProps) {
  if (!open || !fee) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white p-6">
        <RecordPaymentForm
          key={fee.fee_id}
          fee={fee}
          onClose={() => onOpenChange(false)}
          onPaymentRecorded={onPaymentRecorded}
        />
      </DialogContent>
    </Dialog>
  )
}
