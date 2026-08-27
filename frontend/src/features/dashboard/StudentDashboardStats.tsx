import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { BarChart, ClipboardCheck, CreditCard, Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { formatDate } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

interface StudentStats {
  total_exams: number
  overall_percentage: number
  unpaid_count: number
  best_rank: number | null
  recent_performance: Array<{
    exam_name: string
    exam_date: string
    percentage: number | null
    rank: number | null
    is_absent: boolean
  }>
}

export function StudentDashboardStats() {
  const { student } = useAuth()
  const { data, isLoading } = useQuery<StudentStats>({
    queryKey: ['student-stats', student?.id],
    queryFn: async () => {
      const response = await api.get('/auth/student/stats/')
      return response.data
    },
    enabled: !!student,
  })

  const stats = [
    {
      label: 'Exams Taken',
      value: data?.total_exams ?? 0,
      icon: ClipboardCheck,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Overall Average',
      value: data?.overall_percentage ? `${data.overall_percentage}%` : 'N/A',
      icon: BarChart,
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'Unpaid Months',
      value: data?.unpaid_count ?? 0,
      icon: CreditCard,
      color: 'bg-yellow-100 text-yellow-600',
    },
    {
      label: 'Best Rank',
      value: data?.best_rank ? `#${data.best_rank}` : 'N/A',
      icon: Trophy,
      color: 'bg-purple-100 text-purple-600',
    },
  ]

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 mb-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Performance */}
      {data?.recent_performance && data.recent_performance.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Exam Performance</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exam</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.recent_performance.slice(0, 5).map((perf, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{perf.exam_name}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(perf.exam_date)}</td>
                      <td className="px-4 py-3">
                        {perf.is_absent ? (
                          <span className="text-red-600 font-medium">Absent</span>
                        ) : perf.percentage !== null ? (
                          <span className={`font-bold ${perf.percentage >= 80 ? 'text-green-600' : perf.percentage >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {perf.percentage}%
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{perf.rank ? `#${perf.rank}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
