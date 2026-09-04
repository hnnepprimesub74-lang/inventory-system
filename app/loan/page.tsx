'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import DatePicker from '../../components/DatePicker'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useViewer } from '../../components/ViewerContext'
import { CashSource } from '../../components/SourceSelect'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

type Txn = {
  id: string
  date: string
  category: string
  remark: string
  amount: number
  sourceId: string
}

export default function LoanPage() {

  const router = useRouter()
  const isViewer = useViewer()

  const [sources, setSources] = useState<CashSource[]>([])
  const [txns, setTxns] = useState<Txn[]>([])
  const [loanPayments, setLoanPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [activeSourceId, setActiveSourceId] = useState<string | null>(null)

  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(todayISO())
  const [payNote, setPayNote] = useState('')
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

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
      sourcesRes,
      opExpRes,
      expenseTypesRes,
      miscExpRes,
      miscTypesRes,
      rentRes,
      staffRes,
      staffRes2,
      refundsRes,
      paymentsRes,
      suppliersRes,
      adminSalaryRes,
      loanPaymentsRes,
    ] = await Promise.all([
      supabase.from('cash_sources').select('*').order('name'),
      supabase.from('operating_expenses').select('*'),
      supabase.from('expense_types').select('*'),
      supabase.from('misc_expenses').select('*'),
      supabase.from('misc_expense_types').select('*'),
      supabase.from('rent_payments').select('*'),
      supabase.from('staff_salary').select('*'),
      supabase.from('staff').select('*'),
      supabase.from('refunds').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('suppliers').select('*'),
      supabase.from('admin_salary').select('*'),
      supabase.from('loan_payments').select('*').order('payment_date', { ascending: false }),
    ])

    const sourceRows: CashSource[] = sourcesRes.data || []
    const darazId = sourceRows.find((s) => s.name === 'Daraz')?.id

    const expenseTypes = expenseTypesRes.data || []
    const miscTypes = miscTypesRes.data || []
    const staffList = staffRes2.data || []
    const suppliers = suppliersRes.data || []

    const all: Txn[] = []

    ;(opExpRes.data || []).forEach((r: any) => {
      const typeName = expenseTypes.find((t: any) => t.id === r.expense_type_id)?.name
      all.push({
        id: r.id,
        date: r.expense_date,
        category: 'Operating Expense' + (typeName ? ' — ' + typeName : ''),
        remark: r.remark || '',
        amount: Number(r.amount || 0),
        sourceId: r.source_id,
      })
    })

    ;(miscExpRes.data || []).forEach((r: any) => {
      const typeName = miscTypes.find((t: any) => t.id === r.expense_type_id)?.name
      all.push({
        id: r.id,
        date: r.expense_date,
        category: 'Misc Expense' + (typeName ? ' — ' + typeName : ''),
        remark: r.remark || '',
        amount: Number(r.amount || 0),
        sourceId: r.source_id,
      })
    })

    ;(rentRes.data || []).forEach((r: any) => all.push({
      id: r.id,
      date: r.paid_date,
      category: 'Rent',
      remark: r.note || '',
      amount: Number(r.amount || 0),
      sourceId: r.source_id,
    }))

    ;(staffRes.data || []).forEach((r: any) => {
      const staffName = staffList.find((s: any) => s.id === r.staff_id)?.name
      all.push({
        id: r.id,
        date: r.paid_date,
        category: 'Staff' + (staffName ? ' — ' + staffName : ''),
        remark: r.note || '',
        amount: Number(r.amount || 0),
        sourceId: r.source_id,
      })
    })

    ;(refundsRes.data || []).forEach((r: any) => all.push({
      id: r.id,
      date: r.refund_date,
      category: 'Refund',
      remark: r.reason || '',
      amount: Number(r.amount || 0),
      sourceId: r.source_id,
    }))

    ;(adminSalaryRes.data || []).forEach((r: any) => all.push({
      id: r.id,
      date: r.paid_date,
      category: 'Admin Finance',
      remark: r.note || '',
      amount: Number(r.amount || 0),
      sourceId: r.source_id,
    }))

    ;(paymentsRes.data || []).forEach((r: any) => {
      const supplierName = suppliers.find((s: any) => s.id === r.supplier_id)?.name
      all.push({
        id: r.id,
        date: r.payment_date,
        category: 'Supplier Payment' + (supplierName ? ' — ' + supplierName : ''),
        remark: r.note || '',
        amount: Number(r.amount || 0),
        sourceId: r.source_id,
      })
    })

    const nonDaraz = all.filter((t) => t.sourceId && t.sourceId !== darazId)

    nonDaraz.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

    setSources(sourceRows)
    setTxns(nonDaraz)
    setLoanPayments(loanPaymentsRes.data || [])
    setLoading(false)

  }

  const loanSources = sources.filter((s) => s.name !== 'Daraz')

  function sourceSummary(sourceId: string) {

    const borrowed = txns
      .filter((t) => t.sourceId === sourceId)
      .reduce((s, t) => s + t.amount, 0)

    const cleared = loanPayments
      .filter((p) => p.source_id === sourceId)
      .reduce((s, p) => s + Number(p.amount || 0), 0)

    return { borrowed, cleared, outstanding: borrowed - cleared }

  }

  const totalBorrowed = txns.reduce((s, t) => s + t.amount, 0)
  const totalCleared = loanPayments.reduce((s, p) => s + Number(p.amount || 0), 0)
  const totalOutstanding = totalBorrowed - totalCleared

  async function addLoanPayment() {

    if (!activeSourceId) return

    const amount = Number(payAmount)

    if (!amount || amount <= 0) {

      alert('Enter a valid amount')
      return

    }

    setSaving(true)

    const { error } = await supabase.from('loan_payments').insert({
      source_id: activeSourceId,
      amount,
      payment_date: payDate || todayISO(),
      note: payNote.trim() || null,
    })

    setSaving(false)

    if (error) {

      alert('Failed to record payment: ' + error.message)
      return

    }

    setPayAmount('')
    setPayNote('')
    setPayDate(todayISO())
    await load()

  }

  async function confirmDeletePayment() {

    if (!deleteTarget) return

    setDeleting(true)

    const { error } = await supabase
      .from('loan_payments')
      .delete()
      .eq('id', deleteTarget.id)

    setDeleting(false)

    if (error) {

      alert('Failed to delete payment: ' + error.message)
      return

    }

    setDeleteTarget(null)
    await load()

  }

  if (loading) {

    return (

      <div className="text-black">

        <p className="text-zinc-500">Loading...</p>

      </div>

    )

  }

  const activeSource = loanSources.find((s) => s.id === activeSourceId)

  return (

    <div className="text-black">

      <div className="max-w-6xl mx-auto space-y-6">

        <div>

          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">

            Loan

          </h1>

          <p className="text-sm text-zinc-500 mt-1">

            Money spent from sources other than Daraz — own cash used to run the business — and payments made to clear it back

          </p>

        </div>

        <div className="flex flex-wrap gap-4">

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-red-500 px-6 py-4 min-w-[220px]">

            <p className="text-sm text-zinc-500">Total Borrowed (Lifetime)</p>
            <h2 className="text-2xl font-bold tracking-tight mt-1 tabular-nums text-red-600">Rs. {totalBorrowed.toLocaleString('en-IN')}</h2>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-green-600 px-6 py-4 min-w-[220px]">

            <p className="text-sm text-zinc-500">Total Cleared</p>
            <h2 className="text-2xl font-bold tracking-tight mt-1 tabular-nums text-green-600">Rs. {totalCleared.toLocaleString('en-IN')}</h2>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-amber-500 px-6 py-4 min-w-[220px]">

            <p className="text-sm text-zinc-500">Outstanding</p>
            <h2 className={`text-2xl font-bold tracking-tight mt-1 tabular-nums ${totalOutstanding > 0 ? 'text-amber-600' : 'text-green-600'}`}>Rs. {totalOutstanding.toLocaleString('en-IN')}</h2>

          </div>

        </div>

        {loanSources.length === 0 ? (

          <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

            <p className="text-zinc-500">No non-Daraz cash sources yet. Add one from any expense entry form's Source dropdown.</p>

          </div>

        ) : (

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {loanSources.map((s) => {

              const { borrowed, cleared, outstanding } = sourceSummary(s.id)

              return (

                <button
                  key={s.id}
                  onClick={() => setActiveSourceId(s.id)}
                  className={`text-left bg-white rounded-2xl shadow-sm border p-5 transition-colors ${activeSourceId === s.id ? 'border-zinc-900' : 'border-zinc-200 hover:border-zinc-300'}`}
                >

                  <div className="flex items-center justify-between gap-3 mb-3">

                    <h3 className="font-bold text-lg text-zinc-900">{s.name}</h3>

                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${outstanding > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      {outstanding > 0 ? 'Outstanding' : 'Cleared'}
                    </span>

                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">

                    <div>
                      <p className="text-zinc-400 text-xs">Borrowed</p>
                      <p className="font-semibold tabular-nums">Rs. {borrowed.toLocaleString('en-IN')}</p>
                    </div>

                    <div>
                      <p className="text-zinc-400 text-xs">Cleared</p>
                      <p className="font-semibold tabular-nums text-green-600">Rs. {cleared.toLocaleString('en-IN')}</p>
                    </div>

                    <div>
                      <p className="text-zinc-400 text-xs">Balance</p>
                      <p className={`font-semibold tabular-nums ${outstanding > 0 ? 'text-amber-600' : 'text-green-600'}`}>Rs. {outstanding.toLocaleString('en-IN')}</p>
                    </div>

                  </div>

                </button>

              )

            })}

          </div>

        )}

        {activeSource && (

          <>

            {!isViewer && (

              <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

                <h3 className="font-bold text-lg text-zinc-900 mb-4">Record Payment — Clear {activeSource.name}</h3>

                <div className="flex gap-3 flex-wrap items-end">

                  <DatePicker value={payDate} onChange={setPayDate} />

                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Amount"
                    className="border border-zinc-300 rounded-xl px-4 py-2.5 w-40"
                  />

                  <input
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    placeholder="Note (optional)"
                    className="border border-zinc-300 rounded-xl px-4 py-2.5 flex-1 min-w-[180px]"
                  />

                  <button
                    onClick={addLoanPayment}
                    disabled={saving}
                    className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50"
                  >

                    {saving ? 'Saving...' : 'Record Payment'}

                  </button>

                </div>

              </div>

            )}

            <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

              <h3 className="font-bold text-lg text-zinc-900 mb-4">{activeSource.name} — Payments Made</h3>

              {loanPayments.filter((p) => p.source_id === activeSource.id).length === 0 ? (

                <p className="text-zinc-500 text-sm">No clearing payments recorded yet.</p>

              ) : (

                <div className="overflow-x-auto">

                  <table className="w-full border-collapse">

                    <thead>

                      <tr className="text-left">

                        <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Date</th>
                        <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Note</th>
                        <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Amount</th>
                        {!isViewer && (
                          <th className="pb-3 text-sm font-medium text-zinc-500 text-right">Actions</th>
                        )}

                      </tr>

                    </thead>

                    <tbody className="divide-y divide-zinc-100">

                      {loanPayments
                        .filter((p) => p.source_id === activeSource.id)
                        .map((p) => (

                          <tr key={p.id}>

                            <td className="py-3 pr-4 text-sm text-zinc-600">{p.payment_date}</td>
                            <td className="py-3 pr-4 text-sm text-zinc-600">{p.note || '—'}</td>
                            <td className="py-3 pr-4 text-right tabular-nums font-semibold text-green-600">
                              Rs. {Number(p.amount).toLocaleString('en-IN')}
                            </td>
                            {!isViewer && (
                              <td className="py-3 text-right whitespace-nowrap">

                                <button
                                  onClick={() => setDeleteTarget(p)}
                                  className="text-xs font-semibold text-red-600 hover:text-red-800"
                                >
                                  Delete
                                </button>

                              </td>
                            )}

                          </tr>

                        ))}

                    </tbody>

                  </table>

                </div>

              )}

            </div>

            <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

              <h3 className="font-bold text-lg text-zinc-900 mb-4">{activeSource.name} — Transactions</h3>

              {txns.filter((t) => t.sourceId === activeSource.id).length === 0 ? (

                <p className="text-zinc-500 text-sm">No transactions from this source yet.</p>

              ) : (

                <div className="overflow-x-auto">

                  <table className="w-full border-collapse">

                    <thead>

                      <tr className="text-left">

                        <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Date</th>
                        <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Category</th>
                        <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Remark</th>
                        <th className="pb-3 text-sm font-medium text-zinc-500 text-right">Amount</th>

                      </tr>

                    </thead>

                    <tbody className="divide-y divide-zinc-100">

                      {txns
                        .filter((t) => t.sourceId === activeSource.id)
                        .map((t) => (

                          <tr key={t.category + t.id}>

                            <td className="py-3 pr-4 text-sm text-zinc-600">{t.date}</td>
                            <td className="py-3 pr-4 text-sm text-zinc-600">{t.category}</td>
                            <td className="py-3 pr-4 text-sm text-zinc-600">{t.remark || '—'}</td>
                            <td className="py-3 text-right tabular-nums font-semibold text-red-600">
                              Rs. {t.amount.toLocaleString('en-IN')}
                            </td>

                          </tr>

                        ))}

                    </tbody>

                  </table>

                </div>

              )}

            </div>

          </>

        )}

      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this payment?"
        message={`Delete the Rs. ${Number(deleteTarget?.amount || 0).toLocaleString('en-IN')} clearing payment on ${deleteTarget?.payment_date || ''}? This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        danger
        onConfirm={confirmDeletePayment}
        onCancel={() => setDeleteTarget(null)}
      />

    </div>

  )

}
