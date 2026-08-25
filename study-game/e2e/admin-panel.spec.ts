import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const artifactDir = path.resolve('..', 'artifacts', 'study-game', 'admin')
fs.mkdirSync(artifactDir, { recursive: true })

test('locks the production admin entry when no authenticated server bridge exists', async ({ page }) => {
  await page.goto('/admin.html')
  await expect(page.getByRole('heading', { name: 'Administrator session required' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in securely' })).toHaveAttribute('href', '/giris/?return_to=%2Fsocial%2Fadmin.html')
  await expect(page.locator('[data-testid="admin-user-list"]')).toHaveCount(0)
})

test('reviews, bans, unbans, and audits a Social user through visible controls', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await page.goto('/admin.html?preview=admin')
  await expect(page.getByRole('heading', { name: 'Campus safety' })).toBeVisible()
  await expect(page.getByTestId('admin-user-list').locator('tbody tr')).toHaveCount(4)
  await page.getByRole('row', { name: /Review Selin/ }).click()
  await expect(page.getByTestId('admin-ban-form')).toBeVisible()
  await page.locator('#ban-reason').selectOption('harassment')
  await page.locator('#ban-duration').selectOption('24h')
  await page.locator('#ban-note').fill('Confirmed repeated unwanted messages in the Library.')
  await page.locator('#ban-confirmation').fill('Selin')
  await page.getByRole('button', { name: 'Ban from Social' }).click()
  await expect(page.locator('#admin-alert')).toContainText('was banned from RadioTEDU Social')
  await expect(page.getByTestId('admin-unban-form')).toBeVisible()
  await page.screenshot({ path: path.join(artifactDir, `${testInfo.project.name}-01-banned.png`), fullPage: true })

  await page.locator('#unban-note').fill('Appeal reviewed and access restored.')
  await page.getByRole('button', { name: 'Revoke ban' }).click()
  await expect(page.locator('#admin-alert')).toContainText('ban was revoked')
  await expect(page.getByTestId('admin-ban-form')).toBeVisible()

  await page.getByRole('button', { name: /Reports/ }).click()
  const firstReport = page.getByTestId('admin-report-list').locator('.report-item').first()
  await firstReport.locator('.report-note').fill('Evidence reviewed and recorded.')
  await firstReport.getByRole('button', { name: 'Resolve' }).click()
  await expect(page.locator('#admin-alert')).toContainText('Report resolved')

  await page.getByRole('button', { name: 'Audit log' }).click()
  await expect(page.getByTestId('admin-audit-list').locator('.audit-item')).toHaveCount(3)
  await expect(page.getByTestId('admin-audit-list')).toContainText('ban created')
  await expect(page.getByTestId('admin-audit-list')).toContainText('ban revoked')
  await expect(page.getByTestId('admin-audit-list')).toContainText('report resolved')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await page.screenshot({ path: path.join(artifactDir, `${testInfo.project.name}-02-audit.png`), fullPage: true })
})
