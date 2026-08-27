import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Layout } from '@/components/Layout'
import { LoginPage } from '@/features/auth/LoginPage'
import { StudentLoginPage } from '@/features/auth/StudentLoginPage'
import { TeacherDashboard } from '@/features/dashboard/TeacherDashboard'
import { StudentDashboard } from '@/features/dashboard/StudentDashboard'

function ProtectedRoute({ children, requireTeacher = false, requireStudent = false }: { children: React.ReactNode; requireTeacher?: boolean; requireStudent?: boolean }) {
  const { isAuthenticated, isTeacher, isStudent, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requireTeacher && !isTeacher) {
    return <Navigate to="/login" replace />
  }

  if (requireStudent && !isStudent) {
    return <Navigate to="/student/login" replace />
  }

  return <>{children}</>
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/student/login" element={<StudentLoginPage />} />
      
      <Route element={<ProtectedRoute requireTeacher><Layout /></ProtectedRoute>}>
        <Route path="/" element={<TeacherDashboard />} />
        <Route path="/students" element={<TeacherDashboard defaultTab="students" />} />
        <Route path="/payments" element={<TeacherDashboard defaultTab="payments" />} />
        <Route path="/exams" element={<TeacherDashboard defaultTab="exams" />} />
        <Route path="/notices" element={<TeacherDashboard defaultTab="notices" />} />
        <Route path="/homework" element={<TeacherDashboard defaultTab="homework" />} />
        <Route path="/attendance" element={<TeacherDashboard defaultTab="attendance" />} />
        <Route path="/batches" element={<TeacherDashboard defaultTab="batches" />} />
      </Route>

      <Route element={<ProtectedRoute requireStudent><Layout /></ProtectedRoute>}>
        <Route path="/student" element={<StudentDashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}