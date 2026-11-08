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
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { Receipt, History, AlertCircle } from 'lucide-react'
import type { FeeSummaryRow, FeePayment } from '@/types/database'

interface PaymentHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fee: FeeSummaryRow | null
}

export function PaymentHistoryDialog({
  open,
  onOpenChange,
  fee,
}: PaymentHistoryDialogProps) {
  const [payments, setPayments] = useState<FeePayment[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

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

  useEffect(() => {
    if (open && fee?.fee_id) {
      fetchPayments()
    } else {
      setPayments([])
    }
  }, [open, fee?.fee_id, fetchPayments])

  if (!fee) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-slate-100 text-slate-700">
              <History className="size-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Payment History
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-600 text-xs">
            {fee.full_name} • {formatDate(fee.period)}
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-md border border-red-200 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-3 py-1">
          {/* Summary Box */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Due</span>
              <span className="font-semibold text-slate-800">{formatCurrency(fee.amount_due)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Paid</span>
              <span className="font-semibold text-emerald-700">{formatCurrency(fee.amount_paid)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Balance</span>
              <span className="font-bold text-rose-700">{formatCurrency(fee.balance)}</span>
            </div>
          </div>

          {/* Payments list */}
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Loading payments...
            </div>
          ) : payments.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-lg">
              <Receipt className="size-8 mx-auto text-slate-300 mb-1" />
              <p>No payments recorded yet for this fee.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {formatCurrency(p.amount)}
                      </span>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-700 bg-slate-100">
                        {p.mode}
                      </Badge>
                    </div>
                    {p.reference && (
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[200px]">
                        Ref: {p.reference}
                      </p>
                    )}
                  </div>

                  <div className="text-right text-slate-500">
                    <span className="font-medium text-slate-700 block">{formatDate(p.paid_on)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full min-h-[44px]"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

