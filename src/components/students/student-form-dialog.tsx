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
import { MessageSquare, AlertCircle, AlertTriangle } from 'lucide-react'
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

  async function handleSubmit(e: React.FormEvent, forceSave = false) {
    e.preventDefault()
    setFormError(null)

    // Required fields check
    if (!fullName.trim()) {
      setFormError('Student full name is required.')
      return
    }
    if (!classLevel) {
      setFormError('Class level is required.')
      return
    }
    if (!parentName.trim()) {
      setFormError("Parent's name is required.")
      return
    }

    // Phone validation
    const parsedPhone = parseAndFormatIndianPhone(phone)
    if (!parsedPhone.isValid) {
      setPhoneError(parsedPhone.error || 'Please enter a valid 10-digit Indian mobile number.')
      setFormError('Please correct the phone number error.')
      return
    }
    setPhoneError(null)

    const supabase = createClient()
    setLoading(true)

    try {
      // Duplicate check: if another active student has same name and phone
      if (!forceSave) {
        let duplicateQuery = supabase
          .from('students')
          .select('id, full_name, phone')
          .eq('status', 'active')
          .ilike('full_name', fullName.trim())
          .eq('phone', parsedPhone.phone)

        if (isEditing && studentToEdit?.id) {
          duplicateQuery = duplicateQuery.neq('id', studentToEdit.id)
        }

        const { data: duplicates, error: dupError } = await duplicateQuery

        if (!dupError && duplicates && duplicates.length > 0) {
          setDuplicateWarning(
            `An active student named "${fullName.trim()}" with phone number ${parsedPhone.phone} is already registered.`
          )
          setLoading(false)
          return
        }
      }

      const payload = {
        full_name: fullName.trim(),
        class_level: classLevel,
        school: school.trim() || null,
        parent_name: parentName.trim(),
        phone: parsedPhone.phone,
        address: address.trim() || null,
        admission_date: admissionDate || null,
        admission_no: admissionNo.trim() || null,
        whatsapp_opt_in: whatsappOptIn,
        monthly_fee: Number(fee) || 1000,
        fee_due_day: studentToEdit?.fee_due_day || 5,
        status,
        notes: studentToEdit?.notes || null,
      }

      if (isEditing && studentToEdit?.id) {
        const { error } = await supabase
          .from('students')
          .update(payload)
          .eq('id', studentToEdit.id)

        if (error) throw error
        toast.success(`Student "${fullName.trim()}" updated successfully!`)
      } else {
        const { error } = await supabase.from('students').insert([payload])

        if (error) throw error
        toast.success(`Student "${fullName.trim()}" added to ${classLevel}!`)
      }

      onSaved()
      onOpenChange(false)
    } catch (err: unknown) {
      console.error('Error saving student:', err)
      const msg = err instanceof Error ? err.message : 'Failed to save student.'
      setFormError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">
            {isEditing ? 'Edit Student' : 'Add New Student'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update student and parent details.'
              : 'Enter student and parent information.'}
          </DialogDescription>
        </DialogHeader>

        {formError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
            <AlertCircle className="size-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {duplicateWarning && (
          <div className="p-4 bg-amber-50 text-amber-900 text-sm rounded-md border border-amber-200 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-5 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">Duplicate Student Detected</p>
                <p className="text-amber-800 text-xs mt-0.5">{duplicateWarning}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDuplicateWarning(null)}
                className="bg-white text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={(e) => handleSubmit(e, true)}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-9"
              >
                Save Anyway
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6 pt-2">
          {/* Section 1: Student Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
              Student Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-slate-800 font-medium">
                  Student Name *
                </Label>
                <Input
                  id="full_name"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11 text-base"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="class_level" className="text-slate-800 font-medium">
                  Class *
                </Label>
                <select
                  id="class_level"
                  value={classLevel}
                  onChange={(e) => setClassLevel(e.target.value)}
                  required
                  className="w-full h-11 px-3 rounded-md border border-slate-300 bg-white text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
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
              <div className="space-y-2">
                <Label htmlFor="school" className="text-slate-700">
                  School (Optional)
                </Label>
                <Input
                  id="school"
                  placeholder="e.g. Delhi Public School"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="h-11 text-base"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admission_no" className="text-slate-700">
                  Admission Number (Optional)
                </Label>
                <Input
                  id="admission_no"
                  placeholder="e.g. AK-2026-001"
                  value={admissionNo}
                  onChange={(e) => setAdmissionNo(e.target.value)}
                  className="h-11 text-base"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="admission_date" className="text-slate-700">
                  Admission Date
                </Label>
                <Input
                  id="admission_date"
                  type="date"
                  value={admissionDate}
                  onChange={(e) => setAdmissionDate(e.target.value)}
                  className="h-11 text-base"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className="text-slate-700">
                  Status
                </Label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full h-11 px-3 rounded-md border border-slate-300 bg-white text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  disabled={loading}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="text-slate-700">
                Residential Address (Optional)
              </Label>
              <Input
                id="address"
                placeholder="House No, Street, Area, City"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="h-11 text-base"
                disabled={loading}
              />
            </div>
          </div>

          {/* Section 2: Parent Contact */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
              Parent Contact
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="parent_name" className="text-slate-800 font-medium">
                  Parent Name *
                </Label>
                <Input
                  id="parent_name"
                  required
                  placeholder="e.g. Suresh Sharma"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="h-11 text-base"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-800 font-medium">
                  Parent Mobile Number *
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500 font-mono text-sm">
                    +91
                  </div>
                  <Input
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
                    className={`pl-12 h-11 text-base font-mono ${
                      phoneError ? 'border-red-500 ring-1 ring-red-500' : ''
                    }`}
                    disabled={loading}
                  />
                </div>
                {phoneError ? (
                  <p className="text-xs text-red-600 font-medium">{phoneError}</p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Enter 10-digit mobile number (starts with 6, 7, 8, or 9).
                  </p>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/80">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <Checkbox
                  checked={whatsappOptIn}
                  onCheckedChange={(checked) => setWhatsappOptIn(checked === true)}
                  disabled={loading}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    <MessageSquare className="size-4 text-emerald-600" />
                    Parent agreed to receive WhatsApp messages
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Required to send automated attendance absent alerts and fee reminders to this number.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Section 3: Fee */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
              Fee
            </h3>

            <div className="space-y-2 max-w-sm">
              <Label htmlFor="fee" className="text-slate-800 font-medium">
                Fee (₹) *
              </Label>
              <Input
                id="fee"
                type="number"
                min="0"
                step="50"
                placeholder="1000"
                value={fee}
                onChange={(e) => setFee(Number(e.target.value))}
                className="h-11 text-base"
                disabled={loading}
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="min-h-[44px] px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              {loading ? 'Saving...' : isEditing ? 'Update Student' : 'Save Student'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
