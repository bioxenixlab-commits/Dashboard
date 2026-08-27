import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Table } from '@/components/ui/Table'
import { formatDate, cn } from '@/lib/utils'

interface StudentHomework {
  id: number
  title: string
  description: string
  student_class: number
  student_class_display: string
  batch: { name: string; student_class: number; display_name: string } | null
  assigned_date: string
  due_date: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  is_overdue: boolean
  submission_status?: string
}

export function StudentHomeworkTab() {
  const { data, isLoading } = useQuery<StudentHomework[]>({
    queryKey: ['student-homework'],
    queryFn: async () => {
      const response = await api.get('/homework/student_homework/')
      return response.data
    },
  })

  const columns = [
    { 
      key: 'title', 
      header: 'Title',
      render: (h: StudentHomework) => <span className="font-medium">{h.title}</span>
    },
    { 
      key: 'description', 
      header: 'Description',
      render: (h: StudentHomework) => <span className="text-gray-600 max-w-xs truncate block">{h.description}</span>
    },
    { 
      key: 'student_class', 
      header: 'Class',
      render: (h: StudentHomework) => <Badge variant="primary">{h.student_class_display}</Badge>
    },
    { 
      key: 'batch', 
      header: 'Batch',
      render: (h: StudentHomework) => <Badge variant="gray">{h.batch?.display_name || 'All Batches'}</Badge>
    },
    { 
      key: 'assigned_date', 
      header: 'Assigned',
      render: (h: StudentHomework) => formatDate(h.assigned_date)
    },
    { 
      key: 'due_date', 
      header: 'Due Date',
      render: (h: StudentHomework) => (
        <span className={cn(h.is_overdue && 'text-red-600 font-medium')}>
          {formatDate(h.due_date)} {h.is_overdue && ' (Overdue)'}
        </span>
      )
    },
    { 
      key: 'priority', 
      header: 'Priority',
      render: (h: StudentHomework) => {
        const variants = {
          low: 'gray' as const,
          normal: 'info' as const,
          high: 'warning' as const,
          urgent: 'danger' as const,
        }
        return <Badge variant={variants[h.priority]}>{h.priority}</Badge>
      }
    },
    { 
      key: 'submission_status', 
      header: 'Status',
      render: (h: StudentHomework) => {
        const status = h.submission_status || 'pending'
        const variants = {
          pending: 'gray' as const,
          submitted: 'info' as const,
          late: 'warning' as const,
          graded: 'success' as const,
        }
        return <Badge variant={variants[status as keyof typeof variants] || 'gray'}>
          status.charAt(0).toUpperCase() + status.slice(1)
        </Badge>
      }
    },
  ]

  return (
    <Card>
      <CardContent className="p-0">
        <Table
          data={data || []}
          columns={columns}
          keyExtractor={(h) => h.id}
          isLoading={isLoading}
          emptyMessage="No homework assigned"
          hoverable
        />
      </CardContent>
    </Card>
  )
}