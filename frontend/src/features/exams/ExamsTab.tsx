import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, ClipboardCheck, BarChart, Search, Filter, Send, Loader2, Eye, Check, X } from 'lucide-react'
import { api } from '@/lib/api'
import { Exam, ExamResult, Batch, PaginatedResponse } from '@/lib/types'
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
import { useToast } from '@/hooks/useToast'
import { cn, getMonthName, getBatchDisplayName, getClassLabel } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const examSchema = z.object({
  name: z.string().min(1, 'Exam name is required'),
  exam_class: z.number().min(6).max(10),
  batch_id: z.number().nullable().optional(),
  total_marks: z.number().min(1).default(100),
  description: z.string().optional(),
  exam_date: z.string().min(1, 'Exam date is required'),
})

type ExamFormData = z.infer<typeof examSchema>

const CLASS_OPTIONS = [
  { value: 6, label: 'Class 6' },
  { value: 7, label: 'Class 7' },
  { value: 8, label: 'Class 8' },
  { value: 9, label: 'Class 9' },
  { value: 10, label: 'Class 10' },
]

export function ExamsTab() {
  const queryClient = useQueryClient()
  const { success: toastSuccess, error: toastError } = useToast()
  const [search, setSearch] = useState('')
  const [selectedClass, setSelectedClass] = useState<number | ''>('')
  const [selectedBatch, setSelectedBatch] = useState<number | ''>('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExam, setEditingExam] = useState<Exam | null>(null)
  const [marksExam, setMarksExam] = useState<Exam | null>(null)
  const [marksResults, setMarksResults] = useState<ExamResult[]>([])
  const [summaryExam, setSummaryExam] = useState<{ exam: Exam; stats: any; ranked: any[] } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Exam | null>(null)

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

  // Fetch exams
  const { data: examsData, isLoading } = useQuery<PaginatedResponse<Exam>>({
    queryKey: ['exams', { search, class: selectedClass, batch: selectedBatch }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (selectedClass) params.append('class', selectedClass.toString())
      if (selectedBatch) params.append('batch', selectedBatch.toString())
      const response = await api.get(`/exams/?${params.toString()}`)
      return response.data
    },
  })

  // Create exam mutation
  const createMutation = useMutation({
    mutationFn: async (data: ExamFormData) => {
      const response = await api.post('/exams/', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toastSuccess('Exam created successfully')
      setIsModalOpen(false)
      setEditingExam(null)
    },
    onError: (error: Error) => toastError(error.message),
  })

  // Update exam mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ExamFormData }) => {
      const response = await api.patch(`/exams/${id}/`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      toastSuccess('Exam updated successfully')
      setIsModalOpen(false)
      setEditingExam(null)
    },
    onError: (error: Error) => toastError(error.message),
  })

  // Delete exam mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/exams/${id}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toastSuccess('Exam deleted')
      setDeleteConfirm(null)
    },
    onError: (error: Error) => toastError(error.message),
  })

  // Bulk update marks mutation
  const updateMarksMutation = useMutation({
    mutationFn: async ({ examId, results }: { examId: number; results: any[] }) => {
      const response = await api.patch(`/exams/${examId}/results/bulk/`, { results })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      queryClient.invalidateQueries({ queryKey: ['exam-results'] })
      toastSuccess('All marks saved successfully')
      setMarksExam(null)
    },
    onError: (error: Error) => toastError(error.message),
  })

  // Publish exam mutation
  const publishMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.post(`/exams/${id}/publish/`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      toastSuccess('Results published successfully')
    },
    onError: (error: Error) => toastError(error.message),
  })

  // Fetch exam results for marks entry
  const fetchExamResults = async (exam: Exam) => {
    setMarksExam(exam)
    try {
      const response = await api.get(`/exams/${exam.id}/results/`)
      setMarksResults(response.data)
    } catch (error) {
      console.error('Failed to load exam results:', error)
    }
  }

  // Fetch exam summary
  const fetchExamSummary = async (exam: Exam) => {
    try {
      const response = await api.get(`/exams/${exam.id}/summary/`)
      setSummaryExam(response.data)
    } catch (error) {
      console.error('Failed to load exam summary:', error)
    }
  }

  const handleDelete = (exam: Exam) => {
    setDeleteConfirm(exam)
  }

  const handleEdit = (exam: Exam) => {
    setEditingExam(exam)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setEditingExam(null)
    setIsModalOpen(true)
  }

  const handleMarks = (exam: Exam) => {
    fetchExamResults(exam)
  }

  const handleSummary = (exam: Exam) => {
    fetchExamSummary(exam)
  }

  const classOptions = CLASS_OPTIONS.map(c => ({ value: c.value, label: c.label }))
  const batchOptions = batches.map(b => ({ value: b.id, label: b.display_name }))

  const columns = [
    { key: 'name', header: 'Exam Name' },
    { 
      key: 'exam_class', 
      header: 'Class',
      render: (exam: Exam) => <Badge variant="primary">{getClassLabel(exam.exam_class)}</Badge>
    },
    { 
      key: 'batch', 
      header: 'Batch',
      render: (exam: Exam) => <Badge variant="gray">{getBatchDisplayName(exam.batch)}</Badge>
    },
    { 
      key: 'exam_date', 
      header: 'Date',
      render: (exam: Exam) => new Date(exam.exam_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    },
    { key: 'total_marks', header: 'Total Marks' },
    { key: 'student_count', header: 'Students' },
    { key: 'results_entered_count', header: 'Results Entered' },
    { 
      key: 'is_published', 
      header: 'Status',
      render: (exam: Exam) => (
        <Badge variant={exam.is_published ? 'success' : 'warning'}>
          {exam.is_published ? 'Published' : 'Draft'}
        </Badge>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (exam: Exam) => (
        <div className="flex items-center space-x-1">
          <button
            onClick={() => handleMarks(exam)}
            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
            title="Enter Marks"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleSummary(exam)}
            className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-colors"
            title="View Results Summary"
          >
            <BarChart className="w-4 h-4" />
          </button>
          {!exam.is_published && (
            <button
              onClick={() => publishMutation.mutate(exam.id)}
              disabled={publishMutation.isPending}
              className="p-1.5 text-purple-500 hover:bg-purple-50 rounded-lg transition-colors"
              title="Publish Results"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => handleEdit(exam)}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(exam)}
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
          <h2 className="text-xl font-semibold text-gray-800">Exam Management</h2>
          <p className="text-sm text-gray-500">Create and manage exams, enter marks, publish results</p>
        </div>
        <Button onClick={handleAdd} className="flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Add Exam
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exams by name..."
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

      {/* Exams Table */}
      <Card>
        <CardContent className="p-0">
          <Table
            data={examsData?.results || []}
            columns={columns}
            keyExtractor={(e) => e.id}
            isLoading={isLoading}
            emptyMessage="No exams found. Create an exam to get started."
            hoverable
          />
        </CardContent>
      </Card>

      {/* Add/Edit Exam Modal */}
      <ExamFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingExam(null); }}
        exam={editingExam}
        batches={allBatches}
        onSubmit={(data) => editingExam ? updateMutation.mutate({ id: editingExam.id, data }) : createMutation.mutate(data)}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Marks Entry Modal */}
      <MarksEntryModal
        isOpen={!!marksExam}
        onClose={() => { setMarksExam(null); setMarksResults([]); }}
        exam={marksExam}
        results={marksResults}
        onSave={updateMarksMutation.mutate}
        isLoading={updateMarksMutation.isPending}
      />

      {/* Exam Summary Modal */}
      <ExamSummaryModal
        isOpen={!!summaryExam}
        onClose={() => setSummaryExam(null)}
        data={summaryExam}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteMutation.mutate(deleteConfirm!.id)}
        title="Delete Exam"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This will also delete all associated results.`}
        confirmText="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

// Exam Form Modal
function ExamFormModal({ 
  isOpen, 
  onClose, 
  exam, 
  batches, 
  onSubmit, 
  isLoading 
}: { 
  isOpen: boolean
  onClose: () => void
  exam: Exam | null
  batches: Batch[]
  onSubmit: (data: ExamFormData) => void
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
  } = useForm<ExamFormData>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      name: '',
      exam_class: 6,
      batch_id: null,
      total_marks: 100,
      description: '',
      exam_date: new Date().toISOString().split('T')[0],
    },
  })

  useEffect(() => {
    if (isOpen) {
      if (exam) {
        reset({
          name: exam.name,
          exam_class: exam.exam_class,
          batch_id: exam.batch_id || null,
          total_marks: exam.total_marks,
          description: exam.description,
          exam_date: exam.exam_date,
        })
        setSelectedClass(exam.exam_class)
      } else {
        reset({
          name: '',
          exam_class: 6,
          batch_id: null,
          total_marks: 100,
          description: '',
          exam_date: new Date().toISOString().split('T')[0],
        })
        setSelectedClass(6)
      }
    }
  }, [isOpen, exam, reset])

  const handleClassChange = (value: number) => {
    setSelectedClass(value)
    setValue('batch_id', null)
    setValue('exam_class', value)
  }

  const handleBatchChange = (value: number | null) => {
    setValue('batch_id', value || undefined)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={exam ? 'Edit Exam' : 'Add Exam'}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="name">Exam Name *</Label>
          <Input id="name" {...register('name')} placeholder="e.g., Mid Term, Final, Class Test" />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="exam_class">Class *</Label>
            <Select
              id="exam_class"
              {...register('exam_class', { valueAsNumber: true })}
              onChange={(e) => handleClassChange(Number(e.target.value))}
              value={selectedClass}
            >
              {CLASS_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="total_marks">Total Marks *</Label>
            <Input 
              id="total_marks" 
              type="number" 
              {...register('total_marks', { valueAsNumber: true })} 
              min="1" 
              placeholder="100" 
            />
            {errors.total_marks && <p className="mt-1 text-sm text-red-600">{errors.total_marks.message}</p>}
          </div>
        </div>
        <div>
          <Label htmlFor="exam_date">Exam Date *</Label>
          <Input 
            id="exam_date" 
            type="date" 
            {...register('exam_date')} 
          />
          {errors.exam_date && <p className="mt-1 text-sm text-red-600">{errors.exam_date.message}</p>}
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
        <div>
          <Label htmlFor="description">Description</Label>
          <Input id="description" {...register('description')} placeholder="Optional description" />
        </div>
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 mr-2" /> : null}
            {exam ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// Marks Entry Modal
function MarksEntryModal({ 
  isOpen, 
  onClose, 
  exam, 
  results, 
  onSave, 
  isLoading 
}: { 
  isOpen: boolean
  onClose: () => void
  exam: Exam | null
  results: ExamResult[]
  onSave: (data: { examId: number; results: any[] }) => void
  isLoading: boolean
}) {
  const [localResults, setLocalResults] = useState<ExamResult[]>([])

  useEffect(() => {
    if (isOpen) {
      setLocalResults(results)
    }
  }, [isOpen, results])

  const updateResult = (resultId: number, field: string, value: any) => {
    setLocalResults(prev => prev.map(r => 
      r.id === resultId ? { ...r, [field]: value } : r
    ))
  }

  const handleSave = () => {
    if (!exam) return
    const resultsToSave = localResults.map(r => ({
      result_id: r.id,
      is_absent: r.is_absent,
      marks_obtained: r.is_absent ? null : r.marks_obtained,
      notes: r.notes,
    }))
    onSave({ examId: exam.id, results: resultsToSave })
  }

  if (!exam) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Enter Marks - ${exam.name}`}
      size="full"
    >
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 sticky top-0 z-10">
          <p className="font-medium text-gray-800">{exam.name}</p>
          <p className="text-sm text-gray-500">
            {getClassLabel(exam.exam_class)} | {getBatchDisplayName(exam.batch)} | Total Marks: {exam.total_marks} | Date: {new Date(exam.exam_date).toLocaleDateString()}
          </p>
        </div>
        
        <div className="overflow-auto max-h-[60vh]">
          <Table
            data={localResults}
            columns={[
              { key: 'student.student_id', header: 'Student ID', render: (r: ExamResult) => <code className="text-sm">{r.student.student_id}</code> },
              { key: 'student.name', header: 'Name', render: (r: ExamResult) => <span className="font-medium">{r.student.name}</span> },
              { key: 'student.roll', header: 'Roll', render: (r: ExamResult) => r.student.roll },
              { 
                key: 'marks', 
                header: 'Marks',
                render: (r: ExamResult) => (
                  <Input
                    type="number"
                    min="0"
                    max={exam.total_marks}
                    value={r.is_absent ? '' : (r.marks_obtained ?? '')}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null
                      updateResult(r.id, 'marks_obtained', val)
                      if (val !== null) {
                        const pct = ((val / exam.total_marks) * 100).toFixed(2)
                        updateResult(r.id, 'percentage', parseFloat(pct))
                      } else {
                        updateResult(r.id, 'percentage', null)
                      }
                    }}
                    disabled={r.is_absent}
                    className="w-24"
                  />
                )
              },
              { 
                key: 'percentage', 
                header: '%',
                render: (r: ExamResult) => (
                  <span className={cn(
                    'font-medium',
                    r.percentage !== null && r.percentage >= 80 ? 'text-green-600' :
                    r.percentage !== null && r.percentage >= 60 ? 'text-yellow-600' :
                    r.percentage !== null ? 'text-red-600' : 'text-gray-500'
                  )}>
                    {r.is_absent ? '-' : r.percentage ? `${r.percentage}%` : '-'}
                  </span>
                )
              },
              { 
                key: 'status', 
                header: 'Status',
                render: (r: ExamResult) => (
                  <Select
                    value={r.is_absent ? 'absent' : 'present'}
                    onChange={(e) => {
                      const isAbsent = e.target.value === 'absent'
                      updateResult(r.id, 'is_absent', isAbsent)
                      if (isAbsent) {
                        updateResult(r.id, 'marks_obtained', null)
                        updateResult(r.id, 'percentage', null)
                      }
                    }}
                    className="w-32"
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                  </Select>
                )
              },
              { 
                key: 'notes', 
                header: 'Notes',
                render: (r: ExamResult) => (
                  <Input
                    value={r.notes}
                    onChange={(e) => updateResult(r.id, 'notes', e.target.value)}
                    placeholder="Notes"
                    className="w-full"
                  />
                )
              },
            ]}
            keyExtractor={(r) => r.id}
            isLoading={false}
            emptyMessage="No students found for this exam"
            hoverable
          />
        </div>
        
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 sticky bottom-0 bg-white z-10">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button onClick={handleSave} loading={isLoading}>
            Save All Marks
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// Exam Summary Modal
function ExamSummaryModal({ 
  isOpen, 
  onClose, 
  data 
}: { 
  isOpen: boolean
  onClose: () => void
  data: { exam: Exam; stats: any; ranked?: any[]; ranked_students?: any[] } | null
}) {
  if (!data) return null

  const ranked = Array.isArray((data as any).ranked_students) ? (data as any).ranked_students : Array.isArray((data as any).ranked) ? (data as any).ranked : []
  const exam = (data as any).exam
  const stats = (data as any).stats || { total_students: 0, attended: 0, absent: 0, avg_percentage: 0 }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${exam.name} - Results Summary`}
      size="lg"
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.total_students}</p>
              <p className="text-sm text-gray-500">Total Students</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.attended}</p>
              <p className="text-sm text-gray-500">Attended</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
              <p className="text-sm text-gray-500">Absent</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{stats.avg_percentage}%</p>
              <p className="text-sm text-gray-500">Average</p>
            </CardContent>
          </Card>
        </div>

        {/* Ranked Students */}
        <div className="overflow-x-auto">
          <Table
            data={ranked}
            columns={[
              { key: 'rank', header: 'Rank', render: (s: any) => <span className="font-bold">{s.rank}</span> },
              { key: 'student_id', header: 'Student ID', render: (s: any) => <code className="text-sm">{s.student_id}</code> },
              { key: 'name', header: 'Name', render: (s: any) => <span className="font-medium">{s.name}</span> },
              { key: 'marks', header: 'Marks', render: (s: any) => `${s.marks}/${exam.total_marks}` },
              { 
                key: 'percentage', 
                header: '%',
                render: (s: any) => (
                  <span className={cn(
                    'font-bold',
                    s.percentage >= 80 ? 'text-green-600' :
                    s.percentage >= 60 ? 'text-yellow-600' : 'text-red-600'
                  )}>
                    {s.percentage}%
                  </span>
                )
              },
            ]}
            keyExtractor={(s) => s.rank}
            isLoading={false}
            hoverable
          />
        </div>
      </div>
    </Modal>
  )
}
