'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useReactToPrint } from 'react-to-print'
import { supabase } from '../../../lib/supabase'
import { loadPurchaseOrderDraft, clearPurchaseOrderDraft, PurchaseOrderDraftItem } from '../../../lib/purchaseOrderDraft'
import PurchaseOrderPrint from '../../../components/PurchaseOrderPrint'

function groupKey(item: PurchaseOrderDraftItem) {

  return [item.product_name, item.brand, item.category].join('|')

}

function todayIso() {

  return new Date().toISOString().slice(0, 10)

}

export default function CreatePurchaseOrderPage() {

  const router = useRouter()

  const [ready, setReady] = useState(false)
  const [items, setItems] = useState<(PurchaseOrderDraftItem & { qty: number })[]>([])
  const [supplierName, setSupplierName] = useState('')
  const [orderDate, setOrderDate] = useState(todayIso())
  const [notes, setNotes] = useState('')

  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Purchase Order - ${orderDate}`,
  })

  useEffect(() => {

    async function init() {

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {

        router.push('/login')
        return

      }

      const draft = loadPurchaseOrderDraft()

      setItems(draft.map((d) => ({ ...d, qty: Math.max(d.suggestedQty || 1, 1) })))
      setReady(true)

    }

    init()

  }, [])

  function updateQty(id: string, qty: number) {

    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, qty: Math.max(qty, 0) } : it)))

  }

  function removeItem(id: string) {

    setItems((prev) => prev.filter((it) => it.id !== id))

  }

  function backToLowStock() {

    router.push('/low-stock')

  }

  function finishOrder() {

    clearPurchaseOrderDraft()
    router.push('/low-stock')

  }

  const groupsMap: Record<string, { productName: string; brand: string; category: string; items: (PurchaseOrderDraftItem & { qty: number })[] }> = {}

  items.forEach((it) => {

    const key = groupKey(it)

    if (!groupsMap[key]) {

      groupsMap[key] = { productName: it.product_name, brand: it.brand, category: it.category, items: [] }

    }

    groupsMap[key].items.push(it)

  })

  const groups = Object.values(groupsMap)
  const totalQty = items.reduce((s, it) => s + Number(it.qty || 0), 0)
  const totalCost = items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.costPrice || 0), 0)

  const printLines = items
    .filter((it) => it.qty > 0)
    .map((it) => ({
      id: it.id,
      product_name: it.product_name,
      category: it.category,
      brand: it.brand,
      shade: it.shade,
      qty: it.qty,
    }))

  if (ready && items.length === 0) {

    return (

      <div className="text-black max-w-2xl mx-auto text-center py-24 space-y-4">

        <h1 className="text-2xl font-bold text-zinc-900">No items selected</h1>
        <p className="text-zinc-500">Go back to Low Stock Products and select items to build a purchase order.</p>

        <button
          onClick={backToLowStock}
          className="bg-zinc-900 hover:bg-zinc-800 text-white font-semibold px-5 py-2.5 rounded-xl text-sm"
        >

          Back to Low Stock

        </button>

      </div>

    )

  }

  return (

    <div className="text-black">

      <div className="max-w-5xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">

          <div>

            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Create Purchase Order</h1>
            <p className="text-sm text-zinc-500 mt-1">Set quantities, then download the order as a PDF for your supplier.</p>

          </div>

          <button
            onClick={backToLowStock}
            className="inline-flex items-center gap-1.5 border border-zinc-300 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-400 transition-colors px-3 py-1.5 rounded-lg text-xs font-medium"
          >

            ← Back to Low Stock

          </button>

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">

          <div>

            <label className="text-xs font-semibold text-zinc-500">Supplier Name</label>
            <input
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Enter supplier name"
              className="mt-1 w-full border border-zinc-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />

          </div>

          <div>

            <label className="text-xs font-semibold text-zinc-500">Order Date</label>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="mt-1 w-full border border-zinc-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />

          </div>

          <div className="sm:col-span-1">

            <label className="text-xs font-semibold text-zinc-500">Notes (optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Delivery instructions, etc."
              className="mt-1 w-full border border-zinc-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />

          </div>

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <div className="space-y-4">

            {groups.map((g) => (

              <div key={g.productName + g.brand + g.category} className="border border-zinc-200 rounded-2xl overflow-hidden">

                <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200">

                  <p className="font-semibold text-zinc-900">{g.productName}</p>
                  <p className="text-xs text-zinc-500">{g.brand} · {g.category}</p>

                </div>

                <div className="divide-y divide-zinc-100">

                  {g.items.map((it) => (

                    <div key={it.id} className="flex items-center gap-3 px-4 py-3">

                      <span className="flex-1 min-w-0 text-sm text-zinc-700 truncate">

                        {it.shade || '—'}

                        <span className="text-zinc-400 ml-2">
                          (current: {it.current_stock}, reorder: {Math.ceil(it.reorderPoint)}, cost: Rs. {Number(it.costPrice || 0).toLocaleString('en-IN')})
                        </span>

                      </span>

                      <input
                        type="number"
                        min={0}
                        value={it.qty}
                        onChange={(e) => updateQty(it.id, Number(e.target.value))}
                        className="w-24 border border-zinc-300 rounded-lg px-2 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-zinc-400"
                      />

                      <span className="w-28 text-sm text-right tabular-nums font-semibold text-zinc-700">
                        Rs. {(Number(it.qty || 0) * Number(it.costPrice || 0)).toLocaleString('en-IN')}
                      </span>

                      <button
                        onClick={() => removeItem(it.id)}
                        className="text-zinc-400 hover:text-red-600 text-xs font-semibold px-2"
                        title="Remove"
                      >

                        Remove

                      </button>

                    </div>

                  ))}

                </div>

              </div>

            ))}

          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-200">

            <p className="text-sm font-semibold text-zinc-700">

              {items.length} line item{items.length !== 1 ? 's' : ''} · {totalQty} total units ·{' '}
              <span className="text-emerald-700">Est. cost Rs. {totalCost.toLocaleString('en-IN')}</span>

            </p>

            <div className="flex items-center gap-3">

              <button
                onClick={() => handlePrint()}
                disabled={printLines.length === 0}
                className="bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl text-sm"
              >

                Download PDF

              </button>

              <button
                onClick={finishOrder}
                className="bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-semibold px-5 py-2.5 rounded-xl text-sm"
              >

                Done

              </button>

            </div>

          </div>

        </div>

      </div>

      <div className="fixed -left-[9999px] top-0">

        <PurchaseOrderPrint
          ref={printRef}
          supplierName={supplierName}
          orderDate={orderDate}
          notes={notes}
          lines={printLines}
        />

      </div>

    </div>

  )

}
