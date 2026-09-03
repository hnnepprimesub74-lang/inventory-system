'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export default function StockLogPage() {

  const router = useRouter()

  const [products, setProducts] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {

    async function load() {

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

    load()

  }, [])

  function productFor(id: any) {
    return products.find((p) => p.id === id)
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

    const da = a.stockDate || a.createdAt || ''
    const db = b.stockDate || b.createdAt || ''

    return db.localeCompare(da)

  })

  function buildExportRows(items: any[]) {

    return items.map((txn) => {

      const product = productFor(txn.product_id)

      const disc = discountPct(product?.mrp, txn.cost_price)

      return {

        'Stock Date':
          txn.stock_date ||
          (txn.created_at ? txn.created_at.slice(0, 10) : ''),

        Seller: txn.seller || '',

        Product: product?.product_name || '',

        Category: product?.category || '',

        Brand: product?.brand || '',

        Shade: product?.shade || '',

        Weight: product?.weight || '',

        Cost: txn.cost_price,

        MRP: product?.mrp || '',

        'Discount %':
          disc !== null ? Number(disc.toFixed(1)) : '',

        Stock: txn.final_stock,

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

    if (transactions.length === 0) {

      alert('No stock-in records yet')

      return

    }

    downloadWorkbook(
      buildExportRows(transactions),
      'stock-log.xlsx'
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

      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">

          <div>

            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">

              Stock Log

            </h1>

            <p className="text-sm text-zinc-500 mt-1">

              Every stock lot added, grouped by seller and date

            </p>

          </div>

          <div className="flex gap-3">

            <button
              onClick={exportAllLogs}
              className="bg-green-600 text-white px-5 py-3 rounded-2xl font-bold"
            >

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

        {loading ? (

          <p className="text-zinc-500">Loading...</p>

        ) : lots.length === 0 ? (

          <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-8 text-center text-zinc-500">

            No stock has been added yet.

          </div>

        ) : (

          <div className="space-y-5">

            {lots.map((lot) => {

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
                  className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6"
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

                        <p className="font-semibold text-zinc-900">

                          Rs. {totalCost.toLocaleString()}

                        </p>

                      </div>

                      <button
                        onClick={() => exportLot(lot)}
                        className="bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex-shrink-0"
                      >

                        Export Lot

                      </button>

                    </div>

                  </div>

                  <div className="overflow-x-auto -mx-6 px-6">

                    <table className="w-full border-collapse">

                      <thead>

                        <tr className="text-left">

                          <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 w-14">

                            Image

                          </th>

                          <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">

                            Product

                          </th>

                          <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">

                            Category

                          </th>

                          <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">

                            Brand

                          </th>

                          <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">

                            Shade

                          </th>

                          <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">

                            Weight

                          </th>

                          <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">

                            Cost

                          </th>

                          <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">

                            MRP

                          </th>

                          <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">

                            Discount %

                          </th>

                          <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">

                            Stock

                          </th>

                          <th className="pb-3 text-sm font-medium text-zinc-500 text-right">

                            Total

                          </th>

                        </tr>

                      </thead>

                      <tbody className="divide-y divide-zinc-100">

                        {lot.items.map((txn: any) => {

                          const product = productFor(txn.product_id)

                          const disc = discountPct(
                            product?.mrp,
                            txn.cost_price
                          )

                          const total =
                            (txn.cost_price || 0) *
                            (txn.quantity || 0)

                          return (

                            <tr key={txn.id}>

                              <td className="py-3 pr-4">

                                {product?.image_url ? (

                                  <img
                                    src={product.image_url}
                                    alt=""
                                    className="w-12 h-12 rounded-lg object-cover border border-zinc-200"
                                  />

                                ) : (

                                  <div className="w-12 h-12 rounded-lg bg-zinc-100 border border-zinc-200" />

                                )}

                              </td>

                              <td className="py-3 pr-4">

                                <div className="font-semibold text-zinc-900">

                                  {product?.product_name || 'Unknown product'}

                                </div>

                                <div className="text-xs text-zinc-400 mt-0.5">

                                  Qty +{txn.quantity}

                                </div>

                              </td>

                              <td className="py-3 pr-4 text-sm text-zinc-600">

                                {product?.category}

                              </td>

                              <td className="py-3 pr-4 text-sm text-zinc-600">

                                {product?.brand}

                              </td>

                              <td className="py-3 pr-4 text-sm text-zinc-600">

                                {product?.shade}

                              </td>

                              <td className="py-3 pr-4 text-sm text-zinc-600">

                                {product?.weight}

                              </td>

                              <td className="py-3 pr-4 text-sm text-zinc-600 text-right tabular-nums">

                                Rs. {txn.cost_price}

                              </td>

                              <td className="py-3 pr-4 text-sm text-zinc-600 text-right tabular-nums">

                                {product?.mrp ? `Rs. ${product.mrp}` : '—'}

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

                              <td className="py-3 pr-4 font-semibold text-zinc-900 text-right tabular-nums">

                                {txn.final_stock}

                              </td>

                              <td className="py-3 font-semibold text-zinc-900 text-right tabular-nums">

                                Rs. {total}

                              </td>

                            </tr>

                          )

                        })}

                      </tbody>

                    </table>

                  </div>

                </div>

              )

            })}

          </div>

        )}

      </div>

    </div>

  )

}
