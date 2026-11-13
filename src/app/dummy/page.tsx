import { StudentDashboard } from '../../../dummy/student-dashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Student Dashboard • Akshara Academy',
  description: 'Clean, accessible, student-friendly home dashboard for Akshara App.',
}

export default function DummyStudentPage() {
  return <StudentDashboard />
}

