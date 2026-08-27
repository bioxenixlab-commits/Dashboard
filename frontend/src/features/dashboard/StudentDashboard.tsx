import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LayoutGrid, BarChart, CreditCard, Bell, BookOpen, ClipboardCheck, Calendar, Clock } from 'lucide-react'
import { api } from '@/lib/api'
import { StudentDashboardStats } from './StudentDashboardStats'
import { StudentPerformanceTab } from './StudentPerformanceTab'
import { StudentPaymentsTab } from './StudentPaymentsTab'
import { StudentNoticesTab } from './StudentNoticesTab'
import { StudentHomeworkTab } from './StudentHomeworkTab'
import { StudentExamsTab } from './StudentExamsTab'
import { StudentAttendanceTab } from './StudentAttendanceTab'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'

type StudentTabId = 'dashboard' | 'performance' | 'payments' | 'notices' | 'homework' | 'exams' | 'attendance'

const tabs: { id: StudentTabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'performance', label: 'Performance', icon: BarChart },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'notices', label: 'Notices', icon: Bell },
  { id: 'homework', label: 'Homework', icon: BookOpen },
  { id: 'exams', label: 'Exams', icon: ClipboardCheck },
  { id: 'attendance', label: 'Attendance', icon: Calendar },
]

export function StudentDashboard() {
  const { student } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as StudentTabId) || 'dashboard'
  const [activeTab, setActiveTab] = useState<StudentTabId>(initialTab)

  const handleTabChange = (tab: StudentTabId) => {
    setActiveTab(tab)
    setSearchParams({ tab }, { replace: true })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Stats Cards - only on dashboard tab */}
      {activeTab === 'dashboard' && <StudentDashboardStats />}

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex -mb-px min-w-max" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  tab-btn px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors
                  ${activeTab === tab.id
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-300'
                  }
                `}
              >
                <tab.icon className="w-5 h-5 mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <h2 className="text-xl font-semibold text-gray-800">Welcome, {student?.name}!</h2>
                <p className="text-sm text-gray-500">Here is your latest updates</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <StudentNoticesPanel onViewAll={() => handleTabChange('notices')} />
                <StudentUpcomingExamsPanel onViewAll={() => handleTabChange('exams')} />
              </div>
            </div>
          )}
          
          {activeTab === 'performance' && <StudentPerformanceTab />}
          {activeTab === 'payments' && <StudentPaymentsTab />}
          {activeTab === 'notices' && <StudentNoticesTab />}
          {activeTab === 'homework' && <StudentHomeworkTab />}
          {activeTab === 'exams' && <StudentExamsTab />}
          {activeTab === 'attendance' && <StudentAttendanceTab />}
        </div>
      </div>
    </div>
  )
}
function StudentNoticesPanel({ onViewAll }: { onViewAll: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["notices", "dashboard", "student"],
    queryFn: async () => {
      const res = await api.get("/notices/student_notices/")
      return Array.isArray(res.data) ? res.data : res.data.results || res.data || []
    },
  })
  const notices = Array.isArray(data) ? data.slice(0, 5) : []
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center"><Bell className="w-4 h-4 mr-2" /> Latest Notices</CardTitle>
        <button onClick={onViewAll} className="text-sm text-green-600 hover:underline">View all</button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : notices.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No notices</p>
        ) : (
          <div className="space-y-3">
            {notices.map((n: any) => {
              const bg = n.priority === 'urgent' ? 'bg-red-50 border-red-200' : n.priority === 'high' ? 'bg-amber-50 border-amber-200' : n.priority === 'normal' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
              return (
                <div key={n.id} className={`p-3 border-2 rounded-lg ${bg}`}>
                  <div className="flex items-start justify-between">
                    <p className="font-medium text-sm text-gray-800 line-clamp-1">{n.title}</p>
                    <Badge variant={n.priority === "urgent" ? "danger" : n.priority === "high" ? "warning" : "info"} className="ml-2 text-[10px]">{n.priority}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{n.content}</p>
                  <p className="text-[11px] text-gray-400 mt-2">{formatDate(n.created_at)}</p>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StudentUpcomingExamsPanel({ onViewAll }: { onViewAll: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["exams", "student", "dashboard"],
    queryFn: async () => {
      const res = await api.get("/exams/student_exams/")
      const all = [...(res.data.upcoming || []), ...(res.data.published || [])]
      return all.filter((e: any) => e.is_upcoming || !e.result).slice(0, 5)
    },
  })
  const exams = Array.isArray(data) ? data : []
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center"><Clock className="w-4 h-4 mr-2" /> Upcoming Exams</CardTitle>
        <button onClick={onViewAll} className="text-sm text-green-600 hover:underline">View all</button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : exams.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No upcoming exams</p>
        ) : (
          <div className="space-y-3">
            {exams.map((e: any) => (
              <div key={e.id} className="p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                <p className="font-medium text-sm text-gray-800">{e.name}</p>
                <p className="text-xs text-gray-500 mt-1">{e.total_marks} marks â€¢ {formatDate(e.exam_date)}</p>
                <p className="text-[11px] text-gray-400 mt-1">{e.result ? `Your score: ${e.result.marks_obtained ?? "-"} ${e.result.is_absent ? "(Absent)" : ""}` : "Not yet taken"}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
