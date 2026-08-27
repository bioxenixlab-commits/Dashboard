import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Select } from '@/components/ui/Input'
import { Label } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Table } from '@/components/ui/Table'
import { ChevronLeft, ChevronRight, CalendarDays, Calendar } from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday, isSameDay } from 'date-fns'
import { cn, getAttendanceStatusColor, getAttendanceStatusIcon, formatDate } from '@/lib/utils'

interface StudentAttendanceRecord {
  date: string
  status: 'present' | 'absent' | 'late' | 'excused'
  status_display: string
  notes: string
}

interface StudentAttendanceStats {
  total_days: number
  present_count: number
  absent_count: number
  late_count: number
  excused_count: number
  attendance_rate: number
}

export function StudentAttendanceTab() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  // Fetch attendance records for calendar
  const { data: calendarData, isLoading: calendarLoading } = useQuery<StudentAttendanceRecord[]>({
    queryKey: ['student-attendance-calendar', selectedYear, currentMonth.getMonth() + 1],
    queryFn: async () => {
      const response = await api.get(`/attendance/student_calendar/?year=${selectedYear}&month=${currentMonth.getMonth() + 1}`)
      return response.data.records
    },
  })

  // Fetch yearly stats
  const { data: statsData, isLoading: statsLoading } = useQuery<StudentAttendanceStats>({
    queryKey: ['student-attendance-stats', selectedYear],
    queryFn: async () => {
      const response = await api.get(`/attendance/student_stats/?year=${selectedYear}`)
      return response.data
    },
  })

  const attendanceMap = new Map(calendarData?.map(r => [r.date, r]) || [])

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev)
      newMonth.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1))
      return newMonth
    })
  }

  const goToCurrentMonth = () => {
    setCurrentMonth(new Date())
    setSelectedYear(new Date().getFullYear())
  }

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const days = []
  let day = calendarStart
  while (day <= calendarEnd) {
    days.push(new Date(day))
    day = addDays(day, 1)
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 10 }, (_, i) => ({
    value: currentYear - 2 + i,
    label: String(currentYear - 2 + i),
  }))

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-green-600">{statsData?.present_count ?? 0}</p>
            <p className="text-sm text-gray-500">Present</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-red-600">{statsData?.absent_count ?? 0}</p>
            <p className="text-sm text-gray-500">Absent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-yellow-600">{statsData?.late_count ?? 0}</p>
            <p className="text-sm text-gray-500">Late</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-purple-600">{statsData?.attendance_rate?.toFixed(1) ?? 0}%</p>
            <p className="text-sm text-gray-500">Attendance Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar View */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-gray-800">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <Select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-28"
            >
              {yearOptions.map((y) => (
                <option key={y.value} value={y.value}>{y.label}</option>
              ))}
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => navigateMonth('prev')} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={goToCurrentMonth} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <CalendarDays className="w-4 h-4 mr-1" />
              This Month
            </button>
            <button onClick={() => navigateMonth('next')} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  {weekDays.map((d) => (
                    <th key={d} className="px-2 py-2 text-xs font-medium text-gray-500 text-center">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const rows = []
                  for (let i = 0; i < days.length; i += 7) {
                    rows.push(days.slice(i, i + 7))
                  }
                  return rows.map((week, weekIdx) => (
                    <tr key={weekIdx}>
                      {week.map((day) => {
                        const dateStr = format(day, 'yyyy-MM-dd')
                        const record = attendanceMap.get(dateStr)
                        const isCurrentMonth = isSameMonth(day, currentMonth)
                        const isTodayDate = isToday(day)
                        
                        return (
                          <td key={dateStr} className={cn(
                            'relative h-20 w-14 border border-gray-100 p-1',
                            !isCurrentMonth && 'bg-gray-50',
                            isTodayDate && 'ring-2 ring-primary-500'
                          )}>
                            <span className={cn(
                              'text-xs font-medium',
                              isTodayDate ? 'text-primary-600' : 'text-gray-600',
                              !isCurrentMonth && 'text-gray-300'
                            )}>
                              {format(day, 'd')}
                            </span>
                            {record && (
                              <div className="mt-1 flex items-center justify-center">
                                <Badge 
                                  variant={record.status === 'present' ? 'success' : 
                                          record.status === 'absent' ? 'danger' :
                                          record.status === 'late' ? 'warning' : 'info'}
                                  className="text-[10px] px-1.5 py-0.5"
                                >
                                  {getAttendanceStatusIcon(record.status)}
                                </Badge>
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
          </div>
          
          {/* Legend */}
          <div className="p-4 border-t border-gray-100 flex flex-wrap gap-4 justify-center">
            {(['present', 'absent', 'late', 'excused'] as const).map((status) => (
              <div key={status} className="flex items-center space-x-1">
                <Badge variant={status === 'present' ? 'success' : status === 'absent' ? 'danger' : status === 'late' ? 'warning' : 'info'} className="text-xs">
                  {getAttendanceStatusIcon(status)}
                </Badge>
                <span className="text-xs text-gray-600 capitalize">{status}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed List View */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table
            data={calendarData?.slice().reverse() || []}
            columns={[
              { key: 'date', header: 'Date', render: (r: StudentAttendanceRecord) => formatDate(r.date) },
              { 
                key: 'status', 
                header: 'Status',
                render: (r: StudentAttendanceRecord) => (
                  <Badge variant={
                    r.status === 'present' ? 'success' :
                    r.status === 'absent' ? 'danger' :
                    r.status === 'late' ? 'warning' : 'info'
                  }>
                    {r.status_display}
                  </Badge>
                )
              },
              { key: 'notes', header: 'Notes', render: (r: StudentAttendanceRecord) => r.notes || '-' },
            ]}
            keyExtractor={(r) => r.date}
            isLoading={calendarLoading}
            emptyMessage="No attendance records for this period"
            hoverable
          />
        </CardContent>
      </Card>
    </div>
  )
}