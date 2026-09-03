'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import MonthPicker from '../../components/MonthPicker'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function monthLabel(month: string) {

  if (!month) return ''

  const [y, m] = month.split('-')

  const date = new Date(Number(y), Number(m) - 1, 1)

  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

}

export default function RefundsPage() {

  const router = useRouter()

  const [products, setProducts] = useState<any[]>([])
  const [refunds, setRefunds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [filterStore, setFilterStore] = useState('')
  const [filterMonth, setFilterMonth] = useState('')

  const [showAddModal, setShowAddModal] = useState(false)
  const [productQuery, setProductQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [store, setStore] = useState('')
  const [refundDate, setRefundDate] = useState('')
  const [saving, setSaving] = useState(false)

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

    const { data: refundsData } =
      await supabase
        .from('refunds')
        .select('*')
        .order('refund_date', { ascending: false })

    setProducts(productsData || [])
    setRefunds(refundsData || [])
    setLoading(false)

  }

  function productFor(id: any) {
    return products.find((p) => p.id === id)
  }

  const stores = Array.from(
    new Set(refunds.map((r) => r.store).filter(Boolean))
  ).sort()

  const filteredRefunds = refunds.filter((r) => {

    if (filterStore && r.store !== filterStore) return false

    if (filterMonth && (r.refund_date || '').slice(0, 7) !== filterMonth) return false

    return true

  })

  const totalRefundAmount = filteredRefunds.reduce((s, r) => s + Number(r.amount || 0), 0)

  const totalRefundLifetime = refunds.reduce((s, r) => s + Number(r.amount || 0), 0)

  const thisMonth = currentMonth()

  const totalRefundThisMonth = refunds
    .filter((r) => (r.refund_date || '').slice(0, 7) === thisMonth)
    .reduce((s, r) => s + Number(r.amount || 0), 0)

  const productMatches =
    productQuery.trim().length === 0
      ? []
      : products
          .filter((p) => {

            const q = productQuery.trim().toLowerCase()

            return (
              (p.product_name || '').toLowerCase().includes(q) ||
              (p.barcode || '').toLowerCase().includes(q) ||
              (p.brand || '').toLowerCase().includes(q)
            )

          })
          .slice(0, 8)

  const productGroups = Object.values(
    filteredRefunds.reduce((acc: any, r) => {

      const key = r.product_id || 'unknown'

      if (!acc[key]) {

        acc[key] = { productId: r.product_id, totalAmount: 0, count: 0 }

      }

      acc[key].totalAmount += Number(r.amount || 0)
      acc[key].count += 1

      return acc

    }, {})
  )
    .map((row: any) => {

      const product = productFor(row.productId)

      return {
        ...row,
        productName: product?.product_name || 'Unknown product',
        category: product?.category || '',
        brand: product?.brand || '',
        shade: product?.shade || '',
        weight: product?.weight || '',
      }

    })
    .sort((a: any, b: any) => b.totalAmount - a.totalAmount)

  async function addRefund() {

    if (!selectedProduct) {

      alert('Search and select a product')
      return

    }

    const amt = Number(amount)

    if (!amt || amt <= 0) {

      alert('Enter a valid amount')
      return

    }

    setSaving(true)

    const { error } = await supabase.from('refunds').insert({
      product_id: selectedProduct.id,
      amount: amt,
      reason: reason.trim() || null,
      store: store.trim() || null,
      refund_date: refundDate || new Date().toISOString().slice(0, 10),
    })

    setSaving(false)

    if (error) {

      alert('Failed to add refund: ' + error.message)
      return

    }

    setSelectedProduct(null)
    setProductQuery('')
    setAmount('')
    setReason('')
    setStore('')
    setRefundDate('')
    setShowAddModal(false)
    await load()

  }

  function exportRefunds() {

    if (filteredRefunds.length === 0) {

      alert('No refunds to export')
      return

    }

    const rows = filteredRefunds.map((r) => {

      const product = productFor(r.product_id)

      return {
        Date: r.refund_date,
        Product: product?.product_name || 'Unknown product',
        Brand: product?.brand || '',
        Category: product?.category || '',
        Shade: product?.shade || '',
        Weight: product?.weight || '',
        Store: r.store || '',
        Reason: r.reason || '',
        Amount: Number(r.amount || 0),
      }

    })

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Refunds')

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })

    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    })

    saveAs(blob, 'refunds.xlsx')

  }

  return (

    <div className="text-black">

      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">

          <div>

            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">

              Customer Refunds

            </h1>

            <p className="text-sm text-zinc-500 mt-1">

              Track refunds by product, store and reason

            </p>

          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-amber-400 border border-amber-500 text-zinc-900 hover:bg-amber-500 transition-colors px-4 py-2 rounded-xl text-sm font-semibold"
          >

            + Add Refund

          </button>

        </div>

        <div className="flex flex-wrap gap-4">

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-red-500 px-6 py-4 min-w-[220px]">

            <p className="text-sm text-zinc-500">

              Total Refunded (Lifetime)

            </p>

            <h2 className="text-3xl font-bold tracking-tight mt-1 tabular-nums text-red-600">

              Rs. {totalRefundLifetime.toLocaleString('en-IN')}

            </h2>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-amber-500 px-6 py-4 min-w-[220px]">

            <p className="text-sm text-zinc-500">

              Refunded This Month ({monthLabel(thisMonth)})

            </p>

            <h2 className="text-3xl font-bold tracking-tight mt-1 tabular-nums text-amber-600">

              Rs. {totalRefundThisMonth.toLocaleString('en-IN')}

            </h2>

          </div>

          {(filterStore || filterMonth) && (

            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-indigo-600 px-6 py-4 min-w-[220px]">

              <p className="text-sm text-zinc-500">

                Refunded (Filtered{filterMonth ? ' — ' + monthLabel(filterMonth) : ''}{filterStore ? (filterMonth ? ', ' : ' — ') + filterStore : ''})

              </p>

              <h2 className="text-3xl font-bold tracking-tight mt-1 tabular-nums text-indigo-600">

                Rs. {totalRefundAmount.toLocaleString('en-IN')}

              </h2>

            </div>

          )}

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">

            <h3 className="font-bold text-lg text-zinc-900">

              Filters

            </h3>

            <button
              onClick={exportRefunds}
              className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm"
            >

              Export Excel

            </button>

          </div>

          <div className="flex gap-3 flex-wrap items-center">

            <select
              value={filterStore}
              onChange={(e) => setFilterStore(e.target.value)}
              className="border border-zinc-300 rounded-xl px-4 py-2.5 min-w-[180px]"
            >

              <option value="">All Stores</option>

              {stores.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}

            </select>

            <MonthPicker value={filterMonth} onChange={setFilterMonth} />

            {(filterStore || filterMonth) && (

              <button
                onClick={() => {
                  setFilterStore('')
                  setFilterMonth('')
                }}
                className="bg-white border border-zinc-300 text-zinc-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-zinc-50"
              >

                Clear Filters

              </button>

            )}

          </div>

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <h3 className="font-bold text-lg text-zinc-900 mb-4">

            Most Refunded Products

          </h3>

          {loading ? (

            <p className="text-zinc-500">Loading...</p>

          ) : productGroups.length === 0 ? (

            <p className="text-zinc-500">No refunds recorded for this filter.</p>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full border-collapse">

                <thead>

                  <tr className="text-left">

                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Product</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Category</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Brand</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Shade</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Weight</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Refund Count</th>
                    <th className="pb-3 text-sm font-medium text-zinc-500 text-right">Total Refunded</th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-zinc-100">

                  {productGroups.map((r: any) => (

                    <tr key={r.productId}>

                      <td className="py-3 pr-4 font-semibold text-zinc-900">{r.productName}</td>
                      <td className="py-3 pr-4 text-sm text-zinc-600">{r.category}</td>
                      <td className="py-3 pr-4 text-sm text-zinc-600">{r.brand}</td>
                      <td className="py-3 pr-4 text-sm text-zinc-600">{r.shade || '—'}</td>
                      <td className="py-3 pr-4 text-sm text-zinc-600">{r.weight || '—'}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{r.count}</td>
                      <td className="py-3 text-right tabular-nums font-semibold text-red-600">Rs. {r.totalAmount.toLocaleString('en-IN')}</td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <h3 className="font-bold text-lg text-zinc-900 mb-4">

            Refund History

          </h3>

          {loading ? (

            <p className="text-zinc-500">Loading...</p>

          ) : filteredRefunds.length === 0 ? (

            <p className="text-zinc-500">No refunds recorded for this filter.</p>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full border-collapse">

                <thead>

                  <tr className="text-left">

                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Date</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Product</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Shade</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Weight</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Store</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Reason</th>
                    <th className="pb-3 text-sm font-medium text-zinc-500 text-right">Amount</th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-zinc-100">

                  {filteredRefunds.map((r) => {

                    const product = productFor(r.product_id)

                    return (

                      <tr key={r.id}>

                        <td className="py-3 pr-4 text-sm text-zinc-600">{r.refund_date}</td>
                        <td className="py-3 pr-4 font-semibold text-zinc-900">{product?.product_name || 'Unknown product'}</td>
                        <td className="py-3 pr-4 text-sm text-zinc-600">{product?.shade || '—'}</td>
                        <td className="py-3 pr-4 text-sm text-zinc-600">{product?.weight || '—'}</td>
                        <td className="py-3 pr-4 text-sm text-zinc-600">{r.store || '—'}</td>
                        <td className="py-3 pr-4 text-sm text-zinc-600">{r.reason || '—'}</td>
                        <td className="py-3 text-right tabular-nums font-semibold text-red-600">Rs. {Number(r.amount).toLocaleString('en-IN')}</td>

                      </tr>

                    )

                  })}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </div>

      {showAddModal && (

        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowAddModal(false)}
        >

          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[24px] shadow-2xl border border-zinc-200 w-full max-w-md p-6"
          >

            <h3 className="font-bold text-lg text-zinc-900 mb-4">

              Add Refund

            </h3>

            <div className="space-y-3">

              <div>

                <label className="text-xs font-medium text-zinc-500 mb-1 block">Product</label>

                {selectedProduct ? (

                  <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5">

                    <div className="min-w-0">

                      <p className="font-semibold text-zinc-900 truncate">{selectedProduct.product_name}</p>
                      <p className="text-xs text-zinc-500 truncate">
                        {selectedProduct.category}
                        {selectedProduct.brand && ` · ${selectedProduct.brand}`}
                        {selectedProduct.shade && ` · ${selectedProduct.shade}`}
                      </p>

                    </div>

                    <button
                      onClick={() => {
                        setSelectedProduct(null)
                        setProductQuery('')
                      }}
                      className="text-xs font-semibold text-zinc-500 hover:text-red-600 flex-shrink-0 ml-3"
                    >

                      Change

                    </button>

                  </div>

                ) : (

                  <div className="relative">

                    <input
                      value={productQuery}
                      onChange={(e) => setProductQuery(e.target.value)}
                      placeholder="Search product by name, brand or barcode"
                      autoFocus
                      className="w-full border border-zinc-300 rounded-xl px-4 py-2.5"
                    />

                    {productMatches.length > 0 && (

                      <div className="absolute z-10 mt-1 w-full bg-white border border-zinc-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">

                        {productMatches.map((p) => (

                          <button
                            key={p.id}
                            onClick={() => {
                              setSelectedProduct(p)
                              setProductQuery('')
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 border-b border-zinc-100 last:border-b-0"
                          >

                            <p className="font-semibold text-sm text-zinc-900">{p.product_name}</p>
                            <p className="text-xs text-zinc-500">
                              {p.category}
                              {p.brand && ` · ${p.brand}`}
                              {p.shade && ` · ${p.shade}`}
                            </p>

                          </button>

                        ))}

                      </div>

                    )}

                  </div>

                )}

              </div>

              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Refund amount"
                className="w-full border border-zinc-300 rounded-xl px-4 py-2.5"
              />

              <input
                value={store}
                onChange={(e) => setStore(e.target.value)}
                placeholder="Store"
                list="refund-stores"
                className="w-full border border-zinc-300 rounded-xl px-4 py-2.5"
              />

              <datalist id="refund-stores">
                {stores.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>

              <input
                type="date"
                value={refundDate}
                onChange={(e) => setRefundDate(e.target.value)}
                className="w-full border border-zinc-300 rounded-xl px-4 py-2.5"
              />

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional)"
                rows={2}
                className="w-full border border-zinc-300 rounded-xl px-4 py-2.5 resize-none"
              />

            </div>

            <div className="flex justify-end gap-3 mt-6">

              <button
                onClick={() => setShowAddModal(false)}
                disabled={saving}
                className="bg-white border border-zinc-300 text-zinc-700 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50"
              >

                Cancel

              </button>

              <button
                onClick={addRefund}
                disabled={saving}
                className="bg-amber-400 border border-amber-500 text-zinc-900 hover:bg-amber-500 transition-colors px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              >

                {saving ? 'Saving...' : 'Add Refund'}

              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  )

}
