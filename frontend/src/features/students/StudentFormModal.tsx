import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Loader2 } from 'lucide-react'
import { Student, Batch, School } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Input'
import { Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { cn, getMonthName } from '@/lib/utils'

const studentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
  student_class: z.number().min(6).max(10),
  roll: z.number().min(1, 'Roll number is required'),
  ssc_session: z.number().min(20).max(99),
  batch_id: z.number().nullable().optional(),
  school_id: z.number().nullable().optional(),
  school_name: z.string().optional(),
  payment_start_month: z.number().min(1).max(12),
  payment_start_year: z.number().min(2020).max(2030),
  address: z.string().optional(),
  parent_name: z.string().optional(),
  parent_phone: z.string().optional(),
})

type StudentFormData = z.infer<typeof studentSchema>

interface StudentFormModalProps {
  isOpen: boolean
  onClose: () => void
  student: Student | null
  batches: Batch[]
  schools: School[]
  onSubmit: (data: StudentFormData) => void
  isLoading: boolean
}

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

const currentYear = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => ({
  value: currentYear - 2 + i,
  label: String(currentYear - 2 + i),
}))

export function StudentFormModal({ 
  isOpen, 
  onClose, 
  student, 
  batches,
  schools,
  onSubmit, 
  isLoading 
}: StudentFormModalProps) {
  const [selectedClass, setSelectedClass] = useState<number>(6)
  const [showNewSchoolInput, setShowNewSchoolInput] = useState(false)
  const filteredBatches = batches.filter(b => b.student_class === selectedClass)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      student_class: 6,
      roll: 1,
      ssc_session: 27,
      payment_start_month: 1,
      payment_start_year: currentYear,
      address: '',
      parent_name: '',
      parent_phone: '',
    },
  })

  // Reset form when modal opens/closes or student changes
  useEffect(() => {
    if (isOpen) {
      if (student) {
        reset({
          name: student.name,
          phone: student.phone,
          student_class: student.student_class,
          roll: student.roll,
          ssc_session: student.ssc_session,
          batch_id: student.batch_id || null,
          school_id: student.school_id || null,
          school_name: '',
          payment_start_month: student.payment_start_month,
          payment_start_year: student.payment_start_year,
          address: student.address,
          parent_name: student.parent_name,
          parent_phone: student.parent_phone,
        })
        setSelectedClass(student.student_class)
        setShowNewSchoolInput(false)
      } else {
        reset({
          name: '',
          phone: '',
          student_class: 6,
          roll: 1,
          ssc_session: 27,
          batch_id: null,
          school_id: null,
          school_name: '',
          payment_start_month: 1,
          payment_start_year: currentYear,
          address: '',
          parent_name: '',
          parent_phone: '',
        })
        setSelectedClass(6)
        setShowNewSchoolInput(false)
      }
    }
  }, [isOpen, student, reset])

  const handleClassChange = (value: number) => {
    setSelectedClass(value)
    setValue('batch_id', null)
    setValue('student_class', value)
  }

  const handleBatchChange = (value: number | null) => {
    setValue('batch_id', value || undefined)
  }

  const handleSchoolChange = (value: number | null) => {
    if (value) {
      setValue('school_id', value)
      setValue('school_name', '')
      setShowNewSchoolInput(false)
    } else {
      setValue('school_id', null)
    }
  }

  const handleNewSchoolToggle = () => {
    if (!showNewSchoolInput) {
      setValue('school_id', null)
      setValue('school_name', '')
    }
    setShowNewSchoolInput(!showNewSchoolInput)
  }

  const onFormSubmit = (data: StudentFormData) => {
    const payload: StudentFormData = {
      ...data,
      batch_id: data.batch_id || null,
      school_id: data.school_name?.trim() ? null : (data.school_id || null),
      school_name: data.school_name?.trim() || undefined,
    }
    // If new school name provided, don't send school_id
    if (payload.school_name) {
      payload.school_id = null
    }
    onSubmit(payload)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={student ? 'Edit Student' : 'Add Student'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Full Name *</Label>
            <Input id="name" {...register('name')} placeholder="Enter full name" />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="phone">Phone Number *</Label>
            <Input id="phone" type="tel" {...register('phone')} placeholder="Enter phone number" />
            {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>}
          </div>
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
            <Label htmlFor="roll">Roll Number *</Label>
            <Input id="roll" type="number" {...register('roll', { valueAsNumber: true })} min="1" placeholder="1" />
            {errors.roll && <p className="mt-1 text-sm text-red-600">{errors.roll.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ssc_session">SSC Session *</Label>
            <Input 
              id="ssc_session" 
              type="number" 
              {...register('ssc_session', { valueAsNumber: true })} 
              min="20" 
              max="99" 
              placeholder="e.g., 27 for 2027" 
            />
            <p className="mt-1 text-xs text-gray-400">Year when student will be in Class 10+1</p>
            {errors.ssc_session && <p className="mt-1 text-sm text-red-600">{errors.ssc_session.message}</p>}
          </div>
          <div>
            <Label htmlFor="batch_id">Batch</Label>
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

        {/* School field - dropdown + add new */}
        <div className="space-y-2">
          <Label htmlFor="school_id">School</Label>
          {!showNewSchoolInput ? (
            <>
              <div className="flex gap-2">
                <Select
                  id="school_id"
                  onChange={(e) => handleSchoolChange(e.target.value ? Number(e.target.value) : null)}
                  value={watch('school_id') || ''}
                  className="flex-1"
                >
                  <option value="">Select School (Optional)</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </Select>
                <Button type="button" variant="secondary" onClick={handleNewSchoolToggle} className="whitespace-nowrap">
                  + New
                </Button>
              </div>
              <p className="text-xs text-gray-400">Choose from existing schools or click + New to add a school</p>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  id="school_name"
                  {...register('school_name')}
                  placeholder="Enter new school name"
                  className="flex-1"
                  autoFocus
                />
                <Button type="button" variant="secondary" onClick={handleNewSchoolToggle}>
                  Cancel
                </Button>
              </div>
              <p className="text-xs text-gray-400">New school will be created automatically. Or cancel to pick from dropdown.</p>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="payment_start_month">Payment Start Month *</Label>
            <Select
              id="payment_start_month"
              {...register('payment_start_month', { valueAsNumber: true })}
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="payment_start_year">Payment Start Year *</Label>
            <Select
              id="payment_start_year"
              {...register('payment_start_year', { valueAsNumber: true })}
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y.value} value={y.value}>{y.label}</option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="address">Address</Label>
          <Input id="address" {...register('address')} placeholder="Enter address (optional)" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="parent_name">Parent Name</Label>
            <Input id="parent_name" {...register('parent_name')} placeholder="Enter parent name (optional)" />
          </div>
          <div>
            <Label htmlFor="parent_phone">Parent Phone</Label>
            <Input id="parent_phone" type="tel" {...register('parent_phone')} placeholder="Enter parent phone (optional)" />
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 mr-2" /> : null}
            {student ? 'Update' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}