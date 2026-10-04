'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/fetchAll'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

type Period = 'week' | 'month' | 'lifetime' | 'range'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'lifetime', label: 'Lifetime' },
  { key: 'range', label: 'Range' },
]

function toISODate(d: Date) {

  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  return `${d.getFullYear()}-${m}-${day}`

}

const RANGE_PRESETS: { label: string; get: () => [string, string] }[] = [
  {
    label: 'Today',
    get: () => {
      const t = toISODate(new Date())
      return [t, t]
    },
  },
  {
    label: 'Yesterday',
    get: () => {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      const t = toISODate(d)
      return [t, t]
    },
  },
  {
    label: 'This month',
    get: () => {
      const n = new Date()
      return [toISODate(new Date(n.getFullYear(), n.getMonth(), 1)), toISODate(n)]
    },
  },
  {
    label: 'Last month',
    get: () => {
      const n = new Date()
      return [
        toISODate(new Date(n.getFullYear(), n.getMonth() - 1, 1)),
        toISODate(new Date(n.getFullYear(), n.getMonth(), 0)),
      ]
    },
  },
]

function CalendarIcon() {

  return (

    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-zinc-400 flex-shrink-0">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>

  )

}

export default function MostSellingPage() {

  const router = useRouter()

  const [products, setProducts] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('month')
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')

  useEffect(() => {

    async function init() {

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {

        router.push('/login')
        return

      }

      await load()

    }

    init()

  }, [])

  async function load() {

    const { data: productsData } =
      await supabase.from('products').select('*')

    const salesData = await fetchAll(() =>
      supabase
        .from('stock_transactions')
        .select('product_id, quantity, created_at')
        .eq('transaction_type', 'SELL')
        .order('created_at', { ascending: false })
    )

    setProducts(productsData || [])
    setSales(salesData)
    setLoading(false)

  }

  function periodBounds(): { start: Date | null; end: Date | null } {

    const now = new Date()

    if (period === 'week' || period === 'month') {

      const start = new Date(now)
      start.setDate(start.getDate() - (period === 'week' ? 7 : 30))
      return { start, end: null }

    }

    if (period === 'range') {

      return {
        start: rangeFrom ? new Date(`${rangeFrom}T00:00:00`) : null,
        end: rangeTo ? new Date(`${rangeTo}T23:59:59.999`) : null,
      }

    }

    return { start: null, end: null }

  }

  const { start: periodStart, end: periodEnd } = periodBounds()

  const salesMap: Record<string, number> = {}

  sales.forEach((sale: any) => {

    const soldAt = new Date(sale.created_at)

    if (periodStart && soldAt < periodStart) return
    if (periodEnd && soldAt > periodEnd) return

    salesMap[sale.product_id] = (salesMap[sale.product_id] || 0) + Number(sale.quantity || 0)

  })

  const sellingProducts = products
    .map((product: any) => ({ ...product, sold: salesMap[product.id] || 0 }))
    .filter((p) => p.sold > 0)
    .sort((a, b) => b.sold - a.sold)

  const totalUnitsSold = sellingProducts.reduce((s, p) => s + p.sold, 0)
  const topSeller = sellingProducts[0]

  const periodLabel =
    period === 'week'
      ? 'last 7 days'
      : period === 'month'
      ? 'last 30 days'
      : period === 'lifetime'
      ? 'lifetime'
      : rangeFrom || rangeTo
      ? `${rangeFrom || 'start'} to ${rangeTo || 'today'}`
      : 'all time'

  const soldHeader =
    period === 'week' ? 'Sold (7d)' : period === 'month' ? 'Sold (30d)' : period === 'lifetime' ? 'Lifetime Sold' : 'Sold'

  function exportToExcel() {

    if (sellingProducts.length === 0) {

      alert(`No sales for ${periodLabel}`)
      return

    }

    const rows = sellingProducts.map((p, i) => ({
      Rank: i + 1,
      Product: p.product_name,
      Category: p.category,
      Brand: p.brand,
      Shade: p.shade,
      Weight: p.weight,
      [soldHeader]: p.sold,
      'Current Stock': p.current_stock,
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Most Selling')

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })

    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    })

    saveAs(blob, 'most-selling.xlsx')

  }

  function rankBadgeClasses(rank: number) {

    if (rank === 1) return 'bg-amber-100 text-amber-700 border border-amber-200'
    if (rank === 2) return 'bg-zinc-200 text-zinc-700 border border-zinc-300'
    if (rank === 3) return 'bg-orange-100 text-orange-700 border border-orange-200'

    return 'bg-zinc-100 text-zinc-500 border border-zinc-200'

  }

  function stockBadgeClasses(stock: number) {

    if (stock <= 0) return 'bg-red-100 text-red-700'
    if (stock <= 5) return 'bg-amber-100 text-amber-700'

    return 'bg-emerald-100 text-emerald-700'

  }

  return (

    <div className="text-black">

      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">

          <div>

            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">

              Most Selling Products

            </h1>

            <p className="text-sm text-zinc-500 mt-1">

              Ranked by units sold — {periodLabel}

            </p>

          </div>

          <button
            onClick={exportToExcel}
            className="inline-flex items-center gap-1.5 border border-zinc-300 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-400 transition-colors px-3 py-1.5 rounded-lg text-xs font-medium"
          >

            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M12 3v9" strokeLinecap="round" />
              <path d="M8 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 17h16" strokeLinecap="round" />
            </svg>

            Export

          </button>

        </div>

        <div className="flex items-center gap-3 flex-wrap">

          <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl">

            {PERIODS.map((p) => (

              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  period === p.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >

                {p.label}

              </button>

            ))}

          </div>

        </div>

        {period === 'range' && (

          <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-4 space-y-3">

            <div className="flex items-end gap-3 flex-wrap">

              <label className="flex flex-col gap-1 flex-1 min-w-[140px]">

                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">From</span>

                <div className="flex items-center gap-2 border border-zinc-200 bg-zinc-50 focus-within:bg-white focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 rounded-xl px-3 py-2 transition-colors">

                  <CalendarIcon />

                  <input
                    type="date"
                    value={rangeFrom}
                    max={rangeTo || undefined}
                    onChange={(e) => setRangeFrom(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm font-medium text-zinc-800"
                  />

                </div>

              </label>

              <span className="pb-2.5 text-zinc-300 hidden sm:block">→</span>

              <label className="flex flex-col gap-1 flex-1 min-w-[140px]">

                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">To</span>

                <div className="flex items-center gap-2 border border-zinc-200 bg-zinc-50 focus-within:bg-white focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 rounded-xl px-3 py-2 transition-colors">

                  <CalendarIcon />

                  <input
                    type="date"
                    value={rangeTo}
                    min={rangeFrom || undefined}
                    onChange={(e) => setRangeTo(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm font-medium text-zinc-800"
                  />

                </div>

              </label>

            </div>

            <div className="flex items-center gap-2 flex-wrap">

              {RANGE_PRESETS.map((preset) => (

                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    const [from, to] = preset.get()
                    setRangeFrom(from)
                    setRangeTo(to)
                  }}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                >

                  {preset.label}

                </button>

              ))}

              {(rangeFrom || rangeTo) && (

                <button
                  type="button"
                  onClick={() => {
                    setRangeFrom('')
                    setRangeTo('')
                  }}
                  className="px-3 py-1 rounded-full text-xs font-semibold text-zinc-400 hover:text-red-600 transition-colors"
                >

                  Clear

                </button>

              )}

            </div>

          </div>

        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl shadow-sm px-6 py-5 text-white">

            <p className="text-sm text-indigo-100">Units Sold ({periodLabel})</p>
            <h2 className="text-4xl font-bold tracking-tight mt-1 tabular-nums">{totalUnitsSold.toLocaleString('en-IN')}</h2>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 px-6 py-5">

            <p className="text-sm text-zinc-500">Top Seller</p>

            {topSeller ? (

              <>
                <h2 className="text-xl font-bold tracking-tight mt-1 text-zinc-900 truncate">{topSeller.product_name}</h2>
                <p className="text-sm text-zinc-500 mt-0.5">{topSeller.sold} units sold</p>
              </>

            ) : (

              <h2 className="text-xl font-bold tracking-tight mt-1 text-zinc-400">—</h2>

            )}

          </div>

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          {loading ? (

            <p className="text-zinc-500">Loading...</p>

          ) : sellingProducts.length === 0 ? (

            <p className="text-zinc-500">No sales for {periodLabel}.</p>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full border-collapse">

                <thead>

                  <tr className="text-left border-b border-zinc-200">

                    <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">#</th>
                    <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">Product</th>
                    <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">Category</th>
                    <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">Brand</th>
                    <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">Shade</th>
                    <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">Weight</th>
                    <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-zinc-400 text-right">{soldHeader}</th>
                    <th className="pb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400 text-right">Current Stock</th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-zinc-100">

                  {sellingProducts.map((p, i) => (

                    <tr key={p.id} className="hover:bg-zinc-50 transition-colors">

                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${rankBadgeClasses(i + 1)}`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-semibold text-zinc-900">{p.product_name}</td>
                      <td className="py-3 pr-4 text-sm text-zinc-600">{p.category}</td>
                      <td className="py-3 pr-4 text-sm text-zinc-600">{p.brand}</td>
                      <td className="py-3 pr-4 text-sm text-zinc-600">{p.shade || '—'}</td>
                      <td className="py-3 pr-4 text-sm text-zinc-600">{p.weight || '—'}</td>
                      <td className="py-3 pr-4 text-right tabular-nums font-semibold text-indigo-600">{p.sold}</td>
                      <td className="py-3 text-right">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold tabular-nums ${stockBadgeClasses(p.current_stock)}`}>
                          {p.current_stock}
                        </span>
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </div>

    </div>

  )

}
