import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Filter, Loader2, BookOpen, Eye, Download, X, Check, Clock } from 'lucide-react'
import { api } from '@/lib/api'
import { Homework, HomeworkSubmission, Batch, PaginatedResponse } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Input'
import { Select } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import { Dropdown } from '@/components/ui/Dropdown'
import { SearchInput } from '@/components/ui/SearchInput'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/hooks/useToast'
import { cn, getBatchDisplayName, getClassLabel, formatDate } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const homeworkSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  student_class: z.number().min(6).max(10),
  batch_id: z.number().nullable().optional(),
  assigned_date: z.string().min(1, 'Assigned date is required'),
  due_date: z.string().min(1, 'Due date is required'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  is_active: z.boolean().default(true),
})

type HomeworkFormData = z.infer<typeof homeworkSchema>

const CLASS_OPTIONS = [
  { value: 6, label: 'Class 6' },
  { value: 7, label: 'Class 7' },
  { value: 8, label: 'Class 8' },
  { value: 9, label: 'Class 9' },
  { value: 10, label: 'Class 10' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'late', label: 'Late' },
  { value: 'graded', label: 'Graded' },
]

export function HomeworkTab() {
  const queryClient = useQueryClient()
  const { success: toastSuccess, error: toastError } = useToast()
  const [search, setSearch] = useState('')
  const [selectedClass, setSelectedClass] = useState<number | ''>('')
  const [selectedBatch, setSelectedBatch] = useState<number | ''>('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null)
  const [viewSubmissions, setViewSubmissions] = useState<Homework | null>(null)
  const [submissionsData, setSubmissionsData] = useState<HomeworkSubmission[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<Homework | null>(null)

  // Fetch all batches for filter + modal
  const { data: allBatchesData } = useQuery({
    queryKey: ['batches', 'all'],
    queryFn: async () => {
      const response = await api.get(`/batches/`)
      return Array.isArray(response.data) ? response.data : response.data.results || []
    },
  })
  const allBatches = Array.isArray(allBatchesData) ? allBatchesData : []
  const batches = selectedClass ? allBatches.filter((b: Batch) => b.student_class === selectedClass) : allBatches

  // Fetch homework
  const { data: homeworkData, isLoading } = useQuery<PaginatedResponse<Homework>>({
    queryKey: ['homework', { search, class: selectedClass, batch: selectedBatch }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (selectedClass) params.append('class', selectedClass.toString())
      if (selectedBatch) params.append('batch', selectedBatch.toString())
      const response = await api.get(`/homework/?${params.toString()}`)
      return response.data
    },
  })

  // Create homework mutation
  const createMutation = useMutation({
    mutationFn: async (data: HomeworkFormData) => {
      const response = await api.post('/homework/', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] })
      toastSuccess('Homework created successfully')
      setIsModalOpen(false)
      setEditingHomework(null)
    },
    onError: (error: Error) => toastError(error.message),
  })

  // Update homework mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: HomeworkFormData }) => {
      const response = await api.patch(`/homework/${id}/`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] })
      toastSuccess('Homework updated successfully')
      setIsModalOpen(false)
      setEditingHomework(null)
    },
    onError: (error: Error) => toastError(error.message),
  })

  // Delete homework mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/homework/${id}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] })
      toastSuccess('Homework deleted')
      setDeleteConfirm(null)
    },
    onError: (error: Error) => toastError(error.message),
  })

  // Fetch submissions
  const fetchSubmissions = async (homework: Homework) => {
    try {
      const response = await api.get(`/homework/${homework.id}/submissions/`)
      setSubmissionsData(response.data)
      setViewSubmissions(homework)
    } catch (error) {
      console.error('Failed to load submissions:', error)
    }
  }

  // Grade submission mutation
  const gradeMutation = useMutation({
    mutationFn: async ({ homeworkId, studentId, data }: { homeworkId: number; studentId: number; data: { marks: number; feedback: string; status: string } }) => {
      const response = await api.patch(`/homework/submissions/${studentId}/grade/`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] })
      if (viewSubmissions) fetchSubmissions(viewSubmissions)
      toastSuccess('Submission graded')
    },
    onError: (error: Error) => toastError(error.message),
  })

  const handleDelete = (homework: Homework) => {
    setDeleteConfirm(homework)
  }

  const handleEdit = (homework: Homework) => {
    setEditingHomework(homework)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setEditingHomework(null)
    setIsModalOpen(true)
  }

  const classOptions = CLASS_OPTIONS.map(c => ({ value: c.value, label: c.label }))
  const batchOptions = batches.map(b => ({ value: b.id, label: b.display_name }))

  const columns = [
    { key: 'title', header: 'Title' },
    { 
      key: 'student_class', 
      header: 'Class',
      render: (hw: Homework) => <Badge variant="primary">{getClassLabel(hw.student_class)}</Badge>
    },
    { 
      key: 'batch', 
      header: 'Batch',
      render: (hw: Homework) => <Badge variant="gray">{getBatchDisplayName(hw.batch)}</Badge>
    },
    { 
      key: 'assigned_date', 
      header: 'Assigned',
      render: (hw: Homework) => formatDate(hw.assigned_date)
    },
    { 
      key: 'due_date', 
      header: 'Due Date',
      render: (hw: Homework) => (
        <span className={cn(hw.is_overdue && 'text-red-600 font-medium')}>
          {formatDate(hw.due_date)} {hw.is_overdue && <Clock className="w-3 h-3 inline ml-1" />}
        </span>
      )
    },
    { 
      key: 'submission_count', 
      header: 'Submissions',
      render: (hw: Homework) => hw.submission_count
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (hw: Homework) => (
        <div className="flex items-center space-x-1">
          <button
            onClick={() => fetchSubmissions(hw)}
            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
            title="View Submissions"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleEdit(hw)}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(hw)}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
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
          <h2 className="text-xl font-semibold text-gray-800">Homework Management</h2>
          <p className="text-sm text-gray-500">Assign and track homework for students</p>
        </div>
        <Button onClick={handleAdd} className="flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Add Homework
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search homework by title..."
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

      {/* Homework Table */}
      <Card>
        <CardContent className="p-0">
          <Table
            data={homeworkData?.results || []}
            columns={columns}
            keyExtractor={(h) => h.id}
            isLoading={isLoading}
            emptyMessage="No homework found. Create homework to get started."
            hoverable
          />
        </CardContent>
      </Card>

      {/* Add/Edit Homework Modal */}
      <HomeworkFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingHomework(null); }}
        homework={editingHomework}
        batches={allBatches}
        onSubmit={(data) => editingHomework ? updateMutation.mutate({ id: editingHomework.id, data }) : createMutation.mutate(data)}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* View Submissions Modal */}
      <SubmissionsModal
        isOpen={!!viewSubmissions}
        onClose={() => { setViewSubmissions(null); setSubmissionsData([]); }}
        homework={viewSubmissions}
        submissions={submissionsData}
        onGrade={gradeMutation.mutate}
        isGrading={gradeMutation.isPending}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteMutation.mutate(deleteConfirm!.id)}
        title="Delete Homework"
        message={`Are you sure you want to delete "${deleteConfirm?.title}"?`}
        confirmText="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

