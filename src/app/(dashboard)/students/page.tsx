'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StudentFormDialog } from '@/components/students/student-form-dialog'
import { StatusConfirmDialog } from '@/components/students/status-confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Students</h1>
            <Badge variant="secondary" className="text-xs bg-slate-200 text-slate-800 font-semibold">
              {activeCount} Active
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Student registry, contact details, and class enrollment.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleOpenAdd}
          className="min-h-[44px] gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm px-5"
        >
          <Plus className="size-4" />
          <span>Add Student</span>
        </Button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 flex items-center justify-between">
          <span>{errorMsg}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchStudents}
            className="text-xs bg-white text-red-700 border-red-300"
          >
            <RefreshCw className="size-3 mr-1" /> Retry
          </Button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
        {/* Search Input */}
        <div className="md:col-span-5 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            placeholder="Search by name, school, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-11 text-base bg-white border-slate-300"
          />
        </div>

        {/* Class Filter Dropdown */}
        <div className="md:col-span-4">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full h-11 px-3 rounded-md border border-slate-300 bg-white text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All Classes</option>
            {CLASS_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="md:col-span-3">
          <div className="grid grid-cols-3 h-11 p-1 bg-slate-100 rounded-lg text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`rounded-md transition-colors ${
                statusFilter === 'active'
                  ? 'bg-white text-blue-700 font-semibold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={`rounded-md transition-colors ${
                statusFilter === 'inactive'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              Inactive
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`rounded-md transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              All
            </button>
          </div>
        </div>
      </div>

      {/* Main Student List */}
      {loading ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-slate-500 shadow-xs">
          <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-sm font-medium">Loading students...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-slate-300 p-12 text-center shadow-xs">
          <Users className="size-10 mx-auto text-slate-400 mb-3" />
          <h3 className="text-base font-semibold text-slate-900">No students found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || selectedClass !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your search keywords or class filters.'
              : 'Start by adding students to Akshara Academy.'}
          </p>
          <div className="mt-4">
            {searchQuery || selectedClass !== 'all' || statusFilter !== 'all' ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedClass('all')
                  setStatusFilter('all')
                }}
                className="min-h-[44px]"
              >
                Clear Filters
              </Button>
            ) : (
              <Button
                onClick={handleOpenAdd}
                className="min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="size-4 mr-1.5" /> Add Student
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table: Columns: name, class, school, parent name, phone, admission date, status, actions */}
          <div className="hidden md:block bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-700">Student Name</TableHead>
                  <TableHead className="font-semibold text-slate-700">Class</TableHead>
                  <TableHead className="font-semibold text-slate-700">School</TableHead>
                  <TableHead className="font-semibold text-slate-700">Parent Name</TableHead>
                  <TableHead className="font-semibold text-slate-700">Phone</TableHead>
                  <TableHead className="font-semibold text-slate-700">Admission Date</TableHead>
                  <TableHead className="font-semibold text-slate-700">Status</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id} className="hover:bg-slate-50/70">
                    {/* Name */}
                    <TableCell className="py-3.5">
                      <div className="font-semibold text-slate-900 text-base">
                        {student.full_name}
                      </div>
                      {student.admission_no && (
                        <span className="font-mono text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {student.admission_no}
                        </span>
                      )}
                    </TableCell>

                    {/* Class */}
                    <TableCell className="py-3.5">
                      <Badge variant="outline" className="font-semibold text-blue-800 bg-blue-50 border-blue-200">
                        {student.class_level}
                      </Badge>
                    </TableCell>

                    {/* School */}
                    <TableCell className="py-3.5 text-sm text-slate-700">
                      {student.school ? (
                        <div className="flex items-center gap-1.5">
                          <Building className="size-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{student.school}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-xs">-</span>
                      )}
                    </TableCell>

                    {/* Parent Name */}
                    <TableCell className="py-3.5 font-medium text-slate-800 text-sm">
                      {student.parent_name}
                    </TableCell>

                    {/* Phone + WhatsApp badge */}
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${student.phone}`}
                          className="font-mono text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <Phone className="size-3 text-slate-400" />
                          <span>{student.phone}</span>
                        </a>
                        {student.whatsapp_opt_in ? (
                          <span
                            title="Parent opted in to WhatsApp alerts"
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200"
                          >
                            <MessageSquare className="size-2.5" /> WA
                          </span>
                        ) : (
                          <span
                            title="No WhatsApp alerts"
                            className="text-[10px] text-slate-400"
                          >
                            No WA
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Admission Date */}
                    <TableCell className="py-3.5 text-xs text-slate-600 whitespace-nowrap">
                      {formatDate(student.admission_date)}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3.5">
                      {student.status === 'active' ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0 text-xs font-semibold">
                          Active
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-slate-200 text-slate-600 border-0 text-xs font-medium"
                        >
                          Inactive
                        </Badge>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEdit(student)}
                          className="min-h-[36px] text-xs gap-1 border-slate-300 text-slate-700 hover:bg-slate-100"
                        >
                          <Edit className="size-3.5" /> Edit
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenStatusDialog(student)}
                          className={`min-h-[36px] text-xs gap-1 ${
                            student.status === 'active'
                              ? 'text-slate-600 hover:text-red-600 hover:bg-red-50'
                              : 'text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {student.status === 'active' ? (
                            <>
                              <UserX className="size-3.5" /> Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="size-3.5" /> Reactivate
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredStudents.map((student) => (
              <div
                key={student.id}
                className="bg-white rounded-lg border border-slate-200 p-4 space-y-3 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-base text-slate-900 leading-tight">
                      {student.full_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs font-semibold text-blue-800 bg-blue-50 border-blue-200">
                        {student.class_level}
                      </Badge>
                      {student.school && (
                        <span className="text-xs text-slate-500 truncate max-w-[150px]">
                          {student.school}
                        </span>
                      )}
                    </div>
                  </div>

                  {student.status === 'active' ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-0 text-xs font-semibold shrink-0">
                      Active
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="bg-slate-200 text-slate-600 border-0 text-xs font-medium shrink-0"
                    >
                      Inactive
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Parent</span>
                    <span className="font-medium text-slate-800">{student.parent_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Phone</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <a
                        href={`tel:${student.phone}`}
                        className="font-mono text-blue-600 font-medium"
                      >
                        {student.phone}
                      </a>
                      {student.whatsapp_opt_in && (
                        <span className="px-1 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                          WA
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>Admitted: {formatDate(student.admission_date)}</span>
                  {student.admission_no && (
                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                      {student.admission_no}
                    </span>
                  )}
                </div>

                {/* Mobile Action Buttons with large tap targets */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenEdit(student)}
                    className="min-h-[44px] text-sm font-medium border-slate-300 text-slate-700"
                  >
                    <Edit className="size-4 mr-1.5" /> Edit
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleOpenStatusDialog(student)}
                    className={`min-h-[44px] text-sm font-medium ${
                      student.status === 'active'
                        ? 'text-slate-600 hover:text-red-600 hover:bg-red-50'
                        : 'text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    {student.status === 'active' ? (
                      <>
                        <UserX className="size-4 mr-1.5" /> Deactivate
                      </>
                    ) : (
                      <>
                        <UserCheck className="size-4 mr-1.5" /> Reactivate
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add / Edit Dialog */}
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
