'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { displayMrp } from '../../lib/mrp'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export default function StockLogPage() {

  const router = useRouter()

  const [products, setProducts] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSeller, setFilterSeller] = useState('')

  const [editingTxn, setEditingTxn] = useState<any>(null)
  const [editProductName, setEditProductName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editBrand, setEditBrand] = useState('')
  const [editShade, setEditShade] = useState('')
  const [editWeight, setEditWeight] = useState('')
  const [editCost, setEditCost] = useState('')
  const [editMrp, setEditMrp] = useState('')
  const [editQty, setEditQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingTxnId, setDeletingTxnId] = useState<any>(null)
  const [expandedLotGroups, setExpandedLotGroups] = useState<Record<string, boolean>>({})

  async function loadData() {

    const { data: productsData } =
      await supabase.from('products').select('*')

    const { data: txnData } =
      await supabase
        .from('stock_transactions')
        .select('*')
        .eq('transaction_type', 'ADD')
        .order('stock_date', { ascending: false })

    setProducts(productsData || [])
    setTransactions(txnData || [])
    setLoading(false)

  }

  useEffect(() => {

    loadData()

  }, [])

  function openEditTxn(txn: any) {

    const display = resolveTxnDisplay(txn)

    setEditingTxn(txn)
    setEditProductName(display.productName || '')
    setEditCategory(display.category || '')
    setEditBrand(display.brand || '')
    setEditShade(display.shade || '')
    setEditWeight(display.weight || '')
    setEditCost(String(txn.cost_price ?? ''))
    setEditMrp(String(display.mrp ?? ''))
    setEditQty(String(txn.quantity ?? ''))

  }

  async function saveEditTxn() {

    if (!editingTxn) return

    const newCost = Number(editCost)
    const newMrp = Number(editMrp)
    const newQty = Number(editQty)

    setSaving(true)

    // Stock Log is fully independent from Inventory Products — this only
    // updates the log entry itself, never the shared product record.
    const { error: txnError } = await supabase
      .from('stock_transactions')
      .update({

        product_name: editProductName,

        category: editCategory,

        brand: editBrand,

        shade: editShade,

        weight: editWeight,

        cost_price: newCost,

        mrp: newMrp,

        quantity: newQty,

      })
      .eq('id', editingTxn.id)

    setSaving(false)

    if (txnError) {

      alert(`Failed to save changes: ${txnError.message}`)

      return

    }

    setEditingTxn(null)

    await loadData()

  }

  async function deleteTxn(txn: any) {

    const confirmed = window.confirm(
      'Delete this stock log entry? This only removes it from the log — product stock is not affected.'
    )

    if (!confirmed) return

    setDeletingTxnId(txn.id)

    await supabase
      .from('stock_transactions')
      .delete()
      .eq('id', txn.id)

    setDeletingTxnId(null)

    await loadData()

  }

  function productFor(id: any) {
    return products.find((p) => p.id === id)
  }

  // Stock Log is a historical record: everything shown for a logged entry (name,
  // category, brand, shade, weight, MRP) is a frozen snapshot taken when it was
  // logged. It only falls back to the live product for older rows saved before
  // these snapshot columns existed, and for image/barcode which aren't editable here.
  function resolveTxnDisplay(txn: any) {

    const product = productFor(txn.product_id)

    return {
      productName: txn.product_name ?? product?.product_name ?? 'Unknown product',
      category: txn.category ?? product?.category ?? '',
      brand: txn.brand ?? product?.brand ?? '',
      shade: txn.shade ?? product?.shade ?? '',
      weight: txn.weight ?? product?.weight ?? '',
      mrp: txn.mrp ?? product?.mrp ?? null,
      image: product?.image_url,
      barcode: product?.barcode,
    }

  }

  function productGroupKey(display: any) {

    return [
      (display?.productName || '').trim().toLowerCase(),
      (display?.brand || '').trim().toLowerCase(),
      (display?.category || '').trim().toLowerCase(),
    ].join('|')

  }

  function buildLotProductGroups(items: any[]) {

    const map: Record<string, any> = {}
    const groups: any[] = []

    items.forEach((txn) => {

      const display = resolveTxnDisplay(txn)
      const key = productGroupKey(display)

      if (!map[key]) {

        map[key] = {
          key,
          productName: display.productName,
          category: display.category,
          brand: display.brand,
          image: display.image,
          items: [],
        }

        groups.push(map[key])

      }

      if (!map[key].image && display.image) {
        map[key].image = display.image
      }

      map[key].items.push(txn)

    })

    return groups.map((g) => {

      const totalStock = g.items.reduce((s: number, txn: any) => {

        return s + Number(txn.quantity ?? 0)

      }, 0)

      const totalValue = g.items.reduce((s: number, txn: any) => {

        return s + Number(txn.cost_price || 0) * Number(txn.quantity || 0)

      }, 0)

      return { ...g, totalStock, totalValue }

    })

  }

  function discountPct(mrp: any, cost: any) {

    const mrpNum = Number(mrp)
    const costNum = Number(cost)

    if (!mrpNum || mrpNum <= 0) return null

    return ((mrpNum - costNum) / mrpNum) * 100

  }

  // Group by lot_id. Older entries without a lot_id each become their own single-item lot.
  const lotMap: any = {}
  const lots: any[] = []

  transactions.forEach((txn) => {

    const key = txn.lot_id || `single-${txn.id}`

    if (!lotMap[key]) {

      lotMap[key] = {
        lotId: key,
        seller: txn.seller,
        stockDate: txn.stock_date,
        createdAt: txn.created_at,
        items: [],
      }

      lots.push(lotMap[key])

    }

    lotMap[key].items.push(txn)

  })

  lots.sort((a, b) => {

    const da = a.createdAt || a.stockDate || ''
    const db = b.createdAt || b.stockDate || ''

    return db.localeCompare(da)

  })

  const sellers = Array.from(
    new Set(lots.map((l) => l.seller).filter(Boolean))
  ).sort()

  const uniqueCategories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean))
  ).sort()

  const uniqueBrands = Array.from(
    new Set(products.map((p) => p.brand).filter(Boolean))
  ).sort()

  const filteredLots = filterSeller
    ? lots.filter((l) => l.seller === filterSeller)
    : lots

  function buildExportRows(items: any[]) {

    return items.map((txn) => {

      const display = resolveTxnDisplay(txn)

      const disc = discountPct(displayMrp(display.mrp), txn.cost_price)

      return {

        'Stock Date':
          txn.stock_date ||
          (txn.created_at ? txn.created_at.slice(0, 10) : ''),

        Seller: txn.seller || '',

        Product: display.productName || '',

        Category: display.category || '',

        Brand: display.brand || '',

        Shade: display.shade || '',

        Weight: display.weight || '',

        Cost: txn.cost_price,

        MRP: displayMrp(display.mrp) ?? '',

        'Discount %':
          disc !== null ? Number(disc.toFixed(1)) : '',

        'Qty Added': txn.quantity,

        Total:
          (txn.cost_price || 0) * (txn.quantity || 0),

      }

    })

  }

  function downloadWorkbook(rows: any[], filename: string) {

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Log')

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })

    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    })

    saveAs(blob, filename)

  }

  function exportAllLogs() {

    const rows = filteredLots.flatMap((l) => l.items)

    if (rows.length === 0) {

      alert('No stock-in records yet')

      return

    }

    downloadWorkbook(
      buildExportRows(rows),
      filterSeller ? `stock-log-${filterSeller}.xlsx` : 'stock-log.xlsx'
    )

  }

  function exportLot(lot: any) {

    const safeSeller =
      (lot.seller || 'lot')
        .replace(/[^a-z0-9]+/gi, '-')
        .toLowerCase()

    const safeDate =
      lot.stockDate ||
      (lot.createdAt ? lot.createdAt.slice(0, 10) : 'date')

    downloadWorkbook(
      buildExportRows(lot.items),
      `stock-log-${safeSeller}-${safeDate}.xlsx`
    )

  }

  return (

    <div className="text-black">

      <datalist id="categories">

        {uniqueCategories.map((cat, index) => (
          <option key={index} value={cat} />
        ))}

      </datalist>

      <datalist id="brands">

        {uniqueBrands.map((b, index) => (
          <option key={index} value={b} />
        ))}

      </datalist>

      <div className="max-w-7xl mx-auto space-y-6">

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6 relative overflow-hidden">

          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400" />

          <div className="flex items-center justify-between flex-wrap gap-4">

            <div className="flex items-center gap-4">

              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-200">

                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="w-6 h-6"
                >

                  <path d="M3 7l9-4 9 4-9 4-9-4z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 7v10l9 4 9-4V7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 11v10" strokeLinecap="round" />

                </svg>

              </div>

              <div>

                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">

                  Stock Log

                </h1>

                <p className="text-sm text-zinc-500 mt-1">

                  Every stock lot added, grouped by seller and date

                </p>

              </div>

            </div>

            <div className="flex gap-3">

              <button
                onClick={exportAllLogs}
                className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 transition-all text-white px-5 py-3 rounded-2xl font-bold shadow-lg shadow-green-200 flex items-center gap-2"
              >

                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-4 h-4"
                >

                  <path d="M12 3v12" strokeLinecap="round" />
                  <path d="M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 19h16" strokeLinecap="round" />

                </svg>

                Export Excel

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

            <label className="text-xs font-medium text-zinc-500">Seller</label>

            <select
              value={filterSeller}
              onChange={(e) => setFilterSeller(e.target.value)}
              className="border border-zinc-300 bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none rounded-xl px-4 py-2.5 min-w-[200px] font-medium text-zinc-700"
            >

              <option value="">All Sellers</option>

              {sellers.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}

            </select>

            {filterSeller && (

              <button
                onClick={() => setFilterSeller('')}
                className="bg-white border border-zinc-300 text-zinc-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-zinc-50"
              >

                Clear Filter

              </button>

            )}

          </div>

        </div>

        {loading ? (

          <p className="text-zinc-500">Loading...</p>

        ) : filteredLots.length === 0 ? (

          <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-8 text-center text-zinc-500">

            {lots.length === 0 ? 'No stock has been added yet.' : 'No stock lots from this seller.'}

          </div>

        ) : (

          <div className="space-y-5">

            {filteredLots.map((lot) => {

              const totalQty = lot.items.reduce(
                (s: number, i: any) => s + Number(i.quantity || 0),
                0
              )

              const totalCost = lot.items.reduce(
                (s: number, i: any) =>
                  s + Number(i.cost_price || 0) * Number(i.quantity || 0),
                0
              )

              return (

                <div
                  key={lot.lotId}
                  className="bg-white rounded-[28px] shadow-xl border border-zinc-200 border-l-4 border-l-indigo-400 p-6 hover:shadow-2xl transition-shadow"
                >

                  <div className="flex items-center justify-between flex-wrap gap-3 mb-5">

                    <div>

                      <p className="font-bold text-lg text-zinc-900">

                        {lot.seller || 'Unknown seller'}

                      </p>

                      <p className="text-sm text-zinc-500">

                        {lot.stockDate ||
                          (lot.createdAt
                            ? lot.createdAt.slice(0, 10)
                            : '')}

                      </p>

                    </div>

                    <div className="flex items-center gap-4">

                      <div className="text-sm text-zinc-500 text-right">

                        <p>

                          {lot.items.length} product(s)
                          {' · '}
                          {totalQty} units

                        </p>

                        <p className="font-bold text-emerald-600">

                          Rs. {totalCost.toLocaleString()}

                        </p>

                      </div>

                      <button
                        onClick={() => exportLot(lot)}
                        className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 transition-all text-white px-4 py-2 rounded-xl font-bold text-sm flex-shrink-0 shadow-md shadow-green-200"
                      >

                        Export Lot

                      </button>

                    </div>

                  </div>

                  <div className="space-y-3">

                    {buildLotProductGroups(lot.items).map((group: any) => {

                      const groupKey = `${lot.lotId}::${group.key}`
                      const isGroupOpen = expandedLotGroups[groupKey] !== false
                      const isEmptyGroup = Number(group.totalStock || 0) <= 0

                      return (

                        <div
                          key={group.key}
                          className={`border rounded-2xl overflow-hidden border-l-4 ${isEmptyGroup ? 'border-l-red-400 border-zinc-200' : 'border-l-indigo-400 border-zinc-200'}`}
                        >

                          <button
                            onClick={() =>
                              setExpandedLotGroups((prev) => ({ ...prev, [groupKey]: prev[groupKey] === false }))
                            }
                            className="w-full flex items-center gap-4 px-4 py-3 hover:bg-indigo-50/40 transition-colors text-left"
                          >

                            {group.image ? (

                              <img
                                src={group.image}
                                alt=""
                                className="w-12 h-12 rounded-lg object-cover border border-zinc-200 flex-shrink-0"
                              />

                            ) : (

                              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-100 to-fuchsia-100 border border-zinc-200 flex-shrink-0" />

                            )}

                            <div className="flex-1 min-w-0">

                              <p className="font-semibold text-zinc-900 truncate">{group.productName}</p>

                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">

                                {group.category && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-700">
                                    {group.category}
                                  </span>
                                )}

                                {group.brand && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-fuchsia-100 text-fuchsia-700">
                                    {group.brand}
                                  </span>
                                )}

                                <span className="text-xs text-zinc-400">

                                  {group.items.length} {group.items.length === 1 ? 'variant' : 'variants'}

                                </span>

                              </div>

                            </div>

                            <div className="text-right hidden sm:block flex-shrink-0">

                              <p className="text-xs text-zinc-500">Qty Added</p>
                              <p className={`font-bold tabular-nums ${isEmptyGroup ? 'text-red-600' : 'text-indigo-600'}`}>{group.totalStock}</p>

                            </div>

                            <div className="text-right hidden sm:block min-w-[110px] flex-shrink-0">

                              <p className="text-xs text-zinc-500">Total Value</p>
                              <p className="font-bold tabular-nums text-emerald-600">Rs. {group.totalValue.toLocaleString('en-IN')}</p>

                            </div>

                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className={`w-4 h-4 text-indigo-400 flex-shrink-0 transition-transform ${isGroupOpen ? 'rotate-90' : ''}`}
                            >

                              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />

                            </svg>

                          </button>

                          {isGroupOpen && (

                            <div className="border-t border-zinc-200 overflow-x-auto">

                              <table className="w-full border-collapse">

                                <thead>

                                  <tr className="text-left bg-indigo-50/70">

                                    <th className="py-2.5 pl-3 pr-4 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide">

                                      Barcode

                                    </th>

                                    <th className="py-2.5 pr-4 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide">

                                      Shade

                                    </th>

                                    <th className="py-2.5 pr-4 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide">

                                      Weight

                                    </th>

                                    <th className="py-2.5 pr-4 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide text-right">

                                      Cost

                                    </th>

                                    <th className="py-2.5 pr-4 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide text-right">

                                      MRP

                                    </th>

                                    <th className="py-2.5 pr-4 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide text-right">

                                      Discount %

                                    </th>

                                    <th className="py-2.5 pr-4 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide text-right">

                                      Qty Added

                                    </th>

                                    <th className="py-2.5 pr-4 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide text-right">

                                      Total

                                    </th>

                                    <th className="py-2.5 pr-3 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide text-right rounded-r-xl">

                                      Actions

                                    </th>

                                  </tr>

                                </thead>

                                <tbody className="divide-y divide-zinc-100">

                                  {group.items.map((txn: any) => {

                                    const display = resolveTxnDisplay(txn)

                                    const disc = discountPct(
                                      displayMrp(display.mrp),
                                      txn.cost_price
                                    )

                                    const total =
                                      (txn.cost_price || 0) *
                                      (txn.quantity || 0)

                                    return (

                                      <tr key={txn.id}>

                                        <td className="py-3 pl-3 pr-4 text-sm text-zinc-500">

                                          {display.barcode || '—'}

                                        </td>

                                        <td className="py-3 pr-4 text-sm text-zinc-600">

                                          {display.shade || '—'}

                                        </td>

                                        <td className="py-3 pr-4 text-sm text-zinc-600">

                                          {display.weight || '—'}

                                        </td>

                                        <td className="py-3 pr-4 text-sm text-zinc-600 text-right tabular-nums">

                                          Rs. {txn.cost_price}

                                        </td>

                                        <td className="py-3 pr-4 text-sm text-zinc-600 text-right tabular-nums">

                                          {displayMrp(display.mrp) !== null ? `Rs. ${displayMrp(display.mrp)}` : '—'}

                                        </td>

                                        <td className="py-3 pr-4 text-sm text-right tabular-nums">

                                          {disc !== null ? (

                                            <span
                                              className={
                                                disc >= 0
                                                  ? 'text-green-600 font-semibold'
                                                  : 'text-red-600 font-semibold'
                                              }
                                            >

                                              {disc.toFixed(1)}%

                                            </span>

                                          ) : (

                                            <span className="text-zinc-400">—</span>

                                          )}

                                        </td>

                                        <td className="py-3 pr-4 text-right tabular-nums">

                                          <span
                                            className={`inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 rounded-full text-xs font-bold ${Number(txn.quantity ?? 0) <= 0
                                              ? 'bg-red-100 text-red-700'
                                              : 'bg-emerald-100 text-emerald-700'
                                              }`}
                                          >

                                            {txn.quantity}

                                          </span>

                                        </td>

                                        <td className="py-3 pr-4 font-bold text-emerald-700 text-right tabular-nums">

                                          Rs. {total}

                                        </td>

                                        <td className="py-3 pr-3 text-right">

                                          <div className="flex gap-2 justify-end">

                                            <button
                                              onClick={() => openEditTxn(txn)}
                                              title="Edit"
                                              className="w-9 h-9 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors"
                                            >

                                              <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.8"
                                                className="w-4 h-4"
                                              >

                                                <path d="M12 20h9" />

                                                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />

                                              </svg>

                                            </button>

                                            <button
                                              onClick={() => deleteTxn(txn)}
                                              disabled={deletingTxnId === txn.id}
                                              title="Delete"
                                              className="w-9 h-9 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors disabled:opacity-50"
                                            >

                                              {deletingTxnId === txn.id ? (

                                                <svg
                                                  xmlns="http://www.w3.org/2000/svg"
                                                  viewBox="0 0 24 24"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  strokeWidth="1.8"
                                                  className="w-4 h-4 animate-spin"
                                                >

                                                  <path d="M21 12a9 9 0 1 1-9-9" strokeLinecap="round" />

                                                </svg>

                                              ) : (

                                                <svg
                                                  xmlns="http://www.w3.org/2000/svg"
                                                  viewBox="0 0 24 24"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  strokeWidth="1.8"
                                                  className="w-4 h-4"
                                                >

                                                  <path d="M3 6h18" />

                                                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />

                                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />

                                                  <path d="M10 11v6" />

                                                  <path d="M14 11v6" />

                                                </svg>

                                              )}

                                            </button>

                                          </div>

                                        </td>

                                      </tr>

                                    )

                                  })}

                                </tbody>

                              </table>

                            </div>

                          )}

                        </div>

                      )

                    })}

                  </div>

                </div>

              )

            })}

          </div>

        )}

      </div>

      {editingTxn && (

        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-[32px] shadow-2xl border border-zinc-200 w-full max-w-lg max-h-[90vh] flex flex-col">

            <h2 className="text-2xl sm:text-3xl font-bold px-6 sm:px-8 pt-6 sm:pt-8 pb-4 flex-shrink-0">

              Edit Stock Log

            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 sm:px-8 overflow-y-auto">

              <div className="sm:col-span-2">

                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Product</label>

                <input
                  type="text"
                  value={editProductName}
                  onChange={(e) => setEditProductName(e.target.value)}
                  placeholder="Product"
                  className="w-full border-2 rounded-2xl px-4 py-4"
                />

              </div>

              <div>

                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Category</label>

                <input
                  type="text"
                  list="categories"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  placeholder="Category"
                  className="w-full border-2 rounded-2xl px-4 py-4"
                />

              </div>

              <div>

                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Brand</label>

                <input
                  type="text"
                  list="brands"
                  value={editBrand}
                  onChange={(e) => setEditBrand(e.target.value)}
                  placeholder="Brand"
                  className="w-full border-2 rounded-2xl px-4 py-4"
                />

              </div>

              <div>

                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Shade</label>

                <input
                  type="text"
                  value={editShade}
                  onChange={(e) => setEditShade(e.target.value)}
                  placeholder="Shade"
                  className="w-full border-2 rounded-2xl px-4 py-4"
                />

              </div>

              <div>

                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Weight</label>

                <input
                  type="text"
                  value={editWeight}
                  onChange={(e) => setEditWeight(e.target.value)}
                  placeholder="Weight"
                  className="w-full border-2 rounded-2xl px-4 py-4"
                />

              </div>

              <div>

                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Cost</label>

                <input
                  type="number"
                  value={editCost}
                  onChange={(e) => setEditCost(e.target.value)}
                  placeholder="Cost"
                  className="w-full border-2 rounded-2xl px-4 py-4"
                />

              </div>

              <div>

                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">MRP</label>

                <input
                  type="number"
                  value={editMrp}
                  onChange={(e) => setEditMrp(e.target.value)}
                  placeholder="MRP"
                  className="w-full border-2 rounded-2xl px-4 py-4"
                />

              </div>

              <div className="sm:col-span-2 pb-6 sm:pb-8">

                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Qty Added</label>

                <input
                  type="number"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  placeholder="Qty Added"
                  className="w-full border-2 rounded-2xl px-4 py-4"
                />

              </div>

            </div>

            <div className="flex gap-4 px-6 sm:px-8 py-5 border-t border-zinc-200 flex-shrink-0">

              <button
                onClick={saveEditTxn}
                disabled={saving}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 hover:scale-105 transition-all duration-200 text-white py-4 rounded-2xl font-bold disabled:opacity-50"
              >

                {saving ? 'Saving...' : 'Update'}

              </button>

              <button
                onClick={() => setEditingTxn(null)}
                disabled={saving}
                className="flex-1 bg-gray-300 py-4 rounded-2xl font-bold"
              >

                Cancel

              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  )

}
