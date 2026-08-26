// Drives the Sources list page against the stub backend: seeds session tokens,
// opens /sources in real-data mode, and reports what the table renders.
import { chromium } from 'playwright'

const BASE = 'http://localhost:9001'

const browser = await chromium.launch()
const ctx = await browser.newContext()
await ctx.addInitScript(() => {
  localStorage.setItem('sfere_access_token', 'stub-access')
  localStorage.setItem('sfere_refresh_token', 'stub-refresh')
  // default is already real, but pin it in case a previous run stored 'mock'
  localStorage.setItem('sfere_data_source_mode', 'real')
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push('pageerror: ' + e.message))
page.on('console', m => {
  if (m.type() === 'error') errors.push('console.error: ' + m.text())
})
page.on('response', r => console.log('RES', r.status(), r.url()))
page.on('requestfailed', r =>
  console.log('FAIL', r.url(), r.failure()?.errorText)
)

await page.goto(`${BASE}/#/sources`, { waitUntil: 'load' })
await page.waitForTimeout(1500)

const h1 = await page
  .locator('h1')
  .first()
  .textContent()
  .catch(() => null)
const rows = await page.locator('tbody tr').allTextContents()
const bodyText = (await page.locator('body').textContent()).slice(0, 400)
console.log('H1:', JSON.stringify(h1))
console.log('ROWS:', JSON.stringify(rows))
console.log('BODY HEAD:', JSON.stringify(bodyText.replace(/\s+/g, ' ')))
console.log('ERRORS:', errors)
await browser.close()
