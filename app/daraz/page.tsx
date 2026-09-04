'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import MonthPicker from '../../components/MonthPicker'
import DatePicker from '../../components/DatePicker'
import ConfirmDialog from '../../components/ConfirmDialog'
import LineChart from '../../components/LineChart'
import { useViewer } from '../../components/ViewerContext'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

const STORE_COLORS = [
  '#534AB7', '#0F6E56', '#993C1D', '#993556',
  '#185FA5', '#3B6D11', '#854F0B', '#A32D2D', '#5F5E5A',
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function subtractDays(dateStr: string, days: number) {

  const d = new Date(dateStr + 'T00:00:00')

  d.setDate(d.getDate() - days)

  return d.toISOString().slice(0, 10)

}

function formatDateLabel(dateStr: string) {

  if (!dateStr) return ''

  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

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

export default function DarazCashInPage() {

  const router = useRouter()
  const isViewer = useViewer()

  const [stores, setStores] = useState<any[]>([])
  const [cashouts, setCashouts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [showAddStore, setShowAddStore] = useState(false)
  const [newStoreName, setNewStoreName] = useState('')
  const [newStoreType, setNewStoreType] = useState('physical')
  const [addingStore, setAddingStore] = useState(false)

  const [cashoutDate, setCashoutDate] = useState(todayISO())
  const [statementFrom, setStatementFrom] = useState('')
  const [statementTo, setStatementTo] = useState('')
  const [entryAmounts, setEntryAmounts] = useState<Record<string, string>>({})
  const [savingCashout, setSavingCashout] = useState(false)
  const [confirmSaveStep, setConfirmSaveStep] = useState(0)

  const [historyMonth, setHistoryMonth] = useState(currentMonth())

  const [editingCell, setEditingCell] = useState<{ date: string; storeId: string } | null>(null)
  const [editAmount, setEditAmount] = useState('')
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

  useEffect(() => {

    const next: Record<string, string> = {}

    stores.forEach((s) => {

      const existing = cashouts.find(
        (c) => c.store_id === s.id && c.cashout_date === cashoutDate
      )

      next[s.id] = existing ? String(existing.amount) : ''

    })

    setEntryAmounts(next)

    const anyExisting = cashouts.find((c) => c.cashout_date === cashoutDate)

    setStatementFrom(anyExisting?.statement_from || '')
    setStatementTo(anyExisting?.statement_to || '')

  }, [cashoutDate, stores, cashouts])

  async function load() {

    const { data: storeData } =
      await supabase.from('daraz_stores').select('*').order('name')

    const { data: cashoutData } =
      await supabase
        .from('daraz_cashouts')
        .select('*')
        .order('cashout_date', { ascending: false })

    setStores(storeData || [])
    setCashouts(cashoutData || [])
    setLoading(false)

  }

  function updateStatementTo(to: string) {

    setStatementTo(to)
    setStatementFrom(to ? subtractDays(to, 6) : '')

  }

  async function addStore() {

    const name = newStoreName.trim()

    if (!name) {

      alert('Enter a store name')
      return

    }

    setAddingStore(true)

    const { error } =
      await supabase.from('daraz_stores').insert({
        name,
        store_type: newStoreType,
      })

    setAddingStore(false)

    if (error) {

      alert('Failed to add store: ' + error.message)
      return

    }

    setNewStoreName('')
    setNewStoreType('physical')
    setShowAddStore(false)
    await load()

  }

  function requestSaveCashout() {

    if (!cashoutDate) {

      alert('Pick a date')
      return

    }

    const hasAmount = stores.some((s) => Number(entryAmounts[s.id]) > 0)

    if (!hasAmount) {

      alert('Enter at least one amount')
      return

    }

    setConfirmSaveStep(1)

  }

  async function doSaveCashout() {

    const writes = stores
      .map((s) => ({
        store_id: s.id,
        cashout_date: cashoutDate,
        amount: Number(entryAmounts[s.id]),
        statement_from: statementFrom || null,
        statement_to: statementTo || null,
      }))
      .filter((row) => row.amount > 0)

    setConfirmSaveStep(0)
    setSavingCashout(true)

    const { error } = await supabase
      .from('daraz_cashouts')
      .upsert(writes, { onConflict: 'store_id,cashout_date' })

    setSavingCashout(false)

    if (error) {

      alert('Failed to save cashout: ' + error.message)
      return

    }

    await load()

  }

  function startEditCell(record: any) {

    setEditingCell({ date: record.cashout_date, storeId: record.store_id })
    setEditAmount(String(record.amount))

  }

  async function saveEditCell(record: any) {

    const amount = Number(editAmount)

    if (!amount || amount <= 0) {

      alert('Enter a valid amount')
      return

    }

    setSavingEdit(true)

    const { error } = await supabase
      .from('daraz_cashouts')
      .update({ amount })
      .eq('id', record.id)

    setSavingEdit(false)

    if (error) {

      alert('Failed to update cashout: ' + error.message)
      return

    }

    setEditingCell(null)
    await load()

  }

  async function confirmDeleteCashout() {

    if (!deleteTarget) return

    setDeleting(true)

    const { error } = await supabase
      .from('daraz_cashouts')
      .delete()
      .eq('id', deleteTarget.id)

    setDeleting(false)

    if (error) {

      alert('Failed to delete cashout: ' + error.message)
      return

    }

    setDeleteTarget(null)
    await load()

  }

  const totalLifetime = cashouts.reduce((s, c) => s + Number(c.amount || 0), 0)

  const monthCashouts = cashouts.filter(
    (c) => (c.cashout_date || '').slice(0, 7) === historyMonth
  )

  const totalHistoryMonth = monthCashouts.reduce((s, c) => s + Number(c.amount || 0), 0)

  const pivotDates = Array.from(
    new Set(monthCashouts.map((c) => c.cashout_date))
  ).sort()

  const pivotRows = pivotDates.map((date) => {

    const amounts: Record<string, number> = {}
    const records: Record<string, any> = {}

    let rowTotal = 0

    stores.forEach((s) => {

      const entry = monthCashouts.find((c) => c.cashout_date === date && c.store_id === s.id)

      const amount = entry ? Number(entry.amount) : 0

      amounts[s.id] = amount
      records[s.id] = entry || null
      rowTotal += amount

    })

    return { date, amounts, records, rowTotal }

  })

  const storeColumnTotals: Record<string, number> = {}

  stores.forEach((s) => {

    storeColumnTotals[s.id] = pivotRows.reduce((sum, row) => sum + row.amounts[s.id], 0)

  })

  const grandTotal = pivotRows.reduce((sum, row) => sum + row.rowTotal, 0)

  const sixMonthsAgo = (() => {

    const d = new Date()

    d.setDate(1)
    d.setMonth(d.getMonth() - 5)

    return d.toISOString().slice(0, 10)

  })()

  const performanceCashouts = cashouts.filter((c) => (c.cashout_date || '') >= sixMonthsAgo)

  const performanceDates = Array.from(
    new Set(performanceCashouts.map((c) => c.cashout_date))
  ).sort()

  const performanceRows = performanceDates.map((date) => {

    const amounts: Record<string, number> = {}

    let rowTotal = 0

    stores.forEach((s) => {

      const entry = performanceCashouts.find((c) => c.cashout_date === date && c.store_id === s.id)

      const amount = entry ? Number(entry.amount) : 0

      amounts[s.id] = amount
      rowTotal += amount

    })

    return { date, amounts, rowTotal }

  })

  const performanceLabels = performanceDates.map((d) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
  )

  const performanceSeries = [
    {
      label: 'Total',
      color: '#18181B',
      data: performanceRows.map((row) => row.rowTotal),
    },
    ...stores.map((s, i) => ({
      label: s.name,
      color: STORE_COLORS[i % STORE_COLORS.length],
      data: performanceRows.map((row) => row.amounts[s.id]),
    })),
  ]

  function exportCashouts() {

    if (pivotRows.length === 0) {

      alert('No cashouts to export for this month')
      return

    }

    const rows = pivotRows.map((row) => {

      const rowData: any = { Date: row.date }

      stores.forEach((s) => {
        rowData[s.name] = row.amounts[s.id]
      })

      rowData.Total = row.rowTotal

      return rowData

    })

    const totalRow: any = { Date: 'Total' }

    stores.forEach((s) => {
      totalRow[s.name] = storeColumnTotals[s.id]
    })

    totalRow.Total = grandTotal

    rows.push(totalRow)

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daraz Cash In')

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })

    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    })

    saveAs(blob, `daraz-cash-in-${historyMonth}.xlsx`)

  }

  return (

    <div className="text-black">

      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">

          <div>

            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">

              Daraz Cash In

            </h1>

            <p className="text-sm text-zinc-500 mt-1">

              Track cashout payments received from Daraz, per store

            </p>

          </div>

          {!isViewer && (

            <button
              onClick={() => setShowAddStore(true)}
              className="bg-amber-400 border border-amber-500 text-zinc-900 hover:bg-amber-500 transition-colors px-4 py-2 rounded-xl text-sm font-semibold"
            >

              + Add Store

            </button>

          )}

        </div>

        <div className="flex flex-wrap gap-4">

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-zinc-900 px-6 py-4 min-w-[200px]">

            <p className="text-sm text-zinc-500">Total Cash In (Lifetime)</p>
            <h2 className="text-2xl font-bold tracking-tight mt-1 tabular-nums">Rs. {totalLifetime.toLocaleString('en-IN')}</h2>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-green-600 px-6 py-4 min-w-[200px]">

            <p className="text-sm text-zinc-500">Cash In — {monthLabel(historyMonth)}</p>
            <h2 className="text-2xl font-bold tracking-tight mt-1 tabular-nums text-green-600">Rs. {totalHistoryMonth.toLocaleString('en-IN')}</h2>

          </div>

        </div>

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <h3 className="font-bold text-lg text-zinc-900 mb-1">Performance — Last 6 Months</h3>
          <p className="text-xs text-zinc-400 mb-4">Cashout total per date (bold) alongside each store, across the last 6 months</p>

          {stores.length === 0 ? (

            <p className="text-zinc-500">Add a store to see performance.</p>

          ) : performanceDates.length === 0 ? (

            <p className="text-zinc-500">No cashouts recorded in the last 6 months.</p>

          ) : (

            <LineChart labels={performanceLabels} series={performanceSeries} />

          )}

        </div>

        {!isViewer && (

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <h3 className="font-bold text-lg text-zinc-900 mb-4">Add Cashout for a Date</h3>

          <p className="text-xs text-zinc-400 mb-4">

            Pick the cashout date and the statement period's end date (the start is set automatically, 7 days before), then enter the amount received from each store. Up to ~6 cashouts a month per store is normal.

          </p>

          <div className="flex flex-wrap items-end gap-4 mb-4">

            <div>

              <label className="text-xs font-medium text-zinc-500 mb-1 block">Cashout Date</label>

              <DatePicker value={cashoutDate} onChange={setCashoutDate} />

            </div>

            <div>

              <label className="text-xs font-medium text-zinc-500 mb-1 block">Statement Period To</label>

              <DatePicker value={statementTo} onChange={updateStatementTo} placeholder="Select end date" />

            </div>

            {statementFrom && statementTo && (

              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5">

                <p className="text-xs text-indigo-600 font-medium">

                  Statement period: {formatDateLabel(statementFrom)} – {formatDateLabel(statementTo)}

                </p>

              </div>

            )}

          </div>

          {stores.length === 0 ? (

            <p className="text-zinc-500">Add a store first to record cashouts.</p>

          ) : (

            <div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">

                {stores.map((s) => (

                  <div key={s.id} className="border border-zinc-200 rounded-xl px-3 py-2.5">

                    <p className="font-semibold text-zinc-900 text-sm truncate">{s.name}</p>
                    <p className="text-xs text-zinc-400 mb-2">{s.store_type === 'online' ? 'Online Store' : 'Physical Store'}</p>

                    <input
                      type="number"
                      value={entryAmounts[s.id] || ''}
                      onChange={(e) =>
                        setEntryAmounts((prev) => ({ ...prev, [s.id]: e.target.value }))
                      }
                      placeholder="Amount"
                      className="w-full border border-zinc-300 rounded-lg px-3 py-1.5 text-sm"
                    />

                  </div>

                ))}

              </div>

              <button
                onClick={requestSaveCashout}
                disabled={savingCashout}
                className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 mt-4"
              >

                {savingCashout ? 'Saving...' : 'Save Cashout'}

              </button>

            </div>

          )}

        </div>

        )}

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">

            <div>

              <h3 className="font-bold text-lg text-zinc-900">Cashout History</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Cashouts by date and store for the selected month</p>

            </div>

            <div className="flex items-center gap-3">

              <MonthPicker value={historyMonth} onChange={setHistoryMonth} />

              <button
                onClick={exportCashouts}
                className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm"
              >

                Export Excel

              </button>

            </div>

          </div>

          {loading ? (

            <p className="text-zinc-500">Loading...</p>

          ) : stores.length === 0 ? (

            <p className="text-zinc-500">Add a store to see cashout history.</p>

          ) : pivotRows.length === 0 ? (

            <p className="text-zinc-500">No cashouts recorded for {monthLabel(historyMonth)}.</p>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full border-collapse text-sm">

                <thead>

                  <tr>

                    <th className="bg-green-600 text-white font-semibold px-4 py-3 text-left border border-green-700 sticky left-0">Date</th>

                    {stores.map((s) => (
                      <th key={s.id} className="bg-amber-300 text-zinc-900 font-semibold px-4 py-3 text-center border border-amber-400 whitespace-nowrap">
                        {s.name}
                      </th>
                    ))}

                    <th className="bg-green-600 text-white font-semibold px-4 py-3 text-right border border-green-700">Total</th>

                  </tr>

                </thead>

                <tbody>

                  {pivotRows.map((row) => (

                    <tr key={row.date} className="hover:bg-zinc-50">

                      <td className="font-semibold text-zinc-900 px-4 py-2.5 border border-zinc-200 sticky left-0 bg-white whitespace-nowrap">
                        {formatDateLabel(row.date)}
                      </td>

                      {stores.map((s) => {

                        const record = row.records[s.id]
                        const isEditing =
                          !isViewer && editingCell?.date === row.date && editingCell?.storeId === s.id

                        if (isEditing) {

                          return (

                            <td key={s.id} className="px-2 py-1.5 border border-zinc-200 bg-indigo-50/40">

                              <div className="flex items-center gap-1 justify-end">

                                <input
                                  type="number"
                                  value={editAmount}
                                  onChange={(e) => setEditAmount(e.target.value)}
                                  autoFocus
                                  className="w-24 border border-zinc-300 rounded-lg px-2 py-1 text-sm text-right"
                                />

                                <button
                                  onClick={() => saveEditCell(record)}
                                  disabled={savingEdit}
                                  className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                                  aria-label="Save"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>

                                <button
                                  onClick={() => setEditingCell(null)}
                                  disabled={savingEdit}
                                  className="text-zinc-400 hover:text-zinc-600 disabled:opacity-50"
                                  aria-label="Cancel"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                                  </svg>
                                </button>

                              </div>

                            </td>

                          )

                        }

                        return (

                          <td key={s.id} className="group text-right tabular-nums px-4 py-2.5 border border-zinc-200 text-zinc-700">

                            {record ? (

                              <div className="flex items-center justify-end gap-1.5">

                                {!isViewer && (
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">

                                  <button
                                    onClick={() => startEditCell(record)}
                                    className="text-zinc-400 hover:text-indigo-600"
                                    aria-label="Edit"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                                      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </button>

                                  <button
                                    onClick={() => setDeleteTarget(record)}
                                    className="text-zinc-400 hover:text-red-600"
                                    aria-label="Delete"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </button>

                                </span>
                                )}

                                <span>{row.amounts[s.id].toLocaleString('en-IN')}</span>

                              </div>

                            ) : (
                              ''
                            )}

                          </td>

                        )

                      })}

                      <td className="text-right tabular-nums font-semibold px-4 py-2.5 border border-zinc-200 text-zinc-900">
                        {row.rowTotal.toLocaleString('en-IN')}
                      </td>

                    </tr>

                  ))}

                </tbody>

                <tfoot>

                  <tr>

                    <td className="bg-green-600 text-white font-bold px-4 py-3 border border-green-700 sticky left-0">Total</td>

                    {stores.map((s) => (
                      <td key={s.id} className="bg-green-600 text-white font-bold text-right tabular-nums px-4 py-3 border border-green-700">
                        {storeColumnTotals[s.id].toLocaleString('en-IN')}
                      </td>
                    ))}

                    <td className="bg-cyan-400 text-zinc-900 font-bold text-right tabular-nums px-4 py-3 border border-cyan-500">
                      {grandTotal.toLocaleString('en-IN')}
                    </td>

                  </tr>

                </tfoot>

              </table>

            </div>

          )}

        </div>

      </div>

      <ConfirmDialog
        open={confirmSaveStep === 1}
        title="Save this cashout?"
        message={`Save the entered cashout amounts for ${formatDateLabel(cashoutDate)}? Please review the amounts before continuing.`}
        confirmLabel="Continue"
        onConfirm={() => setConfirmSaveStep(2)}
        onCancel={() => setConfirmSaveStep(0)}
      />

      <ConfirmDialog
        open={confirmSaveStep === 2}
        title="Please confirm again"
        message={`Final confirmation: save the cashout entries for ${formatDateLabel(cashoutDate)}.`}
        confirmLabel="Yes, Save"
        onConfirm={doSaveCashout}
        onCancel={() => setConfirmSaveStep(0)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this cashout entry?"
        message={`Delete the Rs. ${Number(deleteTarget?.amount || 0).toLocaleString('en-IN')} cashout on ${formatDateLabel(deleteTarget?.cashout_date || '')}? This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        danger
        onConfirm={confirmDeleteCashout}
        onCancel={() => setDeleteTarget(null)}
      />

      {showAddStore && (

        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowAddStore(false)}
        >

          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[24px] shadow-2xl border border-zinc-200 w-full max-w-sm p-6"
          >

            <h3 className="font-bold text-lg text-zinc-900 mb-4">Add Daraz Store</h3>

            <div className="space-y-3">

              <input
                value={newStoreName}
                onChange={(e) => setNewStoreName(e.target.value)}
                placeholder="Store name"
                autoFocus
                className="w-full border border-zinc-300 rounded-xl px-4 py-2.5"
              />

              <select
                value={newStoreType}
                onChange={(e) => setNewStoreType(e.target.value)}
                className="w-full border border-zinc-300 rounded-xl px-4 py-2.5"
              >

                <option value="physical">Physical Store</option>
                <option value="online">Online Store</option>

              </select>

            </div>

            <div className="flex justify-end gap-3 mt-6">

              <button
                onClick={() => setShowAddStore(false)}
                disabled={addingStore}
                className="bg-white border border-zinc-300 text-zinc-700 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50"
              >

                Cancel

              </button>

              <button
                onClick={addStore}
                disabled={addingStore}
                className="bg-amber-400 border border-amber-500 text-zinc-900 hover:bg-amber-500 transition-colors px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              >

                {addingStore ? 'Adding...' : 'Add Store'}

              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  )

}
