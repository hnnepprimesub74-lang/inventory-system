'use client'

import { forwardRef } from 'react'

type OrderLine = {
  id: string
  product_name: string
  category: string
  brand: string
  shade: string
  qty: number
}

type PurchaseOrderPrintProps = {
  supplierName: string
  orderDate: string
  notes: string
  lines: OrderLine[]
}

function groupKey(l: OrderLine) {

  return [l.product_name, l.brand, l.category].join('|')

}

const PurchaseOrderPrint = forwardRef<HTMLDivElement, PurchaseOrderPrintProps>(function PurchaseOrderPrint(
  { supplierName, orderDate, notes, lines },
  ref
) {

  const generatedOn = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const groupsMap: Record<string, { productName: string; brand: string; category: string; lines: OrderLine[] }> = {}

  lines.forEach((l) => {

    const key = groupKey(l)

    if (!groupsMap[key]) {

      groupsMap[key] = { productName: l.product_name, brand: l.brand, category: l.category, lines: [] }

    }

    groupsMap[key].lines.push(l)

  })

  const groups = Object.values(groupsMap)
  const totalQty = lines.reduce((s, l) => s + Number(l.qty || 0), 0)

  return (

    <div ref={ref} className="bg-white text-black" style={{ width: 900 }}>

      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          .po-section { break-inside: avoid; }
        }
      `}</style>

      <div className="px-10 py-10 space-y-8">

        <div className="flex items-center justify-between border-b-4 border-zinc-900 pb-5">

          <div>

            <p className="text-xs font-semibold tracking-widest text-indigo-600 uppercase mb-1">Cloud Inventory ERP System</p>
            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900">Purchase Order</h1>
            <p className="text-lg text-zinc-500 mt-1">{supplierName || 'Supplier'}</p>

          </div>

          <div className="text-right">

            <p className="text-xs text-zinc-400">Order Date</p>
            <p className="text-sm font-semibold text-zinc-700">{orderDate}</p>
            <p className="text-xs text-zinc-400 mt-2">Generated on</p>
            <p className="text-sm font-semibold text-zinc-700">{generatedOn}</p>

          </div>

        </div>

        <div className="grid grid-cols-2 gap-4 po-section">

          <div className="rounded-2xl border border-zinc-200 p-4 border-l-4 border-l-indigo-600">
            <p className="text-xs text-zinc-500">Total Line Items</p>
            <p className="text-xl font-bold tabular-nums text-indigo-700 mt-1">{lines.length}</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 p-4 border-l-4 border-l-zinc-900">
            <p className="text-xs text-zinc-500">Total Quantity Ordered</p>
            <p className="text-xl font-bold tabular-nums text-zinc-900 mt-1">{totalQty}</p>
          </div>

        </div>

        <div className="rounded-2xl border border-zinc-200 p-5 po-section">

          <h3 className="font-bold text-zinc-900 mb-4">Order Items</h3>

          <table className="w-full border-collapse text-sm">

            <thead>
              <tr className="text-left border-b border-zinc-200">
                <th className="py-2 pr-2 font-semibold text-zinc-500">#</th>
                <th className="py-2 px-2 font-semibold text-zinc-500">Product</th>
                <th className="py-2 px-2 font-semibold text-zinc-500">Brand</th>
                <th className="py-2 px-2 font-semibold text-zinc-500">Category</th>
                <th className="py-2 px-2 font-semibold text-zinc-500">Shade</th>
                <th className="py-2 pl-2 font-semibold text-zinc-500 text-right">Qty</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-100">

              {groups.map((g, gi) =>
                g.lines.map((l, li) => (

                  <tr key={l.id}>

                    <td className="py-2 pr-2 text-zinc-400 font-semibold">{li === 0 ? gi + 1 : ''}</td>
                    <td className="py-2 px-2 font-semibold text-zinc-900">{li === 0 ? g.productName : ''}</td>
                    <td className="py-2 px-2 text-zinc-600">{li === 0 ? g.brand : ''}</td>
                    <td className="py-2 px-2 text-zinc-600">{li === 0 ? g.category : ''}</td>
                    <td className="py-2 px-2 text-zinc-600">{l.shade || '—'}</td>
                    <td className="py-2 pl-2 text-right tabular-nums font-bold text-zinc-900">{l.qty}</td>

                  </tr>

                ))
              )}

            </tbody>

            <tfoot>
              <tr className="border-t-2 border-zinc-300 font-bold text-zinc-900">
                <td className="py-2 pr-2" colSpan={5}>Total</td>
                <td className="py-2 pl-2 text-right tabular-nums">{totalQty}</td>
              </tr>
            </tfoot>

          </table>

        </div>

        {notes && (

          <div className="rounded-2xl border border-zinc-200 p-5 po-section">

            <h3 className="font-bold text-zinc-900 mb-2">Notes</h3>
            <p className="text-sm text-zinc-600 whitespace-pre-line">{notes}</p>

          </div>

        )}

        <div className="text-center text-xs text-zinc-400 pt-4 border-t border-zinc-200">

          Cloud Inventory ERP System · Purchase Order · Generated {generatedOn}

        </div>

      </div>

    </div>

  )

})

export default PurchaseOrderPrint
