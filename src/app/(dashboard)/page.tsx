'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AksharaCard } from '@/components/ui/akshara-card'
import {
  CalendarCheck,
  BellRing,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'

interface ClassAttendanceStatus {
  className: string
  isTaken: boolean
  takenTime: string | null
  presentCount: number
  absentCount: number
  totalStudents: number
}

interface HomeSummaryData {
  enrolledCount: number
  presentCount: number
  absentCount: number
  totalAttendanceRecords: number
  overdueCount: number
  overdueBalance: number
  classesStatus: ClassAttendanceStatus[]
  loading: boolean
}

function getTodayIST(): string {
  const now = new Date()
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const istDate = new Date(now.getTime() + istOffsetMs)
  return istDate.toISOString().split('T')[0]
}

function formatTimeIST(dateString: string): string {
  try {
    const dt = new Date(dateString)
    return dt.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    })
  } catch {
    return '9:00'
  }
}

export default function HomePage() {
  const [data, setData] = useState<HomeSummaryData>({
    enrolledCount: 0,
    presentCount: 0,
    absentCount: 0,
    totalAttendanceRecords: 0,
    overdueCount: 0,
    overdueBalance: 0,
    classesStatus: [],
    loading: true,
  })

  const [todayIST, setTodayIST] = useState<string>('')
  const [formattedToday, setFormattedToday] = useState<string>('')

  useEffect(() => {
    const today = getTodayIST()
    setTodayIST(today)
    setFormattedToday(
      new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      })
    )
  }, [])

  const loadHomeData = useCallback(async (currentTodayIST: string) => {
    if (!currentTodayIST) return
    const supabase = createClient()

    try {
      // 1. Load active students
      const { data: students, error: studentsErr } = await supabase
        .from('students')
        .select('id, class_level')
        .eq('status', 'active')

      if (studentsErr) throw studentsErr

      const activeStudents = students || []
      const enrolledCount = activeStudents.length

      // Distinct classes sorted
      const classMap = new Map<string, string[]>()
      activeStudents.forEach((s) => {
        const cls = s.class_level
        if (!classMap.has(cls)) classMap.set(cls, [])
        classMap.get(cls)!.push(s.id)
      })

      const sortedClasses = Array.from(classMap.keys()).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ''), 10) || 0
        const numB = parseInt(b.replace(/\D/g, ''), 10) || 0
        return numA - numB
      })

      // 2. Load today's attendance in IST
      const studentIds = activeStudents.map((s) => s.id)
      const { data: attRecords, error: attErr } = await supabase
        .from('attendance')
        .select('student_id, status, created_at')
        .eq('att_date', currentTodayIST)
        .in('student_id', studentIds)

      if (attErr) throw attErr

      const todayAtt = attRecords || []
      const attByStudent = new Map<string, { status: string; created_at?: string }>()
      let presentCount = 0
      let absentCount = 0

      todayAtt.forEach((rec) => {
        attByStudent.set(rec.student_id, {
          status: rec.status,
          created_at: rec.created_at,
        })
        if (rec.status === 'present') presentCount++
        if (rec.status === 'absent') absentCount++
      })

      // 3. Compute per-class attendance status
      const classesStatus: ClassAttendanceStatus[] = sortedClasses.map((cls) => {
        const clsStudentIds = classMap.get(cls) || []
        let pCount = 0
        let aCount = 0
        let recordsFound = 0
        let latestCreatedAt: string | null = null

        clsStudentIds.forEach((sid) => {
          const rec = attByStudent.get(sid)
          if (rec) {
            recordsFound++
            if (rec.status === 'present') pCount++
            if (rec.status === 'absent') aCount++
            if (rec.created_at) {
              if (!latestCreatedAt || rec.created_at > latestCreatedAt) {
                latestCreatedAt = rec.created_at
              }
            }
          }
        })

        const isTaken = recordsFound > 0
        const takenTime = latestCreatedAt ? formatTimeIST(latestCreatedAt) : null

        return {
          className: cls,
          isTaken,
          takenTime,
          presentCount: pCount,
          absentCount: aCount,
          totalStudents: clsStudentIds.length,
        }
      })

      // 4. Load overdue fees from fee_summary view
      const { data: overdueFees, error: feesErr } = await supabase
        .from('fee_summary')
        .select('balance')
        .eq('status', 'overdue')

      if (feesErr) throw feesErr

      const overdueCount = overdueFees?.length || 0
      const overdueBalance = (overdueFees || []).reduce(
        (acc, row) => acc + (Number(row.balance) || 0),
        0
      )

      setData({
        enrolledCount,
        presentCount,
        absentCount,
        totalAttendanceRecords: todayAtt.length,
        overdueCount,
        overdueBalance,
        classesStatus,
        loading: false,
      })
    } catch (err: unknown) {
      console.error('Failed to load home dashboard:', err)
      setData((prev) => ({ ...prev, loading: false }))
    }
  }, [])

  useEffect(() => {
    if (todayIST) {
      loadHomeData(todayIST)
    }
  }, [todayIST, loadHomeData])

  const attendanceTakenToday = data.totalAttendanceRecords > 0

  return (
    <div className="space-y-4 max-w-[1100px] mx-auto pb-10">
      {/* Top Date Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <span className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider block">
            {formattedToday || 'Today'}
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] mt-0.5">
            Overview
          </h1>
        </div>

        <button
          type="button"
          onClick={() => todayIST && loadHomeData(todayIST)}
          disabled={data.loading}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors py-1 cursor-pointer"
        >
          <RefreshCw className={`size-3.5 ${data.loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 1. HERO CARD with purple gradient: today's date, three numbers, two actions */}
      <AksharaCard variant="hero" className="p-4 sm:p-5 max-w-[760px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-white/80 uppercase tracking-widest block">
              {formattedToday || 'Today'}
            </span>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
              Daily Attendance & Fees
            </h2>
          </div>

          {/* Two Actions: "Take attendance" and "Send fee reminders" beside each other */}
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
            <Link href="/attendance" className="w-full sm:w-auto">
              <button
                type="button"
                className="w-full min-h-[40px] px-3.5 rounded-[12px] bg-white text-[var(--primary)] hover:bg-[var(--primary-soft)] font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-[0.98]"
              >
                <CalendarCheck className="size-4 stroke-[2.5]" />
                <span className="truncate">Take attendance</span>
              </button>
            </Link>

            <Link href="/fees" className="w-full sm:w-auto">
              <button
                type="button"
                className="w-full min-h-[40px] px-3.5 rounded-[12px] bg-white/15 hover:bg-white/25 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border border-white/25 cursor-pointer transition-all active:scale-[0.98]"
              >
                <BellRing className="size-4" />
                <span className="truncate">Fee reminders</span>
              </button>
            </Link>
          </div>
        </div>

        {/* Three Numbers Beside Each Other in a 3-column row */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3.5 pt-3 border-t border-white/20">
          <div className="bg-white/10 rounded-[14px] p-2.5 sm:p-3 text-center sm:text-left">
            <span className="text-[10px] sm:text-xs font-semibold text-white/80 block uppercase tracking-wider truncate">
              Enrolled
            </span>
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-0.5 block">
              {data.loading ? '—' : data.enrolledCount}
            </span>
            <span className="text-[10px] sm:text-xs text-white/70 font-normal mt-0.5 block truncate">
              Active students
            </span>
          </div>

          <div className="bg-white/10 rounded-[14px] p-2.5 sm:p-3 text-center sm:text-left">
            <span className="text-[10px] sm:text-xs font-semibold text-white/80 block uppercase tracking-wider truncate">
              Present
            </span>
            {data.loading ? (
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-0.5 block">
                —
              </span>
            ) : attendanceTakenToday ? (
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-0.5 block">
                {data.presentCount}
              </span>
            ) : (
              <span className="inline-flex items-center justify-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-white/20 text-white border border-white/30 truncate">
                <Clock className="size-3 shrink-0" />
                <span>Not taken</span>
              </span>
            )}
            <span className="text-[10px] sm:text-xs text-white/70 font-normal mt-0.5 block truncate">
              {attendanceTakenToday ? 'Marked present' : 'Awaiting check-in'}
            </span>
          </div>

          <div className="bg-white/10 rounded-[14px] p-2.5 sm:p-3 text-center sm:text-left">
            <span className="text-[10px] sm:text-xs font-semibold text-white/80 block uppercase tracking-wider truncate">
              Absent
            </span>
            {data.loading ? (
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-0.5 block">
                —
              </span>
            ) : attendanceTakenToday ? (
              <span
                className={`text-xl sm:text-2xl font-bold tracking-tight mt-0.5 block ${
                  data.absentCount > 0 ? 'text-amber-200' : 'text-white'
                }`}
              >
                {data.absentCount}
              </span>
            ) : (
              <span className="inline-flex items-center justify-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-white/20 text-white border border-white/30 truncate">
                <Clock className="size-3 shrink-0" />
                <span>Not taken</span>
              </span>
            )}
            <span className="text-[10px] sm:text-xs text-white/70 font-normal mt-0.5 block truncate">
              {attendanceTakenToday ? 'Marked absent' : 'Awaiting check-in'}
            </span>
          </div>
        </div>
      </AksharaCard>

      {/* 2. OVERDUE FEES ALERT: Attention tint, count of overdue students, button to Fees page */}
      {!data.loading && data.overdueCount > 0 && (
        <div className="rounded-[24px] p-5 sm:p-6 bg-[var(--attention-bg)] border border-[var(--attention)]/30 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="size-11 rounded-[14px] bg-white border border-[var(--attention)]/30 flex items-center justify-center text-[var(--attention-text)] shrink-0 shadow-2xs">
              <AlertCircle className="size-6 stroke-[2.2]" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-[var(--attention-text)]">
                  Overdue Fees Alert
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[var(--attention-text)] text-white text-xs font-bold">
                  {data.overdueCount} {data.overdueCount === 1 ? 'student' : 'students'}
                </span>
              </div>
              <p className="text-sm font-normal text-[var(--text-secondary)]">
                Total outstanding overdue balance:{' '}
                <strong className="text-[var(--attention-text)] font-bold">
                  {formatCurrency(data.overdueBalance)}
                </strong>
                .
              </p>
            </div>
          </div>

          <Link href="/fees" className="shrink-0">
            <button
              type="button"
              className="min-h-[44px] px-5 rounded-[12px] bg-white text-[var(--attention-text)] border border-[var(--attention)]/40 hover:bg-[var(--attention-bg)] font-bold text-sm flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            >
              <span>View Overdue Fees</span>
              <ArrowRight className="size-4" />
            </button>
          </Link>
        </div>
      )}

      {/* 3. LIST OF CLASSES with "Taken 9:40" or "Not taken yet" and an Open button */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base font-bold text-[var(--text)] tracking-tight">
            Today&apos;s Class Attendance
          </h3>
          <span className="text-xs font-normal text-[var(--text-secondary)]">
            {data.classesStatus.filter((c) => c.isTaken).length} of{' '}
            {data.classesStatus.length} classes taken
          </span>
        </div>

        <div className="rounded-[24px] bg-white border border-[var(--card-border)] divide-y divide-[var(--card-border)]/50 overflow-hidden shadow-2xs">
          {data.loading ? (
            <div className="p-8 text-center text-xs text-[var(--text-secondary)] space-y-2">
              <RefreshCw className="size-5 animate-spin mx-auto text-[var(--primary)]" />
              <p>Loading classes status...</p>
            </div>
          ) : data.classesStatus.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--text-secondary)]">
              No active classes found. Add students to get started.
            </div>
          ) : (
            data.classesStatus.map((cls) => (
              <div
                key={cls.className}
                className="p-4 sm:p-5 flex items-center justify-between gap-3 hover:bg-[var(--primary-soft)]/40 transition-colors"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[var(--text)]">
                      {cls.className}
                    </span>
                    <span className="text-xs font-normal text-[var(--text-secondary)]">
                      ({cls.totalStudents} {cls.totalStudents === 1 ? 'student' : 'students'})
                    </span>
                  </div>

                  {cls.isTaken ? (
                    <p className="text-xs font-normal text-[var(--present-text)]">
                      {cls.presentCount} present · {cls.absentCount} absent
                    </p>
                  ) : (
                    <p className="text-xs font-normal text-[var(--attention-text)]">
                      Attendance not recorded yet for today
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Status Badge: "Taken 9:40" or "Not taken yet" */}
                  {cls.isTaken ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--present-bg)] text-[var(--present-text)] border border-[var(--present)]/20">
                      <CheckCircle2 className="size-3.5 stroke-[2.5]" />
                      <span>Taken {cls.takenTime || ''}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--attention-bg)] text-[var(--attention-text)] border border-[var(--attention)]/30">
                      <Clock className="size-3.5 stroke-[2.5]" />
                      <span>Not taken yet</span>
                    </span>
                  )}

                  {/* Open Button */}
                  <Link href={`/attendance?class=${encodeURIComponent(cls.className)}`}>
                    <button
                      type="button"
                      className="min-h-[44px] px-4 rounded-[12px] font-bold text-sm bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] shadow-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
                    >
                      <span>Open</span>
                      <ChevronRight className="size-4" />
                    </button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
