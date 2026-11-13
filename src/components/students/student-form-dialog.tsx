'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { MessageSquare, AlertCircle, AlertTriangle, User } from 'lucide-react'
import { parseAndFormatIndianPhone, getTodayIST } from '@/lib/formatters'
import { CLASS_OPTIONS, type Student } from '@/types/database'
import { toast } from 'sonner'

interface StudentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentToEdit?: Student | null
  onSaved: () => void
}

export function StudentFormDialog({
  open,
  onOpenChange,
  studentToEdit,
  onSaved,
}: StudentFormDialogProps) {
  const isEditing = !!studentToEdit

  // Form fields
  const [fullName, setFullName] = useState('')
  const [classLevel, setClassLevel] = useState<string>('Class 10')
  const [school, setSchool] = useState('')
  const [parentName, setParentName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [admissionDate, setAdmissionDate] = useState('')
  const [admissionNo, setAdmissionNo] = useState('')
  const [whatsappOptIn, setWhatsappOptIn] = useState(false)
  const [feeInput, setFeeInput] = useState<string>('1000')
  const [feeDueDayInput, setFeeDueDayInput] = useState<string>('5')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')

  // Validation & state
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)

  // Pre-fill fields when editing or reset for adding
  useEffect(() => {
    let ignore = false
    const timer = setTimeout(() => {
      if (ignore) return
      if (studentToEdit) {
        setFullName(studentToEdit.full_name || '')
        setClassLevel(studentToEdit.class_level || 'Class 10')
        setSchool(studentToEdit.school || '')
        setParentName(studentToEdit.parent_name || '')
        // Remove +91 prefix for friendly display in the 10-digit input box
        const rawPhone = studentToEdit.phone || ''
        setPhone(rawPhone.startsWith('+91') ? rawPhone.slice(3) : rawPhone)
        setAddress(studentToEdit.address || '')
        setAdmissionDate(studentToEdit.admission_date || getTodayIST())
        setAdmissionNo(studentToEdit.admission_no || '')
        setWhatsappOptIn(!!studentToEdit.whatsapp_opt_in)
        setFeeInput(String(studentToEdit.monthly_fee ?? 1000))
        setFeeDueDayInput(String(studentToEdit.fee_due_day ?? 5))
        setNotes(studentToEdit.notes || '')
        setStatus(studentToEdit.status || 'active')
      } else {
        setFullName('')
        setClassLevel('Class 10')
        setSchool('')
        setParentName('')
        setPhone('')
        setAddress('')
        setAdmissionDate(getTodayIST())
        setAdmissionNo('')
        setWhatsappOptIn(false)
        setFeeInput('1000')
        setFeeDueDayInput('5')
        setNotes('')
        setStatus('active')
      }
      setPhoneError(null)
      setFormError(null)
      setDuplicateWarning(null)
    }, 0)
    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [studentToEdit, open])

  // Real-time phone validation helper on blur
  function handlePhoneBlur() {
    if (!phone.trim()) {
      setPhoneError(null)
      return
    }
    const result = parseAndFormatIndianPhone(phone)
    if (!result.isValid) {
      setPhoneError(result.error || 'Invalid phone number.')
    } else {
      setPhoneError(null)
    }
  }

  // Check for duplicate student (same full_name + class_level)
  async function checkForDuplicate(): Promise<boolean> {
    if (isEditing) return false // Skip check on update
    const supabase = createClient()
    try {
      const { data } = await supabase
        .from('students')
        .select('id, full_name, class_level')
        .ilike('full_name', fullName.trim())
        .eq('class_level', classLevel)

      if (data && data.length > 0) {
        setDuplicateWarning(
          `A student named "${fullName.trim()}" is already registered in ${classLevel}. Are you sure you want to add another?`
        )
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async function handleSubmit(e: React.FormEvent, forceSave = false) {
    e.preventDefault()
    setFormError(null)

    // 1. Validate required fields
    if (!fullName.trim()) {
      setFormError('Student full name is required.')
      return
    }
    if (!parentName.trim()) {
      setFormError('Parent name is required.')
      return
    }
    if (!phone.trim()) {
      setPhoneError('Parent phone number is required.')
      return
    }

    // 2. Validate Indian phone format (+91XXXXXXXXXX)
    const phoneResult = parseAndFormatIndianPhone(phone)
    if (!phoneResult.isValid) {
      setPhoneError(phoneResult.error || 'Invalid phone number.')
      return
    }

    const parsedFee = feeInput.trim() === '' ? 0 : Number(feeInput)
    if (Number.isNaN(parsedFee) || parsedFee < 0) {
      setFormError('Monthly fee must be 0 or greater.')
      return
    }

    const parsedDueDay = feeDueDayInput.trim() === '' ? 5 : Math.round(Number(feeDueDayInput))
    if (Number.isNaN(parsedDueDay) || parsedDueDay < 1 || parsedDueDay > 28) {
      setFormError('Monthly fee due day must be between 1 and 28.')
      return
    }

    // 3. Duplicate check before insert
    if (!isEditing && !forceSave) {
      const isDuplicate = await checkForDuplicate()
      if (isDuplicate) return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      const payload = {
        full_name: fullName.trim(),
        admission_no: admissionNo.trim() || null,
        class_level: classLevel,
        school: school.trim() || null,
        parent_name: parentName.trim(),
        phone: phoneResult.phone, // always +91XXXXXXXXXX
        address: address.trim() || null,
        admission_date: admissionDate || null,
        whatsapp_opt_in: whatsappOptIn,
        monthly_fee: parsedFee,
        fee_due_day: parsedDueDay,
        notes: notes.trim() || null,
        status,
      }

      if (isEditing && studentToEdit) {
        // Update existing student
        const { error } = await supabase
          .from('students')
          .update(payload)
          .eq('id', studentToEdit.id)

        if (error) throw error
        toast.success(`Updated ${fullName.trim()} successfully!`)
      } else {
        // Insert new student
        const { error } = await supabase.from('students').insert([payload])
        if (error) throw error
        toast.success(`Added ${fullName.trim()} to ${classLevel}!`)
      }

      onSaved()
      onOpenChange(false)
    } catch (err: unknown) {
      console.error('Error saving student:', err)
      const rawMsg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to save student record.'
      const errCode =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : ''

      const friendlyMsg =
        errCode === '23505' || rawMsg.includes('students_admission_no_key')
          ? `Admission number "${admissionNo.trim()}" is already assigned to another student.`
          : rawMsg

      setFormError(friendlyMsg)
      toast.error(friendlyMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden bg-white border border-[var(--card-border)] shadow-2xl rounded-[20px] sm:rounded-[24px] w-[calc(100%-1.5rem)] sm:max-w-2xl max-h-[88dvh] flex flex-col"
        showCloseButton={true}
      >
        {/* Fixed Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-[var(--card-border)]/80 bg-white shrink-0 pr-12">
          <DialogHeader className="gap-1 text-left">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-[14px] bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center shrink-0 shadow-2xs">
                <User className="size-5 stroke-[2.2]" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-[var(--text)] tracking-tight">
                  {isEditing ? 'Edit Student' : 'Add New Student'}
                </DialogTitle>
                <DialogDescription className="text-xs text-[var(--text-secondary)]">
                  {isEditing
                    ? 'Update student profile, parent contact, and fee details.'
                    : 'Enter student information, parent contact, and monthly fees.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Form Container */}
        <form
          id="student-form"
          onSubmit={(e) => handleSubmit(e, false)}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6 space-y-6 overscroll-contain">
            {formError && (
              <div className="flex items-center gap-2 p-3.5 bg-[var(--attention-bg)] text-[var(--attention-text)] text-xs rounded-[14px] border border-[var(--attention)]/30 animate-in fade-in-50">
                <AlertCircle className="size-4 shrink-0" />
                <span className="font-medium">{formError}</span>
              </div>
            )}

            {duplicateWarning && (
              <div className="p-4 bg-[var(--attention-bg)] text-[var(--attention-text)] text-xs rounded-[16px] border border-[var(--attention)]/30 space-y-3 animate-in fade-in-50">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="size-5 shrink-0 text-[var(--attention-text)] mt-0.5" />
                  <div>
                    <p className="font-bold text-[var(--attention-text)]">Duplicate Student Detected</p>
                    <p className="text-[var(--text-secondary)] text-xs mt-0.5 leading-relaxed">{duplicateWarning}</p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setDuplicateWarning(null)}
                    className="px-3.5 py-1.5 rounded-[10px] border border-[var(--card-border)] bg-white text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text)] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleSubmit(e, true)}
                    className="px-3.5 py-1.5 rounded-[10px] bg-[var(--primary)] text-white text-xs font-bold cursor-pointer hover:bg-[var(--primary-hover)] shadow-2xs"
                  >
                    Save Anyway
                  </button>
                </div>
              </div>
            )}

            {/* 1. Student Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1.5 border-b border-[var(--card-border)]/60">
                <span className="size-5 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                  Student Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="full_name" className="text-xs font-bold text-[var(--text)]">
                    Student Full Name <span className="text-[var(--attention-text)]">*</span>
                  </Label>
                  <Input
                    id="full_name"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-11 sm:h-12 text-sm sm:text-base rounded-[12px] border-[var(--card-border)] focus-visible:ring-[var(--primary)]"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="class_level" className="text-xs font-bold text-[var(--text)]">
                    Class Level <span className="text-[var(--attention-text)]">*</span>
                  </Label>
                  <select
                    id="class_level"
                    value={classLevel}
                    onChange={(e) => setClassLevel(e.target.value)}
                    required
                    className="w-full h-11 sm:h-12 px-3 rounded-[12px] border border-[var(--card-border)] bg-white text-sm sm:text-base font-bold text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer shadow-2xs"
                    disabled={loading}
                  >
                    {CLASS_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="school" className="text-xs font-bold text-[var(--text)]">
                    School
                  </Label>
                  <Input
                    id="school"
                    placeholder="e.g. Delhi Public School"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    className="h-11 sm:h-12 text-sm sm:text-base rounded-[12px] border-[var(--card-border)] focus-visible:ring-[var(--primary)]"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="admission_no" className="text-xs font-bold text-[var(--text)]">
                    Admission Number
                  </Label>
                  <Input
                    id="admission_no"
                    placeholder="e.g. AK-2026-001"
                    value={admissionNo}
                    onChange={(e) => setAdmissionNo(e.target.value)}
                    className="h-11 sm:h-12 text-sm sm:text-base rounded-[12px] border-[var(--card-border)] focus-visible:ring-[var(--primary)] font-mono"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="admission_date" className="text-xs font-bold text-[var(--text)]">
                    Admission Date
                  </Label>
                  <Input
                    id="admission_date"
                    type="date"
                    value={admissionDate}
                    onChange={(e) => setAdmissionDate(e.target.value)}
                    className="h-11 sm:h-12 text-sm sm:text-base rounded-[12px] border-[var(--card-border)] focus-visible:ring-[var(--primary)]"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="status" className="text-xs font-bold text-[var(--text)]">
                    Enrollment Status
                  </Label>
                  <select
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                    className="w-full h-11 sm:h-12 px-3 rounded-[12px] border border-[var(--card-border)] bg-white text-sm sm:text-base font-bold text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer shadow-2xs"
                    disabled={loading}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-xs font-bold text-[var(--text)]">
                  Residential Address
                </Label>
                <Input
                  id="address"
                  placeholder="House No, Street, Area, City"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-11 sm:h-12 text-sm sm:text-base rounded-[12px] border-[var(--card-border)] focus-visible:ring-[var(--primary)]"
                  disabled={loading}
                />
              </div>
            </div>

            {/* 2. Parent Contact & WhatsApp */}
            <div className="space-y-4 pt-1">
              <div className="flex items-center gap-2 pb-1.5 border-b border-[var(--card-border)]/60">
                <span className="size-5 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                  Parent Contact & Messaging
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="parent_name" className="text-xs font-bold text-[var(--text)]">
                    Parent Name <span className="text-[var(--attention-text)]">*</span>
                  </Label>
                  <Input
                    id="parent_name"
                    required
                    placeholder="e.g. Suresh Sharma"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    className="h-11 sm:h-12 text-sm sm:text-base rounded-[12px] border-[var(--card-border)] focus-visible:ring-[var(--primary)]"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-bold text-[var(--text)]">
                    Parent Mobile Number <span className="text-[var(--attention-text)]">*</span>
                  </Label>
                  <div className="relative flex rounded-[12px] border border-[var(--card-border)] focus-within:ring-2 focus-within:ring-[var(--primary)] overflow-hidden bg-white shadow-2xs">
                    <div className="flex items-center px-3 sm:px-3.5 bg-[var(--primary-soft)] text-[var(--text-secondary)] font-mono font-bold text-xs sm:text-sm border-r border-[var(--card-border)] select-none">
                      +91
                    </div>
                    <input
                      id="phone"
                      required
                      type="tel"
                      placeholder="9876543210"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value)
                        if (phoneError) setPhoneError(null)
                      }}
                      onBlur={handlePhoneBlur}
                      className="w-full h-11 sm:h-12 px-3 text-sm sm:text-base font-mono bg-white text-[var(--text)] focus:outline-none"
                      disabled={loading}
                    />
                  </div>
                  {phoneError ? (
                    <p className="text-xs text-[var(--attention-text)] font-bold">{phoneError}</p>
                  ) : (
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      10-digit mobile number (starts with 6, 7, 8, or 9).
                    </p>
                  )}
                </div>
              </div>

              {/* WhatsApp Opt-in Card */}
              <div className="p-3.5 sm:p-4 rounded-[16px] border border-[#25D366]/30 bg-[#25D366]/5 transition-colors hover:bg-[#25D366]/10">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <Checkbox
                    checked={whatsappOptIn}
                    onCheckedChange={(checked) => setWhatsappOptIn(checked === true)}
                    disabled={loading}
                    className="mt-0.5 size-5 data-[state=checked]:bg-[#25D366] data-[state=checked]:border-[#25D366]"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs sm:text-sm font-bold text-[var(--text)] flex items-center gap-1.5">
                      <MessageSquare className="size-4 text-[#25D366] shrink-0" />
                      Parent agreed to receive WhatsApp messages
                    </span>
                    <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] leading-relaxed">
                      Enables automated absent alerts, payment receipts, and fee reminder messages on WhatsApp.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* 3. Monthly Fees & Notes */}
            <div className="space-y-4 pt-1">
              <div className="flex items-center gap-2 pb-1.5 border-b border-[var(--card-border)]/60">
                <span className="size-5 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                  Monthly Fees & Notes
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fee" className="text-xs font-bold text-[var(--text)]">
                    Monthly Tuition Fee (₹) <span className="text-[var(--attention-text)]">*</span>
                  </Label>
                  <div className="relative flex rounded-[12px] border border-[var(--card-border)] focus-within:ring-2 focus-within:ring-[var(--primary)] overflow-hidden bg-white shadow-2xs">
                    <div className="flex items-center px-3 bg-[var(--primary-soft)] text-[var(--text-secondary)] font-bold text-sm border-r border-[var(--card-border)] select-none">
                      ₹
                    </div>
                    <Input
                      id="fee"
                      type="number"
                      min="0"
                      step="50"
                      placeholder="1000"
                      value={feeInput}
                      onChange={(e) => setFeeInput(e.target.value)}
                      className="h-11 sm:h-12 border-0 text-sm sm:text-base rounded-none focus-visible:ring-0"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fee_due_day" className="text-xs font-bold text-[var(--text)]">
                    Fee Due Day of Month (1–28) <span className="text-[var(--attention-text)]">*</span>
                  </Label>
                  <Input
                    id="fee_due_day"
                    type="number"
                    min="1"
                    max="28"
                    step="1"
                    placeholder="5"
                    value={feeDueDayInput}
                    onChange={(e) => setFeeDueDayInput(e.target.value)}
                    className="h-11 sm:h-12 text-sm sm:text-base rounded-[12px] border-[var(--card-border)] focus-visible:ring-[var(--primary)]"
                    disabled={loading}
                  />
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Default: 5th of each calendar month.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs font-bold text-[var(--text)]">
                  Notes / Special Instructions (Optional)
                </Label>
                <textarea
                  id="notes"
                  rows={2}
                  placeholder="e.g. Sibling concession, transport route, or guardian notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={loading}
                  className="w-full p-3 text-xs sm:text-sm rounded-[12px] border border-[var(--card-border)] bg-white text-[var(--text)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-shadow shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Sticky Footer (Always Visible on Screen) */}
          <div className="px-5 py-3.5 sm:px-7 sm:py-4 border-t border-[var(--card-border)]/80 bg-white shrink-0 shadow-[0_-4px_16px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between gap-3 w-full">
              <div className="hidden sm:block text-[11px] text-[var(--text-secondary)] font-medium">
                <span className="text-[var(--attention-text)] font-bold">*</span> Required fields
              </div>
              <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                  className="min-h-[44px] flex-1 sm:flex-initial px-5 rounded-[12px] font-bold text-xs sm:text-sm border border-[var(--card-border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--primary-soft)] cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="student-form"
                  disabled={loading}
                  className="min-h-[44px] flex-1 sm:flex-initial px-6 rounded-[12px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs sm:text-sm cursor-pointer shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? 'Saving...' : isEditing ? 'Update Student' : 'Save Student'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
