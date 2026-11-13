'use client'

import { CalendarCheck, CheckCircle2, Receipt, ArrowUpRight, Clock, Award } from 'lucide-react'
import type { AttendanceSummary, FeeSummary } from '../data/mock-student-data'

interface BentoStatsProps {
  attendance: AttendanceSummary
  fee: FeeSummary
  onViewAttendance?: () => void
  onViewReceipt?: () => void
}

export function BentoStats({
  attendance,
  fee,
  onViewAttendance,
  onViewReceipt,
}: BentoStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
      {/* 1. ATTENDANCE METRIC CARD */}
      <div className="group relative overflow-hidden rounded-[22px] bg-white border border-[#E9D5FF]/80 p-5 shadow-[0_8px_24px_rgba(91,69,224,0.05)] transition-all hover:shadow-[0_12px_28px_rgba(91,69,224,0.09)] hover:border-[#5B45E0]/40">
        <div className="flex items-start justify-between">
          <div className="flex size-11 items-center justify-center rounded-[14px] bg-[#ECFDF5] text-[#059669] shadow-2xs">
            <CalendarCheck className="size-5" />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-xs font-bold text-[#059669]">
            <CheckCircle2 className="size-3.5" />
            Present Today
          </span>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#1F2438] tracking-tight">
              {attendance.percentage}%
            </span>
            <span className="text-xs font-bold text-[#5A6378]">Monthly Attendance</span>
          </div>

          {/* Progress Bar */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#F4F2FD]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] transition-all duration-500"
              style={{ width: `${attendance.percentage}%` }}
            />
          </div>

          <div className="mt-2.5 flex items-center justify-between text-xs font-semibold text-[#5A6378]">
            <span>{attendance.presentDays} of {attendance.totalDays} days attended</span>
            <button
              type="button"
              onClick={onViewAttendance}
              className="inline-flex items-center gap-0.5 text-[#5B45E0] hover:underline font-bold cursor-pointer"
            >
              Details <ArrowUpRight className="size-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. FEE STATUS CARD */}
      <div className="group relative overflow-hidden rounded-[22px] bg-white border border-[#E9D5FF]/80 p-5 shadow-[0_8px_24px_rgba(91,69,224,0.05)] transition-all hover:shadow-[0_12px_28px_rgba(91,69,224,0.09)] hover:border-[#5B45E0]/40">
        <div className="flex items-start justify-between">
          <div className="flex size-11 items-center justify-center rounded-[14px] bg-[#F4F2FD] text-[#5B45E0] shadow-2xs">
            <Receipt className="size-5" />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#F4F2FD] px-2.5 py-1 text-xs font-bold text-[#5B45E0]">
            <CheckCircle2 className="size-3.5 text-[#059669]" />
            Paid • Nov 2026
          </span>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#1F2438] tracking-tight">
              ₹0
            </span>
            <span className="text-xs font-bold text-[#059669]">No Dues Pending</span>
          </div>

          <p className="mt-1 text-xs text-[#5A6378]">
            ₹{fee.monthlyFee} paid on {fee.lastPaidDate}
          </p>

          <div className="mt-4 pt-3 border-t border-[#EDEEF3] flex items-center justify-between">
            <span className="text-[11px] font-mono font-medium text-[#5A6378] truncate max-w-[140px]">
              {fee.receiptNumber}
            </span>
            <button
              type="button"
              onClick={onViewReceipt}
              className="px-3 py-1 rounded-[10px] bg-[#F4F2FD] hover:bg-[#5B45E0] text-[#5B45E0] hover:text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
            >
              View Receipt
            </button>
          </div>
        </div>
      </div>

      {/* 3. EXAM / TARGET CARD */}
      <div className="group relative overflow-hidden rounded-[22px] bg-white border border-[#E9D5FF]/80 p-5 shadow-[0_8px_24px_rgba(91,69,224,0.05)] transition-all hover:shadow-[0_12px_28px_rgba(91,69,224,0.09)] hover:border-[#5B45E0]/40">
        <div className="flex items-start justify-between">
          <div className="flex size-11 items-center justify-center rounded-[14px] bg-[#FFFBEB] text-[#D97706] shadow-2xs">
            <Award className="size-5" />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FFFBEB] px-2.5 py-1 text-xs font-bold text-[#D97706]">
            <Clock className="size-3.5" />
            In 3 Days
          </span>
        </div>

        <div className="mt-4">
          <h2 className="text-lg font-black text-[#1F2438] tracking-tight line-clamp-1">
            Mathematics Mid-Term
          </h2>
          <p className="mt-0.5 text-xs text-[#5A6378]">
            Chapters 1–5: Real Numbers, Algebra & Triangles
          </p>

          <div className="mt-4 pt-3 border-t border-[#EDEEF3] flex items-center justify-between text-xs font-bold">
            <span className="text-[#5A6378]">Target: 90%+ Score</span>
            <span className="text-[#5B45E0] bg-[#F4F2FD] px-2 py-0.5 rounded-[8px]">
              Class Rank #3
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
