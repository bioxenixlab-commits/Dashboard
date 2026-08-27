import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Users, X, Loader2, ArrowRightLeft } from 'lucide-react'
import { api } from '@/lib/api'
import { Batch, PaginatedResponse } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Input'
import { Select } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/hooks/useToast'
import { cn, getClassLabel } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const batchSchema = z.object({
  name: z.string().min(1, 'Batch name is required'),
  student_class: z.number().min(6).max(10),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
})

type BatchFormData = z.infer<typeof batchSchema>

const CLASS_OPTIONS = [
  { value: 6, label: 'Class 6' },
  { value: 7, label: 'Class 7' },
  { value: 8, label: 'Class 8' },
  { value: 9, label: 'Class 9' },
  { value: 10, label: 'Class 10' },
]

interface ReassignDialogProps {
  isOpen: boolean
  onClose: () => void
  batch: Batch
  batches: Batch[]
  onConfirm: (targetBatchId: number | null, newBatchName?: string) => void
  isLoading: boolean
}

function ReassignDialog({ isOpen, onClose, batch, batches, onConfirm, isLoading }: ReassignDialogProps) {
  const [targetBatchId, setTargetBatchId] = useState<number | null>(null)
  const [newBatchName, setNewBatchName] = useState('')
  const [reassignOption, setReassignOption] = useState<'existing' | 'new'>('existing')

  if (!isOpen || !batch) return null

  const handleConfirm = () => {
    if (reassignOption === 'new') {
      if (!newBatchName.trim()) return
      onConfirm(null, newBatchName)
    } else {
      onConfirm(targetBatchId)
    }
  }

  const filteredBatches = batches.filter(b => b.id !== batch.id && b.student_class === batch.student_class)
  const isConfirmDisabled = reassignOption === 'existing' ? !targetBatchId : !newBatchName.trim()

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Batch & Reassign Students" size="md">
      <div className="space-y-4">
        <p className="text-gray-600">
          You are about to delete <strong>{batch.display_name}</strong> which has <strong>{batch.student_count}</strong> students.
          Please choose where to reassign them:
        </p>
        
        <div className="space-y-3">
          <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              checked={reassignOption === 'existing'}
              onChange={() => setReassignOption('existing')}
              className="text-primary-600 focus:ring-primary-500"
            />
            <div className="flex-1">
              <p className="font-medium">Assign to existing batch</p>
              <Select
                value={targetBatchId || ''}
                onChange={(e) => setTargetBatchId(e.target.value ? Number(e.target.value) : null)}
                disabled={reassignOption !== 'existing'}
              >
                <option value="">Select a batch</option>
                {filteredBatches.map((b) => (
                  <option key={b.id} value={b.id}>{b.display_name} ({b.student_count} students)</option>
                ))}
              </Select>
            </div>
          </label>

          <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              checked={reassignOption === 'new'}
              onChange={() => setReassignOption('new')}
              className="text-primary-600 focus:ring-primary-500"
            />
            <div className="flex-1">
              <p className="font-medium">Create new batch and assign</p>
              <Input
                value={newBatchName}
                onChange={(e) => setNewBatchName(e.target.value)}
                placeholder="New batch name (e.g., A, B, Science, Commerce)"
                disabled={reassignOption !== 'new'}
                className="mt-2"
              />
            </div>
          </label>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={handleConfirm} loading={isLoading} disabled={isConfirmDisabled}>
            Delete & Reassign
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function BatchesTab() {
  const queryClient = useQueryClient()
  const { success: toastSuccess, error: toastError } = useToast()
  const [selectedClass, setSelectedClass] = useState<number | ''>('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null)
  const [deleteReassign, setDeleteReassign] = useState<{ batch: Batch; onConfirm: (id: number | null, name?: string) => void } | null>(null)

  // Fetch batches
  const { data: batchesData, isLoading } = useQuery<PaginatedResponse<Batch>>({
    queryKey: ['batches', { class: selectedClass }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedClass) params.append('student_class', selectedClass.toString())
      const response = await api.get(`/batches/?${params.toString()}`)
      return response.data
    },
  })

  // Create batch mutation
  const createMutation = useMutation({
    mutationFn: async (data: BatchFormData) => {
      const response = await api.post('/batches/', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toastSuccess('Batch created successfully')
      setIsModalOpen(false)
      setEditingBatch(null)
    },
    onError: (error: Error) => toastError(error.message),
  })

  // Update batch mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: BatchFormData }) => {
      const response = await api.patch(`/batches/${id}/`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toastSuccess('Batch updated successfully')
      setIsModalOpen(false)
      setEditingBatch(null)
    },
    onError: (error: Error) => toastError(error.message),
  })

  // Delete batch with reassign mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ id, targetBatchId, newBatchName }: { id: number; targetBatchId: number | null; newBatchName?: string }) => {
      const response = await api.post(`/batches/${id}/delete_with_reassign/`, {
        target_batch: targetBatchId,
        new_batch_name: newBatchName,
        new_batch_description: '',
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toastSuccess('Batch deleted and students reassigned')
      setDeleteReassign(null)
    },
    onError: (error: Error) => toastError(error.message),
  })

  const simpleDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/batches/${id}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      toastSuccess('Batch deleted')
      setSimpleDeleteConfirm(null)
    },
    onError: (error: any) => toastError(error.response?.data?.detail || error.message),
  })
  const [simpleDeleteConfirm, setSimpleDeleteConfirm] = useState<Batch | null>(null)

  const handleDelete = (batch: Batch) => {
    if (batch.student_count === 0) {
      setSimpleDeleteConfirm(batch)
    } else {
      setDeleteReassign({
        batch,
        onConfirm: (targetBatchId, newBatchName) => 
          deleteMutation.mutate({ id: batch.id, targetBatchId, newBatchName }),
      })
    }
  }

  const handleEdit = (batch: Batch) => {
    setEditingBatch(batch)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setEditingBatch(null)
    setIsModalOpen(true)
  }

  const columns = [
    { key: 'display_name', header: 'Batch Name' },
    { 
      key: 'student_class', 
      header: 'Class',
      render: (batch: Batch) => <Badge variant="primary">{getClassLabel(batch.student_class)}</Badge>
    },
    { key: 'description', header: 'Description' },
    { 
      key: 'student_count', 
      header: 'Students',
      render: (batch: Batch) => batch.student_count
    },
    { 
      key: 'is_active', 
      header: 'Status',
      render: (batch: Batch) => (
        <Badge variant={batch.is_active ? 'success' : 'gray'}>
          {batch.is_active ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (batch: Batch) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleEdit(batch)}
            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(batch)}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete & Reassign Students"
          >
            <ArrowRightLeft className="w-4 h-4" />
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
          <h2 className="text-xl font-semibold text-gray-800">Batch Management</h2>
          <p className="text-sm text-gray-500">Manage student batches and assignments</p>
        </div>
        <Button onClick={handleAdd} className="flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Add Batch
        </Button>
      </div>

      {/* Class Filter */}
      <Card className="p-4">
        <div className="flex items-center space-x-4">
          <Label className="mb-0">Filter by Class:</Label>
          <Select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value ? Number(e.target.value) : '')}
            className="w-48"
          >
            <option value="">All Classes</option>
            {CLASS_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Batches Table */}
      <Card>
        <CardContent className="p-0">
          <Table
            data={batchesData?.results || []}
            columns={columns}
            keyExtractor={(b) => b.id}
            isLoading={isLoading}
            emptyMessage="No batches found. Create a batch to get started."
            hoverable
          />
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <BatchFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingBatch(null); }}
        batch={editingBatch}
        onSubmit={editingBatch ? updateMutation.mutate : createMutation.mutate}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete & Reassign Dialog */}
      <ReassignDialog
        isOpen={!!deleteReassign}
        onClose={() => setDeleteReassign(null)}
        batch={deleteReassign?.batch!}
        batches={batchesData?.results || []}
        onConfirm={deleteReassign?.onConfirm || (() => {})}
        isLoading={deleteMutation.isPending}
      />

      {/* Simple Delete for Empty Batch */}
      <ConfirmDialog
        isOpen={!!simpleDeleteConfirm}
        onClose={() => setSimpleDeleteConfirm(null)}
        onConfirm={() => simpleDeleteConfirm && simpleDeleteMutation.mutate(simpleDeleteConfirm.id)}
        title="Delete Batch"
        message={`Are you sure you want to delete "${simpleDeleteConfirm?.display_name}"? This batch is empty.`}
        confirmText="Delete"
        variant="danger"
        loading={simpleDeleteMutation.isPending}
      />
    </div>
  )
}

// Batch Form Modal
function BatchFormModal({ 
  isOpen, 
  onClose, 
  batch, 
  onSubmit, 
  isLoading 
}: { 
  isOpen: boolean
  onClose: () => void
  batch: Batch | null
  onSubmit: (data: BatchFormData) => void
  isLoading: boolean
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BatchFormData>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      name: '',
      student_class: 6,
      description: '',
      is_active: true,
    },
  })

  useEffect(() => {
    if (isOpen) {
      if (batch) {
        reset({
          name: batch.name,
          student_class: batch.student_class,
          description: batch.description,
          is_active: batch.is_active,
        })
      } else {
        reset({
          name: '',
          student_class: 6,
          description: '',
          is_active: true,
        })
      }
    }
  }, [isOpen, batch, reset])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={batch ? 'Edit Batch' : 'Add Batch'}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="name">Batch Name *</Label>
          <Input id="name" {...register('name')} placeholder="e.g., A, B, Science, Commerce" />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
        </div>
        <div>
          <Label htmlFor="student_class">Class *</Label>
          <Select
            id="student_class"
            {...register('student_class', { valueAsNumber: true })}
          >
            {CLASS_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Input id="description" {...register('description')} placeholder="Optional description" />
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
            {batch ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}