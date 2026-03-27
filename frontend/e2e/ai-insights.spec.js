/**
 * E2E — AI Insights data binding
 * Regression tests for Bug 3:
 *   generateInsights() read summary.total_rows / total_columns which don't
 *   exist in the API response — resulting in 0 rows / 0 columns.
 */
import { test, expect } from '@playwright/test'

const EMAIL    = process.env.TEST_USER_EMAIL    || 'demo@datahubpro.com'
const PASSWORD = process.env.TEST_USER_PASSWORD || 'demopassword'

async function logIn(page) {
  await page.goto('/login')
  await page.locator('input[type="email"], input[name="email"]').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /sign.?in|log.?in/i }).click()
  await page.waitForURL(/\/hub/, { timeout: 12_000 })
}

async function selectFirstFile(page) {
  const sel = page.locator('select')
  const options = await sel.locator('option').all()
  if (options.length < 2) return false
  await sel.selectOption(await options[1].getAttribute('value'))
  return true
}

test.describe('AI Insights (Bug 3 regression)', () => {
  test.beforeEach(async ({ page }) => {
    await logIn(page)
    await page.goto('/ai-insights')
    await page.waitForLoadState('networkidle')
  })

  test('page loads with heading, selector and Generate button', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /ai insights/i })).toBeVisible()
    await expect(page.locator('select')).toBeVisible()
    await expect(page.getByRole('button', { name: /generate insights/i })).toBeVisible()
  })

  test('Generate button is disabled with no file selected', async ({ page }) => {
    await expect(page.getByRole('button', { name: /generate insights/i })).toBeDisabled()
  })

  test('Generate button enables once a file is selected', async ({ page }) => {
    if (!await selectFirstFile(page)) return
    await expect(page.getByRole('button', { name: /generate insights/i })).toBeEnabled()
  })

  test('shows non-zero rows and columns — Bug 3 was always 0', async ({ page }) => {
    if (!await selectFirstFile(page)) { console.log('No files — skipping'); return }
    await page.getByRole('button', { name: /generate insights/i }).click()
    await page.waitForFunction(() => document.body.innerText.includes('Rows') && document.body.innerText.includes('Columns'), { timeout: 15_000 })
    const body = await page.locator('body').innerText()
    // REGRESSION: must NOT show 0
    expect(body).not.toMatch(/Rows\s*\n?\s*0\b/)
    expect(body).not.toContain('Dataset has 0 records')
    expect(body).not.toMatch(/Columns\s*\n?\s*0\b/)
  })

  test('Key Findings card appears with record count', async ({ page }) => {
    if (!await selectFirstFile(page)) return
    await page.getByRole('button', { name: /generate insights/i }).click()
    await page.waitForTimeout(4_000)
    await expect(page.getByText(/Key Findings/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Dataset has \d/)).toBeVisible({ timeout: 5_000 })
  })

  test('Data Quality card appears', async ({ page }) => {
    if (!await selectFirstFile(page)) return
    await page.getByRole('button', { name: /generate insights/i }).click()
    await page.waitForTimeout(4_000)
    await expect(page.getByText(/Data Quality/i)).toBeVisible({ timeout: 10_000 })
  })

  test('Column Highlights card appears', async ({ page }) => {
    if (!await selectFirstFile(page)) return
    await page.getByRole('button', { name: /generate insights/i }).click()
    await page.waitForTimeout(4_000)
    await expect(page.getByText(/Column Highlights/i)).toBeVisible({ timeout: 10_000 })
  })
})
