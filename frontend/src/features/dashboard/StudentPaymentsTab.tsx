import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Select } from '@/components/ui/Input'
import { Label } from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { formatDate, formatCurrency, getMonthName } from '@/lib/utils'

interface StudentPayment {
  month: number
  month_name: string
  year: number
  amount: number
  is_paid: boolean
  paid_date: string | null
}

export function StudentPaymentsTab() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 10 }, (_, i) => ({
    value: currentYear - 2 + i,
    label: String(currentYear - 2 + i),
  }))

  const { data, isLoading } = useQuery<{ payments: StudentPayment[] }>({
    queryKey: ['student-payments', selectedYear],
    queryFn: async () => {
      const response = await api.get(`/auth/student/payments/?year=${selectedYear}`)
      return response.data
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Payment Status</h3>
        <div className="flex items-center space-x-2">
          <Label className="mb-0">Year:</Label>
          <Select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-32"
          >
            {yearOptions.map((y) => (
              <option key={y.value} value={y.value}>{y.label}</option>
            ))}
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table
            data={data?.payments || []}
            columns={[
              { 
                key: 'month_name', 
                header: 'Month',
                render: (p: StudentPayment) => `${p.month_name} ${p.year}`
              },
              { 
                key: 'amount', 
                header: 'Amount',
                render: (p: StudentPayment) => formatCurrency(p.amount)
              },
              { 
                key: 'status', 
                header: 'Status',
                render: (p: StudentPayment) => (
                  <Badge variant={p.is_paid ? 'success' : 'danger'}>
                    {p.is_paid ? 'Paid' : 'Unpaid'}
                  </Badge>
                )
              },
              { 
                key: 'paid_date', 
                header: 'Paid Date',
                render: (p: StudentPayment) => p.paid_date ? formatDate(p.paid_date) : '-'
              },
            ]}
            keyExtractor={(p) => `${p.year}-${p.month}`}
            isLoading={isLoading}
            emptyMessage="No payment records for this year"
            hoverable
          />
        </CardContent>
      </Card>
    </div>
  )
}
