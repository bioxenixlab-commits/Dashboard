import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Filter, Calendar, Bell, Loader2, Check, X } from 'lucide-react'
import { api } from '@/lib/api'
import { Student, Payment, PaginatedResponse } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Input'
import { Select } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import { Dropdown } from '@/components/ui/Dropdown'
import { SearchInput } from '@/components/ui/SearchInput'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/hooks/useToast'
import { cn, getMonthName, formatCurrency, getBatchDisplayName, getClassLabel } from '@/lib/utils'

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: getMonthName(i + 1),
}))

const currentYear = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => ({
  value: currentYear - 2 + i,
  label: String(currentYear - 2 + i),
}))

export function PaymentsTab() {
  const queryClient = useQueryClient()
  const { success: toastSuccess, error: toastError } = useToast()
  const [search, setSearch] = useState('')
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedClass, setSelectedClass] = useState<number | ''>('')
  const [selectedBatch, setSelectedBatch] = useState<number | ''>('')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [showStudentDetail, setShowStudentDetail] = useState(false)
  const [studentSearchResults, setStudentSearchResults] = useState<Student[]>([])

  // Fetch unpaid students count for stats
  const { data: unpaidData } = useQuery({
    queryKey: ['unpaid-students', { year: selectedYear, class: selectedClass, batch: selectedBatch }],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('year', selectedYear.toString())
      if (selectedClass) params.append('class', selectedClass.toString())
      if (selectedBatch) params.append('batch', selectedBatch.toString())
      const response = await api.get(`/payments/unpaid_students/?${params.toString()}`)
      return response.data
    },
  })

  // Search students
  const searchStudents = useCallback(async (query: string) => {
    if (!query.trim()) {
      setStudentSearchResults([])
      return
    }
    try {
      const params = new URLSearchParams()
      params.append('q', query)
      params.append('year', selectedYear.toString())
      if (selectedClass) params.append('class', selectedClass.toString())
      if (selectedBatch) params.append('batch', selectedBatch.toString())
      const response = await api.get(`/payments/search/?${params.toString()}`)
      setStudentSearchResults(response.data.students)
    } catch (error) {
      console.error('Search failed:', error)
    }
  }, [selectedYear, selectedClass, selectedBatch])

  // Load student payments
  const loadStudentPayments = async (student: Student) => {
    setSelectedStudent(student)
    setShowStudentDetail(true)
    setStudentSearchResults([])
    setSearch('')
  }

  // Update payment mutation - with optimistic update for instant UI
  const updatePaymentMutation = useMutation({
    mutationFn: async ({ paymentId, isPaid, amount, notes }: { paymentId: number; isPaid: boolean; amount?: number; notes?: string }) => {
      const response = await api.patch(`/payments/${paymentId}/`, { is_paid: isPaid, amount, notes })
      return response.data
    },
    onMutate: async ({ paymentId, isPaid }) => {
      await queryClient.cancelQueries({ queryKey: ['student-payments'] })
      const prev = queryClient.getQueryData(['student-payments', selectedStudent?.id, selectedYear])
      // Optimistically update the student-payments cache
      queryClient.setQueryData(['student-payments', selectedStudent?.id, selectedYear], (old: any) => {
        if (!old) return old
        return old.map((p: any) => p.id === paymentId ? { ...p, is_paid: isPaid, paid_date: isPaid ? new Date().toISOString() : null } : p)
      })
      return { prev }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-payments'] })
      queryClient.invalidateQueries({ queryKey: ['unpaid-students'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toastSuccess('Payment updated')
    },
    onError: (error: Error, _vars, context: any) => {
      if (context?.prev) {
        queryClient.setQueryData(['student-payments', selectedStudent?.id, selectedYear], context.prev)
      }
      toastError(error.message)
    },
  })

  // Bulk update payments
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ paymentIds, isPaid, amount, notes }: { paymentIds: number[]; isPaid: boolean; amount?: number; notes?: string }) => {
      const response = await api.post('/payments/bulk_update/', { payment_ids: paymentIds, is_paid: isPaid, amount, notes })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['unpaid-students'] })
      toastSuccess('Payments updated')
    },
    onError: (error: Error) => toastError(error.message),
  })

  // Notify unpaid
  const notifyMutation = useMutation({
    mutationFn: async ({ class: classId, batch: batchId }: { class?: number; batch?: number }) => {
      const params = new URLSearchParams()
      if (classId) params.append('class', classId.toString())
      if (batchId) params.append('batch', batchId.toString())
      const response = await api.post(`/payments/notify_unpaid/?${params.toString()}`)
      return response.data
    },
    onSuccess: (data) => {
      toastSuccess(`Notifications sent to ${data.results?.length || 0} students`)
    },
    onError: (error: Error) => toastError(error.message),
  })

  // Fetch all batches
  const { data: allBatchesData } = useQuery({
    queryKey: ['batches', 'all'],
    queryFn: async () => {
      const response = await api.get(`/batches/`)
      return Array.isArray(response.data) ? response.data : response.data.results || []
    },
  })
  const allBatches = Array.isArray(allBatchesData) ? allBatchesData : []
  const batches = selectedClass ? allBatches.filter((b: any) => b.student_class === selectedClass) : allBatches

  const classOptions = [
    { value: 6, label: 'Class 6' },
    { value: 7, label: 'Class 7' },
    { value: 8, label: 'Class 8' },
    { value: 9, label: 'Class 9' },
    { value: 10, label: 'Class 10' },
  ].map(c => ({ value: c.value, label: c.label }))

  const batchOptions = batches.map(b => ({ value: b.id, label: b.display_name }))

  // Student detail payments
  const { data: studentPayments } = useQuery({
    queryKey: ['student-payments', selectedStudent?.id, selectedYear],
    queryFn: async () => {
      if (!selectedStudent) return []
      const response = await api.get(`/payments/student_detail/?student_id=${selectedStudent.id}&year=${selectedYear}`)
      return response.data.payments
    },
    enabled: !!selectedStudent && showStudentDetail,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Payment Management</h2>
          <p className="text-sm text-gray-500">Track and manage student fee payments</p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="w-32">
            {YEAR_OPTIONS.map((y) => (
              <option key={y.value} value={y.value}>{y.label}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 max-w-md">
            <SearchInput
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                searchStudents(e.target.value)
              }}
              placeholder="Search student by name, ID, or phone..."
            />
            {studentSearchResults.length > 0 && (
              <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto z-10">
                {studentSearchResults.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => loadStudentPayments(student)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0 text-sm"
                  >
                    <div className="font-medium text-gray-800">{student.name}</div>
                    <div className="text-xs text-gray-500">
                      ID: {student.student_id} | {getClassLabel(student.student_class)} | {getBatchDisplayName(student.batch)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Dropdown
            options={[{ value: '', label: 'All Classes' }, ...classOptions]}
            value={selectedClass}
            onChange={(v) => {
              setSelectedClass(v as number | '')
              setSelectedBatch('')
            }}
            placeholder="Filter by Class"
            className="w-48"
          />
          <Dropdown
            options={[{ value: '', label: 'All Batches' }, ...batchOptions]}
            value={selectedBatch}
            onChange={(v) => setSelectedBatch(v as number | '')}
            placeholder="Filter by Batch"
            className="w-48"
            
          />
          <Button 
            onClick={() => notifyMutation.mutate({ class: selectedClass || undefined, batch: selectedBatch || undefined })}
            loading={notifyMutation.isPending}
            variant="secondary"
            className="flex items-center"
          >
            <Bell className="w-4 h-4 mr-2" />
            Notify Unpaid
          </Button>
        </div>
      </Card>

      {/* Student Detail View */}
      {showStudentDetail && selectedStudent && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">{selectedStudent.name}</CardTitle>
              <p className="text-sm text-gray-500">
                ID: {selectedStudent.student_id} | {getClassLabel(selectedStudent.student_class)} | {getBatchDisplayName(selectedStudent.batch)}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setShowStudentDetail(false); setSelectedStudent(null); }}>
              <X className="w-4 h-4 mr-1" />
              Close
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
              {studentPayments?.map((payment) => (
                <div
                  key={payment.id}
                  className={cn(
                    'bg-white border rounded-lg p-4',
                    payment.is_paid ? 'bg-green-50 border-green-200' : 'border-gray-200'
                  )}
                >
                  <div className="font-medium text-gray-800">{payment.month_name} {payment.year}</div>
                  <div className="text-sm text-gray-500 mt-1">{formatCurrency(payment.amount)}</div>
                  <div className="mt-3 flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`pay_${payment.id}`}
                      checked={payment.is_paid}
                      onChange={(e) => updatePaymentMutation.mutate({ 
                        paymentId: payment.id, 
                        isPaid: e.target.checked 
                      })}
                      disabled={updatePaymentMutation.isPending}
                      className="w-5 h-5 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={`pay_${payment.id}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                      {payment.is_paid ? 'Paid' : 'Mark Paid'}
                    </label>
                  </div>
                  {payment.paid_date && (
                    <div className="mt-2 text-xs text-gray-400">
                      Paid: {new Date(payment.paid_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unpaid Students Summary */}
      {unpaidData && unpaidData.unpaid_students.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Students with Unpaid Fees ({unpaidData.unpaid_students.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {unpaidData.unpaid_students.map((student) => (
                <div key={student.student_id} className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="font-medium text-gray-800">{student.name}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    ID: {student.student_code} | {getClassLabel(student.student_class)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {student.unpaid_months.map((m: {month: number; month_name: string}) => (
                      <Badge key={m.month} variant="danger" className="text-xs">{m.month_name}</Badge>
                    ))}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-2 w-full"
                    onClick={() => loadStudentPayments({ 
                      id: student.student_id, 
                      name: student.name,
                      student_id: student.student_code,
                      phone: student.phone,
                      student_class: student.student_class,
                      batch: null,
                      roll: 0,
                      ssc_session: 0,
                      payment_start_month: 1,
                      payment_start_year: selectedYear,
                      password: '',
                      address: '',
                      parent_name: '',
                      parent_phone: '',
                      date_added: '',
                      is_active: true,
                      unpaid_months_count: 0,
                      overall_percentage: 0,
                    } as Student)}
                  >
                    View Details
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

import { useSearchParams } from 'react-router-dom'
