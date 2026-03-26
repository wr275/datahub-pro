/**
 * E2E — Landing Page auth-aware rendering
 * Regression tests for Bug 1:
 *   Sign In / Start Free Trial auto-redirected authenticated users to /hub
 *   instead of showing the login form.
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

async function clearAuth(page) {
  await page.evaluate(() => localStorage.clear())
}

test.describe('Landing Page (logged-out)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearAuth(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('shows Sign In button', async ({ page }) => {
    const signIn = page.getByRole('link', { name: /sign.?in/i })
      .or(page.getByRole('button', { name: /sign.?in/i }))
    await expect(signIn.first()).toBeVisible()
  })

  test('shows Free Trial / Start button', async ({ page }) => {
    const trial = page.getByRole('link', { name: /free.?trial|start/i })
      .or(page.getByRole('button', { name: /free.?trial|start/i }))
    await expect(trial.first()).toBeVisible()
  })

  test('clicking Sign In leads to login form — NOT /hub', async ({ page }) => {
    const signIn = page.getByRole('link', { name: /sign.?in/i })
      .or(page.getByRole('button', { name: /sign.?in/i }))
    await signIn.first().click()
    await page.waitForTimeout(1_500)
    // Must NOT auto-redirect to hub (that was Bug 1)
    expect(page.url()).not.toMatch(/\/hub/)
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('Landing Page (logged-in)', () => {
  test.beforeEach(async ({ page }) => {
    await logIn(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('shows Go to Dashboard button', async ({ page }) => {
    const dash = page.getByRole('link', { name: /dashboard/i })
      .or(page.getByRole('button', { name: /dashboard/i }))
    await expect(dash.first()).toBeVisible()
  })

  test('does NOT show Sign In button when already logged in', async ({ page }) => {
    const signIn = page.getByRole('link', { name: /^sign.?in$/i })
      .or(page.getByRole('button', { name: /^sign.?in$/i }))
    await expect(signIn).toHaveCount(0)
  })

  test('landing page does NOT auto-redirect to /hub (Bug 1 regression)', async ({ page }) => {
    // Before the fix: visiting / while logged in immediately went to /hub
    await expect(page).not.toHaveURL(/\/hub/)
    await expect(page).toHaveURL(/\/$|\/index/)
  })
})
