'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { displayMrp } from '../../../lib/mrp'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import MonthPicker from '../../../components/MonthPicker'

function normalizeName(name: any) {
  return (name || '').toString().trim().toLowerCase()
}

export default function LifetimePurchasePage() {

  const router = useRouter()

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [stockTxns, setStockTxns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterBrand, setFilterBrand] = useState('')

  const [editingProductId, setEditingProductId] = useState<any>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editBrand, setEditBrand] = useState('')
  const [editCost, setEditCost] = useState('')
  const [editMrp, setEditMrp] = useState('')
  const [editQty, setEditQty] = useState('')
  const [saving, setSaving] = useState(false)
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

    const { data: supplierData } =
      await supabase.from('suppliers').select('*').order('name')

    const { data: productData } =
      await supabase.from('products').select('*')

    const { data: txnData } =
      await supabase
        .from('stock_transactions')
        .select('*')
        .eq('transaction_type', 'ADD')

    setSuppliers(supplierData || [])
    setProducts(productData || [])
    setStockTxns(txnData || [])
    setLoading(false)

  }

  function txnAmount(t: any) {
    return Number(t.cost_price || 0) * Number(t.quantity || 0)
  }

  function productFor(id: any) {
    return products.find((p) => p.id === id)
  }

  function discountPct(mrp: any, cost: any) {

    const mrpNum = Number(mrp)
    const costNum = Number(cost)

    if (!mrpNum || mrpNum <= 0) return null

    return ((mrpNum - costNum) / mrpNum) * 100

  }

  function productGroupKey(row: any) {

    return [
      (row.productName || '').trim().toLowerCase(),
      (row.brand || '').trim().toLowerCase(),
      (row.category || '').trim().toLowerCase(),
    ].join('|')

  }

  const brands = Array.from(
    new Set(products.map((p) => p.brand).filter(Boolean))
  ).sort()

  const filteredTxns = stockTxns.filter((t) => {

    if (filterSupplier && normalizeName(t.seller) !== normalizeName(filterSupplier)) {
      return false
    }

    if (filterMonth && (t.stock_date || '').slice(0, 7) !== filterMonth) {
      return false
    }

    if (filterBrand) {

      const product = productFor(t.product_id)

      if ((product?.brand || '') !== filterBrand) {
        return false
      }

    }

    return true

  })

  const totalAmount = filteredTxns.reduce((s, t) => s + txnAmount(t), 0)
  const totalQty = filteredTxns.reduce((s, t) => s + Number(t.quantity || 0), 0)

  const productMap: any = {}

  filteredTxns.forEach((t) => {

    const key = t.product_id

    if (!productMap[key]) {

      productMap[key] = {
        productId: key,
        totalQty: 0,
        totalAmount: 0,
      }

    }

    productMap[key].totalQty += Number(t.quantity || 0)
    productMap[key].totalAmount += txnAmount(t)

  })

  const productRows = Object.values(productMap)
    .map((row: any) => {

      const product = productFor(row.productId)

      return {
        ...row,
        productName: product?.product_name || 'Unknown product',
        category: product?.category || '',
        brand: product?.brand || '',
        barcode: product?.barcode || '',
        shade: product?.shade || '',
        weight: product?.weight || '',
        costPrice: product?.cost_price,
        mrp: product?.mrp,
        image: product?.image_url,
      }

    })
    .sort((a: any, b: any) => b.totalAmount - a.totalAmount)

  const productGroupsMap: Record<string, any> = {}
  const productGroupsList: any[] = []

  productRows.forEach((row: any) => {

    const key = productGroupKey(row)

    if (!productGroupsMap[key]) {

      productGroupsMap[key] = {
        key,
        productName: row.productName,
        category: row.category,
        brand: row.brand,
        image: row.image,
        items: [],
      }

      productGroupsList.push(productGroupsMap[key])

    }

    if (!productGroupsMap[key].image && row.image) {
      productGroupsMap[key].image = row.image
    }

    productGroupsMap[key].items.push(row)

  })

  const productGroups = productGroupsList
    .map((g: any) => {

      const groupTotalQty = g.items.reduce(
        (s: number, r: any) => s + Number(r.totalQty || 0),
        0
      )

      const groupTotalAmount = g.items.reduce(
        (s: number, r: any) => s + Number(r.totalAmount || 0),
        0
      )

      return { ...g, totalQty: groupTotalQty, totalAmount: groupTotalAmount }

    })
    .sort((a: any, b: any) => b.totalAmount - a.totalAmount)

  function openEditProduct(row: any) {

    const product = productFor(row.productId)

    if (!product) return

    setEditingProductId(row.productId)
    setEditName(product.product_name || '')
    setEditCategory(product.category || '')
    setEditBrand(product.brand || '')
    setEditCost(String(product.cost_price ?? ''))
    setEditMrp(String(product.mrp ?? ''))
    setEditQty(String(row.totalQty ?? ''))

  }

  async function saveEditProduct() {

    if (!editingProductId) return

    const newQty = Number(editQty)

    if (!Number.isFinite(newQty) || newQty < 0) {

      alert('Total Quantity must be 0 or greater')

      return

    }

    setSaving(true)

    const productTxns = filteredTxns.filter(
      (t) => t.product_id === editingProductId
    )

    const oldQty = productTxns.reduce(
      (s, t) => s + Number(t.quantity || 0),
      0
    )

    const delta = newQty - oldQty

    let txnError = null

    if (delta !== 0 && productTxns.length > 0) {

      const target = productTxns[0]
      const updatedQty = Number(target.quantity || 0) + delta

      const { error } = await supabase
        .from('stock_transactions')
        .update({ quantity: updatedQty < 0 ? 0 : updatedQty })
        .eq('id', target.id)

      txnError = error

    }

    const { error: productError } = await supabase
      .from('products')
      .update({

        product_name: editName,

        category: editCategory,

        brand: editBrand,

        cost_price: Number(editCost),

        mrp: Number(editMrp),

      })
      .eq('id', editingProductId)

    setSaving(false)

    if (txnError || productError) {

      alert(`Failed to save changes: ${txnError?.message || productError?.message}`)

      return

    }

    setEditingProductId(null)

    await load()

  }

  function exportProductPurchases() {

    if (productRows.length === 0) {

      alert('No purchase data for this filter')
      return

    }

    const rows = productRows.map((r: any) => ({
      Product: r.productName,
      Category: r.category,
      Brand: r.brand,
      'Total Quantity Purchased': r.totalQty,
      'Total Amount': r.totalAmount,
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Product Purchases')

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })

    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    })

    saveAs(blob, 'lifetime-purchase.xlsx')

  }

  return (

    <div className="text-black">

      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">

          <div>

            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">

              Lifetime Purchase

            </h1>

            <p className="text-sm text-zinc-500 mt-1">

              Every product ever purchased, across all suppliers

            </p>

          </div>

          

        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-zinc-900 px-6 py-4 min-w-[220px] inline-block">

          <p className="text-sm text-zinc-500">

            Total Purchase (Filtered)

          </p>

          <h2 className="text-3xl font-bold tracking-tight mt-1 tabular-nums">

            Rs. {totalAmount.toLocaleString()}

          </h2>

          <p className="text-xs text-zinc-400 mt-1">

            {totalQty} units

          </p>

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">

            <h3 className="font-bold text-lg text-zinc-900">

              Filters

            </h3>

            <button
              onClick={exportProductPurchases}
              className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm"
            >

              Export Excel

            </button>

          </div>

          <div className="flex gap-3 flex-wrap">

            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="border border-zinc-300 rounded-xl px-4 py-2.5 min-w-[200px]"
            >

              <option value="">All Suppliers</option>

              {suppliers.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}

            </select>

            <MonthPicker value={filterMonth} onChange={setFilterMonth} />

            <select
              value={filterBrand}
              onChange={(e) => setFilterBrand(e.target.value)}
              className="border border-zinc-300 rounded-xl px-4 py-2.5 min-w-[160px]"
            >

              <option value="">All Brands</option>

              {brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}

            </select>

            {(filterSupplier || filterMonth || filterBrand) && (

              <button
                onClick={() => {
                  setFilterSupplier('')
                  setFilterMonth('')
                  setFilterBrand('')
                }}
                className="bg-white border border-zinc-300 text-zinc-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-zinc-50"
              >

                Clear Filters

              </button>

            )}

          </div>

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">

            <h3 className="font-bold text-lg text-zinc-900">

              Product Purchase Details

            </h3>

            <p className="text-sm text-zinc-500">

              {productGroups.length} product(s) · {totalQty} units · <span className="font-bold text-emerald-600">Rs. {totalAmount.toLocaleString()}</span>

            </p>

          </div>

          {loading ? (

            <p className="text-zinc-500">Loading...</p>

          ) : productGroups.length === 0 ? (

            <p className="text-zinc-500">No purchase data for this filter.</p>

          ) : (

            <div className="space-y-3">

              {productGroups.map((group: any) => {

                const isOpen = expandedGroups[group.key] !== false
                const isEmptyGroup = Number(group.totalQty || 0) <= 0

                return (

                  <div
                    key={group.key}
                    className={`border rounded-2xl overflow-hidden border-l-4 ${isEmptyGroup ? 'border-l-red-400 border-zinc-200' : 'border-l-indigo-400 border-zinc-200'}`}
                  >

                    <button
                      onClick={() =>
                        setExpandedGroups((prev) => ({ ...prev, [group.key]: prev[group.key] === false }))
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

                        <p className="text-xs text-zinc-500">Total Quantity</p>
                        <p className={`font-bold tabular-nums ${isEmptyGroup ? 'text-red-600' : 'text-indigo-600'}`}>{group.totalQty}</p>

                      </div>

                      <div className="text-right hidden sm:block min-w-[110px] flex-shrink-0">

                        <p className="text-xs text-zinc-500">Total Amount</p>
                        <p className="font-bold tabular-nums text-emerald-600">Rs. {group.totalAmount.toLocaleString('en-IN')}</p>

                      </div>

                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`w-4 h-4 text-indigo-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      >

                        <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />

                      </svg>

                    </button>

                    {isOpen && (

                      <div className="border-t border-zinc-200 overflow-x-auto">

                        <table className="w-full border-collapse">

                          <thead>

                            <tr className="text-left bg-indigo-50/70">

                              <th className="py-2.5 pl-3 pr-4 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide">Barcode</th>
                              <th className="py-2.5 pr-4 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide">Shade</th>
                              <th className="py-2.5 pr-4 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide">Weight</th>
                              <th className="py-2.5 pr-4 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide text-right">Cost</th>
                              <th className="py-2.5 pr-4 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide text-right">MRP</th>
                              <th className="py-2.5 pr-4 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide text-right">Discount %</th>
                              <th className="py-2.5 pr-4 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide text-right">Total Quantity</th>
                              <th className="py-2.5 pr-4 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide text-right">Total Amount</th>
                              <th className="py-2.5 pr-3 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide text-right rounded-r-xl">Actions</th>

                            </tr>

                          </thead>

                          <tbody className="divide-y divide-zinc-100">

                            {group.items.map((r: any) => {

                              const mrpDisplay = displayMrp(r.mrp)
                              const disc = discountPct(mrpDisplay, r.costPrice)

                              return (

                                <tr key={r.productId}>

                                  <td className="py-3 pl-3 pr-4">

                                    <div className="text-sm text-zinc-500">{r.barcode || '—'}</div>

                                    <div className="text-xs text-zinc-400 mt-0.5">Qty {r.totalQty}</div>

                                  </td>

                                  <td className="py-3 pr-4 text-sm text-zinc-600">{r.shade || '—'}</td>
                                  <td className="py-3 pr-4 text-sm text-zinc-600">{r.weight || '—'}</td>
                                  <td className="py-3 pr-4 text-sm text-zinc-600 text-right tabular-nums">Rs. {r.costPrice ?? '—'}</td>
                                  <td className="py-3 pr-4 text-sm text-zinc-600 text-right tabular-nums">{mrpDisplay !== null ? `Rs. ${mrpDisplay}` : '—'}</td>

                                  <td className="py-3 pr-4 text-sm text-right tabular-nums">

                                    {disc !== null ? (

                                      <span className={disc >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>

                                        {disc.toFixed(1)}%

                                      </span>

                                    ) : (

                                      <span className="text-zinc-400">—</span>

                                    )}

                                  </td>

                                  <td className="py-3 pr-4 text-right tabular-nums font-semibold text-zinc-900">{r.totalQty}</td>
                                  <td className="py-3 pr-4 font-bold text-emerald-700 text-right tabular-nums">Rs. {r.totalAmount.toLocaleString()}</td>

                                  <td className="py-3 pr-3 text-right">

                                    <button
                                      onClick={() => openEditProduct(r)}
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

          )}

        </div>

      </div>

      {editingProductId && (

        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-[32px] shadow-2xl border border-zinc-200 w-full max-w-lg max-h-[90vh] flex flex-col">

            <h2 className="text-2xl sm:text-3xl font-bold px-6 sm:px-8 pt-6 sm:pt-8 pb-4 flex-shrink-0">

              Edit Product

            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 sm:px-8 overflow-y-auto">

              <div className="sm:col-span-2">

                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Product Name</label>

                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Product"
                  className="w-full border-2 rounded-2xl px-4 py-4"
                />

              </div>

              <div>

                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Category</label>

                <input
                  type="text"
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
                  value={editBrand}
                  onChange={(e) => setEditBrand(e.target.value)}
                  placeholder="Brand"
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

                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Total Quantity</label>

                <input
                  type="number"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  placeholder="Total Quantity"
                  className="w-full border-2 rounded-2xl px-4 py-4"
                />

              </div>

            </div>

            <div className="flex gap-4 px-6 sm:px-8 py-5 border-t border-zinc-200 flex-shrink-0">

              <button
                onClick={saveEditProduct}
                disabled={saving}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 hover:scale-105 transition-all duration-200 text-white py-4 rounded-2xl font-bold disabled:opacity-50"
              >

                {saving ? 'Saving...' : 'Update'}

              </button>

              <button
                onClick={() => setEditingProductId(null)}
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
