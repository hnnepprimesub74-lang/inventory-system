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
  const [loanBorrowings, setLoanBorrowings] = useState<any[]>([])
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
      { data: stockAddData },
      { data: stockSellData },
      { data: storeData },
      { data: productData },
      { data: supplierData },
      { data: paymentData },
      { data: sourceData },
      { data: loanPaymentData },
      { data: loanBorrowingData },
    ] = await Promise.all([
      supabase.from('daraz_cashouts').select('*'),
      supabase.from('rent_payments').select('*'),
      supabase.from('staff_salary').select('*'),
      supabase.from('admin_salary').select('*'),
      supabase.from('operating_expenses').select('*'),
      supabase.from('misc_expenses').select('*'),
      supabase.from('refunds').select('*'),
      supabase.from('stock_transactions').select('*').eq('transaction_type', 'ADD'),
      supabase.from('stock_transactions').select('*').eq('transaction_type', 'SELL'),
      supabase.from('daraz_stores').select('*').order('name'),
      supabase.from('products').select('*'),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('payments').select('*'),
      supabase.from('cash_sources').select('*').order('name'),
      supabase.from('loan_payments').select('*'),
      supabase.from('loan_borrowings').select('*'),
    ])

    setDarazCashouts(darazData || [])
    setRentPayments(rentData || [])
    setStaffSalary(staffData || [])
    setAdminSalary(adminData || [])
    setOperatingExpenses(opExData || [])
    setMiscExpenses(miscExData || [])
    setRefunds(refundData || [])
    setAllStockTxns([...(stockAddData || []), ...(stockSellData || [])])
    setDarazStores(storeData || [])
    setProducts(productData || [])
    setSuppliers(supplierData || [])
    setSupplierPayments(paymentData || [])
    setCashSources(sourceData || [])
    setLoanPayments(loanPaymentData || [])
    setLoanBorrowings(loanBorrowingData || [])

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
  const loanPaymentByMonth = sumByMonth(loanPayments, 'payment_date', 'amount')

  const darazSourceId = cashSources.find((s) => s.name === 'Daraz')?.id

  // Anything spent from a non-Daraz source (plus explicit loan_borrowings) is money borrowed,
  // dated the same month as the spend so cash in and cash out land together.
  const loanInSources = [
    { rows: rentPayments, dateField: 'month' },
    { rows: staffSalary, dateField: 'month' },
    { rows: adminSalary, dateField: 'month' },
    { rows: operatingExpenses, dateField: 'expense_date' },
    { rows: miscExpenses, dateField: 'expense_date' },
    { rows: refunds, dateField: 'refund_date' },
    { rows: supplierPayments, dateField: 'payment_date' },
    { rows: loanBorrowings, dateField: 'borrow_date' },
  ]

  const loanInByMonth: Record<string, number> = {}

  loanInSources.forEach((t) => {

    t.rows
      .filter((r: any) => r.source_id && r.source_id !== darazSourceId)
      .forEach((r: any) => {

        const month = (r[t.dateField] || '').slice(0, 7)

        if (!month) return

        loanInByMonth[month] = (loanInByMonth[month] || 0) + Number(r.amount || 0)

      })

  })

  const allMonths = Array.from(
    new Set([
      ...Object.keys(loanInByMonth),
      ...Object.keys(incomeByMonth),
      ...Object.keys(rentByMonth),
      ...Object.keys(staffByMonth),
      ...Object.keys(adminByMonth),
      ...Object.keys(opExByMonth),
      ...Object.keys(miscExByMonth),
      ...Object.keys(refundByMonth),
      ...Object.keys(supplierPaymentByMonth),
      ...Object.keys(loanPaymentByMonth),
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
    const loanPayment = loanPaymentByMonth[month] || 0

    const loanIn = loanInByMonth[month] || 0

    const totalCashIn = income + loanIn
    const totalExpense = rent + staff + admin + operating + misc + refund + supplierPayment + loanPayment
    const balance = totalCashIn - totalExpense

    return { month, income, loanIn, totalCashIn, rent, staff, admin, operating, misc, refund, supplierPayment, loanPayment, totalExpense, balance }

  })

  const monthlyRowsDesc = [...monthlyRows].sort((a, b) => b.month.localeCompare(a.month))

  const lifetimeDarazIncome = monthlyRows.reduce((s, r) => s + r.income, 0)
  const lifetimeLoanIn = monthlyRows.reduce((s, r) => s + r.loanIn, 0)
  const lifetimeIncome = lifetimeDarazIncome + lifetimeLoanIn
  const lifetimeExpense = monthlyRows.reduce((s, r) => s + r.totalExpense, 0)
  const lifetimeBalance = lifetimeIncome - lifetimeExpense

  const lifetimeRent = monthlyRows.reduce((s, r) => s + r.rent, 0)
  const lifetimeStaff = monthlyRows.reduce((s, r) => s + r.staff, 0)
  const lifetimeAdmin = monthlyRows.reduce((s, r) => s + r.admin, 0)
  const lifetimeOperating = monthlyRows.reduce((s, r) => s + r.operating, 0)
  const lifetimeMisc = monthlyRows.reduce((s, r) => s + r.misc, 0)
  const lifetimeRefund = monthlyRows.reduce((s, r) => s + r.refund, 0)
  const lifetimeSupplierPayment = monthlyRows.reduce((s, r) => s + r.supplierPayment, 0)
  const lifetimeLoanPayment = monthlyRows.reduce((s, r) => s + r.loanPayment, 0)

  const expenseBreakdown = [
    { label: 'Rent', value: lifetimeRent, color: '#6366F1' },
    { label: 'Staff', value: lifetimeStaff, color: '#0EA5E9' },
    { label: 'Admin Finance', value: lifetimeAdmin, color: '#8B5CF6' },
    { label: 'Operating Expenses', value: lifetimeOperating, color: '#F59E0B' },
    { label: 'Misc Expenses', value: lifetimeMisc, color: '#EC4899' },
    { label: 'Refunds', value: lifetimeRefund, color: '#EF4444' },
    { label: 'Supplier Payment', value: lifetimeSupplierPayment, color: '#18181B' },
    { label: 'Loan Payment', value: lifetimeLoanPayment, color: '#0891B2' },
  ]

  // ---- Monthly Report (PDF) data ----

  const reportRow =
    monthlyRows.find((r) => r.month === reportMonth) || {
      month: reportMonth,
      income: 0,
      loanIn: 0,
      totalCashIn: 0,
      rent: 0,
      staff: 0,
      admin: 0,
      operating: 0,
      misc: 0,
      refund: 0,
      supplierPayment: 0,
      loanPayment: 0,
      totalExpense: 0,
      balance: 0,
    }

  const reportExpenseBreakdown = [
    { label: 'Rent', value: reportRow.rent, color: '#6366F1' },
    { label: 'Staff', value: reportRow.staff, color: '#0EA5E9' },
    { label: 'Admin Finance', value: reportRow.admin, color: '#8B5CF6' },
    { label: 'Operating Expenses', value: reportRow.operating, color: '#F59E0B' },
    { label: 'Misc Expenses', value: reportRow.misc, color: '#EC4899' },
    { label: 'Refunds', value: reportRow.refund, color: '#EF4444' },
    { label: 'Supplier Payment', value: reportRow.supplierPayment, color: '#18181B' },
    { label: 'Loan Payment', value: reportRow.loanPayment, color: '#0891B2' },
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

    const opening = Number(s.opening_balance || 0)
    const pending = opening + purchased - paid

    return { name: s.name, opening, purchased, paid, pending }

  })

  const loanTxnTables = [
    { rows: operatingExpenses, dateField: 'expense_date' },
    { rows: miscExpenses, dateField: 'expense_date' },
    { rows: rentPayments, dateField: 'paid_date' },
    { rows: staffSalary, dateField: 'paid_date' },
    { rows: refunds, dateField: 'refund_date' },
    { rows: supplierPayments, dateField: 'payment_date' },
    { rows: adminSalary, dateField: 'paid_date' },
    { rows: loanBorrowings, dateField: 'borrow_date' },
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
    { label: 'Cash In (Daraz + Loan)', color: '#0F6E56', data: monthlyRows.map((r) => r.totalCashIn) },
    { label: 'Expense', color: '#A32D2D', data: monthlyRows.map((r) => r.totalExpense) },
    { label: 'Remaining Balance', color: '#18181B', data: monthlyRows.map((r) => r.balance) },
  ]

  type BreakdownKey =
    | 'income' | 'loanIn' | 'totalCashIn' | 'rent' | 'staff' | 'admin' | 'operating'
    | 'misc' | 'refund' | 'supplierPayment' | 'loanPayment' | 'totalExpense' | 'balance'

  const breakdownGroups: { label: string; tone: string; cols: { key: BreakdownKey; label: string; strong?: boolean }[] }[] = [
    {
      label: 'Cash In',
      tone: 'text-green-700 bg-green-50 border-green-500',
      cols: [
        { key: 'income', label: 'Daraz' },
        { key: 'loanIn', label: 'Loan Received' },
        { key: 'totalCashIn', label: 'Total', strong: true },
      ],
    },
    {
      label: 'Expenses',
      tone: 'text-red-700 bg-red-50 border-red-500',
      cols: [
        { key: 'rent', label: 'Rent' },
        { key: 'staff', label: 'Staff' },
        { key: 'admin', label: 'Admin' },
        { key: 'operating', label: 'Operating' },
        { key: 'misc', label: 'Misc' },
        { key: 'refund', label: 'Refunds' },
        { key: 'supplierPayment', label: 'Supplier' },
        { key: 'loanPayment', label: 'Loan Repaid' },
        { key: 'totalExpense', label: 'Total', strong: true },
      ],
    },
    {
      label: 'Result',
      tone: 'text-zinc-700 bg-zinc-100 border-zinc-700',
      cols: [{ key: 'balance', label: 'Remaining Balance', strong: true }],
    },
  ]

  const breakdownTotals = monthlyRows.reduce(
    (acc, r) => {
      ;(Object.keys(acc) as BreakdownKey[]).forEach((k) => { acc[k] += r[k] })
      return acc
    },
    {
      income: 0, loanIn: 0, totalCashIn: 0, rent: 0, staff: 0, admin: 0, operating: 0,
      misc: 0, refund: 0, supplierPayment: 0, loanPayment: 0, totalExpense: 0, balance: 0,
    } as Record<BreakdownKey, number>
  )

  function breakdownCell(key: BreakdownKey, value: number, strong?: boolean) {

    if (key === 'balance') {

      return (
        <span className={`inline-block rounded-lg px-3 py-1 font-bold ${value >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {value < 0 ? '−' : ''}Rs. {Math.abs(value).toLocaleString('en-IN')}
        </span>
      )

    }

    if (value === 0) return <span className="text-zinc-300">—</span>

    const color =
      key === 'income' || key === 'loanIn' || key === 'totalCashIn'
        ? 'text-green-700'
        : key === 'totalExpense'
          ? 'text-red-700'
          : 'text-zinc-700'

    return (
      <span className={`${color} ${strong ? 'font-semibold' : ''}`}>
        Rs. {value.toLocaleString('en-IN')}
      </span>
    )

  }

  function exportReport() {

    if (monthlyRowsDesc.length === 0) {

      alert('No data to export')
      return

    }

    const rows = monthlyRowsDesc.map((r) => ({
      Month: monthLabel(r.month),
      'Daraz Cash In': r.income,
      'Loan Received': r.loanIn,
      'Total Cash In': r.totalCashIn,
      Rent: r.rent,
      'Staff Salary': r.staff,
      'Admin Finance': r.admin,
      'Operating Expenses': r.operating,
      'Misc Expenses': r.misc,
      Refunds: r.refund,
      'Supplier Payment': r.supplierPayment,
      'Loan Payment': r.loanPayment,
      'Total Expenses': r.totalExpense,
      'Remaining Balance': r.balance,
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

      <div className="w-full space-y-6">

        <div className="sticky top-0 z-40 -mx-4 -mt-4 lg:-mx-6 lg:-mt-6 px-4 lg:px-6 py-3 bg-[#F1F2FB]/90 backdrop-blur border-b border-zinc-200 flex items-center gap-4">

          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 bg-white border border-zinc-300 text-zinc-800 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition-colors px-4 py-2 rounded-xl text-sm font-semibold shadow-sm"
          >

            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
              <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            Back to Dashboard

          </button>

          <h1 className="text-xl font-bold tracking-tight text-zinc-900">

            Finance Report

          </h1>

        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">

          <div>

            <p className="text-sm text-zinc-500">

              Remaining balance = (Daraz Cash In + Loan Received) − (Rent + Staff + Admin Finance + Operating Expenses + Misc Expenses + Refunds + Supplier Payment + Loan Payment)

            </p>

          </div>

          <button
            onClick={exportReport}
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

            <p className="text-sm text-zinc-500">Total Cash In (Daraz + Loan, Lifetime)</p>
            <h2 className="text-2xl font-bold tracking-tight mt-1 tabular-nums text-green-600">Rs. {lifetimeIncome.toLocaleString('en-IN')}</h2>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-red-500 px-6 py-4">

            <p className="text-sm text-zinc-500">Total Expenses (Lifetime)</p>
            <h2 className="text-2xl font-bold tracking-tight mt-1 tabular-nums text-red-600">Rs. {lifetimeExpense.toLocaleString('en-IN')}</h2>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-zinc-900 px-6 py-4">

            <p className="text-sm text-zinc-500">Remaining Balance (Lifetime)</p>
            <h2 className={`text-2xl font-bold tracking-tight mt-1 tabular-nums ${lifetimeBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Rs. {lifetimeBalance.toLocaleString('en-IN')}
            </h2>

          </div>

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <h3 className="font-bold text-lg text-zinc-900 mb-1">Cash In vs Expense vs Remaining Balance</h3>
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

            <div className="overflow-x-auto rounded-2xl border border-zinc-200">

              <table className="w-full min-w-[1280px] border-separate border-spacing-0 text-sm">

                <thead>

                  <tr>

                    <th rowSpan={2} className="sticky left-0 z-10 bg-white px-4 text-left align-bottom pb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 border-b border-zinc-200">Month</th>

                    {breakdownGroups.map((g) => (
                      <th
                        key={g.label}
                        colSpan={g.cols.length}
                        className={`px-4 py-2 text-center text-xs font-bold uppercase tracking-wider border-t-2 border-l border-zinc-200 ${g.tone}`}
                      >
                        {g.label}
                      </th>
                    ))}

                  </tr>

                  <tr>

                    {breakdownGroups.map((g) =>
                      g.cols.map((c, i) => (
                        <th
                          key={c.key}
                          className={`px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 whitespace-nowrap bg-zinc-50 border-b border-zinc-200 ${i === 0 ? 'border-l' : ''}`}
                        >
                          {c.label}
                        </th>
                      ))
                    )}

                  </tr>

                </thead>

                <tbody>

                  {monthlyRowsDesc.map((r) => (

                    <tr key={r.month} className="group hover:bg-zinc-50/70">

                      <td className="sticky left-0 z-10 bg-white group-hover:bg-zinc-50 px-4 py-3.5 font-semibold text-zinc-900 whitespace-nowrap border-b border-zinc-100">
                        {monthLabel(r.month)}
                      </td>

                      {breakdownGroups.map((g) =>
                        g.cols.map((c, i) => (
                          <td
                            key={c.key}
                            className={`px-4 py-3.5 text-right tabular-nums whitespace-nowrap border-b border-zinc-100 ${i === 0 ? 'border-l border-l-zinc-100' : ''}`}
                          >
                            {breakdownCell(c.key, r[c.key], c.strong)}
                          </td>
                        ))
                      )}

                    </tr>

                  ))}

                </tbody>

                <tfoot>

                  <tr className="bg-zinc-50 font-bold">

                    <td className="sticky left-0 z-10 bg-zinc-50 px-4 py-4 text-zinc-900 border-t-2 border-zinc-300">Total</td>

                    {breakdownGroups.map((g) =>
                      g.cols.map((c, i) => (
                        <td
                          key={c.key}
                          className={`px-4 py-4 text-right tabular-nums whitespace-nowrap border-t-2 border-zinc-300 ${i === 0 ? 'border-l border-l-zinc-200' : ''}`}
                        >
                          {breakdownCell(c.key, breakdownTotals[c.key], true)}
                        </td>
                      ))
                    )}

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
          totalCashIn={reportRow.totalCashIn}
          darazCashIn={reportRow.income}
          loanReceived={reportRow.loanIn}
          totalExpenditure={reportRow.totalExpense}
          remainingBalance={reportRow.balance}
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
