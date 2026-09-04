'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import DatePicker from '../../components/DatePicker'
import MonthPicker from '../../components/MonthPicker'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useViewer } from '../../components/ViewerContext'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function monthLabel(month: string) {

  if (!month) return ''

  const [y, m] = month.split('-')

  const date = new Date(Number(y), Number(m) - 1, 1)

  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

}

type EntryForm = {
  date: string
  amount: string
  remark: string
}

export default function MiscExpensesPage() {

  const router = useRouter()
  const isViewer = useViewer()

  const [expenseTypes, setExpenseTypes] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [showAddType, setShowAddType] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [addingType, setAddingType] = useState(false)

  const [entryForms, setEntryForms] = useState<Record<string, EntryForm>>({})
  const [savingTypeId, setSavingTypeId] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editRemark, setEditRemark] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

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

  function formFor(typeId: string): EntryForm {
    return entryForms[typeId] || { date: todayISO(), amount: '', remark: '' }
  }

  function updateForm(typeId: string, patch: Partial<EntryForm>) {

    setEntryForms((prev) => ({
      ...prev,
      [typeId]: { ...formFor(typeId), ...patch },
    }))

  }

  async function load() {

    const { data: typeData } =
      await supabase.from('misc_expense_types').select('*').order('name')

    const { data: expenseData } =
      await supabase
        .from('misc_expenses')
        .select('*')
        .order('expense_date', { ascending: false })

    setExpenseTypes(typeData || [])
    setExpenses(expenseData || [])
    setLoading(false)

  }

  function expensesFor(typeId: string) {
    return expenses.filter(
      (e) => e.expense_type_id === typeId && (e.expense_date || '').slice(0, 7) === filterMonth
    )
  }

  function sumAmount(rows: any[]) {
    return rows.reduce((s, r) => s + Number(r.amount || 0), 0)
  }

  async function addType() {

    const name = newTypeName.trim()

    if (!name) {

      alert('Enter an expense type name')
      return

    }

    setAddingType(true)

    const { error } =
      await supabase.from('misc_expense_types').insert({ name })

    setAddingType(false)

    if (error) {

      alert('Failed to add expense type: ' + error.message)
      return

    }

    setNewTypeName('')
    setShowAddType(false)
    await load()

  }

  async function addExpense(typeId: string) {

    const form = formFor(typeId)
    const amount = Number(form.amount)

    if (!amount || amount <= 0) {

      alert('Enter a valid amount')
      return

    }

    setSavingTypeId(typeId)

    const { error } = await supabase.from('misc_expenses').insert({
      expense_type_id: typeId,
      expense_date: form.date || todayISO(),
      amount,
      remark: form.remark.trim() || null,
    })

    setSavingTypeId(null)

    if (error) {

      alert('Failed to add expense: ' + error.message)
      return

    }

    setEntryForms((prev) => ({
      ...prev,
      [typeId]: { date: form.date, amount: '', remark: '' },
    }))

    await load()

  }

  function startEdit(expense: any) {

    setEditingId(expense.id)
    setEditDate(expense.expense_date)
    setEditAmount(String(expense.amount))
    setEditRemark(expense.remark || '')

  }

  async function saveEdit() {

    const amount = Number(editAmount)

    if (!amount || amount <= 0) {

      alert('Enter a valid amount')
      return

    }

    setSavingEdit(true)

    const { error } = await supabase
      .from('misc_expenses')
      .update({
        expense_date: editDate || todayISO(),
        amount,
        remark: editRemark.trim() || null,
      })
      .eq('id', editingId)

    setSavingEdit(false)

    if (error) {

      alert('Failed to update expense: ' + error.message)
      return

    }

    setEditingId(null)
    await load()

  }

  async function confirmDelete() {

    if (!deleteTarget) return

    setDeleting(true)

    const { error } = await supabase
      .from('misc_expenses')
      .delete()
      .eq('id', deleteTarget.id)

    setDeleting(false)

    if (error) {

      alert('Failed to delete expense: ' + error.message)
      return

    }

    setDeleteTarget(null)
    await load()

  }

  const totalLifetime = sumAmount(expenses)

  const totalFilterMonth = sumAmount(
    expenses.filter((e) => (e.expense_date || '').slice(0, 7) === filterMonth)
  )

  return (

    <div className="text-black">

      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">

          <div>

            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">

              Miscellaneous Expenses

            </h1>

            <p className="text-sm text-zinc-500 mt-1">

              Track expenses by type — Fuel, Water Jar, Electricity Bill, Water Bill, Fooding, and anything else

            </p>

          </div>

          {!isViewer && (

            <button
              onClick={() => setShowAddType(true)}
              className="bg-amber-400 border border-amber-500 text-zinc-900 hover:bg-amber-500 transition-colors px-4 py-2 rounded-xl text-sm font-semibold"
            >

              + Add Expense Type

            </button>

          )}

        </div>

        <div className="flex flex-wrap gap-4 items-end">

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-red-500 px-6 py-4 min-w-[220px]">

            <p className="text-sm text-zinc-500">Total Expenses (Lifetime)</p>
            <h2 className="text-3xl font-bold tracking-tight mt-1 tabular-nums text-red-600">Rs. {totalLifetime.toLocaleString('en-IN')}</h2>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-amber-500 px-6 py-4 min-w-[220px]">

            <p className="text-sm text-zinc-500">Expenses — {monthLabel(filterMonth)}</p>
            <h2 className="text-3xl font-bold tracking-tight mt-1 tabular-nums text-amber-600">Rs. {totalFilterMonth.toLocaleString('en-IN')}</h2>

          </div>

          <div>

            <label className="text-xs font-medium text-zinc-500 mb-1 block">Month</label>

            <MonthPicker value={filterMonth} onChange={setFilterMonth} />

          </div>

        </div>

        {loading ? (

          <p className="text-zinc-500">Loading...</p>

        ) : expenseTypes.length === 0 ? (

          <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

            <p className="text-zinc-500">No expense types yet. Add one to get started.</p>

          </div>

        ) : (

          expenseTypes.map((type) => {

            const typeExpenses = expensesFor(type.id)
            const typeTotal = sumAmount(typeExpenses)
            const form = formFor(type.id)

            return (

              <div key={type.id} className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">

                  <h3 className="font-bold text-lg text-zinc-900">{type.name}</h3>

                  <span className="font-bold tabular-nums text-red-600">Rs. {typeTotal.toLocaleString('en-IN')}</span>

                </div>

                {!isViewer && (

                  <div className="flex gap-3 flex-wrap items-end mb-5">

                    <DatePicker value={form.date} onChange={(v) => updateForm(type.id, { date: v })} />

                    <input
                      type="number"
                      value={form.amount}
                      onChange={(e) => updateForm(type.id, { amount: e.target.value })}
                      placeholder="Amount"
                      className="border border-zinc-300 rounded-xl px-4 py-2.5 w-40"
                    />

                    <input
                      value={form.remark}
                      onChange={(e) => updateForm(type.id, { remark: e.target.value })}
                      placeholder="Remark (optional)"
                      className="border border-zinc-300 rounded-xl px-4 py-2.5 flex-1 min-w-[180px]"
                    />

                    <button
                      onClick={() => addExpense(type.id)}
                      disabled={savingTypeId === type.id}
                      className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50"
                    >

                      {savingTypeId === type.id ? 'Saving...' : 'Add Expense'}

                    </button>

                  </div>

                )}

                {typeExpenses.length === 0 ? (

                  <p className="text-zinc-500 text-sm">No expenses recorded for this type in {monthLabel(filterMonth)}.</p>

                ) : (

                  <div className="overflow-x-auto">

                    <table className="w-full border-collapse">

                      <thead>

                        <tr className="text-left">

                          <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Date</th>
                          <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">Remark</th>
                          <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">Amount</th>
                          {!isViewer && (
                            <th className="pb-3 text-sm font-medium text-zinc-500 text-right">Actions</th>
                          )}

                        </tr>

                      </thead>

                      <tbody className="divide-y divide-zinc-100">

                        {typeExpenses.map((e) =>

                          !isViewer && editingId === e.id ? (

                            <tr key={e.id} className="bg-indigo-50/40">

                              <td className="py-2.5 pr-4">
                                <DatePicker value={editDate} onChange={setEditDate} />
                              </td>

                              <td className="py-2.5 pr-4">
                                <input
                                  value={editRemark}
                                  onChange={(ev) => setEditRemark(ev.target.value)}
                                  placeholder="Remark"
                                  className="border border-zinc-300 rounded-lg px-3 py-1.5 text-sm w-full"
                                />
                              </td>

                              <td className="py-2.5 pr-4 text-right">
                                <input
                                  type="number"
                                  value={editAmount}
                                  onChange={(ev) => setEditAmount(ev.target.value)}
                                  className="border border-zinc-300 rounded-lg px-3 py-1.5 text-sm w-28 text-right"
                                />
                              </td>

                              <td className="py-2.5 text-right whitespace-nowrap">

                                <button
                                  onClick={saveEdit}
                                  disabled={savingEdit}
                                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 mr-3 disabled:opacity-50"
                                >
                                  {savingEdit ? 'Saving...' : 'Save'}
                                </button>

                                <button
                                  onClick={() => setEditingId(null)}
                                  disabled={savingEdit}
                                  className="text-xs font-semibold text-zinc-500 hover:text-zinc-700 disabled:opacity-50"
                                >
                                  Cancel
                                </button>

                              </td>

                            </tr>

                          ) : (

                            <tr key={e.id}>

                              <td className="py-3 pr-4 text-sm text-zinc-600">{e.expense_date}</td>
                              <td className="py-3 pr-4 text-sm text-zinc-600">{e.remark || '—'}</td>
                              <td className="py-3 pr-4 text-right tabular-nums font-semibold text-zinc-900">
                                Rs. {Number(e.amount).toLocaleString('en-IN')}
                              </td>
                              {!isViewer && (
                                <td className="py-3 text-right whitespace-nowrap">

                                  <button
                                    onClick={() => startEdit(e)}
                                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 mr-3"
                                  >
                                    Edit
                                  </button>

                                  <button
                                    onClick={() => setDeleteTarget(e)}
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

          })

        )}

      </div>

      {showAddType && (

        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowAddType(false)}
        >

          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[24px] shadow-2xl border border-zinc-200 w-full max-w-sm p-6"
          >

            <h3 className="font-bold text-lg text-zinc-900 mb-4">Add Expense Type</h3>

            <input
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="e.g. Fuel, Water Jar, Electricity Bill"
              autoFocus
              className="w-full border border-zinc-300 rounded-xl px-4 py-2.5"
            />

            <div className="flex justify-end gap-3 mt-6">

              <button
                onClick={() => setShowAddType(false)}
                disabled={addingType}
                className="bg-white border border-zinc-300 text-zinc-700 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50"
              >

                Cancel

              </button>

              <button
                onClick={addType}
                disabled={addingType}
                className="bg-amber-400 border border-amber-500 text-zinc-900 hover:bg-amber-500 transition-colors px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              >

                {addingType ? 'Adding...' : 'Add Type'}

              </button>

            </div>

          </div>

        </div>

      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this expense?"
        message={`Delete the Rs. ${Number(deleteTarget?.amount || 0).toLocaleString('en-IN')} expense on ${deleteTarget?.expense_date || ''}? This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

    </div>

  )

}
