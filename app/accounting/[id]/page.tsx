'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import ConfirmDialog from '../../../components/ConfirmDialog'
import { useViewer } from '../../../components/ViewerContext'
import SourceSelect, { CashSource, defaultSourceId } from '../../../components/SourceSelect'

function normalizeName(name: any) {
  return (name || '').toString().trim().toLowerCase()
}

export default function SupplierLedgerPage() {

  const router = useRouter()
  const isViewer = useViewer()
  const params = useParams()
  const supplierId = params?.id as string

  const [supplier, setSupplier] = useState<any>(null)
  const [stockTxns, setStockTxns] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [sources, setSources] = useState<CashSource[]>([])
  const [loading, setLoading] = useState(true)

  const [openingBalanceInput, setOpeningBalanceInput] = useState('')
  const [editingOpening, setEditingOpening] = useState(false)
  const [savingOpening, setSavingOpening] = useState(false)
  const [openingConfirmStep, setOpeningConfirmStep] = useState(0)

  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentSourceId, setPaymentSourceId] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)

  useEffect(() => {

    async function init() {

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {

        router.push('/login')
        return

      }

      if (supplierId) {
        await load()
      }

    }

    init()

  }, [supplierId])

  async function load() {

    const { data: supplierData } =
      await supabase.from('suppliers').select('*').eq('id', supplierId).single()

    const { data: paymentData } =
      await supabase
        .from('payments')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('payment_date', { ascending: false })

    let txnData: any[] = []

    if (supplierData?.name) {

      const { data } =
        await supabase
          .from('stock_transactions')
          .select('*')
          .eq('transaction_type', 'ADD')

      txnData = (data || []).filter(
        (t) => normalizeName(t.seller) === normalizeName(supplierData.name)
      )

    }

    const { data: sourceData } =
      await supabase.from('cash_sources').select('*').order('name')

    const sourceRows = sourceData || []

    setSupplier(supplierData || null)
    setOpeningBalanceInput(String(supplierData?.opening_balance || 0))
    setStockTxns(txnData)
    setPayments(paymentData || [])
    setSources(sourceRows)
    setLoading(false)

    setPaymentSourceId((prev) => prev || defaultSourceId(sourceRows))

  }

  function txnAmount(t: any) {
    return Number(t.cost_price || 0) * Number(t.quantity || 0)
  }

  async function confirmSaveOpeningBalance() {

    const amount = Number(openingBalanceInput) || 0

    setOpeningConfirmStep(0)
    setSavingOpening(true)

    const { error } = await supabase
      .from('suppliers')
      .update({ opening_balance: amount })
      .eq('id', supplierId)

    setSavingOpening(false)

    if (error) {

      alert('Failed to save old pending payment: ' + error.message)
      return

    }

    setEditingOpening(false)
    await load()

  }

  async function addPayment() {

    const amount = Number(paymentAmount)

    if (!amount || amount <= 0) {

      alert('Enter a valid amount')
      return

    }

    setSavingPayment(true)

    const { error } = await supabase.from('payments').insert({
      supplier_id: supplierId,
      amount,
      note: paymentNote.trim() || null,
      payment_date: paymentDate || new Date().toISOString().slice(0, 10),
      source_id: paymentSourceId || defaultSourceId(sources),
    })

    setSavingPayment(false)

    if (error) {

      alert('Failed to add payment: ' + error.message)
      return

    }

    setPaymentAmount('')
    setPaymentDate('')
    setPaymentNote('')
    await load()

  }

  const openingBalance = Number(supplier?.opening_balance || 0)
  const totalPurchase = stockTxns.reduce((s, t) => s + txnAmount(t), 0)
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0)
  const pending = openingBalance + totalPurchase - totalPaid

  type LedgerEntry = {
    date: string
    description: string
    debit: number
    credit: number
    source: string
  }

  const ledgerEntries: LedgerEntry[] = []

  if (supplier) {

    ledgerEntries.push({
      date: supplier.created_at ? supplier.created_at.slice(0, 10) : '',
      description: 'Opening Balance (Old Pending Payment)',
      debit: openingBalance,
      credit: 0,
      source: '',
    })

  }

  stockTxns.forEach((t) => {

    ledgerEntries.push({
      date: t.stock_date || (t.created_at ? t.created_at.slice(0, 10) : ''),
      description: 'Stock Purchase (from Stock Log)',
      debit: txnAmount(t),
      credit: 0,
      source: '',
    })

  })

  payments.forEach((p) => {

    ledgerEntries.push({
      date: p.payment_date,
      description: p.note || 'Payment',
      debit: 0,
      credit: Number(p.amount || 0),
      source: sources.find((s) => s.id === p.source_id)?.name || '',
    })

  })

  ledgerEntries.sort((a, b) => (a.date || '').localeCompare(b.date || ''))

  let running = 0

  const ledgerWithBalance = ledgerEntries.map((e) => {

    running += e.debit - e.credit

    return { ...e, balance: running }

  })

  if (loading) {

    return (

      <div className="text-black">

        <p className="text-zinc-500">Loading...</p>

      </div>

    )

  }

  return (

    <div className="text-black">

      <div className="max-w-5xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">

          <div>

            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">

              {supplier?.name || 'Supplier'}

            </h1>

            <p className="text-sm text-zinc-500 mt-1">

              Purchase and payment ledger

            </p>

          </div>

          <button
            onClick={() => router.push('/accounting')}
            className="bg-white border border-zinc-200 text-zinc-700 px-5 py-3 rounded-2xl font-bold hover:bg-zinc-50"
          >

            Back to Suppliers

          </button>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-zinc-900 px-6 py-4">

            <p className="text-sm text-zinc-500">Total Purchase</p>
            <h2 className="text-2xl font-bold tracking-tight mt-1 tabular-nums">Rs. {totalPurchase.toLocaleString()}</h2>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-zinc-900 px-6 py-4">

            <p className="text-sm text-zinc-500">Total Paid</p>
            <h2 className="text-2xl font-bold tracking-tight mt-1 tabular-nums">Rs. {totalPaid.toLocaleString()}</h2>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-zinc-900 px-6 py-4">

            <p className="text-sm text-zinc-500">Pending Payment</p>
            <h2 className={`text-2xl font-bold tracking-tight mt-1 tabular-nums ${pending > 0 ? 'text-red-600' : 'text-green-600'}`}>
              Rs. {pending.toLocaleString()}
            </h2>

          </div>

        </div>

        {!isViewer && (

          <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

            <h3 className="font-bold text-lg text-zinc-900 mb-4">Old Pending Payment</h3>

            <p className="text-xs text-zinc-400 mb-3">

              One-time opening balance carried over from before this ledger started. Recorded as a Debit.

            </p>

            {!editingOpening ? (

              <div className="flex items-center gap-4 flex-wrap">

                <p className="text-2xl font-bold tabular-nums text-zinc-900">

                  Rs. {openingBalance.toLocaleString()}

                </p>

                <button
                  onClick={() => {
                    setOpeningBalanceInput(String(openingBalance))
                    setEditingOpening(true)
                  }}
                  className="bg-white border border-zinc-300 text-zinc-700 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-zinc-50"
                >

                  Edit

                </button>

              </div>

            ) : (

              <div className="flex gap-3 flex-wrap">

                <input
                  type="number"
                  value={openingBalanceInput}
                  onChange={(e) => setOpeningBalanceInput(e.target.value)}
                  placeholder="Old pending amount"
                  className="border border-zinc-300 rounded-xl px-4 py-2.5 w-64"
                />

                <button
                  onClick={() => setOpeningConfirmStep(1)}
                  disabled={savingOpening}
                  className="bg-zinc-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                >

                  {savingOpening ? 'Saving...' : 'Save'}

                </button>

                <button
                  onClick={() => setEditingOpening(false)}
                  disabled={savingOpening}
                  className="bg-white border border-zinc-300 text-zinc-700 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50"
                >

                  Cancel

                </button>

              </div>

            )}

          </div>

        )}

        {!isViewer && (

          <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

            <h3 className="font-bold text-lg text-zinc-900 mb-4">Add Payment</h3>

            <div className="flex gap-3 flex-wrap">

              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Amount"
                className="border border-zinc-300 rounded-xl px-4 py-2.5 w-40"
              />

              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="border border-zinc-300 rounded-xl px-4 py-2.5"
              />

              <input
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="Note (optional)"
                className="border border-zinc-300 rounded-xl px-4 py-2.5 flex-1 min-w-[180px]"
              />

              <SourceSelect
                sources={sources}
                value={paymentSourceId}
                onChange={setPaymentSourceId}
                onSourceAdded={(s) => setSources((prev) => [...prev, s])}
                className="border border-zinc-300 rounded-xl px-4 py-2.5"
              />

              <button
                onClick={addPayment}
                disabled={savingPayment}
                className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50"
              >

                {savingPayment ? 'Saving...' : 'Add Payment'}

              </button>

            </div>

          </div>

        )}

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <h3 className="font-bold text-lg text-zinc-900 mb-4">Ledger</h3>

          <div className="overflow-x-auto">

            <table className="w-full border-collapse">

              <thead>

                <tr className="text-left">

                  <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Date</th>
                  <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Description</th>
                  <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Source</th>
                  <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Debit</th>
                  <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Credit</th>
                  <th className="pb-3 text-sm font-medium text-zinc-500 text-right">Balance</th>

                </tr>

              </thead>

              <tbody className="divide-y divide-zinc-100">

                {ledgerWithBalance.filter((e) => e.debit !== 0 || e.credit !== 0).length === 0 ? (

                  <tr>
                    <td colSpan={6} className="py-4 text-zinc-500">No entries yet.</td>
                  </tr>

                ) : ledgerWithBalance
                  .filter((e) => e.debit !== 0 || e.credit !== 0)
                  .map((e, i) => (

                    <tr key={i}>

                      <td className="py-3 pr-4 text-sm text-zinc-600">{e.date}</td>
                      <td className="py-3 pr-4 text-sm text-zinc-600">{e.description}</td>
                      <td className="py-3 pr-4 text-sm text-zinc-600">{e.source || '—'}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-red-600">
                        {e.debit ? `Rs. ${e.debit.toLocaleString()}` : '—'}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-green-600">
                        {e.credit ? `Rs. ${e.credit.toLocaleString()}` : '—'}
                      </td>
                      <td className="py-3 text-right tabular-nums font-semibold text-zinc-900">
                        Rs. {e.balance.toLocaleString()}
                      </td>

                    </tr>

                  ))}

              </tbody>

            </table>

          </div>

        </div>

      </div>

      <ConfirmDialog
        open={openingConfirmStep === 1}
        title="Change Old Pending Payment?"
        message={`Set Old Pending Payment for ${supplier?.name || 'this supplier'} to Rs. ${(Number(openingBalanceInput) || 0).toLocaleString()}?\n\nThis changes the supplier's account balance and affects their Pending Payment total.`}
        confirmLabel="Continue"
        onConfirm={() => setOpeningConfirmStep(2)}
        onCancel={() => setOpeningConfirmStep(0)}
      />

      <ConfirmDialog
        open={openingConfirmStep === 2}
        title="Please confirm again"
        message={`Final confirmation: Old Pending Payment will be set to Rs. ${(Number(openingBalanceInput) || 0).toLocaleString()}.`}
        confirmLabel="Yes, Save"
        danger
        onConfirm={confirmSaveOpeningBalance}
        onCancel={() => setOpeningConfirmStep(0)}
      />

    </div>

  )

}
