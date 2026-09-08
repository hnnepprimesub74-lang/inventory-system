'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
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
  const topSeller = sellingProducts[0]

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
      Weight: p.weight,
      'Sold (30d)': p.sold,
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

              Ranked by units sold in the last 30 days

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

          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl shadow-sm px-6 py-5 text-white">

            <p className="text-sm text-indigo-100">Units Sold (30d)</p>
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

            <p className="text-zinc-500">No sales in the last 30 days.</p>

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
                    <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-zinc-400 text-right">Sold (30d)</th>
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
