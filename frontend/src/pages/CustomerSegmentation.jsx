import React, { useState, useEffect, useRef } from 'react'
import { filesApi, analyticsApi } from '../api'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import EmptyState from '../components/ui/EmptyState'
import ExportMenu from '../components/ui/ExportMenu'
import OpenInAskYourData from '../components/ui/OpenInAskYourData'
import PinToDashboard from '../components/ui/PinToDashboard'

const SEGMENT_COLORS = ['#e91e8c', '#0097b2', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

export default function CustomerSegmentation() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [xCol, setXCol] = useState('')
  const [yCol, setYCol] = useState('')
  const [labelCol, setLabelCol] = useState('')
  const [k, setK] = useState(3)
  const [result, setResult] = useState(null)
  const chartRef = useRef(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setResult(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function run() {
    if (!xCol || !yCol || !rows.length) return
    const pts = rows.map((r, i) => ({ x: parseFloat(r[xCol]) || 0, y: parseFloat(r[yCol]) || 0, label: r[labelCol] || `Row ${i + 1}` }))
    const xMin = Math.min(...pts.map(p => p.x)); const xMax = Math.max(...pts.map(p => p.x))
    const yMin = Math.min(...pts.map(p => p.y)); const yMax = Math.max(...pts.map(p => p.y))
    const norm = pts.map(p => ({ ...p, nx: xMax > xMin ? (p.x - xMin) / (xMax - xMin) : 0, ny: yMax > yMin ? (p.y - yMin) / (yMax - yMin) : 0 }))
    // k-means
    let centroids = Array.from({ length: k }, (_, i) => ({ nx: (i + 0.5) / k, ny: Math.random() }))
    let assignments = new Array(pts.length).fill(0)
    for (let iter = 0; iter < 20; iter++) {
      assignments = norm.map(p => {
        let best = 0; let bestD = Infinity
        centroids.forEach((c, ci) => {
          const d = (p.nx - c.nx) ** 2 + (p.ny - c.ny) ** 2
          if (d < bestD) { bestD = d; best = ci }
        })
        return best
      })
      centroids = centroids.map((_, ci) => {
        const members = norm.filter((_, i) => assignments[i] === ci)
        if (!members.length) return centroids[ci]
        return { nx: members.reduce((a, p) => a + p.nx, 0) / members.length, ny: members.reduce((a, p) => a + p.ny, 0) / members.length }
      })
    }
    const chartData = pts.map((p, i) => ({ ...p, cluster: assignments[i] }))
    const segments = Array.from({ length: k }, (_, ci) => {
      const members = pts.filter((_, i) => assignments[i] === ci)
      return {
        id: ci, count: members.length,
        avgX: members.length ? (members.reduce((a, p) => a + p.x, 0) / members.length).toFixed(2) : 0,
        avgY: members.length ? (members.reduce((a, p) => a + p.y, 0) / members.length).toFixed(2) : 0,
        color: SEGMENT_COLORS[ci % SEGMENT_COLORS.length]
      }
    }).sort((a, b) => b.count - a.count)
    setResult({ chartData, segments })
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Customer Segmentation</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>K-means clustering to identify natural customer groups</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
          {[
            ['File', <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Choose --</option>{files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}</select>],
            ['X Axis', <select value={xCol} onChange={e => setXCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Numeric --</option>{numericCols.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Y Axis', <select value={yCol} onChange={e => setYCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Numeric --</option>{numericCols.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Label', <select value={labelCol} onChange={e => setLabelCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">(optional)</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Clusters (k)', <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="range" min="2" max="6" value={k} onChange={e => setK(parseInt(e.target.value))} style={{ flex: 1 }} /><span style={{ fontWeight: 700, color: '#0c1446', minWidth: 16 }}>{k}</span></div>]
          ].map(([label, el]) => <div key={label}><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</div>{el}</div>)}
        </div>
        <button onClick={run} disabled={!xCol || !yCol} style={{ padding: '9px 24px', background: xCol && yCol ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: xCol && yCol ? 'pointer' : 'default' }}>Run Segmentation</button>
      </div>

      {result && (
        <>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
          <OpenInAskYourData
            fileId={fileId}
            prompt={`I clustered customers into ${result.segments.length} groups using ${xCol} and ${yCol}. Help me characterise each group with 1-2 sentence personas.`}
          />
          <PinToDashboard
            widget={{
              type: 'scatter',
              col: xCol,
              label: `Segments: ${xCol} × ${yCol}`,
              file_id: fileId,
              extra: { x: xCol, y: yCol, k },
            }}
          />
          <ExportMenu
            data={result.chartData.map(d => ({ label: d.label, x: d.x, y: d.y, segment: d.cluster + 1 }))}
            filename={`segmentation-${xCol}-${yCol}`}
            containerRef={chartRef}
            title={`Customer Segmentation: ${xCol} × ${yCol}`}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <div ref={chartRef} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Cluster Scatter Plot</div>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="x" name={xCol} tick={{ fontSize: 11 }} label={{ value: xCol, position: 'insideBottom', offset: -5, fontSize: 12 }} />
                <YAxis dataKey="y" name={yCol} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => payload?.length ? <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem' }}><div>{payload[0]?.payload?.label}</div><div>X: {payload[0]?.payload?.x}</div><div>Y: {payload[0]?.payload?.y}</div></div> : null} />
                {Array.from({ length: k }, (_, ci) => (
                  <Scatter key={ci} name={`Segment ${ci + 1}`} data={result.chartData.filter(d => d.cluster === ci)} fill={SEGMENT_COLORS[ci % SEGMENT_COLORS.length]} opacity={0.7} r={4} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Segment Summary</div>
            {result.segments.map((s, i) => (
              <div key={s.id} style={{ padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: s.color }}>Segment {i + 1}</span>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <OpenInAskYourData
                      variant="icon"
                      fileId={fileId}
                      prompt={`Describe Segment ${i + 1} from my k-means run on ${xCol} × ${yCol} (${s.count} customers, avg ${xCol}=${s.avgX}, avg ${yCol}=${s.avgY}). What's the persona and ideal next campaign?`}
                    />
                    <span style={{ background: s.color + '20', color: s.color, borderRadius: 12, padding: '2px 8px', fontSize: '0.8rem', fontWeight: 700 }}>{s.count} pts</span>
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Avg {xCol}: <strong>{s.avgX}</strong></div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Avg {yCol}: <strong>{s.avgY}</strong></div>
              </div>
            ))}
          </div>
        </div>
        </>
      )}

      {!result && (
        <EmptyState
          icon="🎯"
          title="Pick X and Y to run k-means"
          body="K-means groups customers into clusters based on two numeric columns. Tweak k (2–6) to control cluster count."
        />
      )}
    </div>
  )
}
