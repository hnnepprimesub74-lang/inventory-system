'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { savePurchaseOrderDraft } from '../../lib/purchaseOrderDraft'

const SALES_WINDOW_DAYS = 7
const MIN_FLOOR = 2

function groupKey(p: any) {

  return [
    (p.product_name || '').trim().toLowerCase(),
    (p.brand || '').trim().toLowerCase(),
    (p.category || '').trim().toLowerCase(),
  ].join('|')

}

function GroupCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean
  indeterminate: boolean
  onChange: () => void
}) {

  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {

    if (ref.current) ref.current.indeterminate = indeterminate

  }, [indeterminate])

  return (

    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 cursor-pointer"
    />

  )

}

export default function LowStockPage() {

  const router = useRouter()

  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out'>('all')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

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

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: salesData } =
      await supabase
        .from('stock_transactions')
        .select('*')
        .eq('transaction_type', 'SELL')
        .gte('created_at', thirtyDaysAgo.toISOString())

    const salesWindowAgo = new Date()
    salesWindowAgo.setDate(salesWindowAgo.getDate() - SALES_WINDOW_DAYS)

    const recentSalesMap: any = {}

    ;(salesData || []).forEach((sale: any) => {

      const soldAt = new Date(sale.created_at)

      if (soldAt >= salesWindowAgo) {

        recentSalesMap[sale.product_id] =
          (recentSalesMap[sale.product_id] || 0) + Number(sale.quantity || 0)

      }

    })

    const ranked = (productsData || []).map((product: any) => {

      const sold7 = recentSalesMap[product.id] || 0
      const reorderPoint = Math.max(sold7, MIN_FLOOR)

      return { ...product, sold7, reorderPoint }

    })

    setProducts(ranked)
    setLoading(false)

  }

  function isLow(p: any) {

    return Number(p.current_stock || 0) <= p.reorderPoint

  }

  function isOut(p: any) {

    return Number(p.current_stock || 0) <= 0

  }

  const lowStock = products
    .filter((p) => isLow(p))
    .sort((a, b) => b.reorderPoint - a.reorderPoint)

  const outOfStockCount = lowStock.filter((p) => isOut(p)).length
  const lowOnlyCount = lowStock.length - outOfStockCount

  const visibleLowStock = lowStock.filter((p) => {

    if (statusFilter === 'low') return !isOut(p)
    if (statusFilter === 'out') return isOut(p)
    return true

  })

  const groupsMap: Record<string, any> = {}

  products.forEach((p) => {

    const key = groupKey(p)

    if (!groupsMap[key]) {

      groupsMap[key] = {
        key,
        productName: p.product_name,
        category: p.category,
        brand: p.brand,
        variants: [],
      }

    }

    groupsMap[key].variants.push(p)

  })

  const groups = Object.values(groupsMap)
    .map((g: any) => {

      const sortedVariants = [...g.variants].sort((a: any, b: any) =>
        String(a.shade || '').localeCompare(String(b.shade || ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      )

      const matched = sortedVariants.filter((v: any) => {

        if (!isLow(v)) return false
        if (statusFilter === 'low') return !isOut(v)
        if (statusFilter === 'out') return isOut(v)
        return true

      })

      const matchedIds = new Set(matched.map((v: any) => v.id))
      const others = sortedVariants.filter((v: any) => !matchedIds.has(v.id))

      const lowCount = sortedVariants.filter((v: any) => isLow(v)).length
      const outCount = sortedVariants.filter((v: any) => isOut(v)).length
      const maxReorderPoint = Math.max(...sortedVariants.map((v: any) => v.reorderPoint))

      return { ...g, variants: sortedVariants, matched, others, lowCount, outCount, maxReorderPoint }

    })
    .filter((g: any) => g.matched.length > 0)
    .sort((a: any, b: any) => b.maxReorderPoint - a.maxReorderPoint)

  const selectedCount = Object.values(selected).filter(Boolean).length

  function toggleVariant(id: string) {

    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))

  }

  function visibleRowsOf(g: any) {

    return expandedGroups[g.key] ? [...g.matched, ...g.others] : g.matched

  }

  function toggleGroup(g: any) {

    const rows = visibleRowsOf(g)
    const allSelected = rows.every((v: any) => selected[v.id])

    setSelected((prev) => {

      const next = { ...prev }

      rows.forEach((v: any) => {

        next[v.id] = !allSelected

      })

      return next

    })

  }

  function toggleExpand(key: string) {

    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }))

  }

  function clearSelection() {

    setSelected({})

  }

  function proceedToOrder() {

    const items = products
      .filter((p) => selected[p.id])
      .map((p) => ({
        id: p.id,
        product_name: p.product_name,
        category: p.category,
        brand: p.brand,
        shade: p.shade,
        current_stock: Number(p.current_stock || 0),
        reorderPoint: p.reorderPoint,
        suggestedQty: Math.max(Math.ceil(p.reorderPoint) - Number(p.current_stock || 0), 1),
        costPrice: Number(p.cost_price || 0),
      }))

    if (items.length === 0) return

    savePurchaseOrderDraft(items)
    router.push('/low-stock/create-order')

  }

  function exportToExcel() {

    if (visibleLowStock.length === 0) {

      alert('No low stock items')
      return

    }

    const rows = visibleLowStock.map((p) => ({
      Product: p.product_name,
      Category: p.category,
      Brand: p.brand,
      Shade: p.shade,
      'Current Stock': p.current_stock,
      'Reorder Point': Math.ceil(p.reorderPoint),
      Status: isOut(p) ? 'Out of Stock' : 'Low Stock',
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Low Stock')

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })

    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    })

    saveAs(blob, 'low-stock.xlsx')

  }

  return (

    <div className="text-black">

      <div className="max-w-7xl mx-auto space-y-6 pb-24">

        <div className="flex items-center justify-between flex-wrap gap-3">

          <div>

            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">

              Low Stock Products

            </h1>

            <p className="text-sm text-zinc-500 mt-1">

              Products at or below their reorder point. Select items to build a purchase order.

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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'low' ? 'all' : 'low')}
            className={`text-left bg-white rounded-2xl shadow-sm border px-6 py-4 border-l-4 border-l-amber-500 transition-colors ${
              statusFilter === 'low' ? 'border-amber-400 ring-2 ring-amber-200' : 'border-zinc-200 hover:border-amber-300'
            }`}
          >

            <p className="text-sm text-zinc-500">Low Stock (not zero)</p>
            <h2 className="text-3xl font-bold tracking-tight mt-1 tabular-nums text-amber-600">{lowOnlyCount}</h2>

          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'out' ? 'all' : 'out')}
            className={`text-left bg-white rounded-2xl shadow-sm border px-6 py-4 border-l-4 border-l-red-500 transition-colors ${
              statusFilter === 'out' ? 'border-red-400 ring-2 ring-red-200' : 'border-zinc-200 hover:border-red-300'
            }`}
          >

            <p className="text-sm text-zinc-500">Out of Stock</p>
            <h2 className="text-3xl font-bold tracking-tight mt-1 tabular-nums text-red-600">{outOfStockCount}</h2>

          </button>

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          {loading ? (

            <p className="text-zinc-500">Loading...</p>

          ) : lowStock.length === 0 ? (

            <p className="text-zinc-500">Nothing is low on stock right now.</p>

          ) : groups.length === 0 ? (

            <p className="text-zinc-500">No products match this filter.</p>

          ) : (

            <div className="space-y-4">

              <div className="grid grid-cols-[24px_1fr_140px_140px_140px] items-center gap-4 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wide">

                <span />
                <span>Product / Shade</span>
                <span className="text-right">Current Stock</span>
                <span className="text-right">Reorder Point</span>
                <span className="text-center">Status</span>

              </div>

              {groups.map((g: any) => {

                const rows = visibleRowsOf(g)
                const groupAllSelected = rows.length > 0 && rows.every((v: any) => selected[v.id])
                const groupSomeSelected = rows.some((v: any) => selected[v.id])

                return (

                  <div key={g.key} className="border border-zinc-200 rounded-2xl overflow-hidden">

                    <div className="flex items-center gap-3 px-4 py-3 bg-zinc-50 border-b border-zinc-200">

                      <GroupCheckbox
                        checked={groupAllSelected}
                        indeterminate={groupSomeSelected && !groupAllSelected}
                        onChange={() => toggleGroup(g)}
                      />

                      <div className="flex-1 min-w-0">

                        <p className="font-semibold text-zinc-900 truncate">{g.productName}</p>

                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">

                          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                            {g.brand}
                          </span>

                          <span className="bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                            {g.category}
                          </span>

                        </div>

                      </div>

                      <div className="flex items-center gap-2 text-xs flex-shrink-0">

                        {g.outCount > 0 && (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                            {g.outCount} out
                          </span>
                        )}

                        {g.lowCount - g.outCount > 0 && (
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                            {g.lowCount - g.outCount} low
                          </span>
                        )}

                      </div>

                    </div>

                    <div className="divide-y divide-zinc-100">

                      {g.matched.map((p: any) => {

                        const outOfStock = isOut(p)

                        return (

                          <label
                            key={p.id}
                            className="grid grid-cols-[24px_1fr_140px_140px_140px] items-center gap-4 px-4 py-3.5 hover:bg-zinc-50 cursor-pointer"
                          >

                            <input
                              type="checkbox"
                              checked={!!selected[p.id]}
                              onChange={() => toggleVariant(p.id)}
                              className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 cursor-pointer"
                            />

                            <span className="min-w-0 text-sm text-zinc-700 truncate">
                              {p.shade || '—'}
                            </span>

                            <span className={`text-base tabular-nums font-bold text-right ${outOfStock ? 'text-red-600' : 'text-amber-600'}`}>
                              {p.current_stock}
                            </span>

                            <span className="text-base tabular-nums font-semibold text-zinc-500 text-right">
                              {Math.ceil(p.reorderPoint)}
                            </span>

                            <span
                              className={
                                outOfStock
                                  ? 'bg-red-100 text-red-700 px-3 py-1.5 rounded-full text-xs font-semibold text-center justify-self-center'
                                  : 'bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full text-xs font-semibold text-center justify-self-center'
                              }
                            >

                              {outOfStock ? 'Out of Stock' : 'Low Stock'}

                            </span>

                          </label>

                        )

                      })}

                    </div>

                    {g.others.length > 0 && (

                      <div className="border-t border-zinc-100">

                        <button
                          type="button"
                          onClick={() => toggleExpand(g.key)}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                        >

                          {expandedGroups[g.key]
                            ? 'Hide other shades'
                            : `+ Add other shade${g.others.length > 1 ? 's' : ''} (${g.others.length})`}

                        </button>

                        {expandedGroups[g.key] && (

                          <div className="divide-y divide-zinc-100">

                            {g.others.map((p: any) => {

                              const otherOut = isOut(p)
                              const otherLow = isLow(p)

                              const badgeClass = otherOut
                                ? 'bg-red-100 text-red-700'
                                : otherLow
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-zinc-100 text-zinc-500'

                              const badgeLabel = otherOut ? 'Out of Stock' : otherLow ? 'Low Stock' : 'In Stock'

                              const stockClass = otherOut ? 'text-red-600' : otherLow ? 'text-amber-600' : 'text-zinc-500'

                              return (

                                <label
                                  key={p.id}
                                  className="grid grid-cols-[24px_1fr_140px_140px_140px] items-center gap-4 px-4 py-3.5 hover:bg-zinc-50 cursor-pointer bg-zinc-50/50"
                                >

                                  <input
                                    type="checkbox"
                                    checked={!!selected[p.id]}
                                    onChange={() => toggleVariant(p.id)}
                                    className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 cursor-pointer"
                                  />

                                  <span className="min-w-0 text-sm text-zinc-500 truncate">
                                    {p.shade || '—'}
                                  </span>

                                  <span className={`text-base tabular-nums font-bold text-right ${stockClass}`}>
                                    {p.current_stock}
                                  </span>

                                  <span className="text-base tabular-nums font-semibold text-zinc-400 text-right">
                                    {Math.ceil(p.reorderPoint)}
                                  </span>

                                  <span className={`${badgeClass} px-3 py-1.5 rounded-full text-xs font-semibold text-center justify-self-center`}>
                                    {badgeLabel}
                                  </span>

                                </label>

                              )

                            })}

                          </div>

                        )}

                      </div>

                    )}

                  </div>

                )

              })}

            </div>

          )}

        </div>

      </div>

      {selectedCount > 0 && (

        <div className="sticky bottom-4 z-30 mt-4 max-w-7xl mx-auto">

          <div className="bg-zinc-900 text-white rounded-2xl shadow-2xl px-6 py-4 flex items-center justify-between gap-4 flex-wrap">

            <p className="text-sm font-semibold">

              {selectedCount} item{selectedCount > 1 ? 's' : ''} selected

            </p>

            <div className="flex items-center gap-3">

              <button
                onClick={clearSelection}
                className="text-sm text-zinc-300 hover:text-white"
              >

                Clear

              </button>

              <button
                onClick={proceedToOrder}
                className="bg-white text-zinc-900 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-zinc-100"
              >

                Create Purchase Order →

              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  )

}
