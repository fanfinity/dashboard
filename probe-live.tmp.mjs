// Drives the Live Events page against the stub backend.
import { chromium } from 'playwright'

const BASE = 'http://localhost:9001'

const browser = await chromium.launch()
const ctx = await browser.newContext()
await ctx.addInitScript(() => {
  localStorage.setItem('sfere_access_token', 'stub-access')
  localStorage.setItem('sfere_refresh_token', 'stub-refresh')
  localStorage.setItem('sfere_data_source_mode', 'real')
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push('pageerror: ' + e.message))
page.on('console', m => {
  if (m.type() === 'error') errors.push('console.error: ' + m.text())
})
page.on('response', r => {
  if (r.url().includes('localhost:8080'))
    console.log('RES', r.status(), r.url())
})

await page.goto(`${BASE}/#/live-events`, { waitUntil: 'load' })
await page.waitForTimeout(2500)

const h1 = await page
  .locator('h1')
  .first()
  .textContent()
  .catch(() => null)
const rows = await page.locator('tbody tr').allTextContents()
console.log('H1:', JSON.stringify(h1))
console.log('ROWS:', JSON.stringify(rows))

// Open the detail drawer for the first row.
if (rows.length) {
  await page.locator('tbody tr').first().click()
  await page.waitForTimeout(500)
  const drawer = await page
    .locator('.q-dialog .q-card')
    .textContent()
    .catch(() => null)
  console.log(
    'DRAWER:',
    JSON.stringify((drawer || '').replace(/\s+/g, ' ').slice(0, 500))
  )
}
console.log('ERRORS:', errors)
await browser.close()
