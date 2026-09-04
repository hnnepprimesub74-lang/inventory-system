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
  const slices = data.filter((d) => d.value > 0)

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

  return (

    <div className="flex flex-wrap items-center gap-6">

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>

        {arcs.length === 0 ? (

          <circle cx={center} cy={center} r={radius} fill="#F4F4F5" />

        ) : (

          arcs.map((a, i) => (

            <path
              key={a.label}
              d={a.path}
              fill={a.color}
              opacity={hoverIndex === null || hoverIndex === i ? 1 : 0.35}
              stroke="#fff"
              strokeWidth={1}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            />

          ))

        )}

      </svg>

      <div className="space-y-2 min-w-[180px]">

        {arcs.length === 0 ? (

          <p className="text-sm text-zinc-500">No data yet.</p>

        ) : (

          arcs.map((a, i) => (

            <div
              key={a.label}
              className="flex items-center justify-between gap-3 text-sm cursor-default"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              style={{ opacity: hoverIndex === null || hoverIndex === i ? 1 : 0.5 }}
            >

              <div className="flex items-center gap-2 min-w-0">

                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
                <span className="text-zinc-600 truncate">{a.label}</span>

              </div>

              <div className="text-right flex-shrink-0">

                <span className="font-semibold text-zinc-900 tabular-nums">{format(a.value)}</span>
                <span className="text-zinc-400 ml-1.5 tabular-nums">{(a.fraction * 100).toFixed(1)}%</span>

              </div>

            </div>

          ))

        )}

      </div>

    </div>

  )

}
