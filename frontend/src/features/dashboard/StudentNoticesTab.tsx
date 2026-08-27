import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Table } from '@/components/ui/Table'
import { formatDate } from '@/lib/utils'

interface StudentNotice {
  id: number
  title: string
  content: string
  student_class: number
  student_class_display: string
  batch: { name: string; student_class: number; display_name: string } | null
  priority: 'low' | 'normal' | 'high' | 'urgent'
  created_at: string
  expires_at: string | null
}

export function StudentNoticesTab() {
  const { data, isLoading } = useQuery<StudentNotice[]>({
    queryKey: ['student-notices'],
    queryFn: async () => {
      const response = await api.get('/notices/student_notices/')
      return response.data
    },
  })

  const columns = [
    { 
      key: 'title', 
      header: 'Title',
      render: (n: StudentNotice) => <span className="font-medium">{n.title}</span>
    },
    { 
      key: 'content', 
      header: 'Content',
      render: (n: StudentNotice) => <span className="text-gray-600 max-w-xs truncate block">{n.content}</span>
    },
    { 
      key: 'student_class', 
      header: 'Class',
      render: (n: StudentNotice) => <Badge variant="primary">{n.student_class_display}</Badge>
    },
    { 
      key: 'batch', 
      header: 'Batch',
      render: (n: StudentNotice) => <Badge variant="gray">{n.batch?.display_name || 'All Batches'}</Badge>
    },
    { 
      key: 'priority', 
      header: 'Priority',
      render: (n: StudentNotice) => {
        const variants = {
          low: 'gray' as const,
          normal: 'info' as const,
          high: 'warning' as const,
          urgent: 'danger' as const,
        }
        return <Badge variant={variants[n.priority]}>{n.priority}</Badge>
      }
    },
    { key: 'created_at', header: 'Posted', render: (n: StudentNotice) => formatDate(n.created_at) },
  ]

  return (
    <Card>
      <CardContent className="p-0">
        <Table
          data={data || []}
          columns={columns}
          keyExtractor={(n) => n.id}
          isLoading={isLoading}
          emptyMessage="No notices at this time"
          hoverable
        />
      </CardContent>
    </Card>
  )
}