/**
 * Skeleton — shimmer-animated loading placeholders.
 *
 * Three variants:
 *   <Skeleton variant="line"   width="60%" />  — single line of text
 *   <Skeleton variant="rect"   height={120} /> — block (chart, card, image)
 *   <Skeleton variant="circle" size={40}  />   — avatar / icon
 *
 * Composite helpers:
 *   <SkeletonCard /> — KPI-card-shaped placeholder (label line + big number + trend line)
 *   <SkeletonChart height={260} /> — header line + legend + chart-shaped block
 *   <SkeletonTable rows={5} cols={4} />
 *
 * Animation: a single `@keyframes` rule is injected at module load via a
 * style-tag side-effect. No external CSS file required.
 */

import React from 'react'

// One-time keyframe injection — harmless if mounted multiple times.
const KEYFRAMES_ID = 'dhp-skeleton-keyframes'
if (typeof document !== 'undefined' && !document.getElementById(KEYFRAMES_ID)) {
  const s = document.createElement('style')
  s.id = KEYFRAMES_ID
  s.textContent = `
    @keyframes dhpSkeletonShimmer {
      0%   { background-position: -400px 0; }
      100% { background-position:  400px 0; }
    }
  `
  document.head.appendChild(s)
}

const baseStyle = {
  display: 'inline-block',
  background: 'linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%)',
  backgroundSize: '800px 100%',
  animation: 'dhpSkeletonShimmer 1.4s ease-in-out infinite',
  borderRadius: 6,
  verticalAlign: 'middle',
}

export default function Skeleton({
  variant = 'line',
  width,
  height,
  size,
  style: extraStyle = {},
  className,
}) {
  let style = { ...baseStyle, ...extraStyle }

  if (variant === 'circle') {
    const s = size || height || width || 40
    style = { ...style, width: s, height: s, borderRadius: '50%' }
  } else if (variant === 'rect') {
    style = {
      ...style,
      width:  width  ?? '100%',
      height: height ?? 100,
      display: 'block',
      borderRadius: extraStyle.borderRadius ?? 10,
    }
  } else { // 'line'
    style = {
      ...style,
      width:  width  ?? '100%',
      height: height ?? 12,
      borderRadius: 999,
      display: 'block',
    }
  }

  return <span aria-hidden="true" className={className} style={style} />
}

export function SkeletonCard({ height = 120 }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 18,
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6',
      minHeight: height,
    }}>
      <Skeleton variant="line" width={90}  height={10} style={{ marginBottom: 14 }} />
      <Skeleton variant="line" width={140} height={26} style={{ marginBottom: 10 }} />
      <Skeleton variant="line" width="70%" height={8}  />
    </div>
  )
}

export function SkeletonChart({ height = 260 }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 18,
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <Skeleton variant="line" width={180} height={14} />
        <Skeleton variant="line" width={80}  height={14} />
      </div>
      <Skeleton variant="rect" height={height - 60} />
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #f3f4f6' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10, marginBottom: 14 }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`h${i}`} variant="line" height={10} width="60%" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{
          display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 10, padding: '10px 0', borderTop: '1px solid #f3f4f6',
        }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={`r${r}c${c}`} variant="line" height={10} width={c === 0 ? '85%' : '70%'} />
          ))}
        </div>
      ))}
    </div>
  )
}
