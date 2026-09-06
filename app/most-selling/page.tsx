'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { displayMrp } from '../../lib/mrp'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export default function MostSellingPage() {

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

    const salesMap: any = {}

    ;(salesData || []).forEach((sale: any) => {

      salesMap[sale.product_id] =
        (salesMap[sale.product_id] || 0) + Number(sale.quantity || 0)

    })

    const ranked = (productsData || [])
      .map((product: any) => ({
        ...product,
        sold: salesMap[product.id] || 0,
      }))
      .sort((a: any, b: any) => b.sold - a.sold)

    setProducts(ranked)
    setLoading(false)

  }

  const sellingProducts = products.filter((p) => p.sold > 0)
  const totalUnitsSold = sellingProducts.reduce((s, p) => s + p.sold, 0)
  const totalRevenue = sellingProducts.reduce((s, p) => s + p.sold * (displayMrp(p.mrp) || 0), 0)

  function exportToExcel() {

    if (sellingProducts.length === 0) {

      alert('No sales in the last 30 days')
      return

    }

    const rows = sellingProducts.map((p, i) => ({
      Rank: i + 1,
      Product: p.product_name,
      Category: p.category,
      Brand: p.brand,
      Shade: p.shade,
      'Sold (30d)': p.sold,
      MRP: displayMrp(p.mrp) ?? '',
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

  return (

    <div className="text-black">

      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">

          <div>

            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">

              Most Selling Products

            </h1>

            <p className="text-sm text-zinc-500 mt-1">

              Ranked by units sold in the last 30 days

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

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-indigo-600 px-6 py-4">

            <p className="text-sm text-zinc-500">Units Sold (30d)</p>
            <h2 className="text-3xl font-bold tracking-tight mt-1 tabular-nums text-indigo-600">{totalUnitsSold.toLocaleString('en-IN')}</h2>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-green-600 px-6 py-4">

            <p className="text-sm text-zinc-500">Revenue at MRP (30d)</p>
            <h2 className="text-3xl font-bold tracking-tight mt-1 tabular-nums text-green-600">Rs. {totalRevenue.toLocaleString('en-IN')}</h2>

          </div>

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          {loading ? (

            <p className="text-zinc-500">Loading...</p>

          ) : sellingProducts.length === 0 ? (

            <p className="text-zinc-500">No sales in the last 30 days.</p>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full border-collapse">

                <thead>

                  <tr className="text-left">

                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">#</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Product</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Category</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Brand</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Sold (30d)</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">MRP</th>
                    <th className="pb-3 text-sm font-medium text-zinc-500 text-right">Current Stock</th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-zinc-100">

                  {sellingProducts.map((p, i) => (

                    <tr key={p.id}>

                      <td className="py-3 pr-4 text-sm text-zinc-400 font-semibold">{i + 1}</td>
                      <td className="py-3 pr-4 font-semibold text-zinc-900">{p.product_name}</td>
                      <td className="py-3 pr-4 text-sm text-zinc-600">{p.category}</td>
                      <td className="py-3 pr-4 text-sm text-zinc-600">{p.brand}</td>
                      <td className="py-3 pr-4 text-right tabular-nums font-semibold text-indigo-600">{p.sold}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-zinc-600">{displayMrp(p.mrp) !== null ? `Rs. ${displayMrp(p.mrp)}` : '—'}</td>
                      <td className="py-3 text-right tabular-nums text-zinc-600">{p.current_stock}</td>

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
