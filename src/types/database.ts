export interface Student {
  id: string
  admission_no: string | null
  full_name: string
  class_level: string // e.g. "Class 9", "Class 10"
  school: string | null
  parent_name: string
  phone: string // Stored as +91XXXXXXXXXX
  address: string | null
  admission_date: string | null
  whatsapp_opt_in: boolean
  monthly_fee: number
  fee_due_day: number
  status: 'active' | 'inactive'
  notes: string | null
  created_at?: string
}

export interface StudentFormData {
  full_name: string
  admission_no: string
  class_level: string
  school: string
  parent_name: string
  phone: string
  address: string
  admission_date: string
  whatsapp_opt_in: boolean
  monthly_fee: number
  fee_due_day: number
  status: 'active' | 'inactive'
  notes: string
}

export interface AttendanceRecord {
  id?: string
  student_id: string
  att_date: string
  status: 'present' | 'absent'
  marked_by?: string | null
  created_at?: string
}

export interface StudentAttendanceItem {
  student: Student
  status: 'present' | 'absent'
  attendanceId?: string
}

export const CLASS_OPTIONS = [
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
  'Class 11',
  'Class 12',
] as const
