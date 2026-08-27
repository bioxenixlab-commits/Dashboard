import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('bn-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return months[month - 1] || ''
}

export function getClassLabel(classNum: number): string {
  return `Class ${classNum}`
}

export function getBatchDisplayName(batch: { name: string; student_class: number } | null): string {
  if (!batch) return ''
  return `Class ${batch.student_class} - ${batch.name}`
}

export function getAttendanceStatusColor(status: string): string {
  switch (status) {
    case 'present': return 'text-green-600 bg-green-100'
    case 'absent': return 'text-red-600 bg-red-100'
    case 'late': return 'text-yellow-600 bg-yellow-100'
    case 'excused': return 'text-blue-600 bg-blue-100'
    default: return 'text-gray-600 bg-gray-100'
  }
}

export function getAttendanceStatusIcon(status: string): string {
  switch (status) {
    case 'present': return '✓'
    case 'absent': return '✗'
    case 'late': return '⏰'
    case 'excused': return '⊘'
    default: return '?'
  }
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function generateStudentId(sscSession: number, serial: number): string {
  return `${sscSession}${serial.toString().padStart(3, '0')}`
}

export function parseStudentId(studentId: string): { session: number; serial: number } | null {
  const match = studentId.match(/^(\d{2})(\d{3})$/)
  if (!match) return null
  return {
    session: parseInt(match[1], 10),
    serial: parseInt(match[2], 10),
  }
}