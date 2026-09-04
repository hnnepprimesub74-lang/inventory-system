'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import MonthPicker from '../../components/MonthPicker'
import { useViewer } from '../../components/ViewerContext'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function rateForMonth(rates: any[], month: string) {

  const applicable = rates
    .filter((r) => r.effective_month <= month)
    .sort((a, b) => b.effective_month.localeCompare(a.effective_month))

  return applicable[0]?.rate ?? 0

}

export default function StaffPage() {

  const router = useRouter()
  const isViewer = useViewer()

  const [staff, setStaff] = useState<any[]>([])
  const [salaryRecords, setSalaryRecords] = useState<any[]>([])
  const [salaryRates, setSalaryRates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [showAddStaff, setShowAddStaff] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [adding, setAdding] = useState(false)

  const [filterMonth, setFilterMonth] = useState(currentMonth())

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

    const { data: staffData } =
      await supabase.from('staff').select('*').order('name')

    const { data: salaryData } =
      await supabase.from('staff_salary').select('*')

    const { data: rateData } =
      await supabase.from('staff_salary_rates').select('*')

    setStaff(staffData || [])
    setSalaryRecords(salaryData || [])
    setSalaryRates(rateData || [])
    setLoading(false)

  }

  function sumAmount(rows: any[]) {
    return rows.reduce((s, r) => s + Number(r.amount || 0), 0)
  }

  function salaryFor(staffId: any) {
    return salaryRecords.filter((r) => r.staff_id === staffId)
  }

  function ratesFor(staffId: any) {
    return salaryRates.filter((r) => r.staff_id === staffId)
  }

  async function addStaff() {

    const name = newName.trim()

    if (!name) {

      alert('Enter staff name')
      return

    }

    setAdding(true)

    const { error } =
      await supabase.from('staff').insert({
        name,
        phone: newPhone.trim() || null,
      })

    setAdding(false)

    if (error) {

      alert('Failed to add staff: ' + error.message)
      return

    }

    setNewName('')
    setNewPhone('')
    setShowAddStaff(false)
    await load()

  }

  const totalSalaryLifetime = sumAmount(salaryRecords)

  const staffRows = staff.map((s) => {

    const records = salaryFor(s.id)
    const totalPaid = sumAmount(records)
    const monthRecords = records.filter((r) => r.month === filterMonth)
    const paidInMonth = sumAmount(monthRecords)
    const rateForFilterMonth = rateForMonth(ratesFor(s.id), filterMonth)

    return { ...s, totalPaid, paidInMonth, rateForFilterMonth }

  })

  const totalSalaryForMonth = staffRows.reduce((s, r) => s + r.paidInMonth, 0)

  function monthLabel(month: string) {

    if (!month) return ''

    const [y, m] = month.split('-')

    const date = new Date(Number(y), Number(m) - 1, 1)

    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  }

  return (

    <div className="text-black">

      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">

          <div>

            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">

              Staff

            </h1>

            <p className="text-sm text-zinc-500 mt-1">

              Staff members and their monthly salary records

            </p>

          </div>

          {!isViewer && (

            <button
              onClick={() => setShowAddStaff(true)}
              className="bg-amber-400 border border-amber-500 text-zinc-900 hover:bg-amber-500 transition-colors px-4 py-2 rounded-xl text-sm font-semibold"
            >

              + Add Staff

            </button>

          )}

        </div>

        <div className="flex flex-wrap gap-4">

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-zinc-900 px-6 py-4 min-w-[220px]">

            <p className="text-sm text-zinc-500">

              Total Salary Paid (Lifetime)

            </p>

            <h2 className="text-3xl font-bold tracking-tight mt-1 tabular-nums">

              Rs. {totalSalaryLifetime.toLocaleString('en-IN')}

            </h2>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-indigo-600 px-6 py-4 min-w-[220px]">

            <p className="text-sm text-zinc-500">

              Salary Paid — {monthLabel(filterMonth)}

            </p>

            <h2 className="text-3xl font-bold tracking-tight mt-1 tabular-nums text-indigo-600">

              Rs. {totalSalaryForMonth.toLocaleString('en-IN')}

            </h2>

          </div>

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">

            <h3 className="font-bold text-lg text-zinc-900">

              Staff Members

            </h3>

            <div className="flex items-center gap-2">

              <label className="text-xs font-medium text-zinc-500">Month</label>

              <MonthPicker value={filterMonth} onChange={setFilterMonth} />

            </div>

          </div>

          {loading ? (

            <p className="text-zinc-500">Loading...</p>

          ) : staffRows.length === 0 ? (

            <p className="text-zinc-500">No staff added yet.</p>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full border-collapse">

                <thead>

                  <tr className="text-left">

                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Name</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Phone</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Monthly Salary</th>
                    <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Total Salary Paid</th>
                    <th className="pb-3 text-sm font-medium text-zinc-500 text-right">{monthLabel(filterMonth)}</th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-zinc-100">

                  {staffRows.map((s) => (

                    <tr
                      key={s.id}
                      onClick={() => router.push('/staff/' + s.id)}
                      className="cursor-pointer hover:bg-zinc-50"
                    >

                      <td className="py-3 pr-4 font-semibold text-zinc-900">{s.name}</td>
                      <td className="py-3 pr-4 text-sm text-zinc-600">{s.phone || '—'}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {s.rateForFilterMonth > 0 ? `Rs. ${s.rateForFilterMonth.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">Rs. {s.totalPaid.toLocaleString('en-IN')}</td>
                      <td className="py-3 text-right">

                        {s.paidInMonth > 0 ? (

                          <span className="font-semibold tabular-nums text-green-700">
                            Rs. {s.paidInMonth.toLocaleString('en-IN')}
                          </span>

                        ) : (

                          <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-semibold">
                            Not Paid
                          </span>

                        )}

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </div>

      {showAddStaff && (

        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowAddStaff(false)}
        >

          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[24px] shadow-2xl border border-zinc-200 w-full max-w-sm p-6"
          >

            <h3 className="font-bold text-lg text-zinc-900 mb-4">

              Add Staff

            </h3>

            <div className="space-y-3">

              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Staff name"
                autoFocus
                className="w-full border border-zinc-300 rounded-xl px-4 py-2.5"
              />

              <input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Phone number"
                className="w-full border border-zinc-300 rounded-xl px-4 py-2.5"
              />

            </div>

            <div className="flex justify-end gap-3 mt-6">

              <button
                onClick={() => setShowAddStaff(false)}
                disabled={adding}
                className="bg-white border border-zinc-300 text-zinc-700 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50"
              >

                Cancel

              </button>

              <button
                onClick={addStaff}
                disabled={adding}
                className="bg-amber-400 border border-amber-500 text-zinc-900 hover:bg-amber-500 transition-colors px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              >

                {adding ? 'Adding...' : 'Add Staff'}

              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  )

}
