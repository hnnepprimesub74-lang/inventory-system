'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

function normalizeName(name: any) {
  return (name || '').toString().trim().toLowerCase()
}

export default function AccountingPage() {

  const router = useRouter()

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [stockTxns, setStockTxns] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [newSupplierName, setNewSupplierName] = useState('')
  const [newOpeningBalance, setNewOpeningBalance] = useState('')
  const [adding, setAdding] = useState(false)

  const [reportMonth, setReportMonth] = useState('')

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

    const { data: supplierData } =
      await supabase.from('suppliers').select('*').order('name')

    const { data: txnData } =
      await supabase
        .from('stock_transactions')
        .select('*')
        .eq('transaction_type', 'ADD')

    const { data: paymentData } =
      await supabase.from('payments').select('*')

    setSuppliers(supplierData || [])
    setStockTxns(txnData || [])
    setPayments(paymentData || [])
    setLoading(false)

  }

  function txnAmount(t: any) {
    return Number(t.cost_price || 0) * Number(t.quantity || 0)
  }

  function purchaseTxnsFor(supplierName: any) {
    const target = normalizeName(supplierName)
    return stockTxns.filter((t) => normalizeName(t.seller) === target)
  }

  function paymentsFor(supplierId: any) {
    return payments.filter((p) => p.supplier_id === supplierId)
  }

  function sumAmount(rows: any[]) {
    return rows.reduce((s, r) => s + Number(r.amount || 0), 0)
  }

  function sumTxns(rows: any[]) {
    return rows.reduce((s, r) => s + txnAmount(r), 0)
  }

  async function addSupplier() {

    const name = newSupplierName.trim()

    if (!name) {

      alert('Enter a supplier name')
      return

    }

    setAdding(true)

    const { error } =
      await supabase.from('suppliers').insert({
        name,
        opening_balance: Number(newOpeningBalance) || 0,
      })

    setAdding(false)

    if (error) {

      alert('Failed to add supplier: ' + error.message)
      return

    }

    setNewSupplierName('')
    setNewOpeningBalance('')
    await load()

  }

  const totalPurchaseLifetime = sumTxns(stockTxns)
  const totalPaidLifetime = sumAmount(payments)

  const supplierRows = suppliers.map((s) => {

    const sPurchaseTxns = purchaseTxnsFor(s.name)
    const sPayments = paymentsFor(s.id)

    const totalPurchase = sumTxns(sPurchaseTxns)
    const totalPaid = sumAmount(sPayments)
    const openingBalance = Number(s.opening_balance || 0)

    return {
      ...s,
      openingBalance,
      totalPurchase,
      totalPaid,
      pending: openingBalance + totalPurchase - totalPaid,
    }

  })

  const openingBalanceLifetime = suppliers.reduce(
    (s, r) => s + Number(r.opening_balance || 0),
    0
  )

  const totalPendingLifetime =
    openingBalanceLifetime + totalPurchaseLifetime - totalPaidLifetime

  const monthPurchaseTxns = reportMonth
    ? stockTxns.filter((t) => (t.stock_date || '').slice(0, 7) === reportMonth)
    : []

  const monthPayments = reportMonth
    ? payments.filter((p) => (p.payment_date || '').slice(0, 7) === reportMonth)
    : []

  function supplierName(id: any) {
    return suppliers.find((s) => s.id === id)?.name || 'Unknown supplier'
  }

  function exportMonthlyReport() {

    if (!reportMonth) {

      alert('Pick a month first')
      return

    }

    const rows: any[] = []

    monthPurchaseTxns.forEach((t) => {

      rows.push({
        Date: t.stock_date,
        Type: 'Purchase',
        Supplier: t.seller || 'Unknown',
        Description: 'Stock purchase',
        Debit: txnAmount(t),
        Credit: '',
      })

    })

    monthPayments.forEach((p) => {

      rows.push({
        Date: p.payment_date,
        Type: 'Payment',
        Supplier: supplierName(p.supplier_id),
        Description: p.note || '',
        Debit: '',
        Credit: Number(p.amount || 0),
      })

    })

    rows.sort((a, b) => (a.Date || '').localeCompare(b.Date || ''))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Monthly Report')

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })

    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    })

    saveAs(blob, `accounting-report-${reportMonth}.xlsx`)

  }

  return (

    <div className="min-h-screen bg-zinc-100 p-6 text-black">

      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">

          <div>

            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">

              Accounting

            </h1>

            <p className="text-sm text-zinc-500 mt-1">

              Suppliers, purchases and payments · purchases sync automatically from Stock Log by seller name

            </p>

          </div>

          <button
            onClick={() => router.push('/')}
            className="bg-white border border-zinc-200 text-zinc-700 px-5 py-3 rounded-2xl font-bold hover:bg-zinc-50"
          >

            Back to Dashboard

          </button>

        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-zinc-900 px-6 py-4 min-w-[220px] inline-block">

          <p className="text-sm text-zinc-500">

            Total Purchase (Lifetime)

          </p>

          <h2 className="text-3xl font-bold tracking-tight mt-1 tabular-nums">

            Rs. {totalPurchaseLifetime.toLocaleString()}

          </h2>

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <h3 className="font-bold text-lg text-zinc-900 mb-4">

            Add Supplier

          </h3>

          <p className="text-xs text-zinc-400 mb-3">

            Use the exact same name here as the "Seller / Supplier" field on Add Stock, so purchases link up automatically.

          </p>

          <div className="flex gap-3 flex-wrap">

            <input
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              placeholder="Supplier name"
              className="border border-zinc-300 rounded-xl px-4 py-2.5 flex-1 min-w-[220px]"
            />

            <input
              type="number"
              value={newOpeningBalance}
              onChange={(e) => setNewOpeningBalance(e.target.value)}
              placeholder="Old Pending Payment (optional)"
              className="border border-zinc-300 rounded-xl px-4 py-2.5 w-64"
            />

            <button
              onClick={addSupplier}
              disabled={adding}
              className="bg-amber-400 border border-amber-500 text-zinc-900 hover:bg-amber-500 transition-colors px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            >

              {adding ? 'Adding...' : 'Add Supplier'}

            </button>

          </div>

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <h3 className="font-bold text-lg text-zinc-900 mb-4">

            Suppliers

          </h3>

          {loading ? (

            <p className="text-zinc-500">Loading...</p>

          ) : supplierRows.length === 0 ? (

            <p className="text-zinc-500">No suppliers yet.</p>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full border-collapse">

                <thead>

                  <tr className="text-left">

                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Supplier</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Old Pending</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Total Purchase</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Total Paid</th>
                    <th className="pb-3 text-sm font-medium text-zinc-500 text-right">Pending Payment</th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-zinc-100">

                  {supplierRows.map((s) => (

                    <tr
                      key={s.id}
                      onClick={() => router.push('/accounting/' + s.id)}
                      className="cursor-pointer hover:bg-zinc-50"
                    >

                      <td className="py-3 pr-4 font-semibold text-zinc-900">{s.name}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">Rs. {s.openingBalance.toLocaleString()}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">Rs. {s.totalPurchase.toLocaleString()}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">Rs. {s.totalPaid.toLocaleString()}</td>
                      <td className={`py-3 text-right tabular-nums font-semibold ${s.pending > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        Rs. {s.pending.toLocaleString()}
                      </td>

                    </tr>

                  ))}

                </tbody>

                <tfoot>

                  <tr className="border-t-2 border-zinc-200 font-bold text-zinc-900">

                    <td className="pt-3 pr-4">Total</td>
                    <td className="pt-3 pr-4 text-right tabular-nums">Rs. {openingBalanceLifetime.toLocaleString()}</td>
                    <td className="pt-3 pr-4 text-right tabular-nums">Rs. {totalPurchaseLifetime.toLocaleString()}</td>
                    <td className="pt-3 pr-4 text-right tabular-nums">Rs. {totalPaidLifetime.toLocaleString()}</td>
                    <td className={`pt-3 text-right tabular-nums ${totalPendingLifetime > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      Rs. {totalPendingLifetime.toLocaleString()}
                    </td>

                  </tr>

                </tfoot>

              </table>

            </div>

          )}

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">

            <h3 className="font-bold text-lg text-zinc-900">

              Monthly Report

            </h3>

            <div className="flex items-center gap-3">

              <input
                type="month"
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
                className="border border-zinc-300 rounded-xl px-4 py-2.5"
              />

              <button
                onClick={exportMonthlyReport}
                className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm"
              >

                Export Excel

              </button>

            </div>

          </div>

          {!reportMonth ? (

            <p className="text-zinc-500">Pick a month to see totals.</p>

          ) : (

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              <div className="bg-zinc-50 rounded-xl border border-zinc-200 px-5 py-4">

                <p className="text-sm text-zinc-500">Purchase this month</p>
                <p className="text-2xl font-bold tabular-nums mt-1">Rs. {sumTxns(monthPurchaseTxns).toLocaleString()}</p>

              </div>

              <div className="bg-zinc-50 rounded-xl border border-zinc-200 px-5 py-4">

                <p className="text-sm text-zinc-500">Paid this month</p>
                <p className="text-2xl font-bold tabular-nums mt-1">Rs. {sumAmount(monthPayments).toLocaleString()}</p>

              </div>

              <div className="bg-zinc-50 rounded-xl border border-zinc-200 px-5 py-4">

                <p className="text-sm text-zinc-500">Net (Purchase − Paid)</p>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  Rs. {(sumTxns(monthPurchaseTxns) - sumAmount(monthPayments)).toLocaleString()}
                </p>

              </div>

            </div>

          )}

        </div>

      </div>

    </div>

  )

}
