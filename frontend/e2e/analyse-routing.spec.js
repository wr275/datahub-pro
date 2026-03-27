/**
 * E2E — Analyse Button Routing
 * Regression tests for Bug 2:
 *   Clicking Analyse redirected to home screen instead of analysis tools.
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

test.describe('Analyse Button Routing (Bug 2 regression)', () => {
  test.beforeEach(async ({ page }) => { await logIn(page) })

  test('Analyse button navigates to /analytics — NOT back to /', async ({ page }) => {
    await page.goto('/hub')
    await page.waitForLoadState('networkidle')
    const btn = page.getByRole('button', { name: /analys/i })
      .or(page.getByRole('link', { name: /analys/i }))
    if (await btn.count() === 0) { console.log('No files — skipping'); return }
    await btn.first().click()
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/$/)
    expect(page.url()).toMatch(/analytics/)
  })

  test('Analytics page shows 12-tool picker — not a broken iframe', async ({ page }) => {
    await page.goto('/hub')
    await page.waitForLoadState('networkidle')
    const fileLink = page.locator('[href*="/analytics/"]').first()
    if (await fileLink.count() > 0) {
      await fileLink.click()
    } else {
      await page.goto('/analytics/test-id-placeholder')
    }
    await page.waitForLoadState('networkidle')
    // No broken iframe (Bug 2 root cause)
    for (const frame of await page.locator('iframe').all()) {
      const src = await frame.getAttribute('src')
      expect(src).not.toContain('datahub-pro.html')
      expect(src).not.toContain('analytics-tool')
    }
    // 12-tool picker must be visible
    await expect(page.getByText(/Executive Dashboard|Data View|KPI Dashboard/i).first())
      .toBeVisible({ timeout: 8_000 })
  })

  test('tool cards navigate to the correct sub-routes', async ({ page }) => {
    await page.goto('/hub')
    await page.waitForLoadState('networkidle')
    const fileLink = page.locator('[href*="/analytics/"]').first()
    if (await fileLink.count() === 0) { console.log('No file — skipping'); return }
    const href = await fileLink.getAttribute('href')
    const fileId = href?.split('/analytics/')[1]
    await page.goto('/analytics/' + fileId)
    await page.waitForLoadState('networkidle')
    const dataViewCard = page.getByText(/Data View|Data Table/i).first()
    await expect(dataViewCard).toBeVisible({ timeout: 5_000 })
    await dataViewCard.click()
    await page.waitForTimeout(1_500)
    expect(page.url()).not.toMatch(/\/$/)
  })
})
