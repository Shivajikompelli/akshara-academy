'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { MessageSquare, AlertCircle, AlertTriangle, User } from 'lucide-react'
import { parseAndFormatIndianPhone } from '@/lib/formatters'
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
  const [fee, setFee] = useState<number>(1000)
  const [status, setStatus] = useState<'active' | 'inactive'>('active')

  // Validation & state
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)

  // Pre-fill fields when editing or reset for adding
  useEffect(() => {
    if (studentToEdit) {
      setFullName(studentToEdit.full_name || '')
      setClassLevel(studentToEdit.class_level || 'Class 10')
      setSchool(studentToEdit.school || '')
      setParentName(studentToEdit.parent_name || '')
      // Remove +91 prefix for friendly display in the 10-digit input box
      const rawPhone = studentToEdit.phone || ''
      setPhone(rawPhone.startsWith('+91') ? rawPhone.slice(3) : rawPhone)
      setAddress(studentToEdit.address || '')
      setAdmissionDate(studentToEdit.admission_date || new Date().toISOString().split('T')[0])
      setAdmissionNo(studentToEdit.admission_no || '')
      setWhatsappOptIn(!!studentToEdit.whatsapp_opt_in)
      setFee(studentToEdit.monthly_fee ?? 1000)
      setStatus(studentToEdit.status || 'active')
    } else {
      setFullName('')
      setClassLevel('Class 10')
      setSchool('')
      setParentName('')
      setPhone('')
      setAddress('')
      setAdmissionDate(new Date().toISOString().split('T')[0])
      setAdmissionNo('')
      setWhatsappOptIn(false)
      setFee(1000)
      setStatus('active')
    }
    setPhoneError(null)
    setFormError(null)
    setDuplicateWarning(null)
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
        monthly_fee: Number(fee) || 0,
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
      const msg = err instanceof Error ? err.message : 'Failed to save student record.'
      setFormError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-xl max-h-[100dvh] sm:max-h-[90vh] h-full sm:h-auto overflow-y-auto bg-white p-6 sm:p-7 rounded-none sm:rounded-[24px] border border-[var(--card-border)] shadow-xl inset-0 sm:inset-auto fixed top-0 sm:top-1/2 left-0 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center shrink-0">
              <User className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-[var(--text)]">
                {isEditing ? 'Edit Student' : 'Add New Student'}
              </DialogTitle>
              <DialogDescription className="text-xs font-normal text-[var(--text-secondary)] mt-0.5">
                {isEditing
                  ? 'Update student, parent, and fee details.'
                  : 'Enter student, parent, and enrollment information.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {formError && (
          <div className="flex items-center gap-2 p-3.5 bg-[var(--absent-bg)] text-[var(--absent-text)] text-xs rounded-[12px] border border-[var(--absent)]/30">
            <AlertCircle className="size-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {duplicateWarning && (
          <div className="p-4 bg-[var(--warn-bg)] text-[var(--warn-text)] text-xs rounded-[14px] border border-[var(--warn)]/30 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-5 shrink-0 text-[var(--warn)] mt-0.5" />
              <div>
                <p className="font-bold text-[var(--warn-text)]">Duplicate Student Detected</p>
                <p className="text-[var(--text-secondary)] text-xs mt-0.5">{duplicateWarning}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDuplicateWarning(null)}
                className="px-3 py-1.5 rounded-[8px] border border-[var(--card-border)] bg-white text-xs font-bold text-[var(--text-secondary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                className="px-3 py-1.5 rounded-[8px] bg-[var(--primary)] text-white text-xs font-bold cursor-pointer"
              >
                Save Anyway
              </button>
            </div>
          </div>
        )}

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6 pt-2">
          {/* Group 1: Student Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--card-border)]/50 pb-1.5">
              1. Student Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="full_name" className="text-xs font-bold text-[var(--text)]">
                  Student Full Name *
                </Label>
                <Input
                  id="full_name"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-12 text-base rounded-[12px] border-[var(--card-border)]"
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="class_level" className="text-xs font-bold text-[var(--text)]">
                  Class Level *
                </Label>
                <select
                  id="class_level"
                  value={classLevel}
                  onChange={(e) => setClassLevel(e.target.value)}
                  required
                  className="w-full h-12 px-3 rounded-[12px] border border-[var(--card-border)] bg-white text-base font-bold text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="school" className="text-xs font-bold text-[var(--text)]">
                  School
                </Label>
                <Input
                  id="school"
                  placeholder="e.g. Delhi Public School"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="h-12 text-base rounded-[12px] border-[var(--card-border)]"
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
                  className="h-12 text-base rounded-[12px] border-[var(--card-border)]"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="admission_date" className="text-xs font-bold text-[var(--text)]">
                  Admission Date
                </Label>
                <Input
                  id="admission_date"
                  type="date"
                  value={admissionDate}
                  onChange={(e) => setAdmissionDate(e.target.value)}
                  className="h-12 text-base rounded-[12px] border-[var(--card-border)]"
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="status" className="text-xs font-bold text-[var(--text)]">
                  Status
                </Label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full h-12 px-3 rounded-[12px] border border-[var(--card-border)] bg-white text-base font-bold text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer"
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
                className="h-12 text-base rounded-[12px] border-[var(--card-border)]"
                disabled={loading}
              />
            </div>
          </div>

          {/* Group 2: Parent Contact (with fixed +91 prefix) */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--card-border)]/50 pb-1.5">
              2. Parent Contact
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="parent_name" className="text-xs font-bold text-[var(--text)]">
                  Parent Name *
                </Label>
                <Input
                  id="parent_name"
                  required
                  placeholder="e.g. Suresh Sharma"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="h-12 text-base rounded-[12px] border-[var(--card-border)]"
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-bold text-[var(--text)]">
                  Parent Mobile Number *
                </Label>
                <div className="relative flex rounded-[12px] border border-[var(--card-border)] focus-within:ring-2 focus-within:ring-[var(--primary)] overflow-hidden">
                  <div className="flex items-center px-3.5 bg-[var(--primary-soft)] text-[var(--text-secondary)] font-mono font-bold text-sm border-r border-[var(--card-border)]">
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
                    className="w-full h-12 px-3 text-base font-mono bg-white text-[var(--text)] focus:outline-none"
                    disabled={loading}
                  />
                </div>
                {phoneError ? (
                  <p className="text-xs text-[var(--absent-text)] font-bold">{phoneError}</p>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Enter 10-digit mobile number (starts with 6, 7, 8, or 9).
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 rounded-[16px] border border-[var(--card-border)] bg-[var(--primary-soft)]/40">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <Checkbox
                  checked={whatsappOptIn}
                  onCheckedChange={(checked) => setWhatsappOptIn(checked === true)}
                  disabled={loading}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-sm font-bold text-[var(--text)] flex items-center gap-1.5">
                    <MessageSquare className="size-4 text-[var(--whatsapp)]" />
                    Parent agreed to receive WhatsApp messages
                  </span>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Required to send automated attendance absent alerts and fee reminders to this number.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Group 3: Fees */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--card-border)]/50 pb-1.5">
              3. Monthly Fees
            </h3>

            <div className="space-y-1.5 max-w-sm">
              <Label htmlFor="fee" className="text-xs font-bold text-[var(--text)]">
                Monthly Fee (₹) *
              </Label>
              <Input
                id="fee"
                type="number"
                min="0"
                step="50"
                placeholder="1000"
                value={fee}
                onChange={(e) => setFee(Number(e.target.value))}
                className="h-12 text-base rounded-[12px] border-[var(--card-border)]"
                disabled={loading}
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-[var(--card-border)]/50 gap-3 flex flex-row justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="min-h-[44px] px-5 rounded-[12px] font-bold text-sm border border-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--primary-soft)] cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="min-h-[44px] px-6 rounded-[12px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-sm cursor-pointer shadow-xs"
            >
              {loading ? 'Saving...' : isEditing ? 'Update Student' : 'Save Student'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
