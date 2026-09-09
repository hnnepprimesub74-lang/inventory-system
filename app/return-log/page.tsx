'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { displayMrp } from '../../lib/mrp'
import DatePicker from '../../components/DatePicker'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export default function ReturnLogPage() {

  const router = useRouter()

  const [products, setProducts] = useState<any[]>([])
  const [returnTxns, setReturnTxns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDate, setFilterDate] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterBrand, setFilterBrand] = useState('')

  useEffect(() => {

    async function init() {

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {

        router.push('/login')
        return

      }

      await loadData()

    }

    init()

  }, [])

  async function loadData() {

    const { data: productsData } =
      await supabase.from('products').select('*')

    const { data: txnData } =
      await supabase
        .from('stock_transactions')
        .select('*')
        .eq('transaction_type', 'RETURN')
        .order('created_at', { ascending: false })

    setProducts(productsData || [])
    setReturnTxns(txnData || [])
    setLoading(false)

  }

  function productFor(id: any) {
    return products.find((p) => p.id === id)
  }

  function txnDate(txn: any) {
    return txn.stock_date || (txn.created_at ? txn.created_at.slice(0, 10) : 'Unknown')
  }

  const categories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean))
  ).sort()

  const brands = Array.from(
    new Set(products.map((p) => p.brand).filter(Boolean))
  ).sort()

  const scopedTxns = returnTxns.filter((txn) => {

    if (filterCategory || filterBrand) {

      const product = productFor(txn.product_id)

      if (filterCategory && (product?.category || '') !== filterCategory) return false
      if (filterBrand && (product?.brand || '') !== filterBrand) return false

    }

    return true

  })

  // Group returns by date, then by product within each date.
  const dateMap: Record<string, any> = {}
  const dateGroups: any[] = []

  scopedTxns.forEach((txn) => {

    const date = txnDate(txn)

    if (!dateMap[date]) {

      dateMap[date] = { date, items: [], productMap: {} }
      dateGroups.push(dateMap[date])

    }

    const group = dateMap[date]
    const product = productFor(txn.product_id)
    const key = txn.product_id ?? `unknown-${txn.id}`

    if (!group.productMap[key]) {

      group.productMap[key] = {
        key,
        productName: product?.product_name || 'Unknown product',
        barcode: product?.barcode,
        category: product?.category,
        brand: product?.brand,
        shade: product?.shade,
        weight: product?.weight,
        cost: product?.cost_price,
        mrp: product?.mrp,
        qtyReturned: 0,
      }

      group.items.push(group.productMap[key])

    }

    group.productMap[key].qtyReturned += Number(txn.quantity || 0)

  })

  dateGroups.forEach((group) => {

    group.items.sort((a: any, b: any) => b.qtyReturned - a.qtyReturned)

    group.totalQty = group.items.reduce((s: number, i: any) => s + i.qtyReturned, 0)
    group.totalCp = group.items.reduce((s: number, i: any) => s + Number(i.cost || 0) * i.qtyReturned, 0)

  })

  dateGroups.sort((a, b) => b.date.localeCompare(a.date))

  const filteredGroups = filterDate
    ? dateGroups.filter((g) => g.date === filterDate)
    : dateGroups

  function formatValue(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const todayValue = formatValue(new Date())

  const yesterdayValue = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return formatValue(d)
  })()

  const todayGroup = dateGroups.find((g) => g.date === todayValue)

  function buildExportRows(group: any) {

    return group.items.map((item: any, i: number) => ({

      Rank: i + 1,
      Product: item.productName,
      Barcode: item.barcode || '',
      Category: item.category || '',
      Brand: item.brand || '',
      Shade: item.shade || '',
      Weight: item.weight || '',
      Cost: item.cost ?? '',
      MRP: displayMrp(item.mrp) ?? '',
      'Qty Returned': item.qtyReturned,
      'Total CP': Number(item.cost || 0) * item.qtyReturned,

    }))

  }

  function downloadWorkbook(rows: any[], filename: string) {

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Return Log')

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })

    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    })

    saveAs(blob, filename)

  }

  function exportGroup(group: any) {

    downloadWorkbook(buildExportRows(group), `return-log-${group.date}.xlsx`)

  }

  function exportAll() {

    const rows = filteredGroups.flatMap((g) => buildExportRows(g))

    if (rows.length === 0) {

      alert('No returns recorded yet')
      return

    }

    downloadWorkbook(rows, filterDate ? `return-log-${filterDate}.xlsx` : 'return-log-all.xlsx')

  }

  function formatDateLabel(date: string) {

    if (date === 'Unknown') return 'Unknown date'

    const d = new Date(`${date}T00:00:00`)

    if (Number.isNaN(d.getTime())) return date

    return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  }

  const hasFilters = !!(filterDate || filterCategory || filterBrand)

  return (

    <div className="text-black">

      <div className="max-w-7xl mx-auto space-y-6">

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6 relative">

          <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-[28px] bg-gradient-to-r from-red-500 via-rose-500 to-amber-400" />

          <div className="flex items-center justify-between flex-wrap gap-4">

            <div className="flex items-center gap-4">

              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-rose-500 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-200">

                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
                  <path d="M9 14l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 10h9a5 5 0 0 1 5 5v1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>

              </div>

              <div>

                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Return Log</h1>

                <p className="text-sm text-zinc-500 mt-1">Returns log by date, filterable by category and brand</p>

              </div>

            </div>

            <div className="flex gap-3">

              <button
                onClick={exportAll}
                className="inline-flex items-center gap-1.5 border border-zinc-300 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-400 transition-colors px-3 py-1.5 rounded-lg text-xs font-medium"
              >

                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <path d="M12 3v9" strokeLinecap="round" />
                  <path d="M8 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 17h16" strokeLinecap="round" />
                </svg>

                Export

              </button>

              <button
                onClick={() => router.push('/')}
                className="bg-white border border-zinc-200 text-zinc-700 px-5 py-3 rounded-2xl font-bold hover:bg-zinc-50"
              >

                Back to Dashboard

              </button>

            </div>

          </div>

          <div className="flex flex-wrap gap-3 items-center mt-5 bg-zinc-50 border border-zinc-200 rounded-2xl p-3">

            <div className="flex items-center gap-2 text-zinc-500 pl-1">

              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                <rect x="3" y="4" width="18" height="17" rx="3" />
                <path d="M3 9h18M8 3v3M16 3v3" strokeLinecap="round" />
              </svg>

              <span className="text-xs font-semibold uppercase tracking-wide">Date</span>

            </div>

            <div className="flex flex-wrap items-center gap-1 bg-white border border-zinc-200 rounded-xl p-1">

              <button
                onClick={() => setFilterDate('')}
                className={
                  !filterDate
                    ? 'px-3.5 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white shadow-sm'
                    : 'px-3.5 py-2 rounded-lg text-sm font-medium text-zinc-500 hover:bg-zinc-50'
                }
              >
                All
              </button>

              <button
                onClick={() => setFilterDate(todayValue)}
                className={
                  filterDate === todayValue
                    ? 'px-3.5 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white shadow-sm'
                    : 'px-3.5 py-2 rounded-lg text-sm font-medium text-zinc-500 hover:bg-zinc-50'
                }
              >
                Today
              </button>

              <button
                onClick={() => setFilterDate(yesterdayValue)}
                className={
                  filterDate === yesterdayValue
                    ? 'px-3.5 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white shadow-sm'
                    : 'px-3.5 py-2 rounded-lg text-sm font-medium text-zinc-500 hover:bg-zinc-50'
                }
              >
                Yesterday
              </button>

            </div>

            <DatePicker value={filterDate} onChange={setFilterDate} placeholder="Pick a date" />

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border border-zinc-300 rounded-xl px-4 py-2.5 min-w-[160px] bg-white"
            >

              <option value="">All Categories</option>

              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}

            </select>

            <select
              value={filterBrand}
              onChange={(e) => setFilterBrand(e.target.value)}
              className="border border-zinc-300 rounded-xl px-4 py-2.5 min-w-[160px] bg-white"
            >

              <option value="">All Brands</option>

              {brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}

            </select>

            {hasFilters && (

              <button
                onClick={() => {
                  setFilterDate('')
                  setFilterCategory('')
                  setFilterBrand('')
                }}
                className="flex items-center gap-1.5 bg-white border border-zinc-300 text-zinc-500 px-3.5 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
              >

                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>

                Clear

              </button>

            )}

          </div>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div className="relative overflow-hidden bg-gradient-to-br from-red-600 to-rose-700 rounded-2xl shadow-sm px-6 py-5 text-white">

            <p className="text-sm text-red-100">Units Returned Today</p>
            <h2 className="text-4xl font-bold tracking-tight mt-1 tabular-nums">{(todayGroup?.totalQty || 0).toLocaleString('en-IN')}</h2>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 px-6 py-5">

            <p className="text-sm text-zinc-500">Total CP Returned Today</p>
            <h2 className="text-2xl font-bold tracking-tight mt-1 text-red-600 tabular-nums">
              Rs. {(todayGroup?.totalCp || 0).toLocaleString('en-IN')}
            </h2>

          </div>

        </div>

        {loading ? (

          <p className="text-zinc-500">Loading...</p>

        ) : filteredGroups.length === 0 ? (

          <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-8 text-center text-zinc-500">

            {dateGroups.length === 0 ? 'No returns recorded yet.' : 'No returns for this filter.'}

          </div>

        ) : (

          <div className="space-y-5">

            {filteredGroups.map((group) => (

              <div
                key={group.date}
                className="bg-white rounded-[28px] shadow-xl border border-zinc-200 border-l-4 border-l-red-400 p-6 hover:shadow-2xl transition-shadow"
              >

                <div className="flex items-center justify-between flex-wrap gap-3 mb-5">

                  <div>

                    <p className="font-bold text-lg text-zinc-900">{formatDateLabel(group.date)}</p>

                    <p className="text-sm text-zinc-500">{group.items.length} product(s) · {group.totalQty} units returned</p>

                  </div>

                  <div className="flex items-center gap-4">

                    <div className="text-sm text-zinc-500 text-right">

                      <p>Total CP</p>

                      <p className="font-bold text-red-600">Rs. {group.totalCp.toLocaleString('en-IN')}</p>

                    </div>

                    <button
                      onClick={() => exportGroup(group)}
                      className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 transition-all text-white px-4 py-2 rounded-xl font-bold text-sm flex-shrink-0 shadow-md shadow-green-200"
                    >

                      Export

                    </button>

                  </div>

                </div>

                <div className="overflow-x-auto">

                  <table className="w-full border-collapse">

                    <thead>

                      <tr className="text-left bg-red-50/70">

                        <th className="py-2.5 pl-3 pr-4 text-xs font-semibold text-red-900/70 uppercase tracking-wide rounded-l-xl">#</th>
                        <th className="py-2.5 pr-4 text-xs font-semibold text-red-900/70 uppercase tracking-wide">Product</th>
                        <th className="py-2.5 pr-4 text-xs font-semibold text-red-900/70 uppercase tracking-wide">Category</th>
                        <th className="py-2.5 pr-4 text-xs font-semibold text-red-900/70 uppercase tracking-wide">Brand</th>
                        <th className="py-2.5 pr-4 text-xs font-semibold text-red-900/70 uppercase tracking-wide">Barcode</th>
                        <th className="py-2.5 pr-4 text-xs font-semibold text-red-900/70 uppercase tracking-wide">Shade</th>
                        <th className="py-2.5 pr-4 text-xs font-semibold text-red-900/70 uppercase tracking-wide">Weight</th>
                        <th className="py-2.5 pr-4 text-xs font-semibold text-red-900/70 uppercase tracking-wide text-right">Cost</th>
                        <th className="py-2.5 pr-4 text-xs font-semibold text-red-900/70 uppercase tracking-wide text-right">MRP</th>
                        <th className="py-2.5 pr-4 text-xs font-semibold text-red-900/70 uppercase tracking-wide text-right">Qty Returned</th>
                        <th className="py-2.5 pr-3 text-xs font-semibold text-red-900/70 uppercase tracking-wide text-right rounded-r-xl">Total CP</th>

                      </tr>

                    </thead>

                    <tbody className="divide-y divide-zinc-100">

                      {group.items.map((item: any, i: number) => (

                        <tr key={item.key} className="hover:bg-zinc-50 transition-colors">

                          <td className="py-3 pl-3 pr-4">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-zinc-100 text-zinc-500 border border-zinc-200">
                              {i + 1}
                            </span>
                          </td>

                          <td className="py-3 pr-4 font-semibold text-zinc-900">{item.productName}</td>
                          <td className="py-3 pr-4 text-sm text-zinc-600">{item.category || '—'}</td>
                          <td className="py-3 pr-4 text-sm text-zinc-600">{item.brand || '—'}</td>
                          <td className="py-3 pr-4 text-sm text-zinc-500">{item.barcode || '—'}</td>
                          <td className="py-3 pr-4 text-sm text-zinc-600">{item.shade || '—'}</td>
                          <td className="py-3 pr-4 text-sm text-zinc-600">{item.weight || '—'}</td>
                          <td className="py-3 pr-4 text-sm text-zinc-600 text-right tabular-nums">Rs. {item.cost ?? '—'}</td>
                          <td className="py-3 pr-4 text-sm text-zinc-600 text-right tabular-nums">
                            {displayMrp(item.mrp) !== null ? `Rs. ${displayMrp(item.mrp)}` : '—'}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums">
                            <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                              {item.qtyReturned}
                            </span>
                          </td>
                          <td className="py-3 pr-3 font-bold text-red-700 text-right tabular-nums">
                            Rs. {(Number(item.cost || 0) * item.qtyReturned).toLocaleString('en-IN')}
                          </td>

                        </tr>

                      ))}

                    </tbody>

                    <tfoot>

                      <tr className="border-t-2 border-zinc-200">

                        <td colSpan={10} className="py-3 pl-3 pr-4 text-right font-bold text-zinc-700">Total CP</td>
                        <td className="py-3 pr-3 text-right font-bold text-red-700 tabular-nums">
                          Rs. {group.totalCp.toLocaleString('en-IN')}
                        </td>

                      </tr>

                    </tfoot>

                  </table>

                </div>

              </div>

            ))}

          </div>

        )}

      </div>

    </div>

  )

}
