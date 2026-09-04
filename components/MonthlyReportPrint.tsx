'use client'

import { forwardRef } from 'react'
import PieChart from './PieChart'

type ExpenseSlice = { label: string; value: number; color: string }
type StoreWeek = { storeName: string; weeks: Record<number, number>; total: number }
type SupplierRow = { name: string; purchased: number; paid: number; pending: number }
type LoanRow = { name: string; borrowed: number; cleared: number; outstanding: number }
type TopProduct = { name: string; qty: number; revenue: number }

type MonthlyReportPrintProps = {
  month: string
  monthLabel: string
  totalCashIn: number
  totalExpenditure: number
  netProfit: number
  expenseBreakdown: ExpenseSlice[]
  storeWeeklyEarnings: StoreWeek[]
  totalStockValue: number
  supplierStatus: SupplierRow[]
  loanStatus: LoanRow[]
  topSellingProducts: TopProduct[]
}

function rs(v: number) {
  return 'Rs. ' + Math.round(v).toLocaleString('en-IN')
}

function IncomeExpenseBars({ income, expense }: { income: number; expense: number }) {

  const max = Math.max(income, expense, 1)
  const incomePct = (income / max) * 100
  const expensePct = (expense / max) * 100

  return (

    <div className="space-y-4">

      <div>

        <div className="flex justify-between text-sm mb-1">
          <span className="font-semibold text-zinc-700">Total Cash In</span>
          <span className="font-bold text-green-700 tabular-nums">{rs(income)}</span>
        </div>

        <div className="h-4 w-full bg-zinc-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-600 rounded-full" style={{ width: `${incomePct}%` }} />
        </div>

      </div>

      <div>

        <div className="flex justify-between text-sm mb-1">
          <span className="font-semibold text-zinc-700">Total Expenditure</span>
          <span className="font-bold text-red-700 tabular-nums">{rs(expense)}</span>
        </div>

        <div className="h-4 w-full bg-zinc-100 rounded-full overflow-hidden">
          <div className="h-full bg-red-600 rounded-full" style={{ width: `${expensePct}%` }} />
        </div>

      </div>

    </div>

  )

}

