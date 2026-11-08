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
  AlertTriangle,
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
      <DialogContent className="max-w-md bg-white p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold text-slate-900">
              WhatsApp Alert Summary
            </DialogTitle>
            {result.dry_run && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-semibold text-xs">
                Dry Run Mode
              </Badge>
            )}
          </div>
          <DialogDescription className="text-slate-600 text-xs">
            Summary of attendance absent notification processing.
          </DialogDescription>
        </DialogHeader>

        {/* Dry Run Banner */}
        {result.dry_run && (
          <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs flex items-start gap-2">
            <Info className="size-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <span className="font-semibold">Dry run mode active:</span> Messages were logged in the database, but Meta WhatsApp API was not charged or called.
            </div>
          </div>
        )}

        <div className="space-y-2.5 py-1">
          {/* Sent Count */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs font-semibold text-emerald-950">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <span>{result.dry_run ? 'Messages simulated' : 'Messages sent'}:</span>
            </span>
            <span className="text-sm font-bold text-emerald-700">{result.sent}</span>
          </div>

          {/* Already Sent Count */}
          {result.already_sent > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
              <span>Already notified earlier today (skipped):</span>
              <span className="text-sm font-bold text-slate-800">{result.already_sent}</span>
            </div>
          )}

          {/* Skipped for No Consent */}
          {result.skipped_no_consent && result.skipped_no_consent.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
                <span>Skipped (no parent consent):</span>
                <span>{result.skipped_no_consent.length}</span>
              </div>
              <ul className="text-xs text-slate-600 pl-4 list-disc space-y-0.5">
                {result.skipped_no_consent.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Failed Count */}
          {result.failed > 0 && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-300 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-rose-900">
                <span className="flex items-center gap-1.5">
                  <XCircle className="size-4 text-rose-600" />
                  <span>Failed to send:</span>
                </span>
                <span className="text-sm font-bold text-rose-700">{result.failed}</span>
              </div>
              <p className="text-[11px] text-rose-700">
                Some messages encountered errors. You can retry sending the failed alerts now.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 gap-2">
          {result.failed > 0 && (
            <Button
              type="button"
              disabled={retrying}
              onClick={onRetryFailed}
              className="min-h-[44px] bg-rose-600 hover:bg-rose-700 text-white font-bold gap-1.5"
            >
              <RotateCcw className="size-4" />
              <span>{retrying ? 'Retrying...' : 'Retry Failed Alerts'}</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px] flex-1"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

