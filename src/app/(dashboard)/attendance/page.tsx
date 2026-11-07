'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Users,
  Save,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Phone,
} from 'lucide-react'
import { CLASS_OPTIONS, type Student } from '@/types/database'
import { toast } from 'sonner'

interface StudentAttendanceState {
  student: Student
  status: 'present' | 'absent'
}

export default function AttendancePage() {
  const [selectedClass, setSelectedClass] = useState<string>('Class 10')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [attendanceList, setAttendanceList] = useState<StudentAttendanceState[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Initialize date on client mount to adhere to Next.js 16 prerendering rules
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setSelectedDate(today)
  }, [])

  // Fetch active students and existing attendance for selectedClass and selectedDate
  const loadAttendanceData = useCallback(async () => {
    if (!selectedDate) return

    setLoading(true)
    const supabase = createClient()

    try {
      // 1. Fetch active students in selected class
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
        setLoading(false)
        return
      }

      // 2. Fetch existing attendance for these students on selected date
      const studentIds = students.map((s) => s.id)
      const { data: existingRecords, error: attError } = await supabase
        .from('attendance')
        .select('student_id, status, created_at')
        .eq('att_date', selectedDate)
        .in('student_id', studentIds)

      if (attError) throw attError

      const attendanceMap = new Map<string, 'present' | 'absent'>()
      let latestSave: string | null = null

      if (existingRecords && existingRecords.length > 0) {
        existingRecords.forEach((rec) => {
          attendanceMap.set(rec.student_id, rec.status as 'present' | 'absent')
          if (rec.created_at) {
            latestSave = rec.created_at
          }
        })
      }

      // 3. Build state: If attendance exists, use it; otherwise default EVERY active student to "present"
      const initialList: StudentAttendanceState[] = students.map((student) => ({
        student,
        status: attendanceMap.get(student.id) || 'present', // All default to present!
      }))

      setAttendanceList(initialList)
      setHasUnsavedChanges(false)

      if (existingRecords && existingRecords.length > 0) {
        setLastSavedTime('Saved in database')
      } else {
        setLastSavedTime(null)
      }
    } catch (err: unknown) {
      console.error('Failed to load attendance:', err)
      const msg = err instanceof Error ? err.message : 'Failed to load attendance.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [selectedClass, selectedDate])

  useEffect(() => {
    if (selectedDate) {
      loadAttendanceData()
    }
  }, [selectedDate, selectedClass, loadAttendanceData])

  // Single tap toggles between Present and Absent
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

  // Quick action: Mark all present
  function handleMarkAllPresent() {
    setAttendanceList((prev) =>
      prev.map((item) => ({ ...item, status: 'present' }))
    )
    setHasUnsavedChanges(true)
    toast.info('All students marked present.')
  }

  // Save attendance to Supabase
  async function handleSaveAttendance() {
    if (attendanceList.length === 0) return

    setSaving(true)
    const supabase = createClient()

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

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

      const absentCount = attendanceList.filter((item) => item.status === 'absent').length
      const presentCount = attendanceList.filter((item) => item.status === 'present').length

      const now = new Date()
      const timeStr = now.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })
      setLastSavedTime(`Saved today at ${timeStr}`)
      setHasUnsavedChanges(false)

      toast.success(
        `Attendance saved! (${presentCount} Present, ${absentCount} Absent)`
      )
    } catch (err: unknown) {
      console.error('Failed to save attendance:', err)
      const msg = err instanceof Error ? err.message : 'Failed to save attendance.'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // Date helper navigation
  function adjustDate(days: number) {
    if (!selectedDate) return
    const current = new Date(selectedDate)
    current.setDate(current.getDate() + days)
    setSelectedDate(current.toISOString().split('T')[0])
  }

  function setDateToToday() {
    setSelectedDate(new Date().toISOString().split('T')[0])
  }

  // Stats calculation
  const totalStudents = attendanceList.length
  const presentStudents = useMemo(
    () => attendanceList.filter((i) => i.status === 'present'),
    [attendanceList]
  )
  const absentStudents = useMemo(
    () => attendanceList.filter((i) => i.status === 'absent'),
    [attendanceList]
  )

  const isToday =
    selectedDate && selectedDate === new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Daily Attendance
            </h1>
            {hasUnsavedChanges && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-semibold text-xs animate-pulse">
                Unsaved changes
              </Badge>
            )}
            {lastSavedTime && !hasUnsavedChanges && (
              <Badge variant="outline" className="text-xs text-emerald-700 bg-emerald-50 border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="size-3" /> {lastSavedTime}
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            All students default to Present. Tap on any student to mark them Absent.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleMarkAllPresent}
            disabled={loading || totalStudents === 0}
            className="min-h-[44px] text-xs font-medium border-slate-300 text-slate-700"
          >
            All Present
          </Button>

          <Button
            type="button"
            onClick={handleSaveAttendance}
            disabled={saving || loading || totalStudents === 0}
            className="min-h-[44px] gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm px-5"
          >
            <Save className="size-4" />
            <span>{saving ? 'Saving...' : 'Save Attendance'}</span>
          </Button>
        </div>
      </div>

      {/* Class & Date Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        {/* Class Selector */}
        <div className="sm:col-span-5 space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Select Class
          </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full h-12 px-3 rounded-lg border border-slate-300 bg-white text-base font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
          >
            {CLASS_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Date Selector */}
        <div className="sm:col-span-7 space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Attendance Date</span>
            {!isToday && (
              <button
                type="button"
                onClick={setDateToToday}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium underline flex items-center gap-1"
              >
                Jump to Today
              </button>
            )}
          </label>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => adjustDate(-1)}
              className="h-12 w-12 shrink-0 border-slate-300"
              title="Previous Day"
            >
              <ChevronLeft className="size-5 text-slate-600" />
            </Button>

            <div className="relative flex-1">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full h-12 px-3 rounded-lg border border-slate-300 bg-white text-base font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => adjustDate(1)}
              className="h-12 w-12 shrink-0 border-slate-300"
              title="Next Day"
            >
              <ChevronRight className="size-5 text-slate-600" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center shadow-xs">
          <span className="text-xs font-semibold uppercase text-slate-500 block">Total Enrolled</span>
          <span className="text-2xl font-bold text-slate-900">{totalStudents}</span>
        </div>

        <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 text-center shadow-xs">
          <span className="text-xs font-semibold uppercase text-emerald-800 block">Present</span>
          <span className="text-2xl font-bold text-emerald-700">{presentStudents.length}</span>
        </div>

        <div className={`p-3.5 rounded-xl border text-center shadow-xs transition-colors ${
          absentStudents.length > 0
            ? 'bg-rose-50 border-rose-300 text-rose-900'
            : 'bg-white border-slate-200 text-slate-500'
        }`}>
          <span className="text-xs font-semibold uppercase block">Absent</span>
          <span className={`text-2xl font-bold ${
            absentStudents.length > 0 ? 'text-rose-600' : 'text-slate-400'
          }`}>
            {absentStudents.length}
          </span>
        </div>
      </div>

      {/* Main Students Attendance List */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 shadow-xs">
          <div className="size-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-base font-medium text-slate-700">Loading {selectedClass} students...</p>
        </div>
      ) : totalStudents === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center shadow-xs">
          <Users className="size-10 mx-auto text-slate-400 mb-3" />
          <h3 className="text-base font-bold text-slate-900">No active students in {selectedClass}</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            There are currently no active students registered under {selectedClass}. Select another class or enroll students on the Students page.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>Tap any row to toggle status</span>
            <span>{presentStudents.length} Present • {absentStudents.length} Absent</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {attendanceList.map((item, index) => {
              const { student, status } = item
              const isPresent = status === 'present'

              return (
                <div
                  key={student.id}
                  onClick={() => toggleAttendance(student.id)}
                  className={`cursor-pointer rounded-xl border p-4 transition-all duration-150 select-none shadow-xs flex items-center justify-between gap-4 min-h-[64px] ${
                    isPresent
                      ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                      : 'bg-rose-50/80 border-rose-300 ring-1 ring-rose-300 hover:bg-rose-100/70'
                  }`}
                >
                  {/* Left: Student Name & Details */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="font-mono text-xs text-slate-400 w-6 text-right shrink-0">
                      {index + 1}.
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-base font-bold truncate leading-snug ${
                          isPresent ? 'text-slate-900' : 'text-rose-950 font-extrabold'
                        }`}>
                          {student.full_name}
                        </span>
                        {student.admission_no && (
                          <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">
                            {student.admission_no}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                        <span>Parent: {student.parent_name}</span>
                        <span className="font-mono">{student.phone}</span>
                        {student.school && (
                          <span className="hidden sm:inline text-slate-400">• {student.school}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Status Pill & WhatsApp Opt-In Indicator */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* WhatsApp Alert Badge (shows on absentees) */}
                    {!isPresent && (
                      <div className="hidden sm:flex items-center">
                        {student.whatsapp_opt_in ? (
                          <span
                            title="Parent opted in to receive WhatsApp absent alert"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-300"
                          >
                            <MessageSquare className="size-3 text-emerald-700" />
                            <span>WA Alert Ready</span>
                          </span>
                        ) : (
                          <span
                            title="Parent has NOT opted in to WhatsApp alerts"
                            className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-500 text-xs font-medium"
                          >
                            No WA Opt-in
                          </span>
                        )}
                      </div>
                    )}

                    {/* Status Pill Toggle Button */}
                    <div
                      className={`min-w-[110px] h-11 px-4 rounded-lg flex items-center justify-center gap-2 font-bold text-sm shadow-xs transition-transform active:scale-95 ${
                        isPresent
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200'
                          : 'bg-rose-600 text-white hover:bg-rose-700 shadow-md ring-2 ring-rose-400/50'
                      }`}
                    >
                      {isPresent ? (
                        <>
                          <CheckCircle2 className="size-4 text-emerald-700" />
                          <span>Present</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="size-4 text-white" />
                          <span>Absent</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Sticky Bottom Save Bar for Mobile / Convenience */}
          <div className="sticky bottom-20 md:bottom-6 z-10 pt-4">
            <div className="bg-white/95 backdrop-blur-md p-4 rounded-xl border border-slate-300 shadow-xl flex items-center justify-between gap-4">
              <div className="text-sm">
                <span className="font-bold text-slate-900">{selectedClass} Attendance</span>
                <p className="text-xs text-slate-500">
                  {presentStudents.length} present, {absentStudents.length} absent on {selectedDate}
                </p>
              </div>

              <Button
                type="button"
                onClick={handleSaveAttendance}
                disabled={saving || loading}
                className="min-h-[46px] px-6 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md cursor-pointer"
              >
                <Save className="size-4" />
                <span>{saving ? 'Saving...' : 'Save Attendance'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
