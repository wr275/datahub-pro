import { describe, it, expect } from 'vitest'
import { generateInsights } from '../../utils/insights'

// helpers
const makeData = (overrides = {}) => ({
  filename: 'test.csv', rows: 29, columns: 3,
  summary: {
    Revenue: { type: 'numeric', count: 29, sum: 5000, mean: 172.41, min: 87,  max: 856 },
    COGS:    { type: 'numeric', count: 29, sum: 3000, mean: 103.45, min: 52,  max: 171 },
    Region:  { type: 'text',   count: 29, unique: 3, top_values: ['North','South','East'] },
  },
  ...overrides,
})

// null / empty
describe('generateInsights — null/empty input', () => {
  it('returns empty arrays for null', () => {
    expect(generateInsights(null)).toEqual({ key: [], quality: [], highlights: [] })
  })
  it('returns empty arrays for undefined', () => {
    expect(generateInsights(undefined)).toEqual({ key: [], quality: [], highlights: [] })
  })
  it('handles missing rows/columns gracefully', () => {
    expect(generateInsights({ summary: {} }).key[0]).toContain('0 records and 0 columns')
  })
  it('does not throw on empty summary', () => {
    expect(() => generateInsights({ rows: 10, columns: 0, summary: {} })).not.toThrow()
  })
})

// Key Findings
describe('generateInsights — Key Findings', () => {
  it('reports correct row and column count', () => {
    const r = generateInsights(makeData())
    expect(r.key[0]).toContain('29')
    expect(r.key[0]).toContain('3 columns')
  })
  it('reports numeric column count', () => {
    const line = generateInsights(makeData()).key.find(s => s.includes('numeric'))
    expect(line).toContain('2 numeric columns')
  })
  it('reports categorical column count', () => {
    const line = generateInsights(makeData()).key.find(s => s.includes('categorical'))
    expect(line).toContain('1 categorical column')
  })
  it('uses singular for a single numeric column', () => {
    const data = makeData({ columns: 1, summary: { Rev: { type: 'numeric', count: 29, mean: 100, min: 50, max: 200 } } })
    const line = generateInsights(data).key.find(s => s.includes('numeric'))
    expect(line).toMatch(/1 numeric column /)
    expect(line).not.toMatch(/1 numeric columns/)
  })
  it('identifies highest-average column', () => {
    const line = generateInsights(makeData()).key.find(s => s.includes('highest average'))
    expect(line).toBeTruthy()
    expect(line).toContain('Revenue') // mean 172.41 > COGS 103.45
  })
  it('skips highest-average when no numeric columns', () => {
    const data = makeData({ summary: { Region: { type: 'text', count: 10, unique: 3 } } })
    expect(generateInsights(data).key.some(s => s.includes('highest average'))).toBe(false)
  })
})

// Data Quality
describe('generateInsights — Data Quality', () => {
  it('reports all numeric columns complete', () => {
    expect(generateInsights(makeData()).quality.some(s => s.includes('All numeric columns are complete'))).toBe(true)
  })
  it('reports missing values for incomplete numeric column', () => {
    const data = makeData({ summary: { Revenue: { type: 'numeric', count: 20, mean: 100, min: 50, max: 200 } } })
    const line = generateInsights(data).quality.find(s => s.includes('Revenue') && s.includes('missing'))
    expect(line).toBeTruthy()
    expect(line).toContain('9 missing values')
  })
  it('reports small-dataset warning for < 100 rows', () => {
    expect(generateInsights(makeData({ rows: 29 })).quality.some(s => s.includes('Small dataset'))).toBe(true)
  })
  it('does NOT report small-dataset warning for >= 100 rows', () => {
    expect(generateInsights(makeData({ rows: 150 })).quality.some(s => s.includes('Small dataset'))).toBe(false)
  })
  it('reports large-dataset note for > 10000 rows', () => {
    expect(generateInsights(makeData({ rows: 15000, summary: {} })).quality.some(s => s.includes('Large dataset'))).toBe(true)
  })
  it('reports all categorical columns complete', () => {
    expect(generateInsights(makeData()).quality.some(s => s.includes('All categorical columns are complete'))).toBe(true)
  })
})

// Column Highlights
describe('generateInsights — Column Highlights', () => {
  it('reports min/max range for numeric columns', () => {
    const line = generateInsights(makeData()).highlights.find(s => s.includes('Revenue') && s.includes('ranges from'))
    expect(line).toContain('87')
    expect(line).toContain('856')
  })
  it('reports no-variance for min === max', () => {
    const data = makeData({ summary: { Year: { type: 'numeric', count: 29, mean: 2024, min: 2024, max: 2024 } } })
    const r = generateInsights(data)
    expect(r.highlights.some(s => s.includes('no variance'))).toBe(true)
  })
  it('reports unique values for text columns', () => {
    const line = generateInsights(makeData()).highlights.find(s => s.includes('Region') && s.includes('unique'))
    expect(line).toContain('3 unique values')
  })
  it('falls back to "No notable anomalies" when summary is empty', () => {
    expect(generateInsights({ rows: 10, columns: 0, summary: {} }).highlights.some(s => s.includes('No notable anomalies'))).toBe(true)
  })
})

// API shape regression (Bug 3)
describe('generateInsights — API shape regression (Bug 3)', () => {
  it('reads rows from data.rows NOT data.total_rows', () => {
    expect(generateInsights({ rows: 29, columns: 17, summary: {} }).key[0]).toContain('29')
  })
  it('reads columns from data.columns NOT data.total_columns', () => {
    expect(generateInsights({ rows: 5, columns: 17, summary: {} }).key[0]).toContain('17 columns')
  })
  it('derives numeric columns from summary[col].type === "numeric"', () => {
    const r = generateInsights({ rows: 5, columns: 1, summary: { Amt: { type: 'numeric', count: 5, mean: 10, min: 1, max: 20 } } })
    expect(r.key.some(s => s.includes('1 numeric column'))).toBe(true)
  })
  it('does NOT crash when old field names (total_rows etc.) are absent', () => {
    const r = generateInsights({ total_rows: 29, total_columns: 17, numeric_columns: [], text_columns: [] })
    expect(r.key[0]).toContain('0 records') // graceful fallback
  })
  it('handles real sample_financial_data.csv API response', () => {
    const r = generateInsights({
      filename: 'sample_financial_data.csv', rows: 29, columns: 17,
      summary: {
        Year:    { type: 'numeric', count: 29, mean: 2014, min: 2014, max: 2014 },
        Revenue: { type: 'numeric', count: 29, mean: 352586.21, min: 87000, max: 856000 },
        Segment: { type: 'text', count: 29, unique: 5, top_values: ['Government'] },
      },
    })
    expect(r.key[0]).toContain('29')
    expect(r.key[0]).toContain('17 columns')
    expect(r.key.some(s => s.includes('numeric'))).toBe(true)
    expect(r.quality.length).toBeGreaterThan(0)
    expect(r.highlights.length).toBeGreaterThan(0)
  })
})