const MonthlyReportPrint = forwardRef<HTMLDivElement, MonthlyReportPrintProps>(function MonthlyReportPrint(
  {
    month,
    monthLabel,
    totalCashIn,
    totalExpenditure,
    netProfit,
    expenseBreakdown,
    storeWeeklyEarnings,
    totalStockValue,
    supplierStatus,
    loanStatus,
    topSellingProducts,
  },
  ref
) {

  const generatedOn = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (

    <div ref={ref} className="bg-white text-black" style={{ width: 900 }}>

      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          .report-section { break-inside: avoid; }
        }
      `}</style>

      <div className="px-10 py-10 space-y-8">

        <div className="flex items-center justify-between border-b-4 border-zinc-900 pb-5">

          <div>

            <p className="text-xs font-semibold tracking-widest text-indigo-600 uppercase mb-1">Cloud Inventory ERP System</p>
            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900">Monthly Report</h1>
            <p className="text-lg text-zinc-500 mt-1">{monthLabel}</p>

          </div>

          <div className="text-right">

            <p className="text-xs text-zinc-400">Generated on</p>
            <p className="text-sm font-semibold text-zinc-700">{generatedOn}</p>

          </div>

        </div>

        <div className="grid grid-cols-4 gap-4 report-section">

          <div className="rounded-2xl border border-zinc-200 p-4 border-l-4 border-l-green-600">
            <p className="text-xs text-zinc-500">Total Cash In</p>
            <p className="text-xl font-bold tabular-nums text-green-700 mt-1">{rs(totalCashIn)}</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 p-4 border-l-4 border-l-red-500">
            <p className="text-xs text-zinc-500">Total Expenditure</p>
            <p className="text-xl font-bold tabular-nums text-red-700 mt-1">{rs(totalExpenditure)}</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 p-4 border-l-4 border-l-zinc-900">
            <p className="text-xs text-zinc-500">Net Profit</p>
            <p className={`text-xl font-bold tabular-nums mt-1 ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{rs(netProfit)}</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 p-4 border-l-4 border-l-indigo-600">
            <p className="text-xs text-zinc-500">Total Stock Value</p>
            <p className="text-xl font-bold tabular-nums text-indigo-700 mt-1">{rs(totalStockValue)}</p>
          </div>

        </div>

        <div className="grid grid-cols-2 gap-6 report-section">

          <div className="rounded-2xl border border-zinc-200 p-5">

            <h3 className="font-bold text-zinc-900 mb-4">Income vs Expenditure</h3>

            <IncomeExpenseBars income={totalCashIn} expense={totalExpenditure} />

          </div>

          <div className="rounded-2xl border border-zinc-200 p-5">

            <h3 className="font-bold text-zinc-900 mb-4">Expenditure Breakdown</h3>

            {totalExpenditure === 0 ? (
              <p className="text-sm text-zinc-400">No expenses recorded this month.</p>
            ) : (
              <PieChart data={expenseBreakdown} size={150} />
            )}

          </div>

        </div>

        <div className="rounded-2xl border border-zinc-200 p-5 report-section">

          <h3 className="font-bold text-zinc-900 mb-4">Store Earnings — Weekly Basis</h3>

          {storeWeeklyEarnings.length === 0 ? (

            <p className="text-sm text-zinc-400">No Daraz cash-in recorded this month.</p>

          ) : (

            <table className="w-full border-collapse text-sm">

              <thead>
                <tr className="text-left border-b border-zinc-200">
                  <th className="py-2 pr-3 font-semibold text-zinc-500">Store</th>
                  <th className="py-2 px-3 font-semibold text-zinc-500 text-right">Week 1</th>
                  <th className="py-2 px-3 font-semibold text-zinc-500 text-right">Week 2</th>
                  <th className="py-2 px-3 font-semibold text-zinc-500 text-right">Week 3</th>
                  <th className="py-2 px-3 font-semibold text-zinc-500 text-right">Week 4</th>
                  <th className="py-2 px-3 font-semibold text-zinc-500 text-right">Week 5</th>
                  <th className="py-2 pl-3 font-semibold text-zinc-500 text-right">Total</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100">

                {storeWeeklyEarnings.map((s) => (

                  <tr key={s.storeName}>
                    <td className="py-2 pr-3 font-semibold text-zinc-900">{s.storeName}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-zinc-600">{rs(s.weeks[1])}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-zinc-600">{rs(s.weeks[2])}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-zinc-600">{rs(s.weeks[3])}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-zinc-600">{rs(s.weeks[4])}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-zinc-600">{rs(s.weeks[5])}</td>
                    <td className="py-2 pl-3 text-right tabular-nums font-bold text-zinc-900">{rs(s.total)}</td>
                  </tr>

                ))}

              </tbody>

            </table>

          )}

        </div>

        <div className="grid grid-cols-2 gap-6 report-section">

          <div className="rounded-2xl border border-zinc-200 p-5">

            <h3 className="font-bold text-zinc-900 mb-4">Supplier Payment Status</h3>

            {supplierStatus.length === 0 ? (

              <p className="text-sm text-zinc-400">No suppliers yet.</p>

            ) : (

              <table className="w-full border-collapse text-sm">

                <thead>
                  <tr className="text-left border-b border-zinc-200">
                    <th className="py-2 pr-2 font-semibold text-zinc-500">Supplier</th>
                    <th className="py-2 px-2 font-semibold text-zinc-500 text-right">Purchased</th>
                    <th className="py-2 px-2 font-semibold text-zinc-500 text-right">Paid</th>
                    <th className="py-2 pl-2 font-semibold text-zinc-500 text-right">Pending</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">

                  {supplierStatus.map((s) => (

                    <tr key={s.name}>
                      <td className="py-2 pr-2 font-semibold text-zinc-900">{s.name}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-zinc-600">{rs(s.purchased)}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-green-700">{rs(s.paid)}</td>
                      <td className={`py-2 pl-2 text-right tabular-nums font-bold ${s.pending > 0 ? 'text-red-700' : 'text-green-700'}`}>{rs(s.pending)}</td>
                    </tr>

                  ))}

                </tbody>

              </table>

            )}

          </div>

          <div className="rounded-2xl border border-zinc-200 p-5">

            <h3 className="font-bold text-zinc-900 mb-4">Loans (Non-Daraz Sources)</h3>

            {loanStatus.length === 0 ? (

              <p className="text-sm text-zinc-400">No loan activity recorded.</p>

            ) : (

              <table className="w-full border-collapse text-sm">

                <thead>
                  <tr className="text-left border-b border-zinc-200">
                    <th className="py-2 pr-2 font-semibold text-zinc-500">Source</th>
                    <th className="py-2 px-2 font-semibold text-zinc-500 text-right">Borrowed</th>
                    <th className="py-2 px-2 font-semibold text-zinc-500 text-right">Cleared</th>
                    <th className="py-2 pl-2 font-semibold text-zinc-500 text-right">Outstanding</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">

                  {loanStatus.map((s) => (

                    <tr key={s.name}>
                      <td className="py-2 pr-2 font-semibold text-zinc-900">{s.name}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-zinc-600">{rs(s.borrowed)}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-green-700">{rs(s.cleared)}</td>
                      <td className={`py-2 pl-2 text-right tabular-nums font-bold ${s.outstanding > 0 ? 'text-amber-700' : 'text-green-700'}`}>{rs(s.outstanding)}</td>
                    </tr>

                  ))}

                </tbody>

              </table>

            )}

          </div>

        </div>

        <div className="rounded-2xl border border-zinc-200 p-5 report-section">

          <h3 className="font-bold text-zinc-900 mb-4">Top 3 Selling Products — {monthLabel}</h3>

          {topSellingProducts.length === 0 ? (

            <p className="text-sm text-zinc-400">No sales recorded this month.</p>

          ) : (

            <table className="w-full border-collapse text-sm">

              <thead>
                <tr className="text-left border-b border-zinc-200">
                  <th className="py-2 pr-2 font-semibold text-zinc-500">#</th>
                  <th className="py-2 px-2 font-semibold text-zinc-500">Product</th>
                  <th className="py-2 px-2 font-semibold text-zinc-500 text-right">Units Sold</th>
                  <th className="py-2 pl-2 font-semibold text-zinc-500 text-right">Revenue (MRP)</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100">

                {topSellingProducts.map((p, i) => (

                  <tr key={p.name + i}>
                    <td className="py-2 pr-2 text-zinc-400 font-semibold">{i + 1}</td>
                    <td className="py-2 px-2 font-semibold text-zinc-900">{p.name}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-indigo-700 font-semibold">{p.qty}</td>
                    <td className="py-2 pl-2 text-right tabular-nums text-zinc-600">{rs(p.revenue)}</td>
                  </tr>

                ))}

              </tbody>

            </table>

          )}

        </div>

        <div className="text-center text-xs text-zinc-400 pt-4 border-t border-zinc-200">

          Cloud Inventory ERP System · Monthly Report for {monthLabel} · Generated {generatedOn}

        </div>

      </div>

    </div>

  )

})

export default MonthlyReportPrint
