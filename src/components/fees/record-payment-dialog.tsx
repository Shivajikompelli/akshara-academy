'use client'

import { useState, useEffect } from 'react'
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
import { CreditCard, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { FeeSummaryRow } from '@/types/database'

interface RecordPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fee: FeeSummaryRow | null
  onPaymentRecorded: () => void
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  fee,
  onPaymentRecorded,
}: RecordPaymentDialogProps) {
  const [amount, setAmount] = useState<number>(0)
  const [paidOn, setPaidOn] = useState<string>('')
  const [mode, setMode] = useState<'cash' | 'upi' | 'bank' | 'online'>('cash')
  const [reference, setReference] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (fee) {
      setAmount(fee.balance > 0 ? fee.balance : fee.amount_due)
      setPaidOn(new Date().toISOString().split('T')[0])
      setMode('cash')
      setReference('')
      setErrorMsg(null)
    }
  }, [fee, open])

  if (!fee) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fee) return

    if (!amount || amount <= 0) {
      setErrorMsg('Payment amount must be greater than 0.')
      return
    }

    if (amount > fee.balance) {
      setErrorMsg(
        `Amount cannot exceed the remaining balance of ${formatCurrency(fee.balance)}.`
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
        paid_on: paidOn || new Date().toISOString().split('T')[0],
        mode,
        reference: reference.trim() || null,
        recorded_by: user?.id || null,
      })

      if (error) throw error

      toast.success(
        `Payment of ${formatCurrency(amount)} recorded for ${fee.full_name}!`
      )
      onPaymentRecorded()
      onOpenChange(false)
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-blue-100 text-blue-700">
              <CreditCard className="size-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Record Fee Payment
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-600 text-xs">
            Record a cash, UPI, or bank payment received against student tuition fees.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-md border border-red-200 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Student Fee Summary Banner */}
        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">{fee.full_name}</h4>
              <p className="text-xs text-slate-500">
                {fee.class_level || 'Student'} • Due: {formatDate(fee.due_date)}
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
              {formatDate(fee.period)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/60 text-xs">
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
            <Label htmlFor="amount" className="text-xs font-semibold text-slate-700">
              Payment Amount (₹) *
            </Label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400 font-bold">
                ₹
              </span>
              <Input
                id="amount"
                type="number"
                min="1"
                max={fee.balance}
                step="10"
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="pl-8 h-11 text-base font-bold text-slate-900"
                disabled={loading}
              />
            </div>
            {amount < fee.balance && amount > 0 && (
              <p className="text-[11px] text-amber-700 font-medium">
                Partial payment: Remaining balance will be {formatCurrency(fee.balance - amount)}.
              </p>
            )}
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
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
              className="h-11 text-base"
              disabled={loading}
            />
          </div>

          {/* Payment Mode */}
          <div className="space-y-1.5">
            <Label htmlFor="mode" className="text-xs font-semibold text-slate-700">
              Payment Mode *
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {(['cash', 'upi', 'bank', 'online'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`h-10 rounded-lg text-xs font-bold uppercase transition-colors border ${
                    mode === m
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Reference / Txn ID */}
          <div className="space-y-1.5">
            <Label htmlFor="reference" className="text-xs font-semibold text-slate-700">
              Reference / Txn ID
            </Label>
            <Input
              id="reference"
              placeholder={
                mode === 'upi'
                  ? 'e.g. UPI Ref / GPay Txn ID'
                  : mode === 'bank'
                  ? 'e.g. Bank Transfer Ref / Cheque No'
                  : 'Receipt / Notes'
              }
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="h-11 text-base"
              disabled={loading}
            />
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
              type="submit"
              disabled={loading || amount <= 0}
              className="min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              {loading ? 'Recording...' : `Record ${formatCurrency(amount)}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

