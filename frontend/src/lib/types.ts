export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: 'teacher' | 'student'
  is_staff: boolean
  date_joined: string
}

export interface Batch {
  id: number
  name: string
  student_class: number
  description: string
  is_active: boolean
  display_name: string
  student_count: number
  created_at: string
  updated_at: string
}

export interface Student {
  id: number
  student_id: string
  name: string
  phone: string
  student_class: number
  student_class_display: string
  roll: number
  ssc_session: number
  batch: Batch | null
  batch_id: number | null
  payment_start_month: number
  payment_start_year: number
  address: string
  parent_name: string
  parent_phone: string
  date_added: string
  is_active: boolean
  unpaid_months_count: number
  overall_percentage: number
  new_password?: string
}

export interface Payment {
  id: number
  student: Student
  student_id: number
  year: number
  month: number
  month_name: string
  amount: number
  is_paid: boolean
  paid_date: string | null
  notes: string
  date_created: string
}

export interface Exam {
  id: number
  name: string
  exam_class: number
  exam_class_display: string
  batch: Batch | null
  batch_id: number | null
  total_marks: number
  description: string
  date_created: string
  exam_date: string
  is_published: boolean
  student_count: number
  results_entered_count: number
  is_upcoming: boolean
}

export interface ExamResult {
  id: number
  exam: Exam
  exam_id: number
  student: Student
  student_id: number
  marks_obtained: number | null
  is_absent: boolean
  percentage: number | null
  date_recorded: string
  notes: string
}

export interface Notice {
  id: number
  title: string
  content: string
  student_class: number | null
  student_class_display: string
  batch: Batch | null
  batch_id: number | null
  priority: 'low' | 'normal' | 'high' | 'urgent'
  is_active: boolean
  created_by: number | null
  created_by_name: string | null
  created_at: string
  updated_at: string
  expires_at: string | null
  is_expired: boolean
}

export interface Homework {
  id: number
  title: string
  description: string
  student_class: number
  student_class_display: string
  batch: Batch | null
  batch_id: number | null
  assigned_date: string
  due_date: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  is_active: boolean
  created_by: number | null
  created_by_name: string | null
  created_at: string
  updated_at: string
  submission_count: number
  is_overdue: boolean
  submission_status?: string
}

export interface HomeworkSubmission {
  id: number
  homework: Homework
  student: Student
  content: string
  attachment: string | null
  status: 'pending' | 'submitted' | 'late' | 'graded'
  submitted_at: string | null
  graded_at: string | null
  marks: number | null
  feedback: string
  graded_by: number | null
  graded_by_name: string | null
}

export interface Attendance {
  id: number
  student: Student
  student_id: number
  date: string
  status: 'present' | 'absent' | 'late' | 'excused'
  status_display: string
  notes: string
  recorded_by: number | null
  recorded_by_name: string | null
  created_at: string
  updated_at: string
}

export interface AttendanceSession {
  id: number
  student_class: number
  student_class_display: string
  batch: Batch | null
  batch_id: number | null
  date: string
  taken_by: number | null
  taken_by_name: string | null
  created_at: string
  is_completed: boolean
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ApiError {
  detail: string
  [key: string]: unknown
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface StudentLoginCredentials {
  student_id: string
  password: string
}

export interface AuthResponse {
  access: string
  refresh: string
  user?: User
  student?: Student
}