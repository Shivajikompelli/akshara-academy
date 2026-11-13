'use client'

import { CalendarCheck, CheckCircle2, Receipt, ArrowUpRight, Clock, Award, TrendingUp } from 'lucide-react'
import type { AttendanceSummary, FeeSummary } from '../data/mock-student-data'

interface StudentStatsProps {
  attendance: AttendanceSummary
  fee: FeeSummary
  onViewAttendance?: () => void
  onViewReceipt?: () => void
}

export function StudentStats({
  attendance,
  fee,
  onViewAttendance,
  onViewReceipt,
}: StudentStatsProps) {
  return (
    <div
      aria-label="Student Academic & Financial Overview"
      className="grid grid-cols-1 md:grid-cols-3 gap-4"
    >
      {/* 1. CLAYMORPHIC ATTENDANCE PROGRESS CARD */}
      <div className="group relative overflow-hidden rounded-[24px] bg-white border border-[#C7D2FE]/70 p-5 shadow-[0_10px_25px_-5px_rgba(79,70,229,0.08),0_8px_10px_-6px_rgba(79,70,229,0.04),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-200 ease-out hover:border-[#4F46E5]/40 hover:shadow-[0_14px_30px_-5px_rgba(79,70,229,0.12)] motion-reduce:transition-none">
        <div className="flex items-start justify-between">
          <div className="flex size-12 items-center justify-center rounded-[16px] bg-[#ECFDF5] text-[#059669] shadow-[inset_0_2px_4px_rgba(16,185,129,0.15)] border border-[#10B981]/20">
            <CalendarCheck className="size-6" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-3 py-1 text-xs font-bold text-[#059669] border border-[#10B981]/30">
            <CheckCircle2 className="size-3.5 stroke-[2.5]" />
            Present Today
          </span>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#1E1B4B] tracking-tight">
              {attendance.percentage}%
            </span>
            <span className="text-xs font-bold text-[#475569] flex items-center gap-1">
              <TrendingUp className="size-3 text-[#059669]" /> Above 75% Criteria
            </span>
          </div>

          {/* Smooth Claymorphic Progress Track */}
          <div
            role="progressbar"
            aria-valuenow={attendance.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Attendance rate"
            className="mt-3.5 h-2.5 w-full overflow-hidden rounded-full bg-[#EEF2FF] p-0.5 shadow-inner"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] shadow-xs transition-all duration-500 ease-out"
              style={{ width: `${attendance.percentage}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs font-semibold text-[#475569]">
            <span>{attendance.presentDays} of {attendance.totalDays} Days Attended</span>
            <button
              type="button"
              onClick={onViewAttendance}
              className="inline-flex items-center gap-0.5 text-[#4F46E5] hover:text-[#4338CA] font-bold cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-[#4F46E5] rounded-[6px] focus-visible:outline-none"
            >
              Breakdown <ArrowUpRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. TUITION & CLEARANCE STATUS CARD */}
      <div className="group relative overflow-hidden rounded-[24px] bg-white border border-[#C7D2FE]/70 p-5 shadow-[0_10px_25px_-5px_rgba(79,70,229,0.08),0_8px_10px_-6px_rgba(79,70,229,0.04),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-200 ease-out hover:border-[#4F46E5]/40 hover:shadow-[0_14px_30px_-5px_rgba(79,70,229,0.12)] motion-reduce:transition-none">
        <div className="flex items-start justify-between">
          <div className="flex size-12 items-center justify-center rounded-[16px] bg-[#EEF2FF] text-[#4F46E5] shadow-[inset_0_2px_4px_rgba(79,70,229,0.15)] border border-[#4F46E5]/20">
            <Receipt className="size-6" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-3 py-1 text-xs font-bold text-[#059669] border border-[#10B981]/30">
            <CheckCircle2 className="size-3.5 stroke-[2.5]" />
            Cleared • Nov 2026
          </span>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#1E1B4B] tracking-tight">
              ₹0 Due
            </span>
            <span className="text-xs font-bold text-[#059669]">All Fees Paid</span>
          </div>

          <p className="mt-1 text-xs text-[#475569]">
            ₹{fee.monthlyFee} paid on {fee.lastPaidDate}
          </p>

          <div className="mt-3.5 pt-3 border-t border-[#EBEEF8] flex items-center justify-between">
            <span className="text-[11px] font-mono font-medium text-[#475569] truncate max-w-[130px]">
              {fee.receiptNumber}
            </span>
            <button
              type="button"
              onClick={onViewReceipt}
              className="px-3.5 py-1.5 rounded-[12px] bg-[#EEF2FF] hover:bg-[#4F46E5] text-[#4F46E5] hover:text-white text-xs font-bold transition-all duration-200 ease-out cursor-pointer active:scale-95 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:outline-none shadow-2xs"
            >
              Get Receipt
            </button>
          </div>
        </div>
      </div>

      {/* 3. ACADEMIC GOAL & EXAM COUNTDOWN CARD */}
      <div className="group relative overflow-hidden rounded-[24px] bg-white border border-[#C7D2FE]/70 p-5 shadow-[0_10px_25px_-5px_rgba(79,70,229,0.08),0_8px_10px_-6px_rgba(79,70,229,0.04),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-200 ease-out hover:border-[#4F46E5]/40 hover:shadow-[0_14px_30px_-5px_rgba(79,70,229,0.12)] motion-reduce:transition-none">
        <div className="flex items-start justify-between">
          <div className="flex size-12 items-center justify-center rounded-[16px] bg-[#FFF7ED] text-[#EA580C] shadow-[inset_0_2px_4px_rgba(234,88,12,0.15)] border border-[#EA580C]/20">
            <Award className="size-6" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF7ED] px-3 py-1 text-xs font-bold text-[#EA580C] border border-[#EA580C]/30">
            <Clock className="size-3.5 stroke-[2.5]" />
            In 3 Days
          </span>
        </div>

        <div className="mt-4">
          <h2 className="text-base sm:text-lg font-black text-[#1E1B4B] tracking-tight line-clamp-1">
            Mathematics Mid-Term
          </h2>
          <p className="mt-0.5 text-xs text-[#475569] line-clamp-1">
            Chapters 1–5: Real Numbers, Algebra & Triangles
          </p>

          <div className="mt-3.5 pt-3 border-t border-[#EBEEF8] flex items-center justify-between text-xs font-bold">
            <span className="text-[#475569]">Target: 90%+ Marks</span>
            <span className="text-[#4F46E5] bg-[#EEF2FF] px-2.5 py-0.5 rounded-[10px] border border-[#C7D2FE]/60">
              Class Rank #3
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
