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
import { BentoStats } from './components/bento-stats'
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
import { CheckCircle2, Download, ExternalLink, Calendar, MapPin, User, Clock, FileSpreadsheet } from 'lucide-react'

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
        toast.info('3 Homework assignments recorded for this week.')
        break
      case 'whatsapp':
        window.open('https://wa.me/919876543210?text=Hello%20Akshara%20Academy', '_blank')
        break
      default:
        break
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FE] text-[#1F2438] pb-24 sm:pb-16 selection:bg-[#EDEAFC] selection:text-[#5B45E0]">
      {/* Top Banner (Optional for preview) */}
      <header className="bg-white/80 backdrop-blur-md border-b border-[#E9D5FF]/60 px-4 py-3 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-[10px] bg-[#5B45E0] text-white flex items-center justify-center font-black text-sm shadow-xs">
              A
            </div>
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-[#1F2438]">
              Akshara Academy
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-[#F4F2FD] text-[#5B45E0] px-2 py-0.5 rounded-full">
              Student Portal
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#5A6378] hidden sm:inline">
              Need Help?
            </span>
            <button
              type="button"
              onClick={() => handleActionClick('whatsapp')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#059669] text-xs font-bold transition-colors cursor-pointer"
            >
              <ExternalLink className="size-3" />
              <span>WhatsApp Desk</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 py-5 sm:py-7 space-y-6 sm:space-y-7">
        {/* 1. Student Hero Profile & Greeting */}
        <StudentHero
          student={MOCK_STUDENT}
          onNotificationClick={() => toast.info('You have 2 new academy notices.')}
        />

        {/* 2. Key Daily Bento Stats */}
        <BentoStats
          attendance={MOCK_ATTENDANCE}
          fee={MOCK_FEE}
          onViewAttendance={() => setShowAttendanceModal(true)}
          onViewReceipt={() => setShowReceiptModal(true)}
        />

        {/* 3. Quick One-Tap Actions Grid */}
        <QuickActions onActionClick={handleActionClick} />

        {/* 4. Today's Class Timetable */}
        <TodaySchedule
          schedule={MOCK_SCHEDULE}
          onPeriodClick={(p) => setSelectedPeriod(p)}
        />

        {/* 5. Notice Board & Circulars */}
        <NoticeBoard
          announcements={MOCK_ANNOUNCEMENTS}
          onViewAll={() => toast.info('Showing all current term notices.')}
        />
      </main>

      {/* Flutter-style Bottom Navigation Bar */}
      <StudentNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* MODAL 1: Period Details */}
      <Dialog open={!!selectedPeriod} onOpenChange={(open) => !open && setSelectedPeriod(null)}>
        <DialogContent className="w-full max-w-md bg-white p-5 sm:p-6 rounded-[24px] border border-[#E9D5FF] shadow-2xl space-y-4">
          {selectedPeriod && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span className="size-8 rounded-[10px] bg-[#F4F2FD] text-[#5B45E0] font-black text-xs flex items-center justify-center">
                    P{selectedPeriod.periodNumber}
                  </span>
                  <div>
                    <DialogTitle className="text-base font-extrabold text-[#1F2438]">
                      {selectedPeriod.subject}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-[#5A6378]">
                      {selectedPeriod.timeRange}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-3 pt-2">
                <div className="p-3.5 rounded-[14px] bg-[#F8F9FE] border border-[#E9D5FF]/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6378]">
                    Lesson Topic
                  </span>
                  <p className="text-xs font-bold text-[#1F2438]">
                    {selectedPeriod.topic}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                  <div className="p-3 rounded-[14px] bg-slate-50 border border-slate-100 flex items-center gap-2">
                    <User className="size-4 text-[#5B45E0]" />
                    <span className="truncate">{selectedPeriod.teacherName}</span>
                  </div>
                  <div className="p-3 rounded-[14px] bg-slate-50 border border-slate-100 flex items-center gap-2">
                    <MapPin className="size-4 text-[#5B45E0]" />
                    <span>{selectedPeriod.room}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPeriod(null)}
                  className="flex-1 min-h-[44px] rounded-[12px] bg-[#5B45E0] text-white font-bold text-xs hover:bg-[#4D36D4] transition-colors cursor-pointer"
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
        <DialogContent className="w-full max-w-md bg-white p-5 sm:p-6 rounded-[24px] border border-[#E9D5FF] shadow-2xl space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-[14px] bg-[#ECFDF5] text-[#059669] flex items-center justify-center">
                <CheckCircle2 className="size-6" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-[#1F2438]">
                  Official Fee Receipt
                </DialogTitle>
                <DialogDescription className="text-xs text-[#5A6378]">
                  {MOCK_FEE.currentMonth} Tuition Fee
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Receipt Card Style */}
          <div className="p-4 rounded-[18px] bg-[#F8F9FE] border border-[#E9D5FF]/80 space-y-3 font-mono text-xs">
            <div className="flex justify-between border-b border-[#EDEEF3] pb-2 font-sans font-bold">
              <span>Receipt No:</span>
              <span className="text-[#5B45E0]">{MOCK_FEE.receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5A6378]">Student:</span>
              <span className="font-bold">{MOCK_STUDENT.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5A6378]">Class & Roll:</span>
              <span>{MOCK_STUDENT.classLevel} (Roll #{MOCK_STUDENT.rollNumber})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5A6378]">Paid On:</span>
              <span>{MOCK_FEE.lastPaidDate}</span>
            </div>
            <div className="flex justify-between text-sm font-sans font-black pt-2 border-t border-[#EDEEF3]">
              <span>Amount Paid:</span>
              <span className="text-[#059669]">₹{MOCK_FEE.paidAmount}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowReceiptModal(false)}
              className="flex-1 min-h-[44px] rounded-[12px] border border-[#E9D5FF] text-[#5A6378] font-bold text-xs hover:bg-[#F4F2FD] cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                toast.success('Downloading Official Receipt Image...')
                setShowReceiptModal(false)
              }}
              className="flex-1 min-h-[44px] rounded-[12px] bg-[#5B45E0] hover:bg-[#4D36D4] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
            >
              <Download className="size-4" />
              Download
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Attendance Summary */}
      <Dialog open={showAttendanceModal} onOpenChange={setShowAttendanceModal}>
        <DialogContent className="w-full max-w-md bg-white p-5 sm:p-6 rounded-[24px] border border-[#E9D5FF] shadow-2xl space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-[14px] bg-[#F4F2FD] text-[#5B45E0] flex items-center justify-center">
                <Calendar className="size-6" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-[#1F2438]">
                  Attendance Record
                </DialogTitle>
                <DialogDescription className="text-xs text-[#5A6378]">
                  {MOCK_ATTENDANCE.currentMonth} Overview
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3 rounded-[14px] bg-[#ECFDF5] border border-[#10B981]/20">
              <span className="text-xl font-black text-[#059669]">
                {MOCK_ATTENDANCE.presentDays}
              </span>
              <p className="text-[10px] font-bold text-[#059669] uppercase mt-0.5">Present</p>
            </div>
            <div className="p-3 rounded-[14px] bg-[#FEF2F2] border border-[#DC2626]/20">
              <span className="text-xl font-black text-[#DC2626]">
                {MOCK_ATTENDANCE.absentDays}
              </span>
              <p className="text-[10px] font-bold text-[#DC2626] uppercase mt-0.5">Absent</p>
            </div>
            <div className="p-3 rounded-[14px] bg-[#F4F2FD] border border-[#5B45E0]/20">
              <span className="text-xl font-black text-[#5B45E0]">
                {MOCK_ATTENDANCE.percentage}%
              </span>
              <p className="text-[10px] font-bold text-[#5B45E0] uppercase mt-0.5">Rate</p>
            </div>
          </div>

          <div className="p-3 rounded-[14px] bg-[#F8F9FE] border border-[#E9D5FF]/60 flex items-center gap-2 text-xs font-medium text-[#5A6378]">
            <CheckCircle2 className="size-4 text-[#059669] shrink-0" />
            <span>Eligible for term exams (requires &gt; 75% minimum).</span>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAttendanceModal(false)}
              className="w-full min-h-[44px] rounded-[12px] bg-[#5B45E0] text-white font-bold text-xs hover:bg-[#4D36D4] cursor-pointer"
            >
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
