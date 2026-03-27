/**
 * generateInsights
 * Derives Key Findings, Data Quality notes, and Column Highlights
 * from the analytics summary API response.
 *
 * API response shape  (POST /api/analytics/summary/:fileId):
 * {
 *   filename : string,
 *   rows     : number,
 *   columns  : number,
 *   summary  : {
 *     [columnName]: {
 *       type    : "numeric" | "text",
 *       count   : number,
 *       // numeric only:
 *       sum?    : number,  mean?: number, min?: number, max?: number,
 *       // text only:
 *       unique? : number,  top_values?: string[]
 *     }
 *   }
 * }
 *
 * @param   {object|null} data  raw API response
 * @returns {{ key: string[], quality: string[], highlights: string[] }}
 */
export function generateInsights(data) {
  const out = { key: [], quality: [], highlights: [] }
  if (!data) return out

  const rows       = data.rows    || 0
  const cols       = data.columns || 0
  const summaryObj = data.summary || {}

  const nc = Object.entries(summaryObj)
    .filter(([, v]) => v.type === 'numeric')
    .map(([col, v]) => ({ column: col, ...v }))
  const tc = Object.entries(summaryObj)
    .filter(([, v]) => v.type === 'text')
    .map(([col, v]) => ({ column: col, ...v }))

  // Key Findings
  out.key.push('Dataset has ' + rows.toLocaleString() + ' records and ' + cols + ' columns.')
  if (nc.length)
    out.key.push(nc.length + ' numeric column' + (nc.length > 1 ? 's' : '') +
      ' ready for quantitative analysis.')
  if (tc.length)
    out.key.push(tc.length + ' categorical column' + (tc.length > 1 ? 's' : '') +
      ' available for grouping and segmentation.')
  if (nc.length) {
    const top = nc.reduce((a, b) => (b.mean > a.mean ? b : a), nc[0])
    if (top && top.mean)
      out.key.push('"' + top.column + '" has the highest average: ' +
        Number(top.mean).toLocaleString(undefined, { maximumFractionDigits: 2 }) + '.')
  }

  // Data Quality
  const nmiss = nc.filter(c => (c.count || 0) < rows)
  const tmiss = tc.filter(c => (c.count || 0) < rows)
  if (!nmiss.length && nc.length)
    out.quality.push('All numeric columns are complete - no missing values detected.')
  nmiss.forEach(c => {
    const missing = rows - (c.count || 0)
    out.quality.push('"' + c.column + '": ' + missing +
      ' missing values (' + ((missing / rows) * 100).toFixed(1) + '%).')
  })
  if (!tmiss.length && tc.length)
    out.quality.push('All categorical columns are complete with no missing values.')
  else if (tmiss.length)
    out.quality.push(tmiss.length + ' categorical column' +
      (tmiss.length > 1 ? 's' : '') + ' have missing values.')
  if (rows < 100)
    out.quality.push('Small dataset - statistical conclusions may have limited reliability.')
  else if (rows > 10000)
    out.quality.push('Large dataset (' + rows.toLocaleString() + ' rows) - results are statistically robust.')

  // Column Highlights
  nc.forEach(c => {
    if (c.min !== undefined && c.max !== undefined) {
      if (c.max - c.min === 0)
        out.highlights.push('"' + c.column + '" has no variance (all values are identical).')
      else
        out.highlights.push('"' + c.column + '" ranges from ' +
          Number(c.min).toLocaleString() + ' to ' + Number(c.max).toLocaleString() + '.')
    }
  })
  tc.forEach(c => {
    if (c.unique)
      out.highlights.push('"' + c.column + '" has ' + c.unique +
        ' unique value' + (c.unique > 1 ? 's' : '') +
        (c.top_values?.length ? ': ' + c.top_values.slice(0, 3).join(', ') : '') + '.')
  })
  if (!out.highlights.length)
    out.highlights.push('No notable anomalies detected in numeric distributions.')

  return out
}
