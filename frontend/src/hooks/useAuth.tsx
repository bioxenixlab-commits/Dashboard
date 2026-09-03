import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api, setAuthTokens, clearAuthTokens, getAccessToken } from '@/lib/api'
import { User, Student, AuthResponse, StudentLoginCredentials, LoginCredentials } from '@/lib/types'

interface AuthContextType {
  user: User | null
  student: Student | null
  isLoading: boolean
  isAuthenticated: boolean
  isTeacher: boolean
  isStudent: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  studentLogin: (credentials: StudentLoginCredentials) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [student, setStudent] = useState<Student | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await api.post('/auth/teacher/login/', credentials)
      return response.data as AuthResponse
    },
    onSuccess: (data) => {
      setAuthTokens(data.access, data.refresh)
      if (data.user) setUser(data.user)
    },
  })

  const studentLoginMutation = useMutation({
    mutationFn: async (credentials: StudentLoginCredentials) => {
      const response = await api.post('/auth/student/login/', credentials)
      return response.data as AuthResponse
    },
    onSuccess: async (data) => {
      setAuthTokens(data.access, data.refresh)
      if (data.student) setStudent(data.student)
      // Also fetch and set user for persistence (user.role === 'student')
      try {
        const uRes = await api.get('/auth/teacher/me/')
        setUser(uRes.data)
      } catch {}
    },
  })

  const fetchUser = async () => {
    const token = getAccessToken()
    if (!token) {
      setIsLoading(false)
      return
    }

    try {
      const response = await api.get('/auth/teacher/me/')
      const u = response.data
      setUser(u)
      // If this is a student user, also fetch Student profile for persistence
      if (u?.role === 'student') {
        try {
          const sRes = await api.get('/auth/student/me/')
          setStudent(sRes.data)
        } catch {}
      }
    } catch {
      try {
        const response = await api.get('/auth/student/me/')
        setStudent(response.data)
        // Also try to get user for isTeacher/isStudent checks
        try {
          const uRes = await api.get('/auth/teacher/me/')
          setUser(uRes.data)
        } catch {}
      } catch {
        clearAuthTokens()
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()
  }, [])

  const login = async (credentials: LoginCredentials) => {
    await loginMutation.mutateAsync(credentials)
  }

  const studentLogin = async (credentials: StudentLoginCredentials) => {
    await studentLoginMutation.mutateAsync(credentials)
  }

  const logout = async () => {
    const refresh = localStorage.getItem('refresh_token')
    try {
      // Determine logout endpoint based on role
      const isStudent = user?.role === 'student' || !!student
      const endpoint = isStudent ? '/auth/student/logout/' : '/auth/teacher/logout/'
      if (refresh) {
        await api.post(endpoint, { refresh })
      }
    } catch {
      // ignore blacklist failure, still clear local tokens
    } finally {
      clearAuthTokens()
      setUser(null)
      setStudent(null)
    }
  }

  const refreshUser = async () => {
    await fetchUser()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        student,
        isLoading,
        isAuthenticated: !!user || !!student,
        isTeacher: user?.role === 'teacher',
        isStudent: user?.role === 'student' || !!student,
        login,
        studentLogin,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}