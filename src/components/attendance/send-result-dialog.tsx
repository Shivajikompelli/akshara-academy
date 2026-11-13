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
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Info,
} from 'lucide-react'

export interface AbsentAlertResult {
  dry_run: boolean
  sent: number
  failed: number
  already_sent: number
  skipped_no_consent: string[]
  total_absentees?: number
}

interface SendResultDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: AbsentAlertResult | null
  retrying: boolean
  onRetryFailed: () => void
}

export function SendResultDialog({
  open,
  onOpenChange,
  result,
  retrying,
  onRetryFailed,
}: SendResultDialogProps) {
  if (!result) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[calc(100%-1rem)] sm:max-w-md bg-white p-5 sm:p-6 rounded-[24px] border border-[var(--card-border)] shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold text-[var(--text)]">
              WhatsApp Alert Summary
            </DialogTitle>
            {result.dry_run && (
              <Badge className="bg-[var(--attention-bg)] text-[var(--attention-text)] border border-[var(--attention)]/30 font-bold text-xs rounded-full px-2.5 py-0.5">
                Dry Run Mode
              </Badge>
            )}
          </div>
          <DialogDescription className="text-[var(--text-secondary)] text-xs font-normal">
            Summary of attendance absent notification processing.
          </DialogDescription>
        </DialogHeader>

        {/* Dry Run Banner */}
        {result.dry_run && (
          <div className="p-3.5 rounded-[16px] border border-[var(--attention)]/30 bg-[var(--attention-bg)] text-[var(--attention-text)] text-xs flex items-start gap-2">
            <Info className="size-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Dry run mode active:</span> Messages were logged in the database, but Meta WhatsApp API was not charged or called.
            </div>
          </div>
        )}

        <div className="space-y-2.5 py-1">
          {/* Sent Count */}
          <div className="flex items-center justify-between p-3.5 rounded-[16px] bg-[var(--whatsapp-bg)] border border-[var(--whatsapp)]/30 text-xs font-bold text-[var(--whatsapp-text)]">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-[var(--whatsapp)]" />
              <span>{result.dry_run ? 'Messages simulated' : 'Messages sent'}:</span>
            </span>
            <span className="text-base font-bold">{result.sent}</span>
          </div>

          {/* Already Sent Count */}
          {result.already_sent > 0 && (
            <div className="flex items-center justify-between p-3.5 rounded-[16px] bg-[var(--primary-soft)] border border-[var(--card-border)] text-xs font-medium text-[var(--text)]">
              <span>Already notified earlier today (skipped):</span>
              <span className="text-base font-bold text-[var(--primary)]">{result.already_sent}</span>
            </div>
          )}

          {/* Skipped for No Consent */}
          {result.skipped_no_consent && result.skipped_no_consent.length > 0 && (
            <div className="p-3.5 rounded-[16px] bg-[var(--attention-bg)] border border-[var(--attention)]/30 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--attention-text)]">
                <span>Skipped (no parent consent):</span>
                <span>{result.skipped_no_consent.length}</span>
              </div>
              <ul className="text-xs text-[var(--text-secondary)] pl-4 list-disc space-y-0.5">
                {result.skipped_no_consent.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Failed Count */}
          {result.failed > 0 && (
            <div className="p-3.5 rounded-[16px] bg-[var(--attention-bg)] border border-[var(--attention)]/30 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--attention-text)]">
                <span className="flex items-center gap-1.5">
                  <XCircle className="size-4 text-[var(--attention-text)]" />
                  <span>Failed to send:</span>
                </span>
                <span className="text-base font-bold text-[var(--attention-text)]">{result.failed}</span>
              </div>
              <p className="text-xs text-[var(--attention-text)]">
                Some messages encountered errors. You can retry sending the failed alerts now.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 gap-3 flex flex-row justify-end">
          {result.failed > 0 && (
            <Button
              type="button"
              disabled={retrying}
              onClick={onRetryFailed}
              className="min-h-[44px] px-5 rounded-[16px] border-2 border-[var(--attention-text)] text-[var(--attention-text)] bg-white hover:bg-[var(--attention-bg)] font-bold text-sm gap-1.5 cursor-pointer"
            >
              <RotateCcw className="size-4" />
              <span>{retrying ? 'Retrying...' : 'Retry Failed Alerts'}</span>
            </Button>
          )}

          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px] px-6 rounded-[12px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-sm flex-1 cursor-pointer"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

