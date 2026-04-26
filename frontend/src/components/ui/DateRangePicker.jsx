/**
 * DateRangePicker — shared date filter component.
 *
 * Sits at the top of any page that operates on a date column. Lets the user
 * pick which date column drives the filter, then choose from quick presets
 * (last 7d / 30d / 90d / YTD) or a custom range.
 *
 * Props:
 *   columns         {string[]}    — list of column names from the dataset
 *   dateColumns     {string[]?}   — pre-detected date columns (optional). If absent
 *                                   we derive a heuristic guess from `columns`.
 *   value           {DateRange}   — { date_column, from, to, preset }
 *   onChange        {fn(value)}   — fires whenever any field changes
 *   storageKey      {string?}     — if set, the last selection is persisted to
 *                                   localStorage under this key. Use the page
 *                                   slug, e.g. "kpi-dashboard.dateRange".
 *   compact         {bool}        — single-row layout (default true).
 *
 * Output value shape:
 *   { date_column: "Order Date", from: "2026-01-01", to: "2026-04-26", preset: "30d" }
 *
 * Notes:
 *   - All dates are ISO YYYY-MM-DD (no times, no timezone surprises).
 *   - "from" / "to" are inclusive on both ends.
 *   - Setting preset !== "custom" will recompute from/to whenever the page
 *     mounts so "last 30 days" is always relative to today.
 */

import React, { useEffect, useMemo, useRef } from 'react'

const PRESETS = [
  { id: '7d',     label: 'Last 7 days',  days: 7 },
  { id: '30d',    label: 'Last 30 days', days: 30 },
  { id: '90d',    label: 'Last 90 days', days: 90 },
  { id: 'ytd',    label: 'Year to date', days: null },
  { id: 'custom', label: 'Custom',       days: null },
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function isoDaysAgo(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function ytdStart() {
  return `${new Date().getFullYear()}-01-01`
}

function presetToRange(preset) {
  if (preset === 'ytd') return { from: ytdStart(), to: todayISO() }
  const p = PRESETS.find(p => p.id === preset)
  if (!p || !p.days) return { from: '', to: '' }
  return { from: isoDaysAgo(p.days), to: todayISO() }
}

function looksLikeDateColumn(name) {
  const n = (name || '').toLowerCase()
  return /\b(date|day|month|year|period|created|updated|timestamp|when)\b/.test(n)
}

export default function DateRangePicker({
  columns = [],
  dateColumns,
  value,
  onChange,
  storageKey,
  compact = true,
}) {
  // Derive date-column candidates if caller didn't pass them
  const candidateCols = useMemo(() => {
    if (Array.isArray(dateColumns) && dateColumns.length) return dateColumns
    return (columns || []).filter(looksLikeDateColumn)
  }, [columns, dateColumns])

  const fallbackCol = candidateCols[0] || (columns[0] || '')
  const initialised = useRef(false)

  // Hydrate from localStorage on first mount if the caller didn't pass `value`
  useEffect(() => {
    if (initialised.current) return
    initialised.current = true
    if (value && value.date_column) return
    if (storageKey) {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || 'null')
        if (saved && saved.date_column && columns.includes(saved.date_column)) {
          // Re-resolve preset against today (so "last 30 days" auto-shifts)
          const range = saved.preset && saved.preset !== 'custom'
            ? { ...presetToRange(saved.preset), preset: saved.preset }
            : { from: saved.from || '', to: saved.to || '', preset: 'custom' }
          onChange?.({ date_column: saved.date_column, ...range })
          return
        }
      } catch { /* ignore */ }
    }
    if (fallbackCol) {
      onChange?.({ date_column: fallbackCol, ...presetToRange('30d'), preset: '30d' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, fallbackCol])

  const v = value || { date_column: '', from: '', to: '', preset: '30d' }

  const persist = (next) => {
    if (storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* ignore */ }
    }
    onChange?.(next)
  }

  const setColumn = (col) => persist({ ...v, date_column: col })
  const setPreset = (preset) => {
    if (preset === 'custom') {
      persist({ ...v, preset: 'custom' })
    } else {
      persist({ ...v, preset, ...presetToRange(preset) })
    }
  }
  const setFrom = (from) => persist({ ...v, from, preset: 'custom' })
  const setTo   = (to)   => persist({ ...v, to,   preset: 'custom' })

  if (!columns.length) return null

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
      padding: compact ? '8px 12px' : '12px 16px',
      background: '#f9fafb',
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      fontSize: '0.84rem',
    }}>
      <span style={{ color: '#6b7280', fontWeight: 600 }}>Date column:</span>
      <select
        value={v.date_column || ''}
        onChange={e => setColumn(e.target.value)}
        style={{
          padding: '5px 10px', borderRadius: 7, border: '1px solid #d1d5db',
          fontSize: '0.84rem', background: '#fff', cursor: 'pointer', maxWidth: 220,
        }}
      >
        <option value="">— Select —</option>
        {candidateCols.length > 0 && (
          <optgroup label="Detected">
            {candidateCols.map(c => <option key={c} value={c}>{c}</option>)}
          </optgroup>
        )}
        {columns.length > 0 && (
          <optgroup label="All columns">
            {columns.filter(c => !candidateCols.includes(c)).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </optgroup>
        )}
      </select>

      <div style={{ display: 'flex', gap: 4 }}>
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            disabled={!v.date_column}
            style={{
              padding: '4px 10px',
              borderRadius: 14,
              border: 'none',
              cursor: v.date_column ? 'pointer' : 'not-allowed',
              background: v.preset === p.id ? '#0c1446' : '#fff',
              color:      v.preset === p.id ? '#fff'    : '#374151',
              fontSize: '0.78rem',
              fontWeight: 600,
              opacity: v.date_column ? 1 : 0.5,
              borderStyle: 'solid',
              borderWidth: 1,
              borderColor: v.preset === p.id ? '#0c1446' : '#d1d5db',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {v.preset === 'custom' && v.date_column && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            value={v.from || ''}
            onChange={e => setFrom(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: '0.82rem' }}
          />
          <span style={{ color: '#9ca3af' }}>→</span>
          <input
            type="date"
            value={v.to || ''}
            onChange={e => setTo(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: '0.82rem' }}
          />
        </div>
      )}

      {v.date_column && v.from && v.to && v.preset !== 'custom' && (
        <span style={{ color: '#9ca3af', fontSize: '0.78rem', marginLeft: 'auto' }}>
          {v.from} → {v.to}
        </span>
      )}
    </div>
  )
}

/**
 * Helper: filter an array of row objects to those where row[date_column]
 * parses to a date inside [from, to] inclusive.
 *
 * Use from any page that wants to apply the picker's value to its dataset.
 */
export function applyDateFilter(rows, range) {
  if (!range || !range.date_column || !range.from || !range.to) return rows
  const fromMs = Date.parse(range.from)
  const toMs   = Date.parse(range.to + 'T23:59:59')
  if (isNaN(fromMs) || isNaN(toMs)) return rows
  return rows.filter(r => {
    const v = r[range.date_column]
    if (!v) return false
    const t = Date.parse(v)
    if (isNaN(t)) return false
    return t >= fromMs && t <= toMs
  })
}
