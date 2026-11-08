'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StudentFormDialog } from '@/components/students/student-form-dialog'
import { StatusConfirmDialog } from '@/components/students/status-confirm-dialog'
import { InitialsAvatar } from '@/components/ui/initials-avatar'
import {
  Plus,
  Search,
  MessageSquare,
  Phone,
  Edit,
  UserX,
  UserCheck,
  Users,
  RefreshCw,
  Building,
} from 'lucide-react'
import { formatDate } from '@/lib/formatters'
import { CLASS_OPTIONS, type Student } from '@/types/database'
import { toast } from 'sonner'

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClass, setSelectedClass] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')

  // Modals state
  const [formOpen, setFormOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)

  // Status confirm dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [studentForStatusChange, setStudentForStatusChange] = useState<Student | null>(null)
  const [statusChangeLoading, setStatusChangeLoading] = useState(false)

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('full_name', { ascending: true })

      if (error) throw error

      setStudents(data || [])
    } catch (err: unknown) {
      console.error('Failed to load students:', err)
      const msg = err instanceof Error ? err.message : 'Failed to load students.'
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents])

  // Fast filtering & default sorting by student name
  const filteredStudents = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()

    return students
      .filter((s) => {
        // Status filter (Active by default)
        if (statusFilter !== 'all' && s.status !== statusFilter) {
          return false
        }

        // Class filter
        if (selectedClass !== 'all' && s.class_level !== selectedClass) {
          return false
        }

        // Search by name, school, or phone (and parent name)
        if (query) {
          const matchesName = s.full_name?.toLowerCase().includes(query)
          const matchesSchool = s.school?.toLowerCase().includes(query)
          const matchesPhone = s.phone?.toLowerCase().includes(query)
          const matchesParent = s.parent_name?.toLowerCase().includes(query)
          const matchesAdmission = s.admission_no?.toLowerCase().includes(query)

          if (!matchesName && !matchesSchool && !matchesPhone && !matchesParent && !matchesAdmission) {
            return false
          }
        }

        return true
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [students, statusFilter, selectedClass, searchQuery])

  // Counts
  const activeCount = useMemo(
    () => students.filter((s) => s.status === 'active').length,
    [students]
  )
  const inactiveCount = useMemo(
    () => students.filter((s) => s.status === 'inactive').length,
    [students]
  )

  // Status change handler (Deactivate / Reactivate)
  function handleOpenStatusDialog(student: Student) {
    setStudentForStatusChange(student)
    setStatusDialogOpen(true)
  }

  async function handleConfirmStatusChange() {
    if (!studentForStatusChange) return

    const newStatus: 'active' | 'inactive' =
      studentForStatusChange.status === 'active' ? 'inactive' : 'active'
    setStatusChangeLoading(true)
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('students')
        .update({ status: newStatus })
        .eq('id', studentForStatusChange.id)

      if (error) throw error

      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentForStatusChange.id ? { ...s, status: newStatus } : s
        )
      )

      toast.success(
        newStatus === 'inactive'
          ? `${studentForStatusChange.full_name} has been deactivated.`
          : `${studentForStatusChange.full_name} has been reactivated.`
      )
      setStatusDialogOpen(false)
      setStudentForStatusChange(null)
    } catch (err: unknown) {
      console.error('Failed to change status:', err)
      const msg = err instanceof Error ? err.message : 'Failed to update student status.'
      toast.error(msg)
    } finally {
      setStatusChangeLoading(false)
    }
  }

  function handleOpenAdd() {
    setEditingStudent(null)
    setFormOpen(true)
  }

  function handleOpenEdit(student: Student) {
    setEditingStudent(student)
    setFormOpen(true)
  }

  return (
    <div className="space-y-6 max-w-[960px] mx-auto pb-16">
      {/* 1. TOP HEADER: Single primary button "Add student" */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
              Students
            </h1>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[var(--present-bg)] text-[var(--present-text)] border border-[var(--present)]/30">
              {activeCount} Active
            </span>
          </div>
          <p className="text-sm font-normal text-[var(--text-secondary)] mt-0.5">
            Student registry, parent contacts, and class enrollment.
          </p>
        </div>

        {/* Single Primary Button */}
        <button
          type="button"
          onClick={handleOpenAdd}
          className="min-h-[44px] px-5 rounded-[12px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg cursor-pointer transition-all active:scale-[0.98] self-start sm:self-auto"
        >
          <Plus className="size-4.5 stroke-[2.5]" />
          <span>Add student</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-[var(--absent-bg)] text-[var(--absent-text)] text-sm rounded-[16px] border border-[var(--absent)]/30 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={fetchStudents}
            className="text-xs font-bold px-3 py-1.5 rounded-[8px] bg-white border border-[var(--absent)]/30 hover:bg-[var(--absent-bg)] cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. SEARCH AT THE TOP & FILTERS AS PILLS */}
      <div className="space-y-3">
        {/* Search input at the top */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search by student name, school, parent, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-10 pr-4 rounded-[12px] border border-[var(--card-border)] bg-white text-sm text-[var(--text)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-2xs"
          />
        </div>

        {/* Filters as Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Status filter pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mr-1">
              Status:
            </span>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`min-h-[36px] px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'bg-white text-[var(--text-secondary)] border border-[var(--card-border)] hover:bg-[var(--primary-soft)]'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={`min-h-[36px] px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'inactive'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'bg-white text-[var(--text-secondary)] border border-[var(--card-border)] hover:bg-[var(--primary-soft)]'
              }`}
            >
              Inactive ({inactiveCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`min-h-[36px] px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'bg-white text-[var(--text-secondary)] border border-[var(--card-border)] hover:bg-[var(--primary-soft)]'
              }`}
            >
              All ({students.length})
            </button>
          </div>

          {/* Class filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mr-1 shrink-0">
              Class:
            </span>
            <button
              type="button"
              onClick={() => setSelectedClass('all')}
              className={`min-h-[36px] px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
                selectedClass === 'all'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'bg-white text-[var(--text-secondary)] border border-[var(--card-border)] hover:bg-[var(--primary-soft)]'
              }`}
            >
              All Classes
            </button>
            {CLASS_OPTIONS.map((cls) => (
              <button
                key={cls}
                type="button"
                onClick={() => setSelectedClass(cls)}
                className={`min-h-[36px] px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  selectedClass === cls
                    ? 'bg-[var(--primary)] text-white shadow-xs'
                    : 'bg-white text-[var(--text-secondary)] border border-[var(--card-border)] hover:bg-[var(--primary-soft)]'
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. STUDENT LIST ROWS */}
      {loading ? (
        <div className="bg-white rounded-[24px] border border-[var(--card-border)] p-12 text-center text-[var(--text-secondary)] shadow-2xs">
          <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-[var(--primary)]" />
          <p className="text-sm font-bold">Loading students...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white rounded-[24px] border border-dashed border-[var(--card-border)] p-12 text-center shadow-2xs">
          <Users className="size-10 mx-auto text-[var(--text-secondary)] opacity-50 mb-3" />
          <h3 className="text-base font-bold text-[var(--text)]">No students found</h3>
          <p className="text-sm font-normal text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
            {searchQuery || selectedClass !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your search query, status, or class filter pills.'
              : 'Start by adding students to Akshara Academy.'}
          </p>
          <div className="mt-4">
            {searchQuery || selectedClass !== 'all' || statusFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedClass('all')
                  setStatusFilter('all')
                }}
                className="min-h-[44px] px-5 rounded-[12px] border border-[var(--card-border)] bg-white text-sm font-bold text-[var(--primary)] hover:bg-[var(--primary-soft)] cursor-pointer"
              >
                Clear Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="min-h-[44px] px-6 rounded-[12px] bg-[var(--primary)] text-white font-bold text-sm cursor-pointer shadow-xs"
              >
                Add Student
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStudents.map((student) => (
            <div
              key={student.id}
              onClick={() => handleOpenEdit(student)}
              className="bg-white rounded-[20px] border border-[var(--card-border)]/70 p-4 sm:p-5 shadow-2xs hover:border-[var(--primary)]/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
            >
              {/* Left: Avatar + Name, Admission, Class and School */}
              <div className="flex items-center gap-3.5 min-w-0 md:w-5/12">
                <InitialsAvatar name={student.full_name} size="md" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base text-[var(--text)] truncate">
                      {student.full_name}
                    </span>
                    {student.admission_no && (
                      <span className="text-xs font-normal text-[var(--text-secondary)] bg-[var(--primary-soft)] px-2 py-0.5 rounded-full shrink-0">
                        #{student.admission_no}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-normal text-[var(--text-secondary)] mt-0.5 truncate flex items-center gap-1.5">
                    <span className="font-semibold text-[var(--text)]">{student.class_level}</span>
                    {student.school && (
                      <>
                        <span className="opacity-40">·</span>
                        <span className="truncate flex items-center gap-1">
                          <Building className="size-3 text-[var(--text-secondary)] shrink-0" />
                          <span>{student.school}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Middle: Parent Name and Phone */}
              <div className="text-sm md:w-4/12 space-y-0.5">
                <div className="font-normal text-[var(--text)]">
                  Parent: <strong className="font-bold">{student.parent_name}</strong>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <a
                    href={`tel:${student.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono text-sm text-[var(--primary)] hover:underline flex items-center gap-1 font-bold"
                  >
                    <Phone className="size-3 text-[var(--text-secondary)]" />
                    <span>{student.phone}</span>
                  </a>
                  {student.whatsapp_opt_in ? (
                    <span
                      title="Parent opted in to WhatsApp alerts"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--whatsapp-bg)] text-[var(--whatsapp-text)] text-xs font-bold border border-[var(--whatsapp)]/30"
                    >
                      <MessageSquare className="size-3 text-[var(--whatsapp)]" />
                      <span>WA</span>
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--text-secondary)] opacity-60">
                      No WA
                    </span>
                  )}
                </div>
              </div>

              {/* Right: Status badge & Actions */}
              <div
                className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--card-border)]/40 md:w-3/12"
                onClick={(e) => e.stopPropagation()}
              >
                {student.status === 'active' ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[var(--present-bg)] text-[var(--present-text)] border border-[var(--present)]/30">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-[var(--text-secondary)] border border-[var(--card-border)]/60">
                    Inactive
                  </span>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(student)}
                    className="min-h-[40px] px-3.5 rounded-[12px] text-xs font-bold border border-[var(--card-border)] text-[var(--primary)] bg-white hover:bg-[var(--primary-soft)] flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                  >
                    <Edit className="size-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenStatusDialog(student)}
                    className={`min-h-[40px] px-3 rounded-[12px] text-xs font-bold cursor-pointer transition-colors ${
                      student.status === 'active'
                        ? 'text-[var(--text-secondary)] hover:text-[var(--absent-text)] hover:bg-[var(--absent-bg)]'
                        : 'text-[var(--present-text)] hover:bg-[var(--present-bg)]'
                    }`}
                  >
                    {student.status === 'active' ? (
                      <span className="flex items-center gap-1">
                        <UserX className="size-3.5" />
                        <span className="hidden sm:inline">Deactivate</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <UserCheck className="size-3.5" />
                        <span className="hidden sm:inline">Reactivate</span>
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Sheet / Dialog */}
      <StudentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        studentToEdit={editingStudent}
        onSaved={fetchStudents}
      />

      {/* Deactivate / Reactivate Confirm Dialog */}
      <StatusConfirmDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        student={studentForStatusChange}
        loading={statusChangeLoading}
        onConfirm={handleConfirmStatusChange}
      />
    </div>
  )
}
