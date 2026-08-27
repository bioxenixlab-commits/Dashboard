import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Users, ClipboardCheck, CreditCard, Building2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'

interface Stats {
  total_students: number
  total_exams: number
  unpaid_count: number
  total_batches: number
}

export function StatsCards() {
  const { data, isLoading } = useQuery<Stats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/stats/dashboard/')
      return response.data
    },
  })

  const stats = [
    {
      label: 'Total Students',
      value: data?.total_students ?? 0,
      icon: Users,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Total Exams',
      value: data?.total_exams ?? 0,
      icon: ClipboardCheck,
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'Students with Dues',
      value: data?.unpaid_count ?? 0,
      icon: CreditCard,
      color: 'bg-yellow-100 text-yellow-600',
    },
    {
      label: 'Active Batches',
      value: data?.total_batches ?? 0,
      icon: Building2,
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-800">{stat.value.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}