'use client'

import { useEffect, useRef, useState } from 'react'

type DatePickerProps = {
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function parseValue(value: string) {

  if (!value) {

    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth(), day: null as number | null }

  }

  const [y, m, d] = value.split('-')

  return { year: Number(y), month: Number(m) - 1, day: Number(d) }

}

function formatValue(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function dateLabel(value: string, placeholder: string) {

  if (!value) return placeholder

  const { year, month, day } = parseValue(value)

  if (day === null) return placeholder

  const date = new Date(year, month, day)

  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })

}

function todayValue() {

  const now = new Date()

  return formatValue(now.getFullYear(), now.getMonth(), now.getDate())

}

export default function DatePicker({ value, onChange, className = '', placeholder = 'Select date' }: DatePickerProps) {

  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => parseValue(value).year)
  const [viewMonth, setViewMonth] = useState(() => parseValue(value).month)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {

    if (open) {

      const parsed = parseValue(value)

      setViewYear(parsed.year)
      setViewMonth(parsed.month)

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
  const today = todayValue()

  function shiftMonth(delta: number) {

    let m = viewMonth + delta
    let y = viewYear

    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }

    setViewMonth(m)
    setViewYear(y)

  }

  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const startWeekday = firstOfMonth.getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells: (number | null)[] = []

  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

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

        <span className="flex-1 text-left truncate">{dateLabel(value, placeholder)}</span>

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

        <div className="absolute z-40 mt-2 bg-white border border-zinc-200 rounded-2xl shadow-xl p-4 w-72">

          <div className="flex items-center justify-between mb-3">

            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:bg-zinc-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <span className="font-semibold text-sm text-zinc-900">
              {new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>

            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:bg-zinc-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">

            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-xs font-medium text-zinc-400 py-1">{w}</div>
            ))}

          </div>

          <div className="grid grid-cols-7 gap-1">

            {cells.map((d, i) => {

              if (d === null) return <div key={i} />

              const cellValue = formatValue(viewYear, viewMonth, d)
              const isSelected = selected.day !== null && cellValue === value
              const isToday = cellValue === today

              return (

                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onChange(cellValue)
                    setOpen(false)
                  }}
                  className={
                    isSelected
                      ? 'aspect-square rounded-lg text-sm font-semibold bg-indigo-600 text-white'
                      : isToday
                        ? 'aspect-square rounded-lg text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                        : 'aspect-square rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-100'
                  }
                >

                  {d}

                </button>

              )

            })}

          </div>

          <button
            type="button"
            onClick={() => {
              onChange(today)
              setOpen(false)
            }}
            className="w-full mt-3 py-2 rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
          >

            Today

          </button>

        </div>

      )}

    </div>

  )

}
