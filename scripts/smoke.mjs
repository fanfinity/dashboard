#!/usr/bin/env node
// Smoke test: visit every route in the screen manifest and assert the page did
// not blow up. This is the only behavioural gate in the repo — there is no test
// runner — so it is deliberately blunt and hard to fool.
//
//   node scripts/smoke.mjs --serve              # build output, own server
//   node scripts/smoke.mjs                      # against SMOKE_BASE (default :9000)
//   SMOKE_ROUTES=/pipes,/sources node scripts/smoke.mjs --serve
//
// It asserts, per route:
//   - no uncaught page errors
//   - no console.error
//   - the not-found page did not render
//   - no ErrorState rendered ([data-smoke="error"])
//   - an <h1> exists with non-empty text
//
// That last set only works because every screen renders the SAME ErrorState and
// PageHeader primitives. Hand-rolled error markup would give 54 different
// selectors and no generic gate.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { screens } from '../src/router/screens.js'

const args = process.argv.slice(2)
const SERVE = args.includes('--serve')
const SHOTS = args.includes('--screenshots')
const PORT = Number(process.env.SMOKE_PORT || 4173)
const BASE = SERVE
  ? `http://localhost:${PORT}`
  : process.env.SMOKE_BASE || 'http://localhost:9000'

const EMAIL = process.env.SMOKE_EMAIL
const PASSWORD = process.env.SMOKE_PASSWORD

if (!EMAIL || !PASSWORD) {
  console.error(
    'smoke: SMOKE_EMAIL / SMOKE_PASSWORD are unset.\n' +
      '       Every route is behind the auth guard, so without these the run is\n' +
      '       meaningless. If you are in a worktree, it has no .env — worktrees\n' +
      '       only inherit tracked files. Create worktrees with `pnpm worktree`,\n' +
      '       or copy .env in by hand. See .env.example.'
  )
  process.exit(2)
}

const only = (process.env.SMOKE_ROUTES || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

const targets = (
  only.length ? screens.filter(s => only.includes(s.path)) : screens
).map(s => ({
  ...s,
  // Substitute :id etc. from the manifest's smokeParams.
  url: Object.entries(s.smokeParams || {}).reduce(
    (p, [k, v]) => p.replace(`:${k}`, v),
    s.path
  )
}))

if (only.length && targets.length !== only.length) {
  const found = targets.map(t => t.path)
  console.error(
    `smoke: these SMOKE_ROUTES are not in the manifest: ${only.filter(r => !found.includes(r)).join(', ')}`
  )
  process.exit(2)
}

let server
if (SERVE) {
  server = spawn(process.execPath, ['scripts/serve-dist.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, SMOKE_PORT: String(PORT) }
  })
  // Poll until it answers rather than sleeping a guessed interval.
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE, { signal: AbortSignal.timeout(500) })
      if (r.ok) break
    } catch {
      await new Promise(r => setTimeout(r, 250))
    }
  }
}

const stop = () => server && server.kill()
process.on('exit', stop)
process.on('SIGINT', () => {
  stop()
  process.exit(130)
})

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 }
})
const page = await context.newPage()

// Environmental noise, not page defects. Keep this list SHORT and specific —
// every entry is a class of real bug the gate can no longer see.
//
// The accounts backend's CORS_ALLOW_ORIGINS does not include localhost (see
// CLAUDE.md), so useMe()'s GET /v1/me always fails from a smoke run. It fires
// asynchronously on auth-state-change, so it lands at sign-in on some runs and
// during the first route on others — which made the whole suite flaky, passing
// or failing on timing rather than on code.
const IGNORED_CONSOLE = [
  /Access to fetch at '[^']*\/v1\/me'.*blocked by CORS/i,
  /Failed to load resource.*ERR_FAILED/i
]
const ignored = text => IGNORED_CONSOLE.some(re => re.test(text))

let bucket = []
page.on('pageerror', e => bucket.push(`pageerror: ${e.message}`))
page.on('console', m => {
  if (m.type() !== 'error') return
  const text = m.text()
  if (ignored(text)) return
  bucket.push(`console.error: ${text.slice(0, 200)}`)
})

// Firebase persists its session to IndexedDB, which Playwright's storageState
// does NOT capture — so there is no way to inject a session; we sign in for real.
console.log(`smoke: signing in at ${BASE}`)
await page.goto(`${BASE}/#/login`, { waitUntil: 'domcontentloaded' })
await page.fill('input[type=email]', EMAIL)
await page.fill('input[type=password]', PASSWORD)
await page.click('button[type=submit]')
try {
  await page.waitForSelector('[data-smoke="nav"]', { timeout: 20000 })
} catch {
  console.error(
    'smoke: sign-in did not reach the app shell.\n' +
      `       Check SMOKE_EMAIL/SMOKE_PASSWORD and VITE_FIREBASE_* in .env.\n` +
      `       Console so far:\n       ${bucket.join('\n       ') || '(nothing)'}`
  )
  await browser.close()
  process.exit(1)
}

if (SHOTS) mkdirSync('.playwright', { recursive: true })

const failures = []
for (const t of targets) {
  bucket = []
  await page.goto(`${BASE}/#${t.url}`, { waitUntil: 'domcontentloaded' })
  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 })
  } catch {
    // A page that polls never goes idle; that is not a failure on its own.
  }

  const problems = [...bucket]
  if (await page.locator('[data-smoke="not-found"]').count()) {
    problems.push('route did not resolve (404 page rendered)')
  }
  if (await page.locator('[data-smoke="error"]').count()) {
    const msg = await page
      .locator('[data-smoke="error"]')
      .first()
      .innerText()
      .catch(() => '')
    problems.push(
      `ErrorState rendered: ${msg.replace(/\s+/g, ' ').slice(0, 120)}`
    )
  }
  const heading = await page
    .locator('h1')
    .first()
    .innerText()
    .catch(() => '')
  if (!heading.trim()) problems.push('no non-empty <h1>')

  if (SHOTS) {
    await page.screenshot({
      path: `.playwright/${t.name}.png`,
      fullPage: true
    })
  }

  if (problems.length) {
    failures.push({ route: t.url, issue: t.issue, problems })
    console.log(`  FAIL  ${t.url}`)
    for (const p of problems) console.log(`        - ${p}`)
  } else {
    console.log(`  ok    ${t.url}`)
  }
}

await browser.close()
stop()

console.log(
  `\nsmoke: ${targets.length - failures.length}/${targets.length} routes clean`
)
if (failures.length) {
  console.log('\nFailures:')
  for (const f of failures) {
    console.log(`  ${f.route}${f.issue ? ` (#${f.issue})` : ''}`)
    for (const p of f.problems) console.log(`    - ${p}`)
  }
  process.exit(1)
}
