'use client'

import { useState } from 'react'
import {
  MOCK_STUDENT,
  MOCK_ATTENDANCE,
  MOCK_FEE,
  MOCK_SCHEDULE,
  MOCK_ANNOUNCEMENTS,
  type ClassPeriod,
} from './data/mock-student-data'
import { StudentHero } from './components/student-hero'
import { StudentStats } from './components/student-stats'
import { TodaySchedule } from './components/today-schedule'
import { QuickActions } from './components/quick-actions'
import { NoticeBoard } from './components/notice-board'
import { StudentNav } from './components/student-nav'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { CheckCircle2, Download, ExternalLink, Calendar, MapPin, User, ShieldCheck } from 'lucide-react'

export function StudentDashboard() {
  const [activeTab, setActiveTab] = useState('home')
  const [selectedPeriod, setSelectedPeriod] = useState<ClassPeriod | null>(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [showAttendanceModal, setShowAttendanceModal] = useState(false)

  const handleActionClick = (actionId: string) => {
    switch (actionId) {
      case 'attendance':
        setShowAttendanceModal(true)
        break
      case 'fees':
        setShowReceiptModal(true)
        break
      case 'homework':
        toast.info('You have 2 homework submissions due this week.')
        break
      case 'whatsapp':
        window.open('https://wa.me/919876543210?text=Hello%20Akshara%20Academy', '_blank')
        break
      default:
        break
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FE] text-[#1E1B4B] pb-24 sm:pb-16 selection:bg-[#EEF2FF] selection:text-[#4F46E5]">
      {/* Top Academic Portal Bar */}
      <header className="bg-white/85 backdrop-blur-md border-b border-[#C7D2FE]/60 px-4 py-3 sticky top-0 z-30 shadow-[0_2px_12px_rgba(79,70,229,0.03)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-[12px] bg-[#4F46E5] text-white flex items-center justify-center font-black text-sm shadow-xs border border-white/20">
              A
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-[#1E1B4B]">
                Akshara Academy
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider bg-[#EEF2FF] text-[#4F46E5] px-2 py-0.5 rounded-full border border-[#C7D2FE]/60">
                Student App
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleActionClick('whatsapp')}
              aria-label="Contact Academy on WhatsApp"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[14px] bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#059669] border border-[#10B981]/30 text-xs font-bold transition-all duration-200 ease-out cursor-pointer active:scale-95 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[#10B981] focus-visible:outline-none shadow-2xs"
            >
              <ExternalLink className="size-3.5 stroke-[2.2]" />
              <span>Teacher Desk</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Student Hub Container */}
      <main className="max-w-4xl mx-auto px-4 py-5 sm:py-7 space-y-6 sm:space-y-7">
        {/* 1. Student Hero Profile & Greeting */}
        <StudentHero
          student={MOCK_STUDENT}
          onNotificationClick={() => toast.info('You have 2 official academy announcements.')}
        />

        {/* 2. Key Academic & Fee Metrics (Claymorphism Cards) */}
        <StudentStats
          attendance={MOCK_ATTENDANCE}
          fee={MOCK_FEE}
          onViewAttendance={() => setShowAttendanceModal(true)}
          onViewReceipt={() => setShowReceiptModal(true)}
        />

        {/* 3. One-Tap Quick Actions */}
        <QuickActions onActionClick={handleActionClick} />

        {/* 4. Today's Class Routine & Timeline */}
        <TodaySchedule
          schedule={MOCK_SCHEDULE}
          onPeriodClick={(p) => setSelectedPeriod(p)}
        />

        {/* 5. Academy Notice Board */}
        <NoticeBoard
          announcements={MOCK_ANNOUNCEMENTS}
          onViewAll={() => toast.info('Displaying all current academic notices.')}
        />
      </main>

      {/* Flutter-style Bottom Navigation Bar */}
      <StudentNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* MODAL 1: Period Details */}
      <Dialog open={!!selectedPeriod} onOpenChange={(open) => !open && setSelectedPeriod(null)}>
        <DialogContent className="w-full max-w-md bg-white p-5 sm:p-6 rounded-[24px] border border-[#C7D2FE] shadow-[0_20px_50px_rgba(79,70,229,0.16)] space-y-4">
          {selectedPeriod && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2.5">
                  <span className="size-9 rounded-[12px] bg-[#EEF2FF] text-[#4F46E5] font-black text-xs flex items-center justify-center border border-[#C7D2FE]/60">
                    P{selectedPeriod.periodNumber}
                  </span>
                  <div>
                    <DialogTitle className="text-base font-black text-[#1E1B4B]">
                      {selectedPeriod.subject}
                    </DialogTitle>
                    <DialogDescription className="text-xs font-medium text-[#475569]">
                      {selectedPeriod.timeRange}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-[16px] bg-[#F8F9FE] border border-[#C7D2FE]/60 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#475569]">
                    Lesson Topic
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-[#1E1B4B]">
                    {selectedPeriod.topic}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                  <div className="p-3 rounded-[14px] bg-slate-50 border border-slate-100 flex items-center gap-2">
                    <User className="size-4 text-[#4F46E5]" />
                    <span className="truncate">{selectedPeriod.teacherName}</span>
                  </div>
                  <div className="p-3 rounded-[14px] bg-slate-50 border border-slate-100 flex items-center gap-2">
                    <MapPin className="size-4 text-[#4F46E5]" />
                    <span>{selectedPeriod.room}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPeriod(null)}
                  className="flex-1 min-h-[44px] rounded-[14px] bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold text-xs transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:outline-none"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Fee Receipt Quick Viewer */}
      <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
        <DialogContent className="w-full max-w-md bg-white p-5 sm:p-6 rounded-[24px] border border-[#C7D2FE] shadow-[0_20px_50px_rgba(79,70,229,0.16)] space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-[14px] bg-[#ECFDF5] text-[#059669] flex items-center justify-center border border-[#10B981]/20">
                <CheckCircle2 className="size-6 stroke-[2.2]" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-[#1E1B4B]">
                  Official Fee Receipt
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-[#475569]">
                  {MOCK_FEE.currentMonth} Tuition Clearance
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Receipt Card Style */}
          <div className="p-4 rounded-[18px] bg-[#F8F9FE] border border-[#C7D2FE]/80 space-y-2.5 font-mono text-xs">
            <div className="flex justify-between border-b border-[#EBEEF8] pb-2 font-sans font-bold">
              <span>Receipt No:</span>
              <span className="text-[#4F46E5]">{MOCK_FEE.receiptNumber}</span>
            </div>
            <div className="flex justify-between font-sans">
              <span className="text-[#475569]">Student:</span>
              <span className="font-bold">{MOCK_STUDENT.name}</span>
            </div>
            <div className="flex justify-between font-sans">
              <span className="text-[#475569]">Class & Roll:</span>
              <span>{MOCK_STUDENT.classLevel} (Roll #{MOCK_STUDENT.rollNumber})</span>
            </div>
            <div className="flex justify-between font-sans">
              <span className="text-[#475569]">Paid On:</span>
              <span>{MOCK_FEE.lastPaidDate}</span>
            </div>
            <div className="flex justify-between text-sm font-sans font-black pt-2 border-t border-[#EBEEF8]">
              <span>Amount Paid:</span>
              <span className="text-[#059669]">₹{MOCK_FEE.paidAmount}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowReceiptModal(false)}
              className="flex-1 min-h-[44px] rounded-[14px] border border-[#C7D2FE] text-[#475569] font-bold text-xs hover:bg-[#EEF2FF] cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:outline-none"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                toast.success('Downloading Official Receipt Image...')
                setShowReceiptModal(false)
              }}
              className="flex-1 min-h-[44px] rounded-[14px] bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:outline-none"
            >
              <Download className="size-4" />
              Download Receipt
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Attendance Summary */}
      <Dialog open={showAttendanceModal} onOpenChange={setShowAttendanceModal}>
        <DialogContent className="w-full max-w-md bg-white p-5 sm:p-6 rounded-[24px] border border-[#C7D2FE] shadow-[0_20px_50px_rgba(79,70,229,0.16)] space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-[14px] bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center border border-[#C7D2FE]/60">
                <Calendar className="size-6" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-[#1E1B4B]">
                  Attendance Summary
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-[#475569]">
                  {MOCK_ATTENDANCE.currentMonth} Evaluation
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3.5 rounded-[16px] bg-[#ECFDF5] border border-[#10B981]/20">
              <span className="text-2xl font-black text-[#059669]">
                {MOCK_ATTENDANCE.presentDays}
              </span>
              <p className="text-[10px] font-bold text-[#059669] uppercase mt-0.5">Present</p>
            </div>
            <div className="p-3.5 rounded-[16px] bg-[#FEF2F2] border border-[#DC2626]/20">
              <span className="text-2xl font-black text-[#DC2626]">
                {MOCK_ATTENDANCE.absentDays}
              </span>
              <p className="text-[10px] font-bold text-[#DC2626] uppercase mt-0.5">Absent</p>
            </div>
            <div className="p-3.5 rounded-[16px] bg-[#EEF2FF] border border-[#C7D2FE]/60">
              <span className="text-2xl font-black text-[#4F46E5]">
                {MOCK_ATTENDANCE.percentage}%
              </span>
              <p className="text-[10px] font-bold text-[#4F46E5] uppercase mt-0.5">Ratio</p>
            </div>
          </div>

          <div className="p-3.5 rounded-[16px] bg-[#F8F9FE] border border-[#C7D2FE]/60 flex items-center gap-2.5 text-xs font-medium text-[#475569]">
            <ShieldCheck className="size-5 text-[#059669] shrink-0" />
            <span>Eligible for upcoming Board & Academy term examinations.</span>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAttendanceModal(false)}
              className="w-full min-h-[44px] rounded-[14px] bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold text-xs transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:outline-none"
            >
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
