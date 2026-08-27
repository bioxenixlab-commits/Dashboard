import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Table } from '@/components/ui/Table'
import { formatDate } from '@/lib/utils'

interface StudentExam {
  id: number
  name: string
  exam_class: number
  total_marks: number
  exam_date: string
  is_published: boolean
  is_upcoming: boolean
  result?: {
    marks_obtained: number | null
    is_absent: boolean
    percentage: number | null
    rank: number | null
  }
}

export function StudentExamsTab() {
  const { data, isLoading } = useQuery<{ upcoming: StudentExam[]; published: StudentExam[] }>({
    queryKey: ['student-exams'],
    queryFn: async () => {
      const response = await api.get('/exams/student_exams/')
      return response.data
    },
  })

  const columns = [
    { 
      key: 'name', 
      header: 'Exam',
      render: (e: StudentExam) => <span className="font-medium">{e.name}</span>
    },
    { 
      key: 'exam_date', 
      header: 'Date',
      render: (e: StudentExam) => formatDate(e.exam_date)
    },
    { key: 'total_marks', header: 'Total Marks' },
    { 
      key: 'status', 
      header: 'Status',
      render: (e: StudentExam) => (
        <Badge variant={
          e.result ? 'success' :
          e.is_upcoming ? 'info' : 'warning'
        }>
          {e.result ? 'Completed' : e.is_upcoming ? 'Upcoming' : 'Past (Results Pending)'}
        </Badge>
      )
    },
    { 
      key: 'marks', 
      header: 'Your Marks',
      render: (e: StudentExam) => {
        if (!e.result) return '-'
        if (e.result.is_absent) return <span className="text-red-600">Absent</span>
        return e.result.marks_obtained !== null ? `${e.result.marks_obtained} / ${e.total_marks}` : '-'
      }
    },
    { 
      key: 'percentage', 
      header: 'Percentage',
      render: (e: StudentExam) => {
        if (!e.result || e.result.percentage === null) return '-'
        return (
          <Badge variant={
            e.result.percentage >= 80 ? 'success' :
            e.result.percentage >= 60 ? 'warning' : 'danger'
          }>
            {e.result.percentage}%
          </Badge>
        )
      }
    },
    { 
      key: 'rank', 
      header: 'Rank',
      render: (e: StudentExam) => e.result?.rank ? `#${e.result.rank}` : '-'
    },
  ]

  return (
    <div className="space-y-6">
      {/* Upcoming Exams */}
      {data?.upcoming && data.upcoming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Upcoming Exams</span>
              <Badge variant="info">{data.upcoming.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table
              data={data.upcoming}
              columns={columns}
              keyExtractor={(e) => e.id}
              isLoading={isLoading}
              emptyMessage="No upcoming exams"
              hoverable
            />
          </CardContent>
        </Card>
      )}

      {/* Past/Published Exams */}
      {data?.published && data.published.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Past Exams & Results</span>
              <Badge variant="success">{data.published.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table
              data={data.published}
              columns={columns}
              keyExtractor={(e) => e.id}
              isLoading={isLoading}
              emptyMessage="No past exams"
              hoverable
            />
          </CardContent>
        </Card>
      )}

      {!data?.upcoming?.length && !data?.published?.length && !isLoading && (
        <Card className="p-8 text-center">
          <p className="text-gray-500">No exams found</p>
        </Card>
      )}
    </div>
  )
}