export interface StudentProfile {
  name: string
  classLevel: string
  section: string
  rollNumber: string
  admissionNo: string
  academyName: string
  parentName: string
  phone: string
  avatarUrl?: string
}

export interface AttendanceSummary {
  percentage: number
  totalDays: number
  presentDays: number
  absentDays: number
  todayStatus: 'present' | 'absent' | 'holiday'
  currentMonth: string
}

export interface FeeSummary {
  status: 'cleared' | 'pending' | 'overdue'
  currentMonth: string
  monthlyFee: number
  paidAmount: number
  dueAmount: number
  lastPaidDate: string
  receiptNumber: string
}

export interface ClassPeriod {
  id: string
  periodNumber: number
  subject: string
  topic: string
  timeRange: string
  teacherName: string
  room: string
  status: 'completed' | 'ongoing' | 'upcoming'
  colorKey: 'primary' | 'emerald' | 'amber' | 'blue'
}

export interface HomeworkItem {
  id: string
  subject: string
  title: string
  dueDate: string
  isSubmitted: boolean
}

export interface AnnouncementItem {
  id: string
  title: string
  description: string
  date: string
  category: 'Exam' | 'Event' | 'Holiday' | 'Academic'
  isUrgent?: boolean
}

export const MOCK_STUDENT: StudentProfile = {
  name: 'Rahul Sharma',
  classLevel: 'Class 10',
  section: 'Section A',
  rollNumber: '14',
  admissionNo: 'AK-2026-088',
  academyName: 'Akshara Academy',
  parentName: 'Suresh Sharma',
  phone: '+91 98765 43210',
}

export const MOCK_ATTENDANCE: AttendanceSummary = {
  percentage: 95.5,
  totalDays: 22,
  presentDays: 21,
  absentDays: 1,
  todayStatus: 'present',
  currentMonth: 'November 2026',
}

export const MOCK_FEE: FeeSummary = {
  status: 'cleared',
  currentMonth: 'November 2026',
  monthlyFee: 1000,
  paidAmount: 1000,
  dueAmount: 0,
  lastPaidDate: '05 Nov 2026',
  receiptNumber: 'RCP-2026-11-042',
}

export const MOCK_SCHEDULE: ClassPeriod[] = [
  {
    id: 'p1',
    periodNumber: 1,
    subject: 'Mathematics',
    topic: 'Quadratic Equations & Roots Formula',
    timeRange: '09:30 AM – 10:45 AM',
    teacherName: 'Mr. Suresh Sharma',
    room: 'Room 204',
    status: 'completed',
    colorKey: 'primary',
  },
  {
    id: 'p2',
    periodNumber: 2,
    subject: 'Physics',
    topic: 'Ray Optics: Concave & Convex Mirrors',
    timeRange: '11:15 AM – 12:30 PM',
    teacherName: 'Dr. Anita Rao',
    room: 'Science Lab 2',
    status: 'ongoing',
    colorKey: 'emerald',
  },
  {
    id: 'p3',
    periodNumber: 3,
    subject: 'English Literature',
    topic: 'First Flight: Chapter 4 Discussion',
    timeRange: '02:00 PM – 03:15 PM',
    teacherName: 'Mrs. Verma',
    room: 'Room 102',
    status: 'upcoming',
    colorKey: 'blue',
  },
  {
    id: 'p4',
    periodNumber: 4,
    subject: 'Chemistry',
    topic: 'Periodic Classification & Trends',
    timeRange: '03:30 PM – 04:45 PM',
    teacherName: 'Mr. K. R. Rao',
    room: 'Lab 1',
    status: 'upcoming',
    colorKey: 'amber',
  },
]

export const MOCK_HOMEWORK: HomeworkItem[] = [
  {
    id: 'hw1',
    subject: 'Mathematics',
    title: 'Solve NCERT Exercise 4.3 (Q1 to Q8)',
    dueDate: 'Tomorrow, 09:30 AM',
    isSubmitted: false,
  },
  {
    id: 'hw2',
    subject: 'Physics',
    title: 'Draw ray diagrams for lens focal lengths',
    dueDate: '16 Nov 2026',
    isSubmitted: true,
  },
  {
    id: 'hw3',
    subject: 'English',
    title: 'Write 150-word character sketch of Lencho',
    dueDate: '17 Nov 2026',
    isSubmitted: false,
  },
]

export const MOCK_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: 'ann1',
    title: 'Mid-Term Board Prep Examination Schedule',
    description: 'Practical exams begin 20 Nov 2026. Hall tickets available in the office.',
    date: '12 Nov 2026',
    category: 'Exam',
    isUrgent: true,
  },
  {
    id: 'ann2',
    title: 'Annual Science & Tech Fair 2026',
    description: 'Working model registrations open until Saturday for Class 9 and 10.',
    date: '10 Nov 2026',
    category: 'Event',
  },
]

