'use client'

import { useState } from 'react'

type Series = {
  label: string
  color: string
  data: number[]
}

type LineChartProps = {
  labels: string[]
  series: Series[]
  height?: number
  formatValue?: (v: number) => string
}

const WIDTH = 800

export default function LineChart({ labels, series, height = 300, formatValue }: LineChartProps) {

  const [hover, setHover] = useState<{ seriesIndex: number; pointIndex: number } | null>(null)

  const padLeft = 56
  const padRight = 16
  const padTop = 16
  const padBottom = 32

  const plotWidth = WIDTH - padLeft - padRight
  const plotHeight = height - padTop - padBottom

  const allValues = series.flatMap((s) => s.data)
  const rawMax = Math.max(1, ...allValues)

  function niceMax(v: number) {

    const magnitude = Math.pow(10, Math.floor(Math.log10(v || 1)))
    const normalized = v / magnitude

    let step = 1

    if (normalized > 5) step = 10
    else if (normalized > 2) step = 5
    else if (normalized > 1) step = 2

    return Math.ceil(v / (step * magnitude)) * step * magnitude

  }

  const maxVal = niceMax(rawMax * 1.1)
  const tickCount = 4

  function xFor(i: number) {

    if (labels.length <= 1) return padLeft + plotWidth / 2

    return padLeft + (i / (labels.length - 1)) * plotWidth

  }

  function yFor(v: number) {
    return padTop + plotHeight - (v / maxVal) * plotHeight
  }

  const fmt = formatValue || ((v: number) => v.toLocaleString('en-IN'))

  return (

    <div className="w-full">

      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">

        {Array.from({ length: tickCount + 1 }).map((_, i) => {

          const v = (maxVal / tickCount) * i
          const y = yFor(v)

          return (

            <g key={i}>

              <line x1={padLeft} y1={y} x2={WIDTH - padRight} y2={y} stroke="#E4E4E7" strokeWidth={1} />

              <text x={padLeft - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#A1A1AA">
                {v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : v.toFixed(0)}
              </text>

            </g>

          )

        })}

        {labels.map((label, i) => (

          <text key={i} x={xFor(i)} y={height - 8} textAnchor="middle" fontSize={11} fill="#71717A">
            {label}
          </text>

        ))}

        {series.map((s, si) => {

          const points = s.data.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ')

          return (

            <g key={s.label}>

              <polyline
                points={points}
                fill="none"
                stroke={s.color}
                strokeWidth={si === 0 ? 3 : 2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {s.data.map((v, i) => (

                <circle
                  key={i}
                  cx={xFor(i)}
                  cy={yFor(v)}
                  r={hover?.seriesIndex === si && hover?.pointIndex === i ? 5 : 3}
                  fill={s.color}
                  stroke="white"
                  strokeWidth={1.5}
                  onMouseEnter={() => setHover({ seriesIndex: si, pointIndex: i })}
                  onMouseLeave={() => setHover(null)}
                  className="cursor-pointer"
                />

              ))}

            </g>

          )

        })}

        {hover && (

          <g>

            {(() => {

              const s = series[hover.seriesIndex]
              const v = s.data[hover.pointIndex]
              const x = xFor(hover.pointIndex)
              const y = yFor(v)
              const text = `${s.label}: Rs. ${fmt(v)}`
              const boxWidth = text.length * 6.2 + 16

              let boxX = x - boxWidth / 2
              boxX = Math.max(padLeft, Math.min(WIDTH - padRight - boxWidth, boxX))

              return (

                <g>

                  <rect
                    x={boxX}
                    y={Math.max(0, y - 34)}
                    width={boxWidth}
                    height={24}
                    rx={6}
                    fill="#18181B"
                  />

                  <text
                    x={boxX + boxWidth / 2}
                    y={Math.max(0, y - 34) + 16}
                    textAnchor="middle"
                    fontSize={11}
                    fill="white"
                  >
                    {text}
                  </text>

                </g>

              )

            })()}

          </g>

        )}

      </svg>

      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">

        {series.map((s) => (

          <div key={s.label} className="flex items-center gap-1.5">

            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-zinc-600">{s.label}</span>

          </div>

        ))}

      </div>

    </div>

  )

}
