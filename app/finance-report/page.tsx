'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useReactToPrint } from 'react-to-print'
import { supabase } from '../../lib/supabase'
import { displayMrp } from '../../lib/mrp'
import LineChart from '../../components/LineChart'
import PieChart from '../../components/PieChart'
import MonthPicker from '../../components/MonthPicker'
import MonthlyReportPrint from '../../components/MonthlyReportPrint'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function normalizeName(name: any) {
  return (name || '').toString().trim().toLowerCase()
}

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
  const [adminSalary, setAdminSalary] = useState<any[]>([])
  const [operatingExpenses, setOperatingExpenses] = useState<any[]>([])
  const [miscExpenses, setMiscExpenses] = useState<any[]>([])
  const [refunds, setRefunds] = useState<any[]>([])
  const [darazStores, setDarazStores] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [supplierPayments, setSupplierPayments] = useState<any[]>([])
  const [allStockTxns, setAllStockTxns] = useState<any[]>([])
  const [cashSources, setCashSources] = useState<any[]>([])
  const [loanPayments, setLoanPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [reportMonth, setReportMonth] = useState(currentMonth())
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Monthly Report - ${reportMonth}`,
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

      await load()

    }

    init()

  }, [])

  async function load() {

    const [
      { data: darazData },
      { data: rentData },
      { data: staffData },
      { data: adminData },
      { data: opExData },
      { data: miscExData },
      { data: refundData },
      { data: stockTxnData },
      { data: storeData },
      { data: productData },
      { data: supplierData },
      { data: paymentData },
      { data: sourceData },
      { data: loanPaymentData },
    ] = await Promise.all([
      supabase.from('daraz_cashouts').select('*'),
      supabase.from('rent_payments').select('*'),
      supabase.from('staff_salary').select('*'),
      supabase.from('admin_salary').select('*'),
      supabase.from('operating_expenses').select('*'),
      supabase.from('misc_expenses').select('*'),
      supabase.from('refunds').select('*'),
      supabase.from('stock_transactions').select('*'),
      supabase.from('daraz_stores').select('*').order('name'),
      supabase.from('products').select('*'),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('payments').select('*'),
      supabase.from('cash_sources').select('*').order('name'),
      supabase.from('loan_payments').select('*'),
    ])

    setDarazCashouts(darazData || [])
    setRentPayments(rentData || [])
    setStaffSalary(staffData || [])
    setAdminSalary(adminData || [])
    setOperatingExpenses(opExData || [])
    setMiscExpenses(miscExData || [])
    setRefunds(refundData || [])
    setAllStockTxns(stockTxnData || [])
    setDarazStores(storeData || [])
    setProducts(productData || [])
    setSuppliers(supplierData || [])
    setSupplierPayments(paymentData || [])
    setCashSources(sourceData || [])
    setLoanPayments(loanPaymentData || [])

    setLoading(false)

  }

  const incomeByMonth = sumByMonth(darazCashouts, 'cashout_date', 'amount')
  const rentByMonth = sumByMonth(rentPayments, 'month', 'amount')
  const staffByMonth = sumByMonth(staffSalary, 'month', 'amount')
  const adminByMonth = sumByMonth(adminSalary, 'month', 'amount')
  const opExByMonth = sumByMonth(operatingExpenses, 'expense_date', 'amount')
  const miscExByMonth = sumByMonth(miscExpenses, 'expense_date', 'amount')
  const refundByMonth = sumByMonth(refunds, 'refund_date', 'amount')
  const supplierPaymentByMonth = sumByMonth(supplierPayments, 'payment_date', 'amount')

  const allMonths = Array.from(
    new Set([
      ...Object.keys(incomeByMonth),
      ...Object.keys(rentByMonth),
      ...Object.keys(staffByMonth),
      ...Object.keys(adminByMonth),
      ...Object.keys(opExByMonth),
      ...Object.keys(miscExByMonth),
      ...Object.keys(refundByMonth),
      ...Object.keys(supplierPaymentByMonth),
    ])
  ).sort()

  const monthlyRows = allMonths.map((month) => {

    const income = incomeByMonth[month] || 0
    const rent = rentByMonth[month] || 0
    const staff = staffByMonth[month] || 0
    const admin = adminByMonth[month] || 0
    const operating = opExByMonth[month] || 0
    const misc = miscExByMonth[month] || 0
    const refund = refundByMonth[month] || 0
    const supplierPayment = supplierPaymentByMonth[month] || 0

    const totalExpense = rent + staff + admin + operating + misc + refund + supplierPayment
    const netProfit = income - totalExpense

    return { month, income, rent, staff, admin, operating, misc, refund, supplierPayment, totalExpense, netProfit }

  })

  const monthlyRowsDesc = [...monthlyRows].sort((a, b) => b.month.localeCompare(a.month))

  const lifetimeIncome = monthlyRows.reduce((s, r) => s + r.income, 0)
  const lifetimeExpense = monthlyRows.reduce((s, r) => s + r.totalExpense, 0)
  const lifetimeNetProfit = lifetimeIncome - lifetimeExpense

  const lifetimeRent = monthlyRows.reduce((s, r) => s + r.rent, 0)
  const lifetimeStaff = monthlyRows.reduce((s, r) => s + r.staff, 0)
  const lifetimeAdmin = monthlyRows.reduce((s, r) => s + r.admin, 0)
  const lifetimeOperating = monthlyRows.reduce((s, r) => s + r.operating, 0)
  const lifetimeMisc = monthlyRows.reduce((s, r) => s + r.misc, 0)
  const lifetimeRefund = monthlyRows.reduce((s, r) => s + r.refund, 0)
  const lifetimeSupplierPayment = monthlyRows.reduce((s, r) => s + r.supplierPayment, 0)

  const expenseBreakdown = [
    { label: 'Rent', value: lifetimeRent, color: '#6366F1' },
    { label: 'Staff', value: lifetimeStaff, color: '#0EA5E9' },
    { label: 'Admin Finance', value: lifetimeAdmin, color: '#8B5CF6' },
    { label: 'Operating Expenses', value: lifetimeOperating, color: '#F59E0B' },
    { label: 'Misc Expenses', value: lifetimeMisc, color: '#EC4899' },
    { label: 'Refunds', value: lifetimeRefund, color: '#EF4444' },
    { label: 'Supplier Payment', value: lifetimeSupplierPayment, color: '#18181B' },
  ]

  // ---- Monthly Report (PDF) data ----

  const reportRow =
    monthlyRows.find((r) => r.month === reportMonth) || {
      month: reportMonth,
      income: 0,
      rent: 0,
      staff: 0,
      admin: 0,
      operating: 0,
      misc: 0,
      refund: 0,
      supplierPayment: 0,
      totalExpense: 0,
      netProfit: 0,
    }

  const reportExpenseBreakdown = [
    { label: 'Rent', value: reportRow.rent, color: '#6366F1' },
    { label: 'Staff', value: reportRow.staff, color: '#0EA5E9' },
    { label: 'Admin Finance', value: reportRow.admin, color: '#8B5CF6' },
    { label: 'Operating Expenses', value: reportRow.operating, color: '#F59E0B' },
    { label: 'Misc Expenses', value: reportRow.misc, color: '#EC4899' },
    { label: 'Refunds', value: reportRow.refund, color: '#EF4444' },
    { label: 'Supplier Payment', value: reportRow.supplierPayment, color: '#18181B' },
  ]

  const cashoutsForMonth = darazCashouts.filter(
    (c) => (c.cashout_date || '').slice(0, 7) === reportMonth
  )

  const storeWeeklyEarnings = darazStores.map((store) => {

    const weeks: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

    cashoutsForMonth
      .filter((c) => c.store_id === store.id)
      .forEach((c) => {

        const day = Number((c.cashout_date || '').slice(8, 10)) || 1
        const week = Math.min(5, Math.ceil(day / 7))

        weeks[week] += Number(c.amount || 0)

      })

    const total = Object.values(weeks).reduce((s, v) => s + v, 0)

    return { storeName: store.name, weeks, total }

  }).filter((s) => s.total > 0)

  const totalStockValue = products.reduce(
    (s, p) => s + Number(p.cost_price || 0) * Number(p.current_stock || 0),
    0
  )

  const supplierStatus = suppliers.map((s) => {

    const purchased = allStockTxns
      .filter(
        (t) =>
          t.transaction_type === 'ADD' &&
          normalizeName(t.seller) === normalizeName(s.name)
      )
      .reduce((sum, t) => sum + Number(t.cost_price || 0) * Number(t.quantity || 0), 0)

    const paid = supplierPayments
      .filter((p) => p.supplier_id === s.id)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)

    const pending = Number(s.opening_balance || 0) + purchased - paid

    return { name: s.name, purchased, paid, pending }

  })

  const darazSourceId = cashSources.find((s) => s.name === 'Daraz')?.id

  const loanTxnTables = [
    { rows: operatingExpenses, dateField: 'expense_date' },
    { rows: miscExpenses, dateField: 'expense_date' },
    { rows: rentPayments, dateField: 'paid_date' },
    { rows: staffSalary, dateField: 'paid_date' },
    { rows: refunds, dateField: 'refund_date' },
    { rows: supplierPayments, dateField: 'payment_date' },
    { rows: adminSalary, dateField: 'paid_date' },
  ]

  const loanStatus = cashSources
    .filter((s) => s.id !== darazSourceId)
    .map((s) => {

      const borrowed = loanTxnTables.reduce(
        (sum, t) =>
          sum +
          t.rows
            .filter((r: any) => r.source_id === s.id)
            .reduce((rs: number, r: any) => rs + Number(r.amount || 0), 0),
        0
      )

      const cleared = loanPayments
        .filter((p) => p.source_id === s.id)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0)

      return { name: s.name, borrowed, cleared, outstanding: borrowed - cleared }

    })
    .filter((s) => s.borrowed > 0 || s.cleared > 0)

  const salesForMonth = allStockTxns.filter(
    (t) =>
      t.transaction_type === 'SELL' &&
      (t.created_at || '').slice(0, 7) === reportMonth
  )

  const salesMap: Record<string, number> = {}

  salesForMonth.forEach((t) => {
    salesMap[t.product_id] = (salesMap[t.product_id] || 0) + Number(t.quantity || 0)
  })

  const topSellingProducts = Object.entries(salesMap)
    .map(([productId, qty]) => {

      const product = products.find((p) => p.id === productId)

      return {
        name: product?.product_name || 'Unknown product',
        qty,
        revenue: qty * (displayMrp(product?.mrp) || 0),
      }

    })
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 3)

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
      'Admin Finance': r.admin,
      'Operating Expenses': r.operating,
      'Misc Expenses': r.misc,
      Refunds: r.refund,
      'Supplier Payment': r.supplierPayment,
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

              Net profit = Daraz Cash In − (Rent + Staff + Admin Finance + Operating Expenses + Misc Expenses + Refunds + Supplier Payment)

            </p>

          </div>

          <button
            onClick={exportReport}
            className="bg-green-600 text-white px-5 py-2.5 rounded-2xl font-bold text-sm"
          >

            Export Excel

          </button>

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <div className="flex items-center justify-between flex-wrap gap-4">

            <div>

              <h3 className="font-bold text-lg text-zinc-900">Monthly Report (PDF)</h3>
              <p className="text-xs text-zinc-400 mt-1">Pick a month and download a printable summary report</p>

            </div>

            <div className="flex items-end gap-3 flex-wrap">

              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1 block">Month</label>
                <MonthPicker value={reportMonth} onChange={setReportMonth} />
              </div>

              <button
                onClick={() => handlePrint()}
                disabled={loading}
                className="bg-zinc-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50"
              >

                Download PDF

              </button>

            </div>

          </div>

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

          <h3 className="font-bold text-lg text-zinc-900 mb-1">Total Expenditure Breakdown</h3>
          <p className="text-xs text-zinc-400 mb-4">Lifetime share of each expense category</p>

          {loading ? (

            <p className="text-zinc-500">Loading...</p>

          ) : lifetimeExpense === 0 ? (

            <p className="text-zinc-500">No expenses recorded yet.</p>

          ) : (

            <PieChart data={expenseBreakdown} />

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
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Admin</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Operating</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Misc</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Refunds</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Supplier Payment</th>
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
                      <td className="py-3 pr-4 text-right tabular-nums text-zinc-600">Rs. {r.admin.toLocaleString('en-IN')}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-zinc-600">Rs. {r.operating.toLocaleString('en-IN')}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-zinc-600">Rs. {r.misc.toLocaleString('en-IN')}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-zinc-600">Rs. {r.refund.toLocaleString('en-IN')}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-zinc-600">Rs. {r.supplierPayment.toLocaleString('en-IN')}</td>
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
                    <td className="pt-3 pr-4 text-right tabular-nums">Rs. {monthlyRows.reduce((s, r) => s + r.admin, 0).toLocaleString('en-IN')}</td>
                    <td className="pt-3 pr-4 text-right tabular-nums">Rs. {monthlyRows.reduce((s, r) => s + r.operating, 0).toLocaleString('en-IN')}</td>
                    <td className="pt-3 pr-4 text-right tabular-nums">Rs. {monthlyRows.reduce((s, r) => s + r.misc, 0).toLocaleString('en-IN')}</td>
                    <td className="pt-3 pr-4 text-right tabular-nums">Rs. {monthlyRows.reduce((s, r) => s + r.refund, 0).toLocaleString('en-IN')}</td>
                    <td className="pt-3 pr-4 text-right tabular-nums">Rs. {monthlyRows.reduce((s, r) => s + r.supplierPayment, 0).toLocaleString('en-IN')}</td>
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

      <div style={{ position: 'fixed', top: 0, left: -10000, width: 900 }}>

        <MonthlyReportPrint
          ref={printRef}
          month={reportMonth}
          monthLabel={monthLabel(reportMonth)}
          totalCashIn={reportRow.income}
          totalExpenditure={reportRow.totalExpense}
          netProfit={reportRow.netProfit}
          expenseBreakdown={reportExpenseBreakdown}
          storeWeeklyEarnings={storeWeeklyEarnings}
          totalStockValue={totalStockValue}
          supplierStatus={supplierStatus}
          loanStatus={loanStatus}
          topSellingProducts={topSellingProducts}
        />

      </div>

    </div>

  )

}
