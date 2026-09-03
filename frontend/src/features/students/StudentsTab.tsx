import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, Filter, Edit, Trash2, Key, X, ChevronDown } from 'lucide-react'
import { api } from '@/lib/api'
import { Student, Batch, PaginatedResponse } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Input'
import { Select } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import { Dropdown } from '@/components/ui/Dropdown'
import { SearchInput } from '@/components/ui/SearchInput'
import { Badge } from '@/components/ui/Badge'
import { StudentFormModal } from './StudentFormModal'
import { useToast } from '@/hooks/useToast'
import { cn, getBatchDisplayName, getClassLabel } from '@/lib/utils'
import { getMonthName } from '@/lib/utils'

const CLASS_OPTIONS = [
  { value: 6, label: 'Class 6' },
  { value: 7, label: 'Class 7' },
  { value: 8, label: 'Class 8' },
  { value: 9, label: 'Class 9' },
  { value: 10, label: 'Class 10' },
]

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: getMonthName(i + 1),
}))

export function StudentsTab() {
  const queryClient = useQueryClient()
  const { success: toastSuccess, error: toastError } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [selectedClass, setSelectedClass] = useState<number | ''>('')
  const [selectedBatch, setSelectedBatch] = useState<number | ''>('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ student: Student; onConfirm: () => void } | null>(null)

  // Fetch students
  const { data: studentsData, isLoading } = useQuery<PaginatedResponse<Student>>({
    queryKey: ['students', { search, class: selectedClass, batch: selectedBatch }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (selectedClass) params.append('class', selectedClass.toString())
      if (selectedBatch) params.append('batch', selectedBatch.toString())
      const response = await api.get(`/students/?${params.toString()}`)
      return response.data
    },
  })

  // Fetch all batches for filter + modal (modal filters by its own class)
  const { data: allBatchesData } = useQuery({
    queryKey: ['batches', 'all'],
    queryFn: async () => {
      const response = await api.get(`/batches/`)
      // Handle paginated response
      return Array.isArray(response.data) ? response.data : response.data.results || []
    },
  })
  const allBatches = Array.isArray(allBatchesData) ? allBatchesData : []
  // Filtered for the filter dropdown (show only batches of selected class)
  const batches = selectedClass ? allBatches.filter((b: Batch) => b.student_class === selectedClass) : allBatches

  // Create student mutation
  const createMutation = useMutation({
    mutationFn: async (data: Partial<Student>) => {
      const response = await api.post('/students/', data)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toastSuccess('Student added successfully')
      setIsModalOpen(false)
      setEditingStudent(null)
      if (data?.new_password) {
        // Show newly generated password once
        const studentName = data.name || 'New Student'
        const studentCode = data.student_id || ''
        setResetResult({ student: { id: data.id, name: studentName, student_id: studentCode } as Student, password: data.new_password })
      }
    },
    onError: (error: any) => {
      const msg = error.response?.data ? JSON.stringify(error.response.data) : error.message
      toastError(msg)
    },
  })

  // Update student mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Student> }) => {
      const response = await api.patch(`/students/${id}/`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toastSuccess('Student updated successfully')
      setIsModalOpen(false)
      setEditingStudent(null)
    },
    onError: (error: any) => {
      const msg = error.response?.data ? JSON.stringify(error.response.data) : error.message
      toastError(msg)
    },
  })

  // Delete student mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/students/${id}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toastSuccess('Student deleted')
      setDeleteConfirm(null)
    },
    onError: (error: Error) => toastError(error.message),
  })

  const [resetResult, setResetResult] = useState<{ student: Student; password: string } | null>(null)

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.post(`/students/${id}/reset_password/`)
      return response.data
    },
    onSuccess: (data, studentId) => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      const student = studentsData?.results?.find((s: Student) => s.id === studentId) || { id: studentId, name: 'Student' } as Student
      setResetResult({ student, password: data.new_password })
    },
    onError: (error: Error) => toastError(error.message),
  })

  const handleDelete = (student: Student) => {
    setDeleteConfirm({
      student,
      onConfirm: () => deleteMutation.mutate(student.id),
    })
  }

  const handleEdit = (student: Student) => {
    setEditingStudent(student)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setEditingStudent(null)
    setIsModalOpen(true)
  }

  const classOptions = CLASS_OPTIONS.map((c) => ({ value: c.value, label: c.label }))
  const batchOptions = batches.map((b) => ({ value: b.id, label: b.display_name }))

  const columns = [
    { key: 'student_id', header: 'ID' },
    { key: 'name', header: 'Name' },
    { 
      key: 'student_class', 
      header: 'Class',
      render: (student: Student) => (
        <span className="font-medium">{getClassLabel(student.student_class)}</span>
      )
    },
    { 
      key: 'batch', 
      header: 'Batch',
      render: (student: Student) => (
        <Badge variant="gray">{getBatchDisplayName(student.batch)}</Badge>
      )
    },
    { key: 'roll', header: 'Roll' },
    { key: 'phone', header: 'Phone' },
    { 
      key: 'ssc_session', 
      header: 'SSC Session',
      render: (student: Student) => `${student.ssc_session}`
    },
    { 
      key: 'payment_start', 
      header: 'Payment From',
      render: (student: Student) => (
        <span className="text-sm">
          {getMonthName(student.payment_start_month)} {student.payment_start_year}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (student: Student) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleEdit(student)}
            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(student)}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => resetPasswordMutation.mutate(student.id)}
            disabled={resetPasswordMutation.isPending}
            className="p-1.5 text-purple-500 hover:bg-purple-50 rounded-lg transition-colors"
            title="Reset Password"
          >
            <Key className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Student Management</h2>
          <p className="text-sm text-gray-500">Manage student records, batches, and credentials</p>
        </div>
        <Button onClick={handleAdd} className="flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Add Student
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, or phone..."
            className="flex-1 max-w-md"
          />
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
        </div>
      </Card>

      {/* Students Table */}
      <Card>
        <CardContent className="p-0">
          <Table
            data={studentsData?.results || []}
            columns={columns}
            keyExtractor={(s) => s.id}
            isLoading={isLoading}
            emptyMessage="No students found"
            hoverable
          />
        </CardContent>
      </Card>

      {/* Pagination */}
      {studentsData && (studentsData.next || studentsData.previous) && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {studentsData.results.length} of {studentsData.count} students
          </p>
          <div className="flex space-x-2">
            {studentsData.previous && (
              <Button variant="ghost" size="sm" onClick={() => setSearchParams(new URLSearchParams(studentsData.previous!).get('page') || '1')}>
                Previous
              </Button>
            )}
            {studentsData.next && (
              <Button variant="ghost" size="sm" onClick={() => setSearchParams(new URLSearchParams(studentsData.next!).get('page') || '1')}>
                Next
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <StudentFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingStudent(null); }}
        student={editingStudent}
        batches={allBatches}
        onSubmit={(data) => editingStudent ? updateMutation.mutate({ id: editingStudent.id, data }) : createMutation.mutate(data)}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={deleteConfirm?.onConfirm || (() => {})}
        title="Delete Student"
        message={`Are you sure you want to delete ${deleteConfirm?.student.name} (${deleteConfirm?.student.student_id})? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />

      {/* Reset Password Result Modal - plaintext shown once */}
      <Modal
        isOpen={!!resetResult}
        onClose={() => setResetResult(null)}
        title="Password Reset Successful"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Temporary password for <span className="font-medium">{resetResult?.student.name}</span> ({resetResult?.student.student_id}):
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm font-mono break-all">{resetResult?.password}</code>
            <Button
              size="sm"
              onClick={() => {
                if (resetResult?.password) {
                  navigator.clipboard.writeText(resetResult.password)
                  toastSuccess('Copied to clipboard')
                }
              }}
            >
              Copy
            </Button>
          </div>
          <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">Copy now — this password will not be shown again. Communicate it securely to the student.</p>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setResetResult(null)}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
