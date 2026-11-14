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
import { formatCurrency, formatDate, formatPeriod, getTodayIST } from '@/lib/formatters'
import {
  CreditCard,
  AlertTriangle,
  AlertCircle,
  MessageSquare,
  QrCode,
  Banknote,
  Landmark,
  Loader2,
  Sparkles,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { FeeSummaryRow } from '@/types/database'
import { loadRazorpayScript } from '@/lib/razorpay'

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
    return getTodayIST()
  })
  const [mode, setMode] = useState<PaymentMode>('upi')
  const [isExternalUpi, setIsExternalUpi] = useState<boolean>(false)
  const [reference, setReference] = useState<string>('')
  const [sendReceipt, setSendReceipt] = useState<boolean>(true)
  const [loading, setLoading] = useState(false)
  const [razorpayLoading, setRazorpayLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [confirmOverpayment, setConfirmOverpayment] = useState(false)

  const isOverpayment = amount > fee.balance
  const todayStr = getTodayIST()

  // 1. Razorpay On-Screen Checkout for UPI / Online Payments
  async function handleRazorpayCheckout() {
    if (!amount || amount <= 0) {
      setErrorMsg('Payment amount must be greater than 0.')
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

    setErrorMsg(null)
    setRazorpayLoading(true)

    try {
      // Step A: Create Razorpay Order via Next.js API
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fee_id: fee.fee_id,
          student_id: fee.student_id,
          amount: Number(amount),
        }),
      })

      const orderJson = await orderRes.json()
      const orderData = orderJson.data || orderJson

      if (!orderRes.ok || !orderData?.orderId) {
        const errorMsg =
          orderJson.error?.message ||
          (typeof orderJson.error === 'string' ? orderJson.error : null) ||
          'Failed to initialize Razorpay checkout.'
        throw new Error(errorMsg)
      }

      // Step B: Handle Test Simulation Mode (when API keys are placeholders)
      if (orderData.isMock) {
        toast.info('Running in Razorpay Test Simulation mode. Verifying payment...')

        const verifyRes = await fetch('/api/razorpay/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: orderData.orderId,
            razorpay_payment_id: `pay_mock_${Date.now().toString(36)}`,
            razorpay_signature: 'mock_signature',
            fee_id: fee.fee_id,
            student_id: fee.student_id,
            amount: Number(amount),
            paid_on: paidOn || todayStr,
            period: fee.period,
            send_receipt: sendReceipt,
            isMock: true,
          }),
        })

        const verifyJson = await verifyRes.json()
        const verifyData = verifyJson.data || verifyJson

        if (!verifyRes.ok || !verifyData?.success) {
          const vMsg =
            verifyJson.error?.message ||
            (typeof verifyJson.error === 'string' ? verifyJson.error : null) ||
            'Payment recording failed in test simulation.'
          throw new Error(vMsg)
        }

        toast.success(
          `Payment of ${formatCurrency(amount)} recorded via UPI (${verifyData.reference})!`
        )
        onPaymentRecorded()
        onClose()
        return
      }

      // Step C: Load official Razorpay Checkout SDK
      const scriptLoaded = await loadRazorpayScript()
      if (!scriptLoaded) {
        throw new Error('Could not load Razorpay Checkout SDK. Please check your internet connection.')
      }

      // Step D: Open Razorpay Popup
      const RazorpayConstructor = (window as unknown as { Razorpay: new (opts: unknown) => { open: () => void } }).Razorpay

      const rzp = new RazorpayConstructor({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Akshara Academy',
        description: `Fee: ${fee.full_name} (${formatPeriod(fee.period)})`,
        order_id: orderData.orderId,
        prefill: {
          name: fee.full_name,
          contact: fee.phone || '',
        },
        notes: {
          student_id: fee.student_id,
          fee_id: fee.fee_id,
        },
        theme: {
          color: '#5B45E0',
        },
        modal: {
          ondismiss: () => {
            setRazorpayLoading(false)
          },
        },
        handler: async (response: {
          razorpay_payment_id: string
          razorpay_order_id: string
          razorpay_signature: string
        }) => {
          setRazorpayLoading(true)
          try {
            const verifyRes = await fetch('/api/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                fee_id: fee.fee_id,
                student_id: fee.student_id,
                amount: Number(amount),
                paid_on: paidOn || todayStr,
                period: fee.period,
                send_receipt: sendReceipt,
                isMock: false,
              }),
            })

            const verifyJson = await verifyRes.json()
            const verifyData = verifyJson.data || verifyJson

            if (!verifyRes.ok || !verifyData?.success) {
              const vMsg =
                verifyJson.error?.message ||
                (typeof verifyJson.error === 'string' ? verifyJson.error : null) ||
                'Payment verification failed.'
              throw new Error(vMsg)
            }

            toast.success(
              `Payment of ${formatCurrency(amount)} collected via UPI (${response.razorpay_payment_id})!`
            )
            onPaymentRecorded()
            onClose()
          } catch (vErr: unknown) {
            console.error('Payment verification error:', vErr)
            toast.error(vErr instanceof Error ? vErr.message : 'Failed to verify payment.')
          } finally {
            setRazorpayLoading(false)
          }
        },
      })

      rzp.open()
    } catch (err: unknown) {
      console.error('Razorpay checkout error:', err)
      const msg = err instanceof Error ? err.message : 'Failed to initiate Razorpay checkout.'
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setRazorpayLoading(false)
    }
  }

  // 2. Manual / Cash Payment Recording
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // If in Razorpay UPI mode, trigger Razorpay modal instead of direct insert
    if (mode === 'upi' && !isExternalUpi) {
      await handleRazorpayCheckout()
      return
    }

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

      const finalRef = reference.trim() || null

      const { data: paymentRow, error } = await supabase
        .from('fee_payments')
        .insert({
          fee_id: fee.fee_id,
          amount: Number(amount),
          paid_on: paidOn || todayStr,
          mode,
          reference: finalRef,
          recorded_by: user?.id || null,
        })
        .select('id')
        .single()

      if (error) throw error

      if (sendReceipt) {
        try {
          const receiptRes = await fetch('/api/send-payment-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              student_id: fee.student_id,
              fee_id: fee.fee_id,
              payment_id: paymentRow?.id,
              amount_paid: Number(amount),
              paid_on: paidOn || todayStr,
              period: fee.period,
              mode: mode.toUpperCase(),
              reference: finalRef,
            }),
          })
          const receiptData = await receiptRes.json()
          if (receiptData?.sent) {
            toast.success(
              receiptData.dry_run
                ? `Payment recorded! (Dry Run receipt ${receiptData.receipt_no} logged)`
                : `Payment recorded & WhatsApp receipt (${receiptData.receipt_no}) sent to parent!`
            )
          } else if (receiptData?.skipped_no_consent) {
            toast.success(
              `Payment of ${formatCurrency(amount)} recorded! (Parent has not opted into WhatsApp receipts)`
            )
          } else {
            toast.success(
              `Payment of ${formatCurrency(amount)} recorded! (Receipt message queued in Message Log)`
            )
          }
        } catch {
          toast.success(
            `Payment of ${formatCurrency(amount)} recorded for ${fee.full_name}!`
          )
        }
      } else {
        toast.success(
          `Payment of ${formatCurrency(amount)} recorded for ${fee.full_name}!`
        )
      }

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

  const isRazorpayActive = mode === 'upi' && !isExternalUpi

  return (
    <>
      <DialogHeader className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-[14px] bg-[var(--present-bg)] text-[var(--present-text)] flex items-center justify-center shrink-0 shadow-2xs">
            <CreditCard className="size-5 stroke-[2.2]" />
          </div>
          <div>
            <DialogTitle className="text-lg sm:text-xl font-bold text-[var(--text)] tracking-tight">
              Record Fee Payment
            </DialogTitle>
            <DialogDescription className="text-xs text-[var(--text-secondary)]">
              {fee.full_name} • {fee.class_level || 'Student'}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {errorMsg && (
        <div className="p-3 bg-[var(--attention-bg)] text-[var(--attention-text)] text-xs rounded-xl border border-[var(--attention)]/30 flex items-start gap-2">
          <AlertCircle className="size-4 text-[var(--attention-text)] shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Sleek Fee Summary Strip */}
      <div className="bg-[var(--primary-soft)]/50 p-3.5 sm:p-4 rounded-2xl border border-[var(--card-border)]/80 flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider block">
            {formatPeriod(fee.period)}
          </span>
          <span className="text-xs text-[var(--text)] font-medium">
            Due {formatDate(fee.due_date)}
            {fee.amount_paid > 0 && ` • Paid ${formatCurrency(fee.amount_paid)}`}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-[var(--text-secondary)] block">Remaining Balance</span>
          <span className="text-base sm:text-lg font-extrabold text-[var(--attention-text)]">
            {formatCurrency(fee.balance)}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Amount Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="amount" className="text-xs font-semibold text-[var(--text)]">
              Payment Amount (₹) *
            </Label>
            {fee.balance > 0 && amount !== fee.balance && (
              <button
                type="button"
                onClick={() => setAmount(fee.balance)}
                className="text-xs text-[var(--primary)] hover:underline font-semibold cursor-pointer"
              >
                Pay full balance ({formatCurrency(fee.balance)})
              </button>
            )}
          </div>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[var(--text-secondary)] font-bold text-base">
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
              className="pl-9 h-12 text-base font-bold text-[var(--text)] rounded-xl"
              disabled={loading || razorpayLoading}
            />
          </div>

          {/* Overpayment warning & confirmation */}
          {isOverpayment ? (
            <div className="p-3 bg-[var(--attention-bg)] border border-[var(--attention)]/40 rounded-xl text-[var(--attention-text)] text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-[var(--attention-text)] shrink-0 mt-0.5" />
                <p>
                  <strong>Overpayment warning:</strong> Amount (
                  {formatCurrency(amount)}) exceeds outstanding balance ({formatCurrency(fee.balance)}).
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer font-bold text-[var(--attention-text)] pt-0.5">
                <input
                  type="checkbox"
                  checked={confirmOverpayment}
                  onChange={(e) => setConfirmOverpayment(e.target.checked)}
                  className="size-4 rounded accent-[var(--primary)] cursor-pointer"
                />
                <span>Confirm overpayment amount</span>
              </label>
            </div>
          ) : amount < fee.balance && amount > 0 ? (
            <p className="text-[11px] text-[var(--text-secondary)] font-medium">
              Partial payment: Remaining balance after payment will be{' '}
              <strong>{formatCurrency(fee.balance - amount)}</strong>.
            </p>
          ) : null}
        </div>

        {/* Payment Mode Selector */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-[var(--text)]">
            Payment Mode *
          </Label>
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setMode('upi')
                setIsExternalUpi(false)
              }}
              className={`p-3 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'upi'
                  ? 'bg-[#5B45E0] text-white border-[#5B45E0] shadow-sm'
                  : 'bg-white text-[var(--text)] border-[var(--card-border)] hover:bg-[var(--primary-soft)]'
              }`}
            >
              <QrCode className="size-4" />
              <span>Razorpay UPI</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('cash')}
              className={`p-3 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'cash'
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                  : 'bg-white text-[var(--text)] border-[var(--card-border)] hover:bg-[var(--primary-soft)]'
              }`}
            >
              <Banknote className="size-4" />
              <span>Cash</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('bank')}
              className={`p-3 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'bank'
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                  : 'bg-white text-[var(--text)] border-[var(--card-border)] hover:bg-[var(--primary-soft)]'
              }`}
            >
              <Landmark className="size-4" />
              <span>Bank Transfer</span>
            </button>
          </div>
        </div>

        {/* Razorpay UPI Note & External UPI switch */}
        {isRazorpayActive && (
          <div className="px-3.5 py-2.5 rounded-xl bg-[#F5F3FF] border border-[#DDD6FE] text-xs flex items-center justify-between gap-2">
            <span className="text-[11px] text-[#5B45E0] font-medium flex items-center gap-1.5">
              <Sparkles className="size-3.5 shrink-0" />
              Dynamic QR (GPay, PhonePe, Paytm, BHIM)
            </span>
            <button
              type="button"
              onClick={() => setIsExternalUpi(true)}
              className="text-[11px] font-bold text-[#5B45E0] hover:underline cursor-pointer shrink-0"
            >
              External UPI Ref?
            </button>
          </div>
        )}

        {/* External UPI / Bank Transfer / Cash Note input */}
        {(!isRazorpayActive || mode !== 'upi') && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="reference"
                className="text-xs font-semibold text-[var(--text)]"
              >
                {mode === 'cash'
                  ? 'Cash Receipt / Notes (Optional)'
                  : mode === 'upi'
                  ? 'External UPI Reference (UTR)'
                  : 'Bank Transfer Reference *'}
              </Label>
              {mode === 'upi' && isExternalUpi && (
                <button
                  type="button"
                  onClick={() => setIsExternalUpi(false)}
                  className="text-xs text-[#5B45E0] hover:underline font-semibold cursor-pointer"
                >
                  Back to Razorpay QR
                </button>
              )}
            </div>
            <Input
              id="reference"
              type="text"
              placeholder={
                mode === 'cash'
                  ? 'e.g. Paid in cash at office'
                  : mode === 'upi'
                  ? 'e.g. 12-digit UTR number'
                  : 'e.g. IMPS/NEFT Ref #, Cheque #'
              }
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="h-11 text-sm rounded-xl"
              disabled={loading || razorpayLoading}
            />
          </div>
        )}

        {/* Payment Date (for manual entry) */}
        {!isRazorpayActive && (
          <div className="space-y-1.5">
            <Label htmlFor="paid_on" className="text-xs font-semibold text-[var(--text)]">
              Payment Date *
            </Label>
            <Input
              id="paid_on"
              type="date"
              required
              max={todayStr}
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
              className="h-11 text-sm rounded-xl"
              disabled={loading || razorpayLoading}
            />
          </div>
        )}

        {/* Send WhatsApp Receipt Toggle */}
        <label className="flex items-center gap-3 p-3 rounded-xl bg-[var(--whatsapp-bg)] border border-[var(--whatsapp)]/30 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={sendReceipt}
            onChange={(e) => setSendReceipt(e.target.checked)}
            disabled={loading || razorpayLoading}
            className="size-4 rounded accent-[var(--whatsapp-text)] cursor-pointer shrink-0"
          />
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold text-[var(--whatsapp-text)] flex items-center gap-1.5">
              <MessageSquare className="size-3.5 text-[var(--whatsapp)] shrink-0" />
              <span>Send WhatsApp payment receipt to parent</span>
            </span>
          </div>
        </label>

        <DialogFooter className="pt-2 gap-2.5 sm:gap-3 flex flex-row justify-end w-full">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading || razorpayLoading}
            className="min-h-[44px] flex-1 sm:flex-initial px-5 rounded-xl font-bold text-xs sm:text-sm border border-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--primary-soft)] cursor-pointer"
          >
            Cancel
          </Button>

          {isRazorpayActive ? (
            <Button
              type="button"
              onClick={handleRazorpayCheckout}
              disabled={loading || razorpayLoading || (isOverpayment && !confirmOverpayment)}
              className="min-h-[44px] flex-1 sm:flex-initial px-6 rounded-xl bg-[#5B45E0] hover:bg-[#4C36CE] text-white font-bold text-xs sm:text-sm cursor-pointer shadow-md disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {razorpayLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Opening Checkout...</span>
                </>
              ) : (
                <>
                  <QrCode className="size-4" />
                  <span>Collect via Razorpay UPI (₹{amount || 0})</span>
                </>
              )}
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={loading || (isOverpayment && !confirmOverpayment)}
              className="min-h-[44px] flex-1 sm:flex-initial px-6 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs sm:text-sm cursor-pointer shadow-md disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Recording...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  <span>Record {mode === 'cash' ? 'Cash' : 'Payment'}</span>
                </>
              )}
            </Button>
          )}
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
      <DialogContent className="w-full max-w-[calc(100%-1.5rem)] sm:max-w-xl bg-white p-6 sm:p-7 rounded-[24px] border border-[var(--card-border)] shadow-2xl max-h-[90dvh] overflow-y-auto thin-scrollbar">
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
