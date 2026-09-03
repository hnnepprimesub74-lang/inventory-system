'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
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
      }

    })
    .sort((a: any, b: any) => b.totalAmount - a.totalAmount)

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

          <h3 className="font-bold text-lg text-zinc-900 mb-4">

            Product Purchase Details

          </h3>

          {loading ? (

            <p className="text-zinc-500">Loading...</p>

          ) : productRows.length === 0 ? (

            <p className="text-zinc-500">No purchase data for this filter.</p>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full border-collapse">

                <thead>

                  <tr className="text-left">

                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Product</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Category</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Brand</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Total Quantity</th>
                    <th className="pb-3 text-sm font-medium text-zinc-500 text-right">Total Amount</th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-zinc-100">

                  {productRows.map((r: any) => (

                    <tr key={r.productId}>

                      <td className="py-3 pr-4 font-semibold text-zinc-900">{r.productName}</td>
                      <td className="py-3 pr-4 text-sm text-zinc-600">{r.category}</td>
                      <td className="py-3 pr-4 text-sm text-zinc-600">{r.brand}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{r.totalQty}</td>
                      <td className="py-3 text-right tabular-nums font-semibold text-zinc-900">Rs. {r.totalAmount.toLocaleString()}</td>

                    </tr>

                  ))}

                </tbody>

                <tfoot>

                  <tr className="border-t-2 border-zinc-200 font-bold text-zinc-900">

                    <td className="pt-3 pr-4" colSpan={4}>Total</td>
                    <td className="pt-3 text-right tabular-nums">Rs. {totalAmount.toLocaleString()}</td>

                  </tr>

                </tfoot>

              </table>

            </div>

          )}

        </div>

      </div>

    </div>

  )

}
