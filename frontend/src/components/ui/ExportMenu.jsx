/**
 * ExportMenu — shared export dropdown for any chart, table, KPI panel, etc.
 *
 * Three formats, no external deps:
 *   • CSV  — always available when `data` is provided
 *   • PNG  — works on charts (Recharts SVG); rasterises the SVG inside
 *            `containerRef` to a canvas and downloads a PNG
 *   • PDF  — opens a popup window with print-friendly markup and triggers
 *            `window.print()`. The user picks "Save as PDF" from the print
 *            dialog. Pragmatic — no html2canvas / jsPDF dependency required.
 *
 * Props:
 *   data         {object[]?}     — rows for CSV export. If absent, CSV is hidden.
 *   columns      {string[]?}     — explicit column order; defaults to keys of data[0]
 *   filename     {string}        — base filename (no extension)
 *   containerRef {React.Ref?}    — ref to a DOM node containing the SVG to PNG-export
 *   title        {string?}       — used for PDF page title
 *   accent       {string?}       — button accent colour (default brand purple)
 *
 * Usage:
 *   const ref = useRef(null)
 *   <div ref={ref}>{chart}</div>
 *   <ExportMenu data={rows} containerRef={ref} filename="kpi-summary" title="KPI summary" />
 */

import React, { useEffect, useRef, useState } from 'react'

// ── CSV helpers ─────────────────────────────────────────────────────────────

function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadCSV(filename, data, columns) {
  if (!Array.isArray(data) || data.length === 0) return
  const cols = (columns && columns.length) ? columns : Object.keys(data[0])
  const lines = [cols.join(',')]
  for (const row of data) {
    lines.push(cols.map(c => csvEscape(row[c])).join(','))
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── PNG export — find the first <svg> inside containerRef and rasterise ──

export async function downloadPNG(filename, containerRef) {
  if (!containerRef || !containerRef.current) {
    throw new Error('No container ref supplied for PNG export')
  }
  const svg = containerRef.current.querySelector('svg')
  if (!svg) {
    throw new Error('No SVG chart found to export')
  }

  // Clone + serialise so we can inline computed styles if needed
  const clone = svg.cloneNode(true)
  const w = svg.clientWidth || svg.viewBox?.baseVal?.width || 800
  const h = svg.clientHeight || svg.viewBox?.baseVal?.height || 400
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', w)
  clone.setAttribute('height', h)

  const xml  = new XMLSerializer().serializeToString(clone)
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  const url  = URL.createObjectURL(blob)

  await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = w * 2          // 2× for retina
      canvas.height = h * 2
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(2, 2)
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(b => {
        if (!b) return reject(new Error('Canvas to PNG failed'))
        const u = URL.createObjectURL(b)
        const a = document.createElement('a')
        a.href = u; a.download = `${filename}.png`
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(u), 1000)
        URL.revokeObjectURL(url)
        resolve()
      }, 'image/png')
    }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}

// ── PDF export — open print-friendly window and trigger print dialog ─────

export function downloadPDF(filename, containerRef, title) {
  const html = (containerRef && containerRef.current)
    ? containerRef.current.innerHTML
    : '<div>No content</div>'

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) {
    alert('Please allow pop-ups for this site to export PDFs.')
    return
  }
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title || filename}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #111827; }
    h1, h2, h3 { color: #0c1446; }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 6px 10px; border: 1px solid #e5e7eb; text-align: left; font-size: 0.85rem; }
    th { background: #f9fafb; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1 style="margin-top:0">${title || filename}</h1>
  <div>${html}</div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    }
  <\/script>
</body>
</html>`)
  win.document.close()
}

// ── The dropdown component itself ───────────────────────────────────────────

export default function ExportMenu({
  data,
  columns,
  filename = 'export',
  containerRef,
  title,
  accent = '#0c1446',
  compact = false,
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(null)   // 'png' | 'pdf' | null
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const hasCSV = Array.isArray(data) && data.length > 0
  const hasPNG = !!containerRef && !!containerRef.current
  const hasPDF = !!containerRef && !!containerRef.current

  const handleCSV = () => {
    setOpen(false)
    downloadCSV(filename, data, columns)
  }
  const handlePNG = async () => {
    setBusy('png')
    try {
      await downloadPNG(filename, containerRef)
    } catch (e) {
      alert('PNG export failed: ' + (e?.message || 'unknown error'))
    } finally {
      setBusy(null)
      setOpen(false)
    }
  }
  const handlePDF = () => {
    setBusy('pdf')
    try {
      downloadPDF(filename, containerRef, title)
    } catch (e) {
      alert('PDF export failed: ' + (e?.message || 'unknown error'))
    } finally {
      setBusy(null)
      setOpen(false)
    }
  }

  const items = [
    hasCSV && { id: 'csv', label: '⬇ CSV',  onClick: handleCSV, hint: 'Spreadsheet-friendly data dump' },
    hasPNG && { id: 'png', label: '🖼 PNG',  onClick: handlePNG, hint: 'Chart image (2× retina)' },
    hasPDF && { id: 'pdf', label: '📄 PDF',  onClick: handlePDF, hint: 'Print-ready layout' },
  ].filter(Boolean)

  if (items.length === 0) return null

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: '#fff',
          color: accent,
          border: `1px solid ${accent}`,
          borderRadius: 8,
          padding: compact ? '4px 10px' : '6px 14px',
          fontSize: compact ? '0.78rem' : '0.84rem',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        ⬇ Export
        <span style={{ fontSize: '0.7rem' }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
          boxShadow: '0 6px 22px rgba(0,0,0,0.10)', minWidth: 180, zIndex: 50,
          overflow: 'hidden',
        }}>
          {items.map(i => (
            <button
              key={i.id}
              onClick={i.onClick}
              disabled={busy === i.id}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '9px 14px', background: 'transparent', border: 'none',
                cursor: busy === i.id ? 'wait' : 'pointer',
                fontSize: '0.85rem', color: '#111827',
                opacity: busy === i.id ? 0.6 : 1,
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontWeight: 700 }}>{i.label}</div>
              <div style={{ fontSize: '0.74rem', color: '#9ca3af', marginTop: 2 }}>{i.hint}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
