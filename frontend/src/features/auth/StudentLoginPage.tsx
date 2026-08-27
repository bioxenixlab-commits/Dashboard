import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'

const studentLoginSchema = z.object({
  student_id: z.string().min(1, 'Student ID is required'),
  password: z.string().min(1, 'Password is required'),
})

type StudentLoginForm = z.infer<typeof studentLoginSchema>

export function StudentLoginPage() {
  const navigate = useNavigate()
  const { studentLogin } = useAuth()
  const { error: toastError } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StudentLoginForm>({
    resolver: zodResolver(studentLoginSchema),
  })

  const onSubmit = async (data: StudentLoginForm) => {
    setIsLoading(true)
    try {
      await studentLogin(data)
      navigate('/student')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid credentials'
      toastError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Student Portal</CardTitle>
          <CardDescription>Enter your Student ID and password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="student_id">Student ID</Label>
              <Input
                id="student_id"
                {...register('student_id')}
                placeholder="e.g., 27001"
                disabled={isLoading}
              />
              {errors.student_id && (
                <p className="mt-1 text-sm text-red-600">{errors.student_id.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" loading={isLoading}>
              {isLoading ? <Loader2 className="w-5 h-5 mr-2" /> : null}
              Sign In
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-500">
            Teacher? <a href="/login" className="text-primary-600 hover:underline ml-1">Login here</a>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}