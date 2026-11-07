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

        // Select first available class if not set or invalid
        setSelectedClass((current) => {
          if (current && unique.includes(current)) return current
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
    <div className="space-y-5 max-w-4xl mx-auto pb-28">
      {/* Dry Run Banner (shown if function reports dry run mode) */}
      {alertResult?.dry_run && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Info className="size-4 text-amber-600 shrink-0" />
            <span>
              <strong>Dry Run Mode active:</strong> WhatsApp messages are simulated and logged. No real messages are delivered to Meta.
            </span>
          </div>
          <Badge className="bg-amber-200 text-amber-900 border-0 text-[11px]">
            DRY RUN
          </Badge>
        </div>
      )}

      {/* 1. TOP CONTROLS */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Attendance</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Select class and date. Tap any student who is absent.
            </p>
          </div>

          {/* Status Badge: Attendance taken or Not taken yet */}
          <div>
            {isTaken ? (
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 font-semibold text-xs px-3 py-1 flex items-center gap-1.5 shadow-xs">
                <Check className="size-3.5 stroke-[2.5]" />
                <span>Attendance taken {takenTime ? `(${takenTime})` : ''}</span>
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-amber-50 text-amber-800 border border-amber-200 font-medium text-xs px-3 py-1 flex items-center gap-1.5">
                <Clock className="size-3.5" />
                <span>Not taken yet</span>
              </Badge>
            )}
          </div>
        </div>

        {/* Class Dropdown & Date Picker */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1 border-t border-slate-100">
          {/* Class Dropdown (only classes with active students) */}
          <div className="sm:col-span-5 space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Class</label>
            {availableClasses.length > 0 ? (
              <select
                value={selectedClass}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-base font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
              >
                {availableClasses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <div className="h-11 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center text-sm text-slate-500">
                No classes with active students
              </div>
            )}
          </div>

          {/* Date Picker (allow past, block future) */}
          <div className="sm:col-span-7 space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Date</span>
              {!isToday && todayStr && (
                <button
                  type="button"
                  onClick={() => handleDateChange(todayStr)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium underline cursor-pointer"
                >
                  Today
                </button>
              )}
            </label>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => adjustDate(-1)}
                className="h-11 w-11 shrink-0 border-slate-300 cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft className="size-5 text-slate-600" />
              </Button>

              <div className="relative flex-1">
                <input
                  type="date"
                  value={selectedDate}
                  max={todayStr}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-base font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={isToday}
                onClick={() => adjustDate(1)}
                className="h-11 w-11 shrink-0 border-slate-300 cursor-pointer disabled:opacity-40"
                title="Next Day"
              >
                <ChevronRight className="size-5 text-slate-600" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Search and "Mark all present" toolbar */}
      {availableClasses.length > 0 && attendanceList.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              placeholder="Search student or school in this class..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11 text-base bg-white border-slate-300"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleMarkAllPresent}
            disabled={loading || saving || sendingAlerts}
            className="min-h-[44px] gap-1.5 text-xs font-semibold border-slate-300 text-slate-700 bg-white hover:bg-slate-50 cursor-pointer shrink-0"
          >
            <RotateCcw className="size-3.5 text-slate-500" />
            <span>Mark all present</span>
          </Button>
        </div>
      )}

      {/* 2. STUDENT LIST FOR CHOSEN CLASS */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 shadow-xs">
          <div className="size-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium">Loading {selectedClass} students...</p>
        </div>
      ) : availableClasses.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center shadow-xs">
          <Users className="size-10 mx-auto text-slate-400 mb-3" />
          <h3 className="text-base font-bold text-slate-900">No active students found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Please register active students first from the Students tab.
          </p>
        </div>
      ) : attendanceList.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center shadow-xs">
          <Users className="size-10 mx-auto text-slate-400 mb-3" />
          <h3 className="text-base font-bold text-slate-900">No active students in {selectedClass}</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Switch to another class above or add students to {selectedClass}.
          </p>
        </div>
      ) : visibleStudents.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center shadow-xs">
          <p className="text-sm text-slate-600">No students match &quot;{searchQuery}&quot;.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearchQuery('')}
            className="mt-3 text-xs"
          >
            Clear Search
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-medium">
            <span>Tap row to mark Absent / Present</span>
            <span>{visibleStudents.length} of {attendanceList.length} students</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {visibleStudents.map((item, index) => {
              const { student, status } = item
              const isAbsent = status === 'absent'

              return (
                <div
                  key={student.id}
                  onClick={() => toggleAttendance(student.id)}
                  className={`cursor-pointer rounded-xl border p-4 transition-all duration-150 select-none shadow-xs flex items-center justify-between gap-3 min-h-[64px] ${
                    isAbsent
                      ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400/70 hover:bg-rose-100/80'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                  }`}
                >
                  {/* Left: Student Name and School */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="font-mono text-xs text-slate-400 w-6 text-right shrink-0">
                      {index + 1}.
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-base font-bold truncate ${
                            isAbsent ? 'text-rose-950 font-extrabold' : 'text-slate-900'
                          }`}
                        >
                          {student.full_name}
                        </span>
                        {student.admission_no && (
                          <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">
                            {student.admission_no}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
                        {student.school ? (
                          <>
                            <Building className="size-3 text-slate-400 shrink-0" />
                            <span className="truncate">{student.school}</span>
                          </>
                        ) : (
                          <span className="text-slate-400 italic">No school specified</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Status Tag with large tap area */}
                  <div className="shrink-0">
                    {isAbsent ? (
                      <div className="h-10 px-3.5 rounded-lg bg-rose-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm">
                        <XCircle className="size-4 shrink-0" />
                        <span>Absent</span>
                      </div>
                    ) : (
                      <div className="h-10 px-3.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                        <span>Present</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 3. STICKY BOTTOM SAVE & NOTIFY BAR */}
      {attendanceList.length > 0 && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 md:left-64 z-30 bg-white/95 backdrop-blur-md border-t border-slate-300 p-3 sm:p-4 shadow-lg">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="text-sm">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <span className="text-emerald-700">Present: {presentCount}</span>
                <span className="text-slate-300">•</span>
                <span className={absentCount > 0 ? 'text-rose-600 font-extrabold' : 'text-slate-500'}>
                  Absent: {absentCount}
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Total {attendanceList.length} active students in {selectedClass}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Action A: Save attendance only */}
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveAttendanceOnly}
                disabled={saving || sendingAlerts || loading}
                className="min-h-[46px] px-4 gap-2 border-slate-300 text-slate-700 font-semibold text-xs sm:text-sm bg-white hover:bg-slate-50 cursor-pointer flex-1 sm:flex-initial"
              >
                <Save className="size-4" />
                <span>{saving ? 'Saving...' : 'Save attendance'}</span>
              </Button>

              {/* Action B: Save and notify absentees */}
              <Button
                type="button"
                onClick={handleInitiateSaveAndNotify}
                disabled={absentCount === 0 || saving || sendingAlerts || loading}
                className="min-h-[46px] px-5 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md cursor-pointer disabled:opacity-40 flex-1 sm:flex-initial"
              >
                <Send className="size-4" />
                <span>{sendingAlerts ? 'Processing...' : 'Save & notify absentees'}</span>
              </Button>
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