// Homework Form Modal
function HomeworkFormModal({ 
  isOpen, 
  onClose, 
  homework, 
  batches, 
  onSubmit, 
  isLoading 
}: { 
  isOpen: boolean
  onClose: () => void
  homework: Homework | null
  batches: Batch[]
  onSubmit: (data: HomeworkFormData) => void
  isLoading: boolean
}) {
  const [selectedClass, setSelectedClass] = useState<number>(6)
  const filteredBatches = batches.filter(b => b.student_class === selectedClass)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<HomeworkFormData>({
    resolver: zodResolver(homeworkSchema),
    defaultValues: {
      title: '',
      description: '',
      student_class: 6,
      batch_id: null,
      assigned_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      priority: 'normal',
      is_active: true,
    },
  })

  useEffect(() => {
    if (isOpen) {
      if (homework) {
        reset({
          title: homework.title,
          description: homework.description,
          student_class: homework.student_class,
          batch_id: homework.batch_id || null,
          assigned_date: homework.assigned_date,
          due_date: homework.due_date,
          priority: homework.priority,
          is_active: homework.is_active,
        })
        setSelectedClass(homework.student_class)
      } else {
        reset({
          title: '',
          description: '',
          student_class: 6,
          batch_id: null,
          assigned_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          priority: 'normal',
          is_active: true,
        })
        setSelectedClass(6)
      }
    }
  }, [isOpen, homework, reset])

  const handleClassChange = (value: number) => {
    setSelectedClass(value)
    setValue('batch_id', null)
    setValue('student_class', value)
  }

  const handleBatchChange = (value: number | null) => {
    setValue('batch_id', value || undefined)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={homework ? 'Edit Homework' : 'Add Homework'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="title">Title *</Label>
          <Input id="title" {...register('title')} placeholder="e.g., Chapter 5 Exercises, Essay on..." />
          {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
        </div>
        <div>
          <Label htmlFor="description">Description *</Label>
          <Textarea id="description" {...register('description')} rows={4} placeholder="Describe the homework assignment" />
          {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="student_class">Class *</Label>
            <Select
              id="student_class"
              {...register('student_class', { valueAsNumber: true })}
              onChange={(e) => handleClassChange(Number(e.target.value))}
              value={selectedClass}
            >
              {CLASS_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="batch_id">Batch (Optional)</Label>
            <Select
              id="batch_id"
              onChange={(e) => handleBatchChange(e.target.value ? Number(e.target.value) : null)}
              value={watch('batch_id') || ''}
            >
              <option value="">Select Batch (Optional)</option>
              {filteredBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>{batch.display_name}</option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-gray-400">Only shows batches for selected class</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="assigned_date">Assigned Date *</Label>
            <Input id="assigned_date" type="date" {...register('assigned_date')} />
            {errors.assigned_date && <p className="mt-1 text-sm text-red-600">{errors.assigned_date.message}</p>}
          </div>
          <div>
            <Label htmlFor="due_date">Due Date *</Label>
            <Input id="due_date" type="date" {...register('due_date')} />
            {errors.due_date && <p className="mt-1 text-sm text-red-600">{errors.due_date.message}</p>}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="is_active"
            {...register('is_active')}
            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          />
          <Label htmlFor="is_active" className="mb-0">Active</Label>
        </div>
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 mr-2" /> : null}
            {homework ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// Submissions Modal
function SubmissionsModal({ 
  isOpen, 
  onClose, 
  homework, 
  submissions, 
  onGrade, 
  isGrading 
}: { 
  isOpen: boolean
  onClose: () => void
  homework: Homework | null
  submissions: HomeworkSubmission[]
  onGrade: (data: { homeworkId: number; studentId: number; data: { marks: number; feedback: string; status: string } }) => void
  isGrading: boolean
}) {
  const [gradingSubmission, setGradingSubmission] = useState<HomeworkSubmission | null>(null)
  const [gradeForm, setGradeForm] = useState({ marks: '', feedback: '', status: 'graded' })

  if (!homework) return null

  const openGradeModal = (submission: HomeworkSubmission) => {
    setGradingSubmission(submission)
    setGradeForm({ 
      marks: submission.marks?.toString() || '', 
      feedback: submission.feedback || '', 
      status: submission.status === 'submitted' || submission.status === 'late' ? 'graded' : submission.status
    })
  }

  const handleGradeSubmit = () => {
    if (!gradingSubmission) return
    const marks = parseInt(gradeForm.marks)
    if (isNaN(marks)) return
    onGrade({
      homeworkId: homework.id,
      studentId: gradingSubmission.student.id,
      data: {
        marks,
        feedback: gradeForm.feedback,
        status: gradeForm.status,
      }
    })
    setGradingSubmission(null)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Submissions - ${homework.title}`}
      size="xl"
    >
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="font-medium text-gray-800">{homework.title}</p>
          <p className="text-sm text-gray-500">
            {getClassLabel(homework.student_class)} | {getBatchDisplayName(homework.batch)} | Due: {formatDate(homework.due_date)}
          </p>
        </div>
        
        <Table
          data={submissions}
          columns={[
            { key: 'student.student_id', header: 'Student ID', render: (s: HomeworkSubmission) => <code className="text-sm">{s.student.student_id}</code> },
            { key: 'student.name', header: 'Name', render: (s: HomeworkSubmission) => <span className="font-medium">{s.student.name}</span> },
            { key: 'status', header: 'Status', render: (s: HomeworkSubmission) => {
              const variants = {
                pending: 'gray' as const,
                submitted: 'info' as const,
                late: 'warning' as const,
                graded: 'success' as const,
              }
              return <Badge variant={variants[s.status]}>{s.status}</Badge>
            }},
            { key: 'submitted_at', header: 'Submitted', render: (s: HomeworkSubmission) => s.submitted_at ? formatDate(s.submitted_at) : '-' },
            { key: 'marks', header: 'Marks', render: (s: HomeworkSubmission) => s.marks !== null ? s.marks : '-' },
            { key: 'feedback', header: 'Feedback', render: (s: HomeworkSubmission) => s.feedback || '-' },
            {
              key: 'actions',
              header: 'Actions',
              render: (s: HomeworkSubmission) => (
                <button
                  onClick={() => openGradeModal(s)}
                  disabled={isGrading}
                  className="p-1.5 text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                  title="Grade"
                >
                  <Check className="w-4 h-4" />
                </button>
              ),
            },
          ]}
          keyExtractor={(s) => s.id}
          isLoading={false}
          emptyMessage="No submissions yet"
          hoverable
        />

        {/* Grade Modal */}
        <Modal
          isOpen={!!gradingSubmission}
          onClose={() => setGradingSubmission(null)}
          title={`Grade - ${gradingSubmission?.student.name}`}
          size="md"
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="marks">Marks *</Label>
              <Input 
                id="marks" 
                type="number" 
                value={gradeForm.marks}
                onChange={(e) => setGradeForm(prev => ({ ...prev, marks: e.target.value }))}
                min="0"
              />
            </div>
            <div>
              <Label htmlFor="feedback">Feedback</Label>
              <Textarea
                id="feedback"
                value={gradeForm.feedback}
                onChange={(e) => setGradeForm(prev => ({ ...prev, feedback: e.target.value }))}
                rows={3}
                placeholder="Enter feedback for the student"
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                value={gradeForm.status}
                onChange={(e) => setGradeForm(prev => ({ ...prev, status: e.target.value }))}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setGradingSubmission(null)}>
                Cancel
              </Button>
              <Button onClick={handleGradeSubmit} loading={isGrading}>
                Save Grade
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Modal>
  )
}

