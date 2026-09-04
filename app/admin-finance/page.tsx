'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import MonthPicker from '../../components/MonthPicker'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useViewer } from '../../components/ViewerContext'
import SourceSelect, { CashSource, defaultSourceId } from '../../components/SourceSelect'

const DEFAULT_ADMIN_SALARY = 35000

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function monthLabel(month: string) {

  if (!month) return ''

  const [y, m] = month.split('-')

  const date = new Date(Number(y), Number(m) - 1, 1)

  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

}

function rateForMonth(rates: any[], month: string) {

  const applicable = rates
    .filter((r) => r.effective_month <= month)
    .sort((a, b) => b.effective_month.localeCompare(a.effective_month))

  return applicable[0]?.rate ?? DEFAULT_ADMIN_SALARY

}

export default function AdminFinancePage() {

  const router = useRouter()
  const isViewer = useViewer()

  const [salaryRates, setSalaryRates] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [sources, setSources] = useState<CashSource[]>([])
  const [loading, setLoading] = useState(true)

  const [newRateMonth, setNewRateMonth] = useState(currentMonth())
  const [newRateAmount, setNewRateAmount] = useState('')
  const [confirmNewRate, setConfirmNewRate] = useState(false)
  const [savingRate, setSavingRate] = useState(false)

  const [payMonth, setPayMonth] = useState(currentMonth())
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState('')
  const [payNote, setPayNote] = useState('')
  const [paySourceId, setPaySourceId] = useState('')
  const [saving, setSaving] = useState(false)

  const [filterMonth, setFilterMonth] = useState(currentMonth())
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)

  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editSourceId, setEditSourceId] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

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

    const { data: ratesData } =
      await supabase
        .from('admin_salary_rates')
        .select('*')
        .order('effective_month', { ascending: false })

    const { data: paymentsData } =
      await supabase
        .from('admin_salary')
        .select('*')
        .order('month', { ascending: false })

    const { data: sourceData } =
      await supabase.from('cash_sources').select('*').order('name')

    const rates = ratesData || []
    const sourceRows = sourceData || []

    setSalaryRates(rates)
    setPayments(paymentsData || [])
    setSources(sourceRows)
    setLoading(false)

    setPayAmount((prev) => prev || String(rateForMonth(rates, payMonth) || ''))
    setPaySourceId((prev) => prev || defaultSourceId(sourceRows))

  }

  function updatePayMonth(month: string) {

    setPayMonth(month)

    const applicable = rateForMonth(salaryRates, month)

    if (applicable) {
      setPayAmount(String(applicable))
    }

  }

  async function confirmAddRate() {

    const amount = Number(newRateAmount) || 0

    setConfirmNewRate(false)
    setSavingRate(true)

    const { error } = await supabase
      .from('admin_salary_rates')
      .upsert(
        { effective_month: newRateMonth, rate: amount },
        { onConflict: 'effective_month' }
      )

    setSavingRate(false)

    if (error) {

      alert('Failed to set admin salary: ' + error.message)
      return

    }

    setNewRateAmount('')
    await load()

  }

  async function addPayment() {

    const amount = Number(payAmount)

    if (!amount || amount <= 0) {

      alert('Enter a valid amount')
      return

    }

    if (!payMonth) {

      alert('Pick a month')
      return

    }

    setSaving(true)

    const { error } = await supabase.from('admin_salary').insert({
      month: payMonth,
      amount,
      paid_date: payDate || new Date().toISOString().slice(0, 10),
      note: payNote.trim() || null,
      source_id: paySourceId || defaultSourceId(sources),
    })

    setSaving(false)

    if (error) {

      alert('Failed to add admin salary payment: ' + error.message)
      return

    }

    setPayDate('')
    setPayNote('')
    await load()

  }

  function startEditPayment(p: any) {

    setEditingPaymentId(p.id)
    setEditAmount(String(p.amount))
    setEditDate(p.paid_date)
    setEditNote(p.note || '')
    setEditSourceId(p.source_id || defaultSourceId(sources))

  }

  async function saveEditPayment(id: string) {

    const amount = Number(editAmount)

    if (!amount || amount <= 0) {

      alert('Enter a valid amount')
      return

    }

    setSavingEdit(true)

    const { error } = await supabase
      .from('admin_salary')
      .update({
        amount,
        paid_date: editDate || new Date().toISOString().slice(0, 10),
        note: editNote.trim() || null,
        source_id: editSourceId || defaultSourceId(sources),
      })
      .eq('id', id)

    setSavingEdit(false)

    if (error) {

      alert('Failed to update payment: ' + error.message)
      return

    }

    setEditingPaymentId(null)
    await load()

  }

  async function confirmDeletePayment() {

    if (!deleteTarget) return

    setDeleting(true)

    const { error } = await supabase
      .from('admin_salary')
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

  const totalPaidLifetime = payments.reduce((s, p) => s + Number(p.amount || 0), 0)

  const thisMonth = currentMonth()
  const paidThisMonth = payments.some((p) => p.month === thisMonth)
  const currentRate = rateForMonth(salaryRates, thisMonth)

  const salaryForFilterMonth = payments
    .filter((p) => p.month === filterMonth)
    .reduce((s, p) => s + Number(p.amount || 0), 0)

  const monthGroups = Object.values(
    payments.reduce((acc: any, p) => {

      const key = p.month || 'Unknown'

      if (!acc[key]) {

        acc[key] = { month: key, total: 0, records: [] }

      }

      acc[key].total += Number(p.amount || 0)
      acc[key].records.push(p)

      return acc

    }, {})
  ).sort((a: any, b: any) => (b.month || '').localeCompare(a.month || ''))

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

              Admin Finance

            </h1>

            <p className="text-sm text-zinc-500 mt-1">

              Admin's monthly salary rate and payments — defaults to Rs. {DEFAULT_ADMIN_SALARY.toLocaleString('en-IN')}, changeable per month

            </p>

          </div>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-zinc-900 px-6 py-4">

            <p className="text-sm text-zinc-500">Admin Salary — {monthLabel(thisMonth)}</p>
            <h2 className="text-2xl font-bold tracking-tight mt-1 tabular-nums">Rs. {currentRate.toLocaleString('en-IN')}</h2>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-green-600 px-6 py-4">

            <p className="text-sm text-zinc-500">Total Paid (Lifetime)</p>
            <h2 className="text-2xl font-bold tracking-tight mt-1 tabular-nums text-green-600">Rs. {totalPaidLifetime.toLocaleString('en-IN')}</h2>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-amber-500 px-6 py-4">

            <p className="text-sm text-zinc-500">This Month ({monthLabel(thisMonth)})</p>
            <h2 className={`text-2xl font-bold tracking-tight mt-1 ${paidThisMonth ? 'text-green-600' : 'text-amber-600'}`}>
              {paidThisMonth ? 'Paid' : 'Not Paid'}
            </h2>

          </div>

        </div>

        {!isViewer && (

          <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

            <h3 className="font-bold text-lg text-zinc-900 mb-4">Set Monthly Admin Salary</h3>

            <p className="text-xs text-zinc-400 mb-4">

              Defaults to Rs. {DEFAULT_ADMIN_SALARY.toLocaleString('en-IN')}. Set a new rate effective from a given month onward — e.g. Rs. 40,000 from Oct 2026 onward.

            </p>

            <div className="flex gap-3 flex-wrap mb-5">

              <MonthPicker value={newRateMonth} onChange={setNewRateMonth} />

              <input
                type="number"
                value={newRateAmount}
                onChange={(e) => setNewRateAmount(e.target.value)}
                placeholder={`Salary amount (default Rs. ${DEFAULT_ADMIN_SALARY.toLocaleString('en-IN')})`}
                className="border border-zinc-300 rounded-xl px-4 py-2.5 w-64"
              />

              <button
                onClick={() => {

                  if (!Number(newRateAmount) || Number(newRateAmount) <= 0) {

                    alert('Enter a valid amount')
                    return

                  }

                  setConfirmNewRate(true)

                }}
                disabled={savingRate}
                className="bg-zinc-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              >

                {savingRate ? 'Saving...' : 'Set Rate'}

              </button>

            </div>

          </div>

        )}

        {!isViewer && (

          <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

            <h3 className="font-bold text-lg text-zinc-900 mb-4">Add Admin Salary Payment</h3>

            <div className="flex gap-3 flex-wrap">

              <MonthPicker value={payMonth} onChange={updatePayMonth} />

              <input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Amount"
                className="border border-zinc-300 rounded-xl px-4 py-2.5 w-40"
              />

              <input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="border border-zinc-300 rounded-xl px-4 py-2.5"
              />

              <input
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="Note (optional)"
                className="border border-zinc-300 rounded-xl px-4 py-2.5 flex-1 min-w-[180px]"
              />

              <SourceSelect
                sources={sources}
                value={paySourceId}
                onChange={setPaySourceId}
                onSourceAdded={(s) => setSources((prev) => [...prev, s])}
                className="border border-zinc-300 rounded-xl px-4 py-2.5"
              />

              <button
                onClick={addPayment}
                disabled={saving}
                className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50"
              >

                {saving ? 'Saving...' : 'Add Payment'}

              </button>

            </div>

          </div>

        )}

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">

            <h3 className="font-bold text-lg text-zinc-900">Check a Month</h3>

            <div className="flex items-center gap-2">

              <label className="text-xs font-medium text-zinc-500">Month</label>

              <MonthPicker value={filterMonth} onChange={setFilterMonth} />

            </div>

          </div>

          <div className="flex gap-4 flex-wrap">

            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 inline-block">

              <p className="text-sm text-zinc-500">Rate for {monthLabel(filterMonth)}</p>
              <p className="text-2xl font-bold tabular-nums text-indigo-700 mt-1">Rs. {rateForMonth(salaryRates, filterMonth).toLocaleString('en-IN')}</p>

            </div>

            <div className="bg-green-50 border border-green-100 rounded-2xl px-5 py-4 inline-block">

              <p className="text-sm text-zinc-500">Paid for {monthLabel(filterMonth)}</p>
              <p className="text-2xl font-bold tabular-nums text-green-700 mt-1">Rs. {salaryForFilterMonth.toLocaleString('en-IN')}</p>

            </div>

          </div>

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <h3 className="font-bold text-lg text-zinc-900 mb-4">Payment History</h3>

          {monthGroups.length === 0 ? (

            <p className="text-zinc-500">No admin salary payments recorded yet.</p>

          ) : (

            <div className="space-y-3">

              {monthGroups.map((group: any) => {

                const isOpen = expandedMonth === group.month

                return (

                  <div
                    key={group.month}
                    className="border border-zinc-200 rounded-2xl overflow-hidden"
                  >

                    <button
                      onClick={() =>
                        setExpandedMonth(isOpen ? null : group.month)
                      }
                      className="w-full flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-50 transition-colors text-left"
                    >

                      <div className="flex items-center gap-3">

                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        >
                          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>

                        <span className="font-semibold text-zinc-900">{monthLabel(group.month)}</span>

                        <span className="text-xs text-zinc-400">
                          {group.records.length} {group.records.length === 1 ? 'entry' : 'entries'}
                        </span>

                      </div>

                      <span className="font-bold tabular-nums text-zinc-900">
                        Rs. {group.total.toLocaleString('en-IN')}
                      </span>

                    </button>

                    {isOpen && (

                      <div className="border-t border-zinc-200 overflow-x-auto">

                        <table className="w-full border-collapse">

                          <thead>

                            <tr className="text-left bg-zinc-50">

                              <th className="py-2.5 px-5 text-xs font-medium text-zinc-500">Paid Date</th>
                              <th className="py-2.5 px-5 text-xs font-medium text-zinc-500">Note</th>
                              <th className="py-2.5 px-5 text-xs font-medium text-zinc-500">Source</th>
                              <th className="py-2.5 px-5 text-xs font-medium text-zinc-500 text-right">Amount</th>
                              {!isViewer && (
                                <th className="py-2.5 px-5 text-xs font-medium text-zinc-500 text-right">Actions</th>
                              )}

                            </tr>

                          </thead>

                          <tbody className="divide-y divide-zinc-100">

                            {group.records.map((p: any) =>

                              !isViewer && editingPaymentId === p.id ? (

                                <tr key={p.id} className="bg-indigo-50/40">

                                  <td className="py-2.5 px-5">
                                    <input
                                      type="date"
                                      value={editDate}
                                      onChange={(e) => setEditDate(e.target.value)}
                                      className="border border-zinc-300 rounded-lg px-2.5 py-1.5 text-sm w-full"
                                    />
                                  </td>
                                  <td className="py-2.5 px-5">
                                    <input
                                      value={editNote}
                                      onChange={(e) => setEditNote(e.target.value)}
                                      placeholder="Note"
                                      className="border border-zinc-300 rounded-lg px-2.5 py-1.5 text-sm w-full"
                                    />
                                  </td>
                                  <td className="py-2.5 px-5">
                                    <SourceSelect
                                      sources={sources}
                                      value={editSourceId}
                                      onChange={setEditSourceId}
                                      onSourceAdded={(s) => setSources((prev) => [...prev, s])}
                                      className="border border-zinc-300 rounded-lg px-2.5 py-1.5 text-sm"
                                    />
                                  </td>
                                  <td className="py-2.5 px-5 text-right">
                                    <input
                                      type="number"
                                      value={editAmount}
                                      onChange={(e) => setEditAmount(e.target.value)}
                                      className="border border-zinc-300 rounded-lg px-2.5 py-1.5 text-sm w-28 text-right"
                                    />
                                  </td>
                                  <td className="py-2.5 px-5 text-right whitespace-nowrap">

                                    <button
                                      onClick={() => saveEditPayment(p.id)}
                                      disabled={savingEdit}
                                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 mr-3 disabled:opacity-50"
                                    >
                                      {savingEdit ? 'Saving...' : 'Save'}
                                    </button>

                                    <button
                                      onClick={() => setEditingPaymentId(null)}
                                      disabled={savingEdit}
                                      className="text-xs font-semibold text-zinc-500 hover:text-zinc-700 disabled:opacity-50"
                                    >
                                      Cancel
                                    </button>

                                  </td>

                                </tr>

                              ) : (

                                <tr key={p.id}>

                                  <td className="py-2.5 px-5 text-sm text-zinc-600">{p.paid_date}</td>
                                  <td className="py-2.5 px-5 text-sm text-zinc-600">{p.note || '—'}</td>
                                  <td className="py-2.5 px-5 text-sm text-zinc-600">
                                    {sources.find((s) => s.id === p.source_id)?.name || '—'}
                                  </td>
                                  <td className="py-2.5 px-5 text-right tabular-nums font-semibold text-zinc-900">
                                    Rs. {Number(p.amount).toLocaleString('en-IN')}
                                  </td>
                                  {!isViewer && (
                                    <td className="py-2.5 px-5 text-right whitespace-nowrap">

                                      <button
                                        onClick={() => startEditPayment(p)}
                                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 mr-3"
                                      >
                                        Edit
                                      </button>

                                      <button
                                        onClick={() => setDeleteTarget(p)}
                                        className="text-xs font-semibold text-red-600 hover:text-red-800"
                                      >
                                        Delete
                                      </button>

                                    </td>
                                  )}

                                </tr>

                              )
                            )}

                          </tbody>

                        </table>

                      </div>

                    )}

                  </div>

                )

              })}

            </div>

          )}

        </div>

      </div>

      <ConfirmDialog
        open={confirmNewRate}
        title="Set Admin Salary?"
        message={`Set the admin salary to Rs. ${(Number(newRateAmount) || 0).toLocaleString('en-IN')}, effective from ${monthLabel(newRateMonth)} onward?`}
        confirmLabel="Yes, Set Rate"
        onConfirm={confirmAddRate}
        onCancel={() => setConfirmNewRate(false)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this payment?"
        message={`Delete the Rs. ${Number(deleteTarget?.amount || 0).toLocaleString('en-IN')} admin salary payment for ${monthLabel(deleteTarget?.month || '')}${deleteTarget?.paid_date ? ' (' + deleteTarget.paid_date + ')' : ''}? This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        danger
        onConfirm={confirmDeletePayment}
        onCancel={() => setDeleteTarget(null)}
      />

    </div>

  )

}
