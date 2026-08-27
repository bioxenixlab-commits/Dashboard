import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Tab {
  id: string
  label: string
  icon?: ReactNode
  disabled?: boolean
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (tabId: string) => void
  className?: string
  variant?: 'default' | 'pills' | 'underline'
}

export function Tabs({ tabs, activeTab, onChange, className, variant = 'default' }: TabsProps) {
  const variants = {
    default: {
      container: 'border-b border-gray-200',
      tab: 'px-6 py-4 text-sm font-medium border-b-2 -mb-px transition-colors',
      active: 'text-primary-600 border-primary-600',
      inactive: 'text-gray-500 hover:text-gray-700 hover:border-gray-300 border-transparent',
    },
    pills: {
      container: '',
      tab: 'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
      active: 'bg-primary-100 text-primary-700',
      inactive: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
    },
    underline: {
      container: 'border-b border-gray-200',
      tab: 'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
      active: 'text-primary-600 border-primary-600',
      inactive: 'text-gray-500 hover:text-gray-700 border-transparent',
    },
  }

  const styles = variants[variant]

  return (
    <nav className={cn(styles.container, className)} aria-label="Tabs">
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && onChange(tab.id)}
            disabled={tab.disabled}
            className={cn(
              styles.tab,
              tab.disabled ? 'opacity-50 cursor-not-allowed' : '',
              activeTab === tab.id ? styles.active : styles.inactive
            )}
          >
            {tab.icon && <span className="mr-2">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  )
}

interface TabPanelProps {
  isActive: boolean
  children: ReactNode
  className?: string
}

export function TabPanel({ isActive, children, className }: TabPanelProps) {
  if (!isActive) return null
  return <div className={cn('animate-fade-in', className)}>{children}</div>
}