import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Users, CreditCard, ClipboardCheck, Bell, BookOpen, Calendar, LayoutGrid, Building2, Clock, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { StatsCards } from './StatsCards'
import { StudentsTab } from '@/features/students/StudentsTab'
import { PaymentsTab } from '@/features/payments/PaymentsTab'
import { ExamsTab } from '@/features/exams/ExamsTab'
import { NoticesTab } from '@/features/notices/NoticesTab'
import { HomeworkTab } from '@/features/homework/HomeworkTab'
import { AttendanceTab } from '@/features/attendance/AttendanceTab'
import { BatchesTab } from '@/features/batches/BatchesTab'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'

type TabId = 'dashboard' | 'students' | 'batches' | 'payments' | 'exams' | 'notices' | 'homework' | 'attendance'

const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'batches', label: 'Batches', icon: Building2 },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'exams', label: 'Exams', icon: ClipboardCheck },
  { id: 'notices', label: 'Notices', icon: Bell },
  { id: 'homework', label: 'Homework', icon: BookOpen },
  { id: 'attendance', label: 'Attendance', icon: Calendar },
]

export function TeacherDashboard({ defaultTab }: { defaultTab?: TabId }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as TabId) || defaultTab || 'dashboard'
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab)
    setSearchParams({ tab }, { replace: true })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards - only show on dashboard tab */}
        {activeTab === 'dashboard' && <StatsCards />}

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
                      ? 'text-primary-600 border-b-2 border-primary-600'
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

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <TeacherNoticesPanel onViewAll={() => handleTabChange('notices')} />
                  <TeacherUpcomingExamsPanel onViewAll={() => handleTabChange('exams')} />
                </div>
                <div className="text-center py-6 border-t border-gray-100">
                  <p className="text-sm text-gray-500">Select a tab above to manage students, payments, exams, and more.</p>
                </div>
              </div>
            )}
            
            {activeTab === 'students' && <StudentsTab />}
            {activeTab === 'batches' && <BatchesTab />}
            {activeTab === 'payments' && <PaymentsTab />}
            {activeTab === 'exams' && <ExamsTab />}
            {activeTab === 'notices' && <NoticesTab />}
            {activeTab === 'homework' && <HomeworkTab />}
            {activeTab === 'attendance' && <AttendanceTab />}
          </div>
        </div>
      </div>
  )
}
function TeacherNoticesPanel({ onViewAll }: { onViewAll: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["notices", "dashboard", "teacher"],
    queryFn: async () => {
      const res = await api.get("/notices/?page_size=5")
      return Array.isArray(res.data) ? res.data : res.data.results || []
    },
  })
  const notices = (data || []).slice(0, 5)
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center"><Bell className="w-4 h-4 mr-2" /> Latest Notices</CardTitle>
        <button onClick={onViewAll} className="text-sm text-primary-600 hover:underline">View all</button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : notices.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No notices yet</p>
        ) : (
          <div className="space-y-3">
            {notices.map((n: any) => (
              <div key={n.id} className="p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <p className="font-medium text-sm text-gray-800 line-clamp-1">{n.title}</p>
                  <Badge variant={n.priority === "urgent" ? "danger" : n.priority === "high" ? "warning" : "info"} className="ml-2 text-[10px]">{n.priority}</Badge>
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{n.content}</p>
                <p className="text-[11px] text-gray-400 mt-2">{formatDate(n.created_at)}   {n.student_class_display} {n.batch ? `  ${n.batch.display_name}` : "  All batches"}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TeacherUpcomingExamsPanel({ onViewAll }: { onViewAll: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["exams", "upcoming", "teacher"],
    queryFn: async () => {
      const res = await api.get("/exams/upcoming/")
      return Array.isArray(res.data) ? res.data : res.data.results || res.data || []
    },
  })
  const exams = Array.isArray(data) ? data.slice(0, 5) : []
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center"><Clock className="w-4 h-4 mr-2" /> Upcoming Exams</CardTitle>
        <button onClick={onViewAll} className="text-sm text-primary-600 hover:underline">View all</button>
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
                <p className="text-xs text-gray-500 mt-1">Class {e.exam_class} {e.batch ? `  ${e.batch.display_name}` : "  All batches"}   {e.total_marks} marks</p>
                <p className="text-[11px] text-gray-400 mt-1 flex items-center"><Clock className="w-3 h-3 mr-1" />{formatDate(e.exam_date)} {e.is_published ? <Badge variant="success" className="ml-2 text-[10px]">Published</Badge> : <Badge variant="warning" className="ml-2 text-[10px]">Draft</Badge>}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
