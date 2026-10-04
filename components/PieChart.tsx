'use client'

import { useState } from 'react'

type Slice = {
  label: string
  value: number
  color: string
}

type PieChartProps = {
  data: Slice[]
  size?: number
  formatValue?: (v: number) => string
}

export default function PieChart({ data, size = 220, formatValue }: PieChartProps) {

  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const total = data.reduce((s, d) => s + d.value, 0)
  const slices = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value)

  const radius = size / 2
  const center = radius

  function pointOnCircle(angle: number) {

    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    }

  }

  let cursor = -Math.PI / 2

  const arcs = slices.map((s, i) => {

    const fraction = total > 0 ? s.value / total : 0
    const startAngle = cursor
    const endAngle = cursor + fraction * Math.PI * 2

    cursor = endAngle

    const start = pointOnCircle(startAngle)
    const end = pointOnCircle(endAngle)
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0

    const path =
      fraction >= 0.9999
        ? `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius} Z`
        : `M ${center} ${center} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`

    return { ...s, path, fraction }

  })

  const format = formatValue || ((v: number) => 'Rs. ' + v.toLocaleString('en-IN'))
  const hovered = hoverIndex !== null ? arcs[hoverIndex] : null
  const showBars = size >= 200

  return (

    <div className="flex flex-wrap items-center gap-x-10 gap-y-6">

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">

        {arcs.length === 0 ? (

          <circle cx={center} cy={center} r={radius} fill="#F4F4F5" />

        ) : (

          arcs.map((a, i) => (

            <path
              key={a.label}
              d={a.path}
              fill={a.color}
              opacity={hoverIndex === null || hoverIndex === i ? 1 : 0.3}
              stroke="#fff"
              strokeWidth={2}
              style={{ transition: 'opacity 150ms' }}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            />

          ))

        )}

        {arcs.length > 0 && (

          <>

            <circle cx={center} cy={center} r={radius * 0.62} fill="#fff" pointerEvents="none" />

            <text x={center} y={center - size * 0.04} textAnchor="middle" fontSize={size * 0.055} fill="#A1A1AA" pointerEvents="none">
              {hovered ? hovered.label : 'Total'}
            </text>

            <text x={center} y={center + size * 0.065} textAnchor="middle" fontSize={size * 0.075} fontWeight={700} fill="#18181B" pointerEvents="none">
              {format(hovered ? hovered.value : total)}
            </text>

          </>

        )}

      </svg>

      <div className={`space-y-1 flex-1 ${showBars ? 'min-w-[320px] max-w-2xl' : 'min-w-[180px]'}`}>

        {arcs.length === 0 ? (

          <p className="text-sm text-zinc-500">No data yet.</p>

        ) : (

          arcs.map((a, i) => (

            <div
              key={a.label}
              className={`flex items-center gap-3 text-sm cursor-default rounded-lg ${showBars ? 'px-3 py-2' : 'py-0.5'} ${hoverIndex === i ? 'bg-zinc-50' : ''}`}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              style={{ opacity: hoverIndex === null || hoverIndex === i ? 1 : 0.5, transition: 'opacity 150ms' }}
            >

              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />

              <span className={`text-zinc-600 truncate ${showBars ? 'w-40' : 'flex-1'}`}>{a.label}</span>

              {showBars && (

                <div className="flex-1 h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${a.fraction * 100}%`, backgroundColor: a.color }} />
                </div>

              )}

              <span className={`font-semibold text-zinc-900 tabular-nums text-right whitespace-nowrap ${showBars ? 'w-28' : ''}`}>{format(a.value)}</span>
              <span className="text-zinc-400 tabular-nums text-right w-12">{(a.fraction * 100).toFixed(1)}%</span>

            </div>

          ))

        )}

      </div>

    </div>

  )

}
