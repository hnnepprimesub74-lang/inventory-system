'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import MonthPicker from '../../../components/MonthPicker'
import ConfirmDialog from '../../../components/ConfirmDialog'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function rateForMonth(rates: any[], month: string) {

  const applicable = rates
    .filter((r) => r.effective_month <= month)
    .sort((a, b) => b.effective_month.localeCompare(a.effective_month))

  return applicable[0]?.rate ?? 0

}

export default function StaffLedgerPage() {

  const router = useRouter()
  const params = useParams()
  const staffId = params?.id as string

  const [staffMember, setStaffMember] = useState<any>(null)
  const [salaryRecords, setSalaryRecords] = useState<any[]>([])
  const [salaryRates, setSalaryRates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [newRateMonth, setNewRateMonth] = useState(currentMonth())
  const [newRateAmount, setNewRateAmount] = useState('')
  const [confirmNewRate, setConfirmNewRate] = useState(false)
  const [savingRate, setSavingRate] = useState(false)

  const [salaryMonth, setSalaryMonth] = useState(currentMonth())
  const [salaryAmount, setSalaryAmount] = useState('')
  const [salaryPaidDate, setSalaryPaidDate] = useState('')
  const [salaryNote, setSalaryNote] = useState('')
  const [saving, setSaving] = useState(false)

  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)

  useEffect(() => {

    async function init() {

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {

        router.push('/login')
        return

      }

      if (staffId) {
        await load()
      }

    }

    init()

  }, [staffId])

  async function load() {

    const { data: staffData } =
      await supabase.from('staff').select('*').eq('id', staffId).single()

    const { data: salaryData } =
      await supabase
        .from('staff_salary')
        .select('*')
        .eq('staff_id', staffId)
        .order('month', { ascending: false })

    const { data: rateData } =
      await supabase
        .from('staff_salary_rates')
        .select('*')
        .eq('staff_id', staffId)
        .order('effective_month', { ascending: false })

    const rates = rateData || []

    setStaffMember(staffData || null)
    setSalaryRecords(salaryData || [])
    setSalaryRates(rates)
    setLoading(false)

    setSalaryAmount((prev) => prev || String(rateForMonth(rates, salaryMonth) || ''))

  }

  function updateSalaryMonth(month: string) {

    setSalaryMonth(month)

    const applicable = rateForMonth(salaryRates, month)

    if (applicable) {
      setSalaryAmount(String(applicable))
    }

  }

  async function confirmAddRate() {

    const amount = Number(newRateAmount) || 0

    setConfirmNewRate(false)
    setSavingRate(true)

    const { error } = await supabase
      .from('staff_salary_rates')
      .upsert(
        { staff_id: staffId, effective_month: newRateMonth, rate: amount },
        { onConflict: 'staff_id,effective_month' }
      )

    setSavingRate(false)

    if (error) {

      alert('Failed to set monthly salary: ' + error.message)
      return

    }

    setNewRateAmount('')
    await load()

  }

  async function addSalaryRecord() {

    const amount = Number(salaryAmount)

    if (!amount || amount <= 0) {

      alert('Enter a valid amount')
      return

    }

    if (!salaryMonth) {

      alert('Pick a month')
      return

    }

    setSaving(true)

    const { error } = await supabase.from('staff_salary').insert({
      staff_id: staffId,
      month: salaryMonth,
      amount,
      paid_date: salaryPaidDate || new Date().toISOString().slice(0, 10),
      note: salaryNote.trim() || null,
    })

    setSaving(false)

    if (error) {

      alert('Failed to add salary record: ' + error.message)
      return

    }

    setSalaryPaidDate('')
    setSalaryNote('')
    await load()

  }

  const totalPaid = salaryRecords.reduce((s, r) => s + Number(r.amount || 0), 0)
  const thisMonth = currentMonth()
  const currentSalaryRate = rateForMonth(salaryRates, thisMonth)

  function monthLabel(month: string) {

    if (!month) return ''

    const [y, m] = month.split('-')

    const date = new Date(Number(y), Number(m) - 1, 1)

    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  }

  const monthGroups = Object.values(
    salaryRecords.reduce((acc: any, r) => {

      const key = r.month || 'Unknown'

      if (!acc[key]) {

        acc[key] = { month: key, total: 0, records: [] }

      }

      acc[key].total += Number(r.amount || 0)
      acc[key].records.push(r)

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

              {staffMember?.name || 'Staff'}

            </h1>

            <p className="text-sm text-zinc-500 mt-1">

              {staffMember?.phone || 'No phone on file'} · Monthly salary records

            </p>

          </div>

          <button
            onClick={() => router.push('/staff')}
            className="bg-white border border-zinc-200 text-zinc-700 px-5 py-3 rounded-2xl font-bold hover:bg-zinc-50"
          >

            Back to Staff

          </button>

        </div>

        <div className="flex flex-wrap gap-4">

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-zinc-900 px-6 py-4 min-w-[220px]">

            <p className="text-sm text-zinc-500">Salary Rate — {monthLabel(thisMonth)}</p>
            <h2 className="text-2xl font-bold tracking-tight mt-1 tabular-nums">Rs. {currentSalaryRate.toLocaleString('en-IN')}</h2>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-green-600 px-6 py-4 min-w-[220px]">

            <p className="text-sm text-zinc-500">Total Salary Paid (Lifetime)</p>
            <h2 className="text-2xl font-bold tracking-tight mt-1 tabular-nums text-green-600">Rs. {totalPaid.toLocaleString('en-IN')}</h2>

          </div>

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <h3 className="font-bold text-lg text-zinc-900 mb-4">Set Monthly Salary</h3>

          <p className="text-xs text-zinc-400 mb-4">

            Set the salary rate effective from a given month onward — e.g. Rs. 15,000 from Jan 2026, then Rs. 18,000 from Oct 2026 onward.

          </p>

          <div className="flex gap-3 flex-wrap">

            <MonthPicker value={newRateMonth} onChange={setNewRateMonth} />

            <input
              type="number"
              value={newRateAmount}
              onChange={(e) => setNewRateAmount(e.target.value)}
              placeholder="Salary amount"
              className="border border-zinc-300 rounded-xl px-4 py-2.5 w-48"
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

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <h3 className="font-bold text-lg text-zinc-900 mb-4">Add Salary Record</h3>

          <div className="flex gap-3 flex-wrap">

            <MonthPicker value={salaryMonth} onChange={updateSalaryMonth} />

            <input
              type="number"
              value={salaryAmount}
              onChange={(e) => setSalaryAmount(e.target.value)}
              placeholder="Amount"
              className="border border-zinc-300 rounded-xl px-4 py-2.5 w-40"
            />

            <input
              type="date"
              value={salaryPaidDate}
              onChange={(e) => setSalaryPaidDate(e.target.value)}
              className="border border-zinc-300 rounded-xl px-4 py-2.5"
            />

            <input
              value={salaryNote}
              onChange={(e) => setSalaryNote(e.target.value)}
              placeholder="Note (optional)"
              className="border border-zinc-300 rounded-xl px-4 py-2.5 flex-1 min-w-[180px]"
            />

            <button
              onClick={addSalaryRecord}
              disabled={saving}
              className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50"
            >

              {saving ? 'Saving...' : 'Add Record'}

            </button>

          </div>

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <h3 className="font-bold text-lg text-zinc-900 mb-4">Salary History</h3>

          {monthGroups.length === 0 ? (

            <p className="text-zinc-500">No salary records yet.</p>

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
                              <th className="py-2.5 px-5 text-xs font-medium text-zinc-500 text-right">Amount</th>

                            </tr>

                          </thead>

                          <tbody className="divide-y divide-zinc-100">

                            {group.records.map((r: any) => (

                              <tr key={r.id}>

                                <td className="py-2.5 px-5 text-sm text-zinc-600">{r.paid_date}</td>
                                <td className="py-2.5 px-5 text-sm text-zinc-600">{r.note || '—'}</td>
                                <td className="py-2.5 px-5 text-right tabular-nums font-semibold text-zinc-900">
                                  Rs. {Number(r.amount).toLocaleString('en-IN')}
                                </td>

                              </tr>

                            ))}

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
        title="Set Monthly Salary?"
        message={`Set the monthly salary for ${staffMember?.name || 'this staff member'} to Rs. ${(Number(newRateAmount) || 0).toLocaleString('en-IN')}, effective from ${monthLabel(newRateMonth)} onward?`}
        confirmLabel="Yes, Set Rate"
        onConfirm={confirmAddRate}
        onCancel={() => setConfirmNewRate(false)}
      />

    </div>

  )

}
