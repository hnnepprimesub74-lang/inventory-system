'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

const SALES_WINDOW_DAYS = 7
const MIN_FLOOR = 2

export default function LowStockPage() {

  const router = useRouter()

  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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

  const lowStock = products
    .filter((p) => Number(p.current_stock || 0) <= p.reorderPoint)
    .sort((a, b) => Number(a.current_stock || 0) - Number(b.current_stock || 0))

  const outOfStockCount = lowStock.filter((p) => Number(p.current_stock || 0) <= 0).length
  const lowOnlyCount = lowStock.length - outOfStockCount

  function exportToExcel() {

    if (lowStock.length === 0) {

      alert('No low stock items')
      return

    }

    const rows = lowStock.map((p) => ({
      Product: p.product_name,
      Category: p.category,
      Brand: p.brand,
      Shade: p.shade,
      'Current Stock': p.current_stock,
      'Reorder Point': Math.ceil(p.reorderPoint),
      Status: Number(p.current_stock || 0) <= 0 ? 'Out of Stock' : 'Low Stock',
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

      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">

          <div>

            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">

              Low Stock Products

            </h1>

            <p className="text-sm text-zinc-500 mt-1">

              Products at or below their reorder point

            </p>

          </div>

          <button
            onClick={exportToExcel}
            className="bg-green-600 text-white px-5 py-3 rounded-2xl font-bold"
          >

            Export Excel

          </button>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-amber-500 px-6 py-4">

            <p className="text-sm text-zinc-500">Low Stock (not zero)</p>
            <h2 className="text-3xl font-bold tracking-tight mt-1 tabular-nums text-amber-600">{lowOnlyCount}</h2>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-red-500 px-6 py-4">

            <p className="text-sm text-zinc-500">Out of Stock</p>
            <h2 className="text-3xl font-bold tracking-tight mt-1 tabular-nums text-red-600">{outOfStockCount}</h2>

          </div>

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          {loading ? (

            <p className="text-zinc-500">Loading...</p>

          ) : lowStock.length === 0 ? (

            <p className="text-zinc-500">Nothing is low on stock right now.</p>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full border-collapse">

                <thead>

                  <tr className="text-left">

                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Product</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Category</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Brand</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Shade</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Current Stock</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Reorder Point</th>
                    <th className="pb-3 text-sm font-medium text-zinc-500">Status</th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-zinc-100">

                  {lowStock.map((p) => {

                    const outOfStock = Number(p.current_stock || 0) <= 0

                    return (

                      <tr key={p.id}>

                        <td className="py-3 pr-4 font-semibold text-zinc-900">{p.product_name}</td>
                        <td className="py-3 pr-4 text-sm text-zinc-600">{p.category}</td>
                        <td className="py-3 pr-4 text-sm text-zinc-600">{p.brand}</td>
                        <td className="py-3 pr-4 text-sm text-zinc-600">{p.shade}</td>
                        <td className={`py-3 pr-4 text-right tabular-nums font-semibold ${outOfStock ? 'text-red-600' : 'text-amber-600'}`}>
                          {p.current_stock}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums text-zinc-600">{Math.ceil(p.reorderPoint)}</td>
                        <td className="py-3">

                          <span
                            className={
                              outOfStock
                                ? 'bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold'
                                : 'bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-semibold'
                            }
                          >

                            {outOfStock ? 'Out of Stock' : 'Low Stock'}

                          </span>

                        </td>

                      </tr>

                    )

                  })}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </div>

    </div>

  )

}
