'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import LineChart from '../../components/LineChart'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

function monthLabel(month: string) {

  if (!month) return ''

  const [y, m] = month.split('-')

  const date = new Date(Number(y), Number(m) - 1, 1)

  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

}

function sumByMonth(rows: any[], dateField: string, amountField: string) {

  const map: Record<string, number> = {}

  rows.forEach((r) => {

    const month = (r[dateField] || '').slice(0, 7)

    if (!month) return

    map[month] = (map[month] || 0) + Number(r[amountField] || 0)

  })

  return map

}

export default function FinanceReportPage() {

  const router = useRouter()

  const [darazCashouts, setDarazCashouts] = useState<any[]>([])
  const [rentPayments, setRentPayments] = useState<any[]>([])
  const [staffSalary, setStaffSalary] = useState<any[]>([])
  const [operatingExpenses, setOperatingExpenses] = useState<any[]>([])
  const [miscExpenses, setMiscExpenses] = useState<any[]>([])
  const [refunds, setRefunds] = useState<any[]>([])
  const [stockPurchases, setStockPurchases] = useState<any[]>([])
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

    const [
      { data: darazData },
      { data: rentData },
      { data: staffData },
      { data: opExData },
      { data: miscExData },
      { data: refundData },
      { data: stockTxnData },
    ] = await Promise.all([
      supabase.from('daraz_cashouts').select('*'),
      supabase.from('rent_payments').select('*'),
      supabase.from('staff_salary').select('*'),
      supabase.from('operating_expenses').select('*'),
      supabase.from('misc_expenses').select('*'),
      supabase.from('refunds').select('*'),
      supabase.from('stock_transactions').select('*').eq('transaction_type', 'ADD'),
    ])

    setDarazCashouts(darazData || [])
    setRentPayments(rentData || [])
    setStaffSalary(staffData || [])
    setOperatingExpenses(opExData || [])
    setMiscExpenses(miscExData || [])
    setRefunds(refundData || [])
    setStockPurchases(
      (stockTxnData || []).map((t: any) => ({
        stock_date: t.stock_date,
        amount: Number(t.cost_price || 0) * Number(t.quantity || 0),
      }))
    )

    setLoading(false)

  }

  const incomeByMonth = sumByMonth(darazCashouts, 'cashout_date', 'amount')
  const rentByMonth = sumByMonth(rentPayments, 'month', 'amount')
  const staffByMonth = sumByMonth(staffSalary, 'month', 'amount')
  const opExByMonth = sumByMonth(operatingExpenses, 'expense_date', 'amount')
  const miscExByMonth = sumByMonth(miscExpenses, 'expense_date', 'amount')
  const refundByMonth = sumByMonth(refunds, 'refund_date', 'amount')
  const purchaseByMonth = sumByMonth(stockPurchases, 'stock_date', 'amount')

  const allMonths = Array.from(
    new Set([
      ...Object.keys(incomeByMonth),
      ...Object.keys(rentByMonth),
      ...Object.keys(staffByMonth),
      ...Object.keys(opExByMonth),
      ...Object.keys(miscExByMonth),
      ...Object.keys(refundByMonth),
      ...Object.keys(purchaseByMonth),
    ])
  ).sort()

  const monthlyRows = allMonths.map((month) => {

    const income = incomeByMonth[month] || 0
    const rent = rentByMonth[month] || 0
    const staff = staffByMonth[month] || 0
    const operating = opExByMonth[month] || 0
    const misc = miscExByMonth[month] || 0
    const refund = refundByMonth[month] || 0
    const purchase = purchaseByMonth[month] || 0

    const totalExpense = rent + staff + operating + misc + refund + purchase
    const netProfit = income - totalExpense

    return { month, income, rent, staff, operating, misc, refund, purchase, totalExpense, netProfit }

  })

  const monthlyRowsDesc = [...monthlyRows].sort((a, b) => b.month.localeCompare(a.month))

  const lifetimeIncome = monthlyRows.reduce((s, r) => s + r.income, 0)
  const lifetimeExpense = monthlyRows.reduce((s, r) => s + r.totalExpense, 0)
  const lifetimeNetProfit = lifetimeIncome - lifetimeExpense

  const chartLabels = monthlyRows.map((r) => monthLabel(r.month))

  const chartSeries = [
    { label: 'Income', color: '#0F6E56', data: monthlyRows.map((r) => r.income) },
    { label: 'Expense', color: '#A32D2D', data: monthlyRows.map((r) => r.totalExpense) },
    { label: 'Net Profit', color: '#18181B', data: monthlyRows.map((r) => r.netProfit) },
  ]

  function exportReport() {

    if (monthlyRowsDesc.length === 0) {

      alert('No data to export')
      return

    }

    const rows = monthlyRowsDesc.map((r) => ({
      Month: monthLabel(r.month),
      'Daraz Cash In': r.income,
      Rent: r.rent,
      'Staff Salary': r.staff,
      'Operating Expenses': r.operating,
      'Misc Expenses': r.misc,
      Refunds: r.refund,
      'Stock Purchase': r.purchase,
      'Total Expenses': r.totalExpense,
      'Net Profit': r.netProfit,
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Finance Report')

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })

    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    })

    saveAs(blob, 'finance-report.xlsx')

  }

  return (

    <div className="text-black">

      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">

          <div>

            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">

              Finance Report

            </h1>

            <p className="text-sm text-zinc-500 mt-1">

              Net profit = Daraz Cash In − (Rent + Staff + Operating Expenses + Misc Expenses + Refunds + Stock Purchase)

            </p>

          </div>

          <button
            onClick={exportReport}
            className="bg-green-600 text-white px-5 py-2.5 rounded-2xl font-bold text-sm"
          >

            Export Excel

          </button>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-green-600 px-6 py-4">

            <p className="text-sm text-zinc-500">Total Income (Lifetime)</p>
            <h2 className="text-2xl font-bold tracking-tight mt-1 tabular-nums text-green-600">Rs. {lifetimeIncome.toLocaleString('en-IN')}</h2>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-red-500 px-6 py-4">

            <p className="text-sm text-zinc-500">Total Expenses (Lifetime)</p>
            <h2 className="text-2xl font-bold tracking-tight mt-1 tabular-nums text-red-600">Rs. {lifetimeExpense.toLocaleString('en-IN')}</h2>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-zinc-900 px-6 py-4">

            <p className="text-sm text-zinc-500">Net Profit (Lifetime)</p>
            <h2 className={`text-2xl font-bold tracking-tight mt-1 tabular-nums ${lifetimeNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Rs. {lifetimeNetProfit.toLocaleString('en-IN')}
            </h2>

          </div>

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <h3 className="font-bold text-lg text-zinc-900 mb-1">Income vs Expense vs Net Profit</h3>
          <p className="text-xs text-zinc-400 mb-4">Every month with recorded activity</p>

          {loading ? (

            <p className="text-zinc-500">Loading...</p>

          ) : monthlyRows.length === 0 ? (

            <p className="text-zinc-500">No financial data recorded yet.</p>

          ) : (

            <LineChart labels={chartLabels} series={chartSeries} />

          )}

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <h3 className="font-bold text-lg text-zinc-900 mb-4">Monthly Breakdown</h3>

          {loading ? (

            <p className="text-zinc-500">Loading...</p>

          ) : monthlyRowsDesc.length === 0 ? (

            <p className="text-zinc-500">No financial data recorded yet.</p>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full border-collapse text-sm">

                <thead>

                  <tr className="text-left">

                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Month</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Daraz Cash In</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Rent</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Staff</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Operating</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Misc</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Refunds</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Stock Purchase</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Total Expenses</th>
                    <th className="pb-3 text-sm font-medium text-zinc-500 text-right">Net Profit</th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-zinc-100">

                  {monthlyRowsDesc.map((r) => (

                    <tr key={r.month}>

                      <td className="py-3 pr-4 font-semibold text-zinc-900 whitespace-nowrap">{monthLabel(r.month)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-green-600">Rs. {r.income.toLocaleString('en-IN')}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-zinc-600">Rs. {r.rent.toLocaleString('en-IN')}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-zinc-600">Rs. {r.staff.toLocaleString('en-IN')}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-zinc-600">Rs. {r.operating.toLocaleString('en-IN')}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-zinc-600">Rs. {r.misc.toLocaleString('en-IN')}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-zinc-600">Rs. {r.refund.toLocaleString('en-IN')}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-zinc-600">Rs. {r.purchase.toLocaleString('en-IN')}</td>
                      <td className="py-3 pr-4 text-right tabular-nums font-semibold text-red-600">Rs. {r.totalExpense.toLocaleString('en-IN')}</td>
                      <td className={`py-3 text-right tabular-nums font-bold ${r.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        Rs. {r.netProfit.toLocaleString('en-IN')}
                      </td>

                    </tr>

                  ))}

                </tbody>

                <tfoot>

                  <tr className="border-t-2 border-zinc-200 font-bold text-zinc-900">

                    <td className="pt-3 pr-4">Total</td>
                    <td className="pt-3 pr-4 text-right tabular-nums text-green-600">Rs. {lifetimeIncome.toLocaleString('en-IN')}</td>
                    <td className="pt-3 pr-4 text-right tabular-nums">Rs. {monthlyRows.reduce((s, r) => s + r.rent, 0).toLocaleString('en-IN')}</td>
                    <td className="pt-3 pr-4 text-right tabular-nums">Rs. {monthlyRows.reduce((s, r) => s + r.staff, 0).toLocaleString('en-IN')}</td>
                    <td className="pt-3 pr-4 text-right tabular-nums">Rs. {monthlyRows.reduce((s, r) => s + r.operating, 0).toLocaleString('en-IN')}</td>
                    <td className="pt-3 pr-4 text-right tabular-nums">Rs. {monthlyRows.reduce((s, r) => s + r.misc, 0).toLocaleString('en-IN')}</td>
                    <td className="pt-3 pr-4 text-right tabular-nums">Rs. {monthlyRows.reduce((s, r) => s + r.refund, 0).toLocaleString('en-IN')}</td>
                    <td className="pt-3 pr-4 text-right tabular-nums">Rs. {monthlyRows.reduce((s, r) => s + r.purchase, 0).toLocaleString('en-IN')}</td>
                    <td className="pt-3 pr-4 text-right tabular-nums text-red-600">Rs. {lifetimeExpense.toLocaleString('en-IN')}</td>
                    <td className={`pt-3 text-right tabular-nums ${lifetimeNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Rs. {lifetimeNetProfit.toLocaleString('en-IN')}
                    </td>

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
