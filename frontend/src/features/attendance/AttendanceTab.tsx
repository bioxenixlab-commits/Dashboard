import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Filter, Calendar, Download, Check, X, Minus, Plus, Loader2, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { api } from '@/lib/api'
import { Student, Attendance, AttendanceSession, Batch, PaginatedResponse } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Input'
import { Select } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Dropdown } from '@/components/ui/Dropdown'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/hooks/useToast'
import { cn, getBatchDisplayName, getClassLabel, getAttendanceStatusColor, getAttendanceStatusIcon, formatDate } from '@/lib/utils'

const ATTENDANCE_STATUS_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'excused', label: 'Excused' },
]

const CLASS_OPTIONS = [
  { value: 6, label: 'Class 6' },
  { value: 7, label: 'Class 7' },
  { value: 8, label: 'Class 8' },
  { value: 9, label: 'Class 9' },
  { value: 10, label: 'Class 10' },
]

export function AttendanceTab() {
  const queryClient = useQueryClient()
  const { success: toastSuccess, error: toastError } = useToast()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedClass, setSelectedClass] = useState<number | ''>('')
  const [selectedBatch, setSelectedBatch] = useState<number | ''>('')
  const [attendanceRecords, setAttendanceRecords] = useState<Record<number, string>>({})

  // Fetch all batches
  const { data: allBatchesData } = useQuery({
    queryKey: ['batches', 'all'],
    queryFn: async () => {
      const response = await api.get(`/batches/`)
      return Array.isArray(response.data) ? response.data : response.data.results || []
    },
  })
  const allBatches = Array.isArray(allBatchesData) ? allBatchesData : []
  const batches = selectedClass ? allBatches.filter((b: Batch) => b.student_class === selectedClass) : allBatches

  // Fetch today's attendance
  const { data: todayData, isLoading: todayLoading, refetch: refetchToday } = useQuery({
    queryKey: ['attendance-today', { date: selectedDate, class: selectedClass, batch: selectedBatch }],
    queryFn: async () => {
      if (!selectedClass) return { date: selectedDate, records: [] }
      const params = new URLSearchParams()
      params.append('date', selectedDate)
      params.append('class', selectedClass.toString())
      if (selectedBatch) params.append('batch', selectedBatch.toString())
      const response = await api.get(`/attendance/today/?${params.toString()}`)
      return response.data
    },
    enabled: !!selectedClass,
  })

  // Initialize attendance records from today's data
  useEffect(() => {
    if (todayData?.records) {
      const records: Record<number, string> = {}
      todayData.records.forEach((item: { student: Student; attendance: Attendance | null }) => {
        if (item.attendance) {
          records[item.student.id] = item.attendance.status
        }
      })
      setAttendanceRecords(records)
    }
  }, [todayData])

  // Auto-save attendance mutation
  const saveAttendanceMutation = useMutation({
    mutationFn: async ({ studentId, status, date }: { studentId: number; status: string; date: string }) => {
      const response = await api.post('/attendance/auto_save/', { student_id: studentId, status, date })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] })
      toastSuccess('Attendance saved')
    },
    onError: (error: Error) => toastError(error.message),
  })

  // Bulk save attendance
  const bulkSaveMutation = useMutation({
    mutationFn: async ({ date, records, class: classId, batch }: { date: string; records: { student_id: number; status: string }[]; class: number; batch?: number }) => {
      const response = await api.post('/attendance/bulk_create/', { date, records, student_class: classId, batch_id: batch })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] })
      toastSuccess('Attendance saved for all students')
    },
    onError: (error: Error) => toastError(error.message),
  })

  const handleAttendanceChange = (studentId: number, status: string) => {
    setAttendanceRecords(prev => ({ ...prev, [studentId]: status }))
    // Auto-save to server
    saveAttendanceMutation.mutate({ studentId, status, date: selectedDate })
  }

  const handleBulkSave = () => {
    if (!selectedClass) return
    const records = Object.entries(attendanceRecords).map(([studentId, status]) => ({
      student_id: Number(studentId),
      status,
    }))
    bulkSaveMutation.mutate({ 
      date: selectedDate, 
      records, 
      class: selectedClass, 
      batch: selectedBatch || undefined 
    })
  }

  const handleDateChange = (direction: 'prev' | 'next') => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() + (direction === 'next' ? 1 : -1))
    const newDate = date.toISOString().split('T')[0]
    setSelectedDate(newDate)
    setAttendanceRecords({})
  }

  const goToToday = () => {
    const today = new Date().toISOString().split('T')[0]
    setSelectedDate(today)
    setAttendanceRecords({})
  }

  const batchOptions = batches.map(b => ({ value: b.id, label: b.display_name }))

  // Get students for the selected class/batch
  const { data: studentsData } = useQuery({
    queryKey: ['students-for-attendance', { class: selectedClass, batch: selectedBatch }],
    queryFn: async () => {
      if (!selectedClass) return []
      const params = new URLSearchParams()
      params.append('class', selectedClass.toString())
      if (selectedBatch) params.append('batch', selectedBatch.toString())
      const response = await api.get(`/students/?${params.toString()}`)
      return response.data.results || []
    },
    enabled: !!selectedClass,
  })

  const students = studentsData || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Attendance</h2>
          <p className="text-sm text-gray-500">Mark daily attendance for students</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" onClick={() => handleDateChange('prev')}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={goToToday} className="px-4">
            <CalendarDays className="w-4 h-4 mr-1" />
            Today
          </Button>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); setAttendanceRecords({}); }}
            className="w-36"
          />
          <Button variant="ghost" size="sm" onClick={() => handleDateChange('next')}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <Dropdown
            options={[{ value: '', label: 'Select Class' }, ...CLASS_OPTIONS]}
            value={selectedClass}
            onChange={(v) => {
              setSelectedClass(v as number | '')
              setSelectedBatch('')
              setAttendanceRecords({})
            }}
            placeholder="Select Class"
            className="w-48"
          />
          <Dropdown
            options={[{ value: '', label: 'All Batches' }, ...batchOptions]}
            value={selectedBatch}
            onChange={(v) => { setSelectedBatch(v as number | ''); setAttendanceRecords({}); }}
            placeholder="Filter by Batch"
            className="w-48"
            
          />

        </div>
      </Card>

      {/* Attendance Grid */}
      {selectedClass ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Attendance for {formatDate(selectedDate)}</span>
              <span className="text-sm font-normal text-gray-500">
                {getClassLabel(selectedClass)} {selectedBatch ? ` - ${batches.find(b => b.id === selectedBatch)?.display_name}` : ''}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {todayLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent mx-auto mb-2"></div>
                <p className="text-gray-500">Loading attendance...</p>
              </div>
            ) : students.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No students found for this class/batch
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Present</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Absent</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Late</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Excused</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {students.map((student: Student, index) => {
                      const currentStatus = attendanceRecords[student.id] || 'present'
                      return (
                        <tr key={student.id} className={index % 2 === 1 ? 'bg-gray-50/50' : ''}>
                          <td className="px-4 py-3 text-sm text-gray-500">{student.roll}</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-700">{student.student_id}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{student.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{getBatchDisplayName(student.batch)}</td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="radio"
                              name={`attendance_${student.id}`}
                              value="present"
                              checked={currentStatus === 'present'}
                              onChange={() => handleAttendanceChange(student.id, 'present')}
                              className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="radio"
                              name={`attendance_${student.id}`}
                              value="absent"
                              checked={currentStatus === 'absent'}
                              onChange={() => handleAttendanceChange(student.id, 'absent')}
                              className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="radio"
                              name={`attendance_${student.id}`}
                              value="late"
                              checked={currentStatus === 'late'}
                              onChange={() => handleAttendanceChange(student.id, 'late')}
                              className="w-4 h-4 text-yellow-600 border-gray-300 focus:ring-yellow-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="radio"
                              name={`attendance_${student.id}`}
                              value="excused"
                              checked={currentStatus === 'excused'}
                              onChange={() => handleAttendanceChange(student.id, 'excused')}
                              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <Calendar className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">Select a class to start taking attendance</h3>
          <p className="text-gray-500">Choose a class from the dropdown above to view students and mark attendance</p>
        </Card>
      )}
    </div>
  )
}


