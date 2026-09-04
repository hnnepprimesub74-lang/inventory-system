'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export type CashSource = { id: string; name: string }

export function defaultSourceId(sources: CashSource[]) {
  return sources.find((s) => s.name === 'Daraz')?.id || sources[0]?.id || ''
}

export default function SourceSelect({
  sources,
  value,
  onChange,
  onSourceAdded,
  className,
}: {
  sources: CashSource[]
  value: string
  onChange: (id: string) => void
  onSourceAdded: (source: CashSource) => void
  className?: string
}) {

  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function addSource() {

    const trimmed = name.trim()

    if (!trimmed) {

      alert('Enter a source name')
      return

    }

    setSaving(true)

    const { data, error } = await supabase
      .from('cash_sources')
      .insert({ name: trimmed })
      .select()
      .single()

    setSaving(false)

    if (error) {

      alert('Failed to add source: ' + error.message)
      return

    }

    setName('')
    setShowAdd(false)
    onSourceAdded(data)
    onChange(data.id)

  }

  return (

    <>

      <select
        value={value}
        onChange={(e) => {

          if (e.target.value === '__add__') {

            setShowAdd(true)
            return

          }

          onChange(e.target.value)

        }}
        className={className || 'border border-zinc-300 rounded-xl px-3 py-2.5 text-sm'}
      >

        {sources.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}

        <option value="__add__">+ Add new source...</option>

      </select>

      {showAdd && (

        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowAdd(false)}
        >

          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[24px] shadow-2xl border border-zinc-200 w-full max-w-sm p-6"
          >

            <h3 className="font-bold text-lg text-zinc-900 mb-4">Add Cash Source</h3>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Personal Cash, Bank"
              autoFocus
              className="w-full border border-zinc-300 rounded-xl px-4 py-2.5"
            />

            <div className="flex justify-end gap-3 mt-6">

              <button
                onClick={() => setShowAdd(false)}
                disabled={saving}
                className="bg-white border border-zinc-300 text-zinc-700 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50"
              >

                Cancel

              </button>

              <button
                onClick={addSource}
                disabled={saving}
                className="bg-amber-400 border border-amber-500 text-zinc-900 hover:bg-amber-500 transition-colors px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              >

                {saving ? 'Adding...' : 'Add Source'}

              </button>

            </div>

          </div>

        </div>

      )}

    </>

  )

}
