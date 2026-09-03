'use client'

import { useEffect, useRef, useState } from 'react'

type MonthPickerProps = {
  value: string
  onChange: (value: string) => void
  className?: string
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function parseValue(value: string) {

  if (!value) {

    const now = new Date()
    return { year: now.getFullYear(), month: null as number | null }

  }

  const [y, m] = value.split('-')

  return { year: Number(y), month: Number(m) - 1 }

}

function formatValue(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`
}

function monthLabel(value: string) {

  if (!value) return 'Select month'

  const { year, month } = parseValue(value)

  if (month === null) return 'Select month'

  const date = new Date(year, month, 1)

  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

}

export default function MonthPicker({ value, onChange, className = '' }: MonthPickerProps) {

  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => parseValue(value).year)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {

    if (open) {
      setViewYear(parseValue(value).year)
    }

  }, [open, value])

  useEffect(() => {

    function handleClickOutside(e: MouseEvent) {

      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }

    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => document.removeEventListener('mousedown', handleClickOutside)

  }, [open])

  const selected = parseValue(value)

  return (

    <div ref={containerRef} className={`relative inline-block ${className}`}>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-white border border-zinc-300 rounded-xl pl-4 pr-3 py-2.5 text-sm font-medium text-zinc-700 outline-none transition-colors hover:border-zinc-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 min-w-[170px]"
      >

        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="w-4 h-4 text-zinc-400 flex-shrink-0"
        >
          <rect x="3" y="4" width="18" height="17" rx="3" />
          <path d="M3 9h18M8 3v3M16 3v3" strokeLinecap="round" />
        </svg>

        <span className="flex-1 text-left truncate">{monthLabel(value)}</span>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`w-3.5 h-3.5 text-zinc-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

      </button>

      {open && (

        <div className="absolute z-40 mt-2 bg-white border border-zinc-200 rounded-2xl shadow-xl p-4 w-64">

          <div className="flex items-center justify-between mb-3">

            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:bg-zinc-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <span className="font-semibold text-sm text-zinc-900">{viewYear}</span>

            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:bg-zinc-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

          </div>

          <div className="grid grid-cols-3 gap-2">

            {MONTHS.map((m, i) => {

              const isSelected = selected.month === i && selected.year === viewYear

              return (

                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    onChange(formatValue(viewYear, i))
                    setOpen(false)
                  }}
                  className={
                    isSelected
                      ? 'py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white'
                      : 'py-2 rounded-lg text-sm font-medium text-zinc-600 hover:bg-indigo-50 hover:text-indigo-700'
                  }
                >

                  {m}

                </button>

              )

            })}

          </div>

        </div>

      )}

    </div>

  )

}
