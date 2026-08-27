import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Filter, Loader2, Bell, X } from 'lucide-react'
import { api } from '@/lib/api'
import { Notice, Batch, PaginatedResponse } from '@/lib/types'
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
import { cn, getBatchDisplayName, getClassLabel } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const noticeSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  student_class: z.number().min(6).max(10).nullable().optional(),
  batch_id: z.number().nullable().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  is_active: z.boolean().default(true),
  expires_at: z.string().optional(),
})

type NoticeFormData = z.infer<typeof noticeSchema>

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

export function NoticesTab() {
  const queryClient = useQueryClient()
  const { success: toastSuccess, error: toastError } = useToast()
  const [search, setSearch] = useState('')
  const [selectedClass, setSelectedClass] = useState<number | ''>('')
  const [selectedBatch, setSelectedBatch] = useState<number | ''>('')
  const [showExpired, setShowExpired] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Notice | null>(null)

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

  // Fetch notices
  const { data: noticesData, isLoading } = useQuery<PaginatedResponse<Notice>>({
    queryKey: ['notices', { search, class: selectedClass, batch: selectedBatch, showExpired }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (selectedClass) params.append('class', selectedClass.toString())
      if (selectedBatch) params.append('batch', selectedBatch.toString())
      if (showExpired) params.append('show_expired', 'true')
      const response = await api.get(`/notices/?${params.toString()}`)
      return response.data
    },
  })

  // Create notice mutation
  const createMutation = useMutation({
    mutationFn: async (data: NoticeFormData) => {
      const response = await api.post('/notices/', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] })
      toastSuccess('Notice created successfully')
      setIsModalOpen(false)
      setEditingNotice(null)
    },
    onError: (error: Error) => toastError(error.message),
  })

  // Update notice mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: NoticeFormData }) => {
      const response = await api.patch(`/notices/${id}/`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] })
      toastSuccess('Notice updated successfully')
      setIsModalOpen(false)
      setEditingNotice(null)
    },
    onError: (error: Error) => toastError(error.message),
  })

  // Delete notice mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/notices/${id}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] })
      toastSuccess('Notice deleted')
      setDeleteConfirm(null)
    },
    onError: (error: Error) => toastError(error.message),
  })

  const handleDelete = (notice: Notice) => {
    setDeleteConfirm(notice)
  }

  const handleEdit = (notice: Notice) => {
    setEditingNotice(notice)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setEditingNotice(null)
    setIsModalOpen(true)
  }

  const classOptions = CLASS_OPTIONS.map(c => ({ value: c.value, label: c.label }))
  const batchOptions = batches.map(b => ({ value: b.id, label: b.display_name }))

  const columns = [
    { key: 'title', header: 'Title' },
    { 
      key: 'student_class', 
      header: 'Class',
      render: (notice: Notice) => <Badge variant="primary">{getClassLabel(notice.student_class)}</Badge>
    },
    { 
      key: 'batch', 
      header: 'Batch',
      render: (notice: Notice) => <Badge variant="gray">{getBatchDisplayName(notice.batch)}</Badge>
    },
    { 
      key: 'priority', 
      header: 'Priority',
      render: (notice: Notice) => {
        const variants = {
          low: 'gray' as const,
          normal: 'info' as const,
          high: 'warning' as const,
          urgent: 'danger' as const,
        }
        return <Badge variant={variants[notice.priority]}>{notice.priority}</Badge>
      }
    },
    { 
      key: 'is_active', 
      header: 'Status',
      render: (notice: Notice) => (
        <Badge variant={notice.is_active ? 'success' : 'gray'}>
          {notice.is_active ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    { 
      key: 'expires_at', 
      header: 'Expires',
      render: (notice: Notice) => notice.expires_at ? new Date(notice.expires_at).toLocaleDateString() : 'Never'
    },
    { 
      key: 'created_at', 
      header: 'Created',
      render: (notice: Notice) => new Date(notice.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (notice: Notice) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleEdit(notice)}
            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(notice)}
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
          <h2 className="text-xl font-semibold text-gray-800">Notice Board</h2>
          <p className="text-sm text-gray-500">Create and manage notices for students</p>
        </div>
        <Button onClick={handleAdd} className="flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Add Notice
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notices by title or content..."
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
          <Dropdown
            options={[{ value: '', label: 'All Priorities' }, ...PRIORITY_OPTIONS]}
            value={''}
            onChange={() => {}}
            placeholder="Filter by Priority"
            className="w-48"
          />
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showExpired}
              onChange={(e) => setShowExpired(e.target.checked)}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="text-sm text-gray-600">Show Expired</span>
          </label>
        </div>
      </Card>

      {/* Notices Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !noticesData?.results || noticesData.results.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500">No notices found. Create a notice to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {noticesData.results.map((notice: Notice) => {
            const bg = notice.priority === 'urgent' ? 'bg-red-50 border-red-200' : notice.priority === 'high' ? 'bg-amber-50 border-amber-200' : notice.priority === 'normal' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
            return (
              <Card key={notice.id} className={`${bg} border-2 hover:shadow-md transition-shadow`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-800 line-clamp-1">{notice.title}</h3>
                    <Badge variant={notice.priority === 'urgent' ? 'danger' : notice.priority === 'high' ? 'warning' : notice.priority === 'normal' ? 'info' : 'gray'} className="ml-2 shrink-0">{notice.priority}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-3 mb-3">{notice.content}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-3">
                    <Badge variant="primary">{notice.student_class_display}</Badge>
                    <Badge variant="gray">{notice.batch ? getBatchDisplayName(notice.batch) : 'All Batches'}</Badge>
                    {notice.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="gray">Inactive</Badge>}
                    <span>{notice.expires_at ? `Expires: ${new Date(notice.expires_at).toLocaleDateString()}` : 'No expiry'}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200/50">
                    <span className="text-xs text-gray-400">{new Date(notice.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    <div className="flex items-center space-x-1">
                      <button onClick={() => handleEdit(notice)} className="p-1.5 text-blue-500 hover:bg-white rounded-lg transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(notice)} className="p-1.5 text-red-500 hover:bg-white rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add/Edit Notice Modal */}
      <NoticeFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingNotice(null); }}
        notice={editingNotice}
        batches={allBatches}
        onSubmit={(data) => editingNotice ? updateMutation.mutate({ id: editingNotice.id, data }) : createMutation.mutate(data)}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteMutation.mutate(deleteConfirm!.id)}
        title="Delete Notice"
        message={`Are you sure you want to delete "${deleteConfirm?.title}"?`}
        confirmText="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

