import { useState, useRef, useEffect, ReactNode } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

interface DropdownOption {
  value: string | number
  label: string
  disabled?: boolean
}

interface DropdownProps {
  options: DropdownOption[]
  value?: string | number
  onChange: (value: string | number) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  searchable?: boolean
}

export function Dropdown({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className,
  disabled,
  searchable = false,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredOptions = searchable
    ? options.filter((opt) => opt.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const selectedOption = options.find((opt) => opt.value === value)

  return (
    <div ref={dropdownRef} className={cn('relative inline-block w-full', className)}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm bg-white',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
          'transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed',
          'flex items-center justify-between',
          value ? 'text-gray-900' : 'text-gray-500'
        )}
      >
        <span>{selectedOption?.label || placeholder}</span>
        <ChevronDown className={cn('w-4 h-4 ml-2 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {searchable && (
            <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                autoFocus
              />
            </div>
          )}
          <ul className="py-1">
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500 text-center">No options found</li>
            ) : (
              filteredOptions.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!option.disabled) {
                        onChange(option.value)
                        setIsOpen(false)
                        setSearch('')
                      }
                    }}
                    disabled={option.disabled}
                    className={cn(
                      'w-full px-3 py-2 text-sm flex items-center justify-between',
                      'hover:bg-gray-100 transition-colors',
                      value === option.value ? 'bg-primary-50 text-primary-600' : 'text-gray-700',
                      option.disabled && 'text-gray-400 cursor-not-allowed'
                    )}
                  >
                    <span>{option.label}</span>
                    {value === option.value && <Check className="w-4 h-4 text-primary-600" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}