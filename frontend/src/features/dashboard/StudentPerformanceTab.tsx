import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Table } from '@/components/ui/Table'
import { formatDate, cn } from '@/lib/utils'

interface StudentPerformance {
  exam_name: string
  exam_date: string
  total_marks: number
  marks_obtained: number | null
  is_absent: boolean
  percentage: number | null
  rank: number | null
  total_students: number
}

export function StudentPerformanceTab() {
  const { data, isLoading } = useQuery<{ performance: StudentPerformance[] }>({
    queryKey: ['student-performance'],
    queryFn: async () => {
      const response = await api.get('/auth/student/performance/')
      return response.data
    },
  })

  const columns = [
    { key: 'exam_name', header: 'Exam', render: (p: StudentPerformance) => <span className="font-medium">{p.exam_name}</span> },
    { key: 'exam_date', header: 'Date', render: (p: StudentPerformance) => formatDate(p.exam_date) },
    { key: 'total_marks', header: 'Total Marks', render: (p: StudentPerformance) => p.total_marks },
    { 
      key: 'marks', 
      header: 'Obtained',
      render: (p: StudentPerformance) => (
        <span className={p.is_absent ? 'text-red-600 font-medium' : 'font-medium text-gray-900'}>
          {p.is_absent ? 'Absent' : p.marks_obtained ?? '-'}
        </span>
      )
    },
    { 
      key: 'percentage', 
      header: '%',
      render: (p: StudentPerformance) => (
        <Badge variant={
          p.is_absent ? 'gray' :
          p.percentage !== null && p.percentage >= 80 ? 'success' :
          p.percentage !== null && p.percentage >= 60 ? 'warning' : 'danger'
        }>
          {p.is_absent ? '-' : p.percentage ? `${p.percentage}%` : '-'}
        </Badge>
      )
    },
    { 
      key: 'rank', 
      header: 'Rank',
      render: (p: StudentPerformance) => (
        p.rank && p.total_students ? `#${p.rank} / ${p.total_students}` : '-'
      )
    },
    { 
      key: 'status', 
      header: 'Status',
      render: (p: StudentPerformance) => (
        <Badge variant={p.is_absent ? 'danger' : 'success'}>
          {p.is_absent ? 'Absent' : 'Present'}
        </Badge>
      )
    },
  ]

  return (
    <Card>
      <CardContent className="p-0">
        <Table
          data={data?.performance || []}
          columns={columns}
          keyExtractor={(p, idx) => idx}
          isLoading={isLoading}
          emptyMessage="No exam records found"
          hoverable
        />
      </CardContent>
    </Card>
  )
}