// Notice Form Modal
function NoticeFormModal({ 
  isOpen, 
  onClose, 
  notice, 
  batches, 
  onSubmit, 
  isLoading 
}: { 
  isOpen: boolean
  onClose: () => void
  notice: Notice | null
  batches: Batch[]
  onSubmit: (data: NoticeFormData) => void
  isLoading: boolean
}) {
  const [selectedClass, setSelectedClass] = useState<number | null>(6)
  const filteredBatches = selectedClass === null ? [] : batches.filter(b => b.student_class === selectedClass)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NoticeFormData>({
    resolver: zodResolver(noticeSchema),
    defaultValues: {
      title: '',
      content: '',
      student_class: 6,
      batch_id: null,
      priority: 'normal',
      is_active: true,
      expires_at: '',
    },
  })

  useEffect(() => {
    if (isOpen) {
      if (notice) {
        reset({
          title: notice.title,
          content: notice.content,
          student_class: notice.student_class ?? null,
          batch_id: notice.batch_id || null,
          priority: notice.priority,
          is_active: notice.is_active,
          expires_at: notice.expires_at ? notice.expires_at.split('T')[0] : '',
        })
        setSelectedClass(notice.student_class ?? null)
      } else {
        reset({
          title: '',
          content: '',
          student_class: 6,
          batch_id: null,
          priority: 'normal',
          is_active: true,
          expires_at: '',
        })
        setSelectedClass(6)
      }
    }
  }, [isOpen, notice, reset])

  const handleClassChange = (value: number | null) => {
    setSelectedClass(value)
    setValue('batch_id', null)
    setValue('student_class', value as any)
  }

  const handleBatchChange = (value: number | null) => {
    setValue('batch_id', value || undefined)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={notice ? 'Edit Notice' : 'Add Notice'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="title">Title *</Label>
          <Input id="title" {...register('title')} placeholder="Enter notice title" />
          {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
        </div>
        <div>
          <Label htmlFor="content">Content *</Label>
          <Textarea id="content" {...register('content')} rows={4} placeholder="Enter notice content" />
          {errors.content && <p className="mt-1 text-sm text-red-600">{errors.content.message}</p>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="student_class">Class</Label>
            <Select
              id="student_class"
              value={selectedClass ?? ''}
              onChange={(e) => {
                const val = e.target.value === '' ? null : Number(e.target.value)
                handleClassChange(val)
              }}
            >
              <option value="">All Classes</option>
              {CLASS_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-gray-400">Select All Classes for broadcast</p>
          </div>
          <div>
            <Label htmlFor="batch_id">Batch (Optional)</Label>
            <Select
              id="batch_id"
              onChange={(e) => handleBatchChange(e.target.value ? Number(e.target.value) : null)}
              value={watch('batch_id') || ''}
              disabled={selectedClass === null}
            >
              <option value="">{selectedClass === null ? 'All Batches (All Classes)' : 'All Batches for Class'}</option>
              {filteredBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>{batch.display_name}</option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-gray-400">{selectedClass === null ? 'Batch selection disabled for All Classes' : 'Only shows batches for selected class'}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="priority">Priority</Label>
            <Select id="priority" {...register('priority')}>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="expires_at">Expires At (Optional)</Label>
            <Input id="expires_at" type="date" {...register('expires_at')} />
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
            {notice ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}


