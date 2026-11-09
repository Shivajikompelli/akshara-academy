'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  XCircle,
  Search,
  Users,
  Save,
  ChevronLeft,
  ChevronRight,
  Clock,
  RotateCcw,
  Check,
  Building,
  Send,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { SendConfirmDialog } from '@/components/attendance/send-confirm-dialog'
import { SendResultDialog, type AbsentAlertResult } from '@/components/attendance/send-result-dialog'
import { InitialsAvatar } from '@/components/ui/initials-avatar'
import { AttendanceToggle } from '@/components/ui/attendance-toggle'
import type { Student } from '@/types/database'

interface AttendanceItem {
  student: Student
  status: 'present' | 'absent'
}

export default function AttendancePage() {
  const [availableClasses, setAvailableClasses] = useState<string[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [todayStr, setTodayStr] = useState<string>('')

  // Student list state for the chosen class
  const [attendanceList, setAttendanceList] = useState<AttendanceItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sendingAlerts, setSendingAlerts] = useState(false)

  // Status badge for the date: "Attendance taken (time)" or "Not taken yet"
  const [isTaken, setIsTaken] = useState(false)
  const [takenTime, setTakenTime] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // WhatsApp Alert dialog states
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [resultDialogOpen, setResultDialogOpen] = useState(false)
  const [alertResult, setAlertResult] = useState<AbsentAlertResult | null>(null)
  const [retryingAlerts, setRetryingAlerts] = useState(false)

  // Initialize date on client mount (Next.js 16 prerender safe)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setTodayStr(today)
    setSelectedDate(today)
  }, [])

  // 1. Fetch all distinct classes that have active students
  const fetchAvailableClasses = useCallback(async () => {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('students')
        .select('class_level')
        .eq('status', 'active')

      if (error) throw error

      if (data && data.length > 0) {
        const unique = Array.from(new Set(data.map((s) => s.class_level)))
        // Natural sort: Class 1, Class 2, ..., Class 12
        unique.sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, ''), 10) || 0
          const numB = parseInt(b.replace(/\D/g, ''), 10) || 0
          return numA - numB
        })
        setAvailableClasses(unique)

        // Select first available class if not set or invalid (respecting ?class= URL param)
        setSelectedClass((current) => {
          if (current && unique.includes(current)) return current
          if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search)
            const paramCls = params.get('class')
            if (paramCls && unique.includes(paramCls)) return paramCls
          }
          return unique[0] || ''
        })
      } else {
        setAvailableClasses([])
        setSelectedClass('')
      }
    } catch (err) {
      console.error('Failed to load active classes:', err)
    }
  }, [])

  useEffect(() => {
    fetchAvailableClasses()
  }, [fetchAvailableClasses])

  // 2. Fetch students & existing attendance for selectedClass and selectedDate
  const loadClassAttendance = useCallback(async () => {
    if (!selectedClass || !selectedDate) {
      setLoading(false)
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      // Fetch all active students in this class, sorted by name
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('class_level', selectedClass)
        .eq('status', 'active')
        .order('full_name', { ascending: true })

      if (studentsError) throw studentsError

      const students: Student[] = studentsData || []

      if (students.length === 0) {
        setAttendanceList([])
        setIsTaken(false)
        setTakenTime(null)
        setHasUnsavedChanges(false)
        setLoading(false)
        return
      }

      // Fetch existing attendance records for these students on the chosen date
      const studentIds = students.map((s) => s.id)
      const { data: existingRecords, error: attError } = await supabase
        .from('attendance')
        .select('student_id, status, created_at')
        .eq('att_date', selectedDate)
        .in('student_id', studentIds)

      if (attError) throw attError

      const attendanceMap = new Map<string, 'present' | 'absent'>()
      let latestCreatedAt: string | null = null

      if (existingRecords && existingRecords.length > 0) {
        setIsTaken(true)
        existingRecords.forEach((rec) => {
          attendanceMap.set(rec.student_id, rec.status as 'present' | 'absent')
          if (rec.created_at) {
            latestCreatedAt = rec.created_at
          }
        })

        if (latestCreatedAt) {
          const dt = new Date(latestCreatedAt)
          setTakenTime(
            dt.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })
          )
        } else {
          setTakenTime('saved')
        }
      } else {
        setIsTaken(false)
        setTakenTime(null)
      }

      // Build state:
      // If attendance was already saved, use saved status.
      // If a student was added to the class after attendance was saved (or not saved yet), default to PRESENT.
      const initialList: AttendanceItem[] = students.map((student) => ({
        student,
        status: attendanceMap.get(student.id) || 'present', // Everyone defaults to PRESENT
      }))

      setAttendanceList(initialList)
      setHasUnsavedChanges(false)
    } catch (err: unknown) {
      console.error('Failed to load attendance:', err)
      const msg = err instanceof Error ? err.message : 'Failed to load attendance records.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [selectedClass, selectedDate])

  useEffect(() => {
    loadClassAttendance()
  }, [loadClassAttendance])

  // Warn if leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  // Change class with unsaved check
  function handleClassChange(newClass: string) {
    if (newClass === selectedClass) return
    if (
      hasUnsavedChanges &&
      !window.confirm('You have unsaved attendance changes. Discard and change class?')
    ) {
      return
    }
    setSelectedClass(newClass)
  }

  // Change date with unsaved check
  function handleDateChange(newDate: string) {
    if (newDate === selectedDate) return
    // Guard against future dates
    if (todayStr && newDate > todayStr) {
      toast.error('Attendance cannot be recorded for future dates.')
      return
    }
    if (
      hasUnsavedChanges &&
      !window.confirm('You have unsaved attendance changes. Discard and change date?')
    ) {
      return
    }
    setSelectedDate(newDate)
  }

  // Step dates (past allowed, future blocked)
  function adjustDate(days: number) {
    if (!selectedDate) return
    const current = new Date(selectedDate)
    current.setDate(current.getDate() + days)
    const formatted = current.toISOString().split('T')[0]
    handleDateChange(formatted)
  }

  // Toggle student between Present and Absent
  function toggleAttendance(studentId: string) {
    setAttendanceList((prev) =>
      prev.map((item) => {
        if (item.student.id === studentId) {
          const nextStatus = item.status === 'present' ? 'absent' : 'present'
          return { ...item, status: nextStatus }
        }
        return item
      })
    )
    setHasUnsavedChanges(true)
  }

  // Mark all present
  function handleMarkAllPresent() {
    setAttendanceList((prev) =>
      prev.map((item) => ({ ...item, status: 'present' }))
    )
    setHasUnsavedChanges(true)
    toast.info('All students set to Present.')
  }

  // Internal save function that writes to Supabase
  async function persistAttendanceToDatabase(): Promise<boolean> {
    if (attendanceList.length === 0 || !selectedDate) return false

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Single upsert payload for all students in the class
    const payload = attendanceList.map((item) => ({
      student_id: item.student.id,
      att_date: selectedDate,
      status: item.status,
      marked_by: user?.id || null,
    }))

    const { error } = await supabase.from('attendance').upsert(payload, {
      onConflict: 'student_id, att_date',
    })

    if (error) throw error

    const now = new Date()
    const timeStr = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    })
    setIsTaken(true)
    setTakenTime(timeStr)
    setHasUnsavedChanges(false)
    return true
  }

  // Action 1: Save attendance only
  async function handleSaveAttendanceOnly() {
    setSaving(true)
    try {
      await persistAttendanceToDatabase()
      const absentCnt = attendanceList.filter((item) => item.status === 'absent').length
      const presentCnt = attendanceList.filter((item) => item.status === 'present').length
      toast.success(
        `Attendance saved for ${selectedClass}! (${presentCnt} Present, ${absentCnt} Absent)`
      )
    } catch (err: unknown) {
      console.error('Failed to save attendance:', err)
      const msg = err instanceof Error ? err.message : 'Failed to save attendance.'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // Action 2: Open confirm dialog for "Save and notify absentees"
  function handleInitiateSaveAndNotify() {
    const absentees = attendanceList.filter((i) => i.status === 'absent')
    if (absentees.length === 0) {
      toast.info('There are no absent students in this class.')
      return
    }

    // Check date eligibility (only today or yesterday)
    if (todayStr) {
      const todayDate = new Date(todayStr)
      const yesterdayDate = new Date(todayDate)
      yesterdayDate.setDate(yesterdayDate.getDate() - 1)
      const yesterdayStr = yesterdayDate.toISOString().split('T')[0]

      if (selectedDate !== todayStr && selectedDate !== yesterdayStr) {
        toast.error('WhatsApp absent alerts can only be sent for today or yesterday.')
        return
      }
    }

    setConfirmDialogOpen(true)
  }

  // Execute alert sending
  async function handleExecuteAlerts(isRetry = false) {
    if (isRetry) {
      setRetryingAlerts(true)
    } else {
      setSendingAlerts(true)
    }

    try {
      // 1. Save attendance to database first
      await persistAttendanceToDatabase()

      // 2. Invoke Edge Function (with fallback to Next.js API route)
      const supabase = createClient()
      let data: AbsentAlertResult | null = null

      try {
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke(
          'send-absent-alerts',
          {
            body: { class_level: selectedClass, date: selectedDate },
          }
        )

        if (edgeError) {
          throw edgeError
        }
        data = edgeData
      } catch (edgeErr) {
        console.warn('Edge Function call not reachable, using in-app API route:', edgeErr)
        // Fallback to internal route
        const apiRes = await fetch('/api/send-absent-alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ class_level: selectedClass, date: selectedDate }),
        })
        const apiJson = await apiRes.json()
        if (!apiRes.ok) {
          throw new Error(apiJson.error || 'Failed to process absent alerts')
        }
        data = apiJson
      }

      if (!data) {
        throw new Error('No response received from alert service.')
      }

      setAlertResult(data)
      setConfirmDialogOpen(false)
      setResultDialogOpen(true)

      if (data.sent > 0) {
        toast.success(
          data.dry_run
            ? `Dry run: Simulated alerts for ${data.sent} student(s)!`
            : `Sent WhatsApp alerts to ${data.sent} parent(s)!`
        )
      } else if (data.already_sent > 0 && data.failed === 0) {
        toast.info('All eligible absent students were already notified earlier.')
      }
    } catch (err: unknown) {
      console.error('Error sending alerts:', err)
      const msg = err instanceof Error ? err.message : 'Failed to send WhatsApp alerts.'
      toast.error(msg)
    } finally {
      setSendingAlerts(false)
      setRetryingAlerts(false)
    }
  }

  // Live Counts
  const presentCount = useMemo(
    () => attendanceList.filter((i) => i.status === 'present').length,
    [attendanceList]
  )
  const absentCount = useMemo(
    () => attendanceList.filter((i) => i.status === 'absent').length,
    [attendanceList]
  )
  const absentStudentsList = useMemo(
    () =>
      attendanceList
        .filter((i) => i.status === 'absent')
        .map((i) => ({ student: i.student, status: 'absent' as const })),
    [attendanceList]
  )

  // Visible students filtered by search
  const visibleStudents = useMemo(() => {
    if (!searchQuery.trim()) return attendanceList
    const query = searchQuery.toLowerCase().trim()
    return attendanceList.filter(
      (item) =>
        item.student.full_name?.toLowerCase().includes(query) ||
        item.student.school?.toLowerCase().includes(query) ||
        item.student.admission_no?.toLowerCase().includes(query)
    )
  }, [attendanceList, searchQuery])

  const isToday = Boolean(selectedDate && todayStr && selectedDate === todayStr)

  return (
    <div className="space-y-6 max-w-[960px] mx-auto pb-36">
      {/* Dry Run Banner (shown if function reports dry run mode) */}
      {alertResult?.dry_run && (
        <div className="p-4 bg-[var(--attention-bg)] border border-[var(--attention)]/30 rounded-[16px] text-[var(--attention-text)] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Info className="size-4 shrink-0" />
            <span>
              <strong>Dry Run Mode active:</strong> WhatsApp messages are simulated and logged. No real messages are delivered to Meta.
            </span>
          </div>
          <span className="bg-[var(--attention)]/20 text-[var(--attention-text)] font-bold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Dry Run
          </span>
        </div>
      )}

      {/* 1. TOP CONTROLS & HEADER */}
      <div className="bg-white p-5 sm:p-6 rounded-[24px] border border-[var(--card-border)] shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Attendance</h1>
            <p className="text-sm font-normal text-[var(--text-secondary)] mt-0.5">
              Select class and date. Tap any student who is absent.
            </p>
          </div>

          {/* Status Badge: Attendance taken or Not taken yet */}
          <div>
            {isTaken ? (
              <div className="bg-[var(--present-bg)] text-[var(--present-text)] border border-[var(--present)]/30 font-bold text-xs px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5">
                <Check className="size-3.5 stroke-[2.5]" />
                <span>Attendance taken {takenTime ? `(${takenTime})` : ''}</span>
              </div>
            ) : (
              <div className="bg-[var(--attention-bg)] text-[var(--attention-text)] border border-[var(--attention)]/30 font-bold text-xs px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5">
                <Clock className="size-3.5" />
                <span>Not taken yet</span>
              </div>
            )}
          </div>
        </div>

        {/* Class Dropdown & Date Picker */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-2 border-t border-[var(--card-border)]/50">
          {/* Class Dropdown */}
          <div className="sm:col-span-5 space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Class</label>
            {availableClasses.length > 0 ? (
              <select
                value={selectedClass}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full h-12 px-3 rounded-[12px] border border-[var(--card-border)] bg-white text-sm font-bold text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer"
              >
                {availableClasses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <div className="h-12 px-3 rounded-[12px] border border-[var(--card-border)] bg-[var(--primary-soft)] flex items-center text-sm font-normal text-[var(--text-secondary)]">
                No classes with active students
              </div>
            )}
          </div>

          {/* Date Picker (allow past, block future) */}
          <div className="sm:col-span-7 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Date</label>
              {!isToday && todayStr && (
                <button
                  type="button"
                  onClick={() => handleDateChange(todayStr)}
                  className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer"
                >
                  Today
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => adjustDate(-1)}
                className="size-12 rounded-[12px] border border-[var(--card-border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                title="Previous Day"
              >
                <ChevronLeft className="size-5" />
              </button>

              <div className="relative flex-1">
                <input
                  type="date"
                  value={selectedDate}
                  max={todayStr}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full h-12 px-3 rounded-[12px] border border-[var(--card-border)] bg-white text-sm font-normal text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer"
                />
              </div>

              <button
                type="button"
                disabled={isToday}
                onClick={() => adjustDate(1)}
                className="size-12 rounded-[12px] border border-[var(--card-border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-40 transition-colors"
                title="Next Day"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Status line: "Present 22 · Absent 3" and "Mark all present" tertiary link */}
        {availableClasses.length > 0 && attendanceList.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-[var(--card-border)]/50">
            <div className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
              <span className="text-[var(--present-text)]">Present {presentCount}</span>
              <span className="text-[var(--text-secondary)] opacity-60">·</span>
              <span className={absentCount > 0 ? 'text-[var(--attention-text)] font-bold' : 'text-[var(--text-secondary)]'}>
                Absent {absentCount}
              </span>
              <span className="text-xs font-normal text-[var(--text-secondary)] ml-1">
                ({visibleStudents.length} of {attendanceList.length} students)
              </span>
            </div>

            <button
              type="button"
              onClick={handleMarkAllPresent}
              disabled={loading || saving || sendingAlerts}
              className="text-sm font-bold text-[var(--primary)] hover:underline inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition-opacity"
            >
              <RotateCcw className="size-4" />
              <span>Mark all present</span>
            </button>
          </div>
        )}
      </div>

      {/* Search Input */}
      {availableClasses.length > 0 && attendanceList.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search student or school in this class..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-[12px] border border-[var(--card-border)] bg-white text-sm text-[var(--text)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-2xs"
          />
        </div>
      )}

      {/* 2. STUDENT LIST FOR CHOSEN CLASS */}
      {loading ? (
        <div className="bg-white rounded-[24px] border border-[var(--card-border)] p-12 text-center text-[var(--text-secondary)] shadow-2xs">
          <div className="size-8 border-3 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold">Loading {selectedClass} students...</p>
        </div>
      ) : availableClasses.length === 0 ? (
        <div className="bg-white rounded-[24px] border border-dashed border-[var(--card-border)] p-12 text-center shadow-2xs">
          <Users className="size-10 mx-auto text-[var(--text-secondary)] mb-3 opacity-60" />
          <h3 className="text-base font-bold text-[var(--text)]">No active students found</h3>
          <p className="text-sm font-normal text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
            Please register active students first from the Students tab.
          </p>
        </div>
      ) : attendanceList.length === 0 ? (
        <div className="bg-white rounded-[24px] border border-dashed border-[var(--card-border)] p-12 text-center shadow-2xs">
          <Users className="size-10 mx-auto text-[var(--text-secondary)] mb-3 opacity-60" />
          <h3 className="text-base font-bold text-[var(--text)]">No active students in {selectedClass}</h3>
          <p className="text-sm font-normal text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
            Switch to another class above or add students to {selectedClass}.
          </p>
        </div>
      ) : visibleStudents.length === 0 ? (
        <div className="bg-white rounded-[24px] border border-dashed border-[var(--card-border)] p-10 text-center shadow-2xs">
          <p className="text-sm font-normal text-[var(--text-secondary)]">No students match &quot;{searchQuery}&quot;.</p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="mt-3 text-sm font-bold text-[var(--primary)] hover:underline cursor-pointer"
          >
            Clear Search
          </button>
        </div>
      ) : (
        /* Rows separated by space and background, not borders */
        <div className="space-y-3">
          {visibleStudents.map((item) => {
            const { student, status } = item
            const isAbsent = status === 'absent'

            return (
              <div
                key={student.id}
                onClick={() => toggleAttendance(student.id)}
                className={`rounded-[16px] p-4 transition-all duration-150 select-none flex items-center justify-between gap-3 min-h-[64px] cursor-pointer ${
                  isAbsent
                    ? 'bg-[var(--attention-row)] shadow-2xs'
                    : 'bg-white hover:bg-[var(--primary-soft)]/50 shadow-2xs'
                }`}
              >
                {/* Left: Initials Avatar + Student & Parent Name */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <InitialsAvatar
                    name={student.full_name}
                    size="md"
                    className={
                      isAbsent
                        ? 'bg-[var(--attention)]/15 text-[var(--attention-text)] border-[var(--attention)]/30'
                        : ''
                    }
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-base font-bold truncate ${
                          isAbsent ? 'text-[var(--attention-text)]' : 'text-[var(--text)]'
                        }`}
                      >
                        {student.full_name}
                      </span>
                      {student.admission_no && (
                        <span className="text-xs font-normal text-[var(--text-secondary)] bg-[var(--primary-soft)] px-2 py-0.5 rounded-full shrink-0">
                          #{student.admission_no}
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-normal text-[var(--text-secondary)] mt-0.5 truncate flex items-center gap-1.5">
                      <span>Parent: {student.parent_name || 'N/A'}</span>
                      {student.school && (
                        <>
                          <span className="opacity-50">·</span>
                          <span className="truncate">{student.school}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Two-state Present / Absent toggle with 44px target */}
                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  <AttendanceToggle
                    status={status}
                    onToggle={() => toggleAttendance(student.id)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 3. STICKY BOTTOM BAR: One primary element (solid purple), secondary (outline) */}
      {attendanceList.length > 0 && (
        <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 lg:left-64 z-30 bg-white/95 backdrop-blur-md border-t border-[var(--card-border)]/70 p-4 shadow-lg">
          <div className="max-w-[960px] mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="text-sm font-bold text-[var(--text)]">
              <div className="flex items-center gap-2">
                <span className="text-[var(--present-text)]">Present: {presentCount}</span>
                <span className="text-[var(--text-secondary)] opacity-60">·</span>
                <span className={absentCount > 0 ? 'text-[var(--attention-text)] font-bold' : 'text-[var(--text-secondary)]'}>
                  Absent: {absentCount}
                </span>
              </div>
              <p className="text-xs font-normal text-[var(--text-secondary)] hidden sm:block mt-0.5">
                Total {attendanceList.length} active students in {selectedClass}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Secondary Action: Save attendance (outline) */}
              <button
                type="button"
                onClick={handleSaveAttendanceOnly}
                disabled={saving || sendingAlerts || loading}
                className="min-h-[44px] px-5 rounded-[12px] font-bold text-sm border-2 border-[var(--card-border)] text-[var(--primary)] bg-white hover:bg-[var(--primary-soft)] cursor-pointer disabled:opacity-40 transition-colors flex items-center justify-center gap-2 flex-1 sm:flex-initial"
              >
                <Save className="size-4" />
                <span>{saving ? 'Saving...' : 'Save attendance'}</span>
              </button>

              {/* One Primary Element: Save and notify absentees (solid purple) */}
              <button
                type="button"
                onClick={handleInitiateSaveAndNotify}
                disabled={absentCount === 0 || saving || sendingAlerts || loading}
                className="min-h-[44px] px-6 rounded-[12px] font-bold text-sm bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] shadow-md hover:shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 flex-1 sm:flex-initial"
              >
                <Send className="size-4" />
                <span>{sendingAlerts ? 'Processing...' : 'Save and notify absentees'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog before sending WhatsApp alerts */}
      <SendConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        absentStudents={absentStudentsList}
        loading={sendingAlerts}
        onConfirm={() => handleExecuteAlerts(false)}
      />

      {/* Result Dialog after sending */}
      <SendResultDialog
        open={resultDialogOpen}
        onOpenChange={setResultDialogOpen}
        result={alertResult}
        retrying={retryingAlerts}
        onRetryFailed={() => handleExecuteAlerts(true)}
      />
    </div>
  )
}
