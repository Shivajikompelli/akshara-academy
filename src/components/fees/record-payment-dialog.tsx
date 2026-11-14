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

      if (!orderRes.ok || !orderJson.data) {
        throw new Error(orderJson.error || 'Failed to initialize Razorpay checkout.')
      }

      const orderData = orderJson.data

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

        if (!verifyRes.ok || !verifyJson.data?.success) {
          throw new Error(verifyJson.error || 'Payment recording failed in test simulation.')
        }

        toast.success(
          `Payment of ${formatCurrency(amount)} recorded via UPI (${verifyJson.data.reference})!`
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

            if (!verifyRes.ok || !verifyJson.data?.success) {
              throw new Error(verifyJson.error || 'Payment verification failed.')
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
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-[var(--present-bg)] text-[var(--present-text)]">
            <CreditCard className="size-5" />
          </div>
          <DialogTitle className="text-lg font-bold text-[var(--text)]">
            Record Fee Payment
          </DialogTitle>
        </div>
        <DialogDescription className="text-[var(--text-secondary)] text-xs">
          Record a fee receipt for <strong>{fee.full_name}</strong> (
          {fee.class_level || 'Student'})
        </DialogDescription>
      </DialogHeader>

      {errorMsg && (
        <div className="p-3 bg-[var(--attention-bg)] text-[var(--attention-text)] text-xs rounded-lg border border-[var(--attention)]/30 flex items-start gap-2">
          <AlertCircle className="size-4 text-[var(--attention-text)] shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Student Fee Context */}
      <div className="bg-[var(--primary-soft)]/40 p-3.5 rounded-lg border border-[var(--card-border)] space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)]">Fee Period</span>
          <span className="font-semibold text-[var(--text)]">
            {formatPeriod(fee.period)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)]">Due Date</span>
          <span className="font-semibold text-[var(--text)]">
            {formatDate(fee.due_date)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--card-border)]/60 text-xs">
          <div>
            <span className="text-[var(--text-secondary)] block text-xs">Total Due</span>
            <span className="font-semibold text-[var(--text)]">
              {formatCurrency(fee.amount_due)}
            </span>
          </div>
          <div>
            <span className="text-[var(--text-secondary)] block text-xs">Paid So Far</span>
            <span className="font-semibold text-[var(--present-text)]">
              {formatCurrency(fee.amount_paid)}
            </span>
          </div>
          <div>
            <span className="text-[var(--text-secondary)] block text-xs">Balance</span>
            <span className="font-bold text-[var(--attention-text)]">
              {formatCurrency(fee.balance)}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Amount Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="amount" className="text-xs font-semibold text-[var(--text)]">
              Payment Amount (₹) *
            </Label>
            {fee.balance > 0 && (
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
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--text-secondary)] font-bold">
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
              className="pl-8 h-11 text-sm font-bold text-[var(--text)]"
              disabled={loading || razorpayLoading}
            />
          </div>

          {/* Overpayment warning & confirmation */}
          {isOverpayment ? (
            <div className="p-3 bg-[var(--attention-bg)] border border-[var(--attention)]/40 rounded-lg text-[var(--attention-text)] text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-[var(--attention-text)] shrink-0 mt-0.5" />
                <p>
                  <strong>Overpayment warning:</strong> Amount (
                  {formatCurrency(amount)}) is greater than the outstanding
                  balance ({formatCurrency(fee.balance)}).
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer font-bold text-[var(--attention-text)] pt-1">
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
            <p className="text-xs text-[var(--attention-text)] font-medium">
              Partial payment: Remaining balance will be{' '}
              {formatCurrency(fee.balance - amount)}.
            </p>
          ) : null}
        </div>

        {/* Payment Mode Selector */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-[var(--text)]">
            Payment Mode *
          </Label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('upi')
                setIsExternalUpi(false)
              }}
              className={`p-2.5 rounded-[14px] text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                mode === 'upi'
                  ? 'bg-[#5B45E0] text-white border-[#5B45E0] shadow-sm ring-2 ring-[#5B45E0]/20'
                  : 'bg-white text-[var(--text)] border-[var(--card-border)] hover:bg-[var(--primary-soft)]'
              }`}
            >
              <QrCode className="size-4" />
              <span>Razorpay UPI</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('cash')}
              className={`p-2.5 rounded-[14px] text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                mode === 'cash'
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm ring-2 ring-[var(--primary)]/20'
                  : 'bg-white text-[var(--text)] border-[var(--card-border)] hover:bg-[var(--primary-soft)]'
              }`}
            >
              <Banknote className="size-4" />
              <span>Cash</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('bank')}
              className={`p-2.5 rounded-[14px] text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                mode === 'bank'
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm ring-2 ring-[var(--primary)]/20'
                  : 'bg-white text-[var(--text)] border-[var(--card-border)] hover:bg-[var(--primary-soft)]'
              }`}
            >
              <Landmark className="size-4" />
              <span>Bank Transfer</span>
            </button>
          </div>
        </div>

        {/* Razorpay UPI Info Card */}
        {isRazorpayActive && (
          <div className="p-3.5 rounded-[14px] bg-[#F5F3FF] border border-[#DDD6FE] text-xs space-y-2">
            <div className="flex items-center justify-between text-[#5B45E0]">
              <span className="font-bold flex items-center gap-1.5">
                <Sparkles className="size-3.5" />
                Instant UPI QR & Apps
              </span>
              <span className="text-[11px] font-medium bg-white px-2 py-0.5 rounded-full border border-[#DDD6FE]">
                Auto-Verified
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Opens on-screen dynamic UPI QR code. Parents can scan using <strong>Google Pay, PhonePe, Paytm, or BHIM</strong>.
            </p>
            <div className="pt-1 flex items-center justify-between border-t border-[#DDD6FE]/60">
              <span className="text-[11px] text-slate-500">Already collected via external QR?</span>
              <button
                type="button"
                onClick={() => setIsExternalUpi(true)}
                className="text-[11px] font-bold text-[#5B45E0] hover:underline cursor-pointer"
              >
                Enter UPI Ref manually
              </button>
            </div>
          </div>
        )}

        {/* External UPI or Bank / Cash Reference */}
        {(!isRazorpayActive || mode !== 'upi') && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="reference"
                className="text-xs font-semibold text-[var(--text)]"
              >
                {mode === 'cash'
                  ? 'Receipt / Cash Note (Optional)'
                  : mode === 'upi'
                  ? 'External UPI Reference (UTR / Txn ID)'
                  : 'Bank Transfer / Cheque Reference *'}
              </Label>
              {mode === 'upi' && isExternalUpi && (
                <button
                  type="button"
                  onClick={() => setIsExternalUpi(false)}
                  className="text-xs text-[#5B45E0] hover:underline font-semibold cursor-pointer"
                >
                  Switch back to Razorpay QR
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
                  ? 'e.g. 12-digit UTR or Txn ID'
                  : 'e.g. IMPS/NEFT Ref #, Cheque #'
              }
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="h-11 text-sm"
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
              className="h-11 text-sm"
              disabled={loading || razorpayLoading}
            />
            <p className="text-xs text-[var(--text-secondary)]">Future dates are blocked.</p>
          </div>
        )}

        {/* Send WhatsApp Receipt Toggle */}
        <label className="flex items-center gap-3 p-3 rounded-[12px] bg-[var(--whatsapp-bg)] border border-[var(--whatsapp)]/30 cursor-pointer select-none">
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
            <span className="text-[11px] text-[var(--text-secondary)] block mt-0.5">
              Sends branded receipt card & confirmation message immediately
            </span>
          </div>
        </label>

        <DialogFooter className="pt-3 gap-2.5 sm:gap-3 flex flex-row justify-end w-full">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading || razorpayLoading}
            className="min-h-[44px] flex-1 sm:flex-initial px-5 rounded-[12px] font-bold text-xs sm:text-sm border border-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--primary-soft)] cursor-pointer"
          >
            Cancel
          </Button>

          {isRazorpayActive ? (
            <Button
              type="button"
              onClick={handleRazorpayCheckout}
              disabled={loading || razorpayLoading || (isOverpayment && !confirmOverpayment)}
              className="min-h-[44px] flex-1 sm:flex-initial px-6 rounded-[12px] bg-[#5B45E0] hover:bg-[#4C36CE] text-white font-bold text-xs sm:text-sm cursor-pointer shadow-md disabled:opacity-40 flex items-center justify-center gap-2"
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
              className="min-h-[44px] flex-1 sm:flex-initial px-6 rounded-[12px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs sm:text-sm cursor-pointer shadow-md disabled:opacity-40 flex items-center justify-center gap-2"
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
      <DialogContent className="w-full max-w-[calc(100%-1rem)] sm:max-w-md bg-white p-5 sm:p-6 rounded-[24px] border border-[var(--card-border)] shadow-2xl max-h-[92dvh] overflow-y-auto">
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
