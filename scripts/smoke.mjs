#!/usr/bin/env node
// Smoke test: visit every route in the screen manifest and assert the page did
// not blow up. This is the only behavioural gate in the repo — there is no test
// runner — so it is deliberately blunt and hard to fool.
//
//   node scripts/smoke.mjs --serve              # build output, own server
//   node scripts/smoke.mjs                      # against SMOKE_BASE (default :9000)
//
// It reads .env itself, so `pnpm smoke:dist` works from a clean shell.
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
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { screens } from '../src/router/screens.js'

// Load .env before anything reads process.env. This used to be the caller's
// job (`node --env-file=.env scripts/smoke.mjs`), which meant a bare
// `pnpm smoke:dist` from a clean shell exited 2 on missing credentials that
// were sitting in .env all along. loadEnvFile does NOT overwrite variables
// that are already set, so `SMOKE_ROUTES=/pipes pnpm smoke:dist` and the
// workflows' env: blocks still win, and passing --env-file as well is
// harmless rather than conflicting.
if (existsSync('.env')) process.loadEnvFile('.env')

const args = process.argv.slice(2)
const SERVE = args.includes('--serve')
const SHOTS = args.includes('--screenshots')
// 9000, not an arbitrary free port, because the origin has to be one the
// backend's CORS_ALLOW_ORIGINS names — sign-in is a real cross-origin POST to
// VITE_API_BASE now, so a browser on any other port is refused at the
// preflight and the run dies before it reaches a single screen. Staging allows
// exactly `http://localhost:9000` today (not 127.0.0.1, not 4173, which is
// what this used to default to). It collides with `pnpm dev` on purpose:
// sharing the dev server's port is what keeps the allowlist to one entry.
// Override with SMOKE_PORT only if the backend has been taught that port too.
const PORT = Number(process.env.SMOKE_PORT || 9000)
const BASE = SERVE
  ? `http://localhost:${PORT}`
  : process.env.SMOKE_BASE || `http://localhost:${PORT}`

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

const IS_LOCAL = /^https?:\/\/localhost[:/]/.test(BASE)

// Which data source the walk runs against. The app defaults to 'real'
// (useDataSource.js), and that is the right default for a run against a
// DEPLOYED origin: the backend allows it, the wired domains return real rows,
// and an unwired one renders "No API yet" — a true picture of the deployed app.
//
// Locally it is the wrong one, for two independent reasons. The backend's
// CORS_ALLOW_ORIGINS does not include this script's static server, so every
// live read is blocked before it leaves the browser — and a blocked read logs a
// console error, which this gate fails on. And even if it were reachable, only
// Sources/Destinations/Pipes have endpoints today, so ~45 of the 54 screens
// would render "No API yet" and the gate would stop exercising the screens it
// exists to check. Mock mode is the only mode where all 54 have data.
//
// Same IS_LOCAL split as IGNORED_CONSOLE below, and preferred over adding
// /v1/dashboard and /v1/errors to that list: an ignore entry is permanent
// blindness to a class of error, this just picks a mode a user could pick too.
// Override with SMOKE_DATA_SOURCE=real to reproduce a real-mode failure
// locally (expect CORS noise), or =mock against a deployed origin.
const DATA_SOURCE =
  process.env.SMOKE_DATA_SOURCE || (IS_LOCAL ? 'mock' : 'real')

// Screens the manifest marks as walkable in Demo data only, dropped here rather
// than half-asserted. Announced rather than filtered silently: a gate that
// quietly narrows its own coverage reads as "all routes clean" when it is not.
const skipped =
  DATA_SOURCE === 'real' ? targets.filter(t => t.smokeMockOnly) : []
const walk = targets.filter(t => !skipped.includes(t))
if (skipped.length) {
  for (const t of skipped) {
    console.log(`  skip  ${t.url} (Demo-data-only screen, real mode)`)
  }
}
await context.addInitScript(mode => {
  try {
    localStorage.setItem('sfere_data_source_mode', mode)
  } catch {
    // Private mode / storage disabled — useDataSource falls back to its own
    // default, which is the pre-existing behaviour, not a new failure.
  }
}, DATA_SOURCE)

// Environmental noise, not page defects. Keep this list SHORT and specific —
// every entry is a class of real bug the gate can no longer see.
//
// The accounts backend allows the deployed dashboard origins but not the local
// static server this script spins up, so useMe()'s GET /v1/me is CORS-blocked
// from a LOCAL run. It fires asynchronously on auth-state-change, landing at
// sign-in on some runs and during the first route on others, which made the
// suite flaky — passing or failing on timing rather than on code.
//
// Gated on the base URL, deliberately. Against a deployed origin
// (SMOKE_BASE=https://app-staging.sfere.io, which deploy-staging.yml uses) that
// origin IS allowed, so a CORS failure there is a real regression in the
// backend's CORS_ALLOW_ORIGINS and must not be swallowed.
const IGNORED_CONSOLE = IS_LOCAL
  ? [
      /Access to fetch at '[^']*\/v1\/me'.*blocked by CORS/i,
      /Failed to load resource.*ERR_FAILED/i
    ]
  : []
const ignored = text => IGNORED_CONSOLE.some(re => re.test(text))

let bucket = []
page.on('pageerror', e => bucket.push(`pageerror: ${e.message}`))
page.on('console', m => {
  if (m.type() !== 'error') return
  const text = m.text()
  if (ignored(text)) return
  bucket.push(`console.error: ${text.slice(0, 200)}`)
})

// Sign in for real through the backend login form (POST /v1/auth/token) — the
// session token lives in localStorage, but exercising the real login is the
// point of the smoke test, so we drive the form rather than inject a token.
console.log(`smoke: signing in at ${BASE}`)
await page.goto(`${BASE}/#/login`, { waitUntil: 'domcontentloaded' })
await page.fill('input[type=email]', EMAIL)
await page.fill('input[type=password]', PASSWORD)
await page.click('button[type=submit]')
try {
  await page.waitForSelector('[data-smoke="nav"]', { timeout: 20000 })
} catch {
  // The two failures here look identical in the DOM and have different fixes,
  // so name them rather than making the reader parse the console dump.
  const noise = bucket.join('\n')
  let diagnosis =
    '       Check SMOKE_EMAIL/SMOKE_PASSWORD and VITE_API_BASE in .env.'
  if (/blocked by CORS/i.test(noise)) {
    diagnosis =
      `       The backend refused this origin (${BASE}). Sign-in is a real\n` +
      `       cross-origin POST, so the origin must be in the backend's\n` +
      `       CORS_ALLOW_ORIGINS — see the SMOKE_PORT note at the top of this file.`
  } else if (/\b401\b/.test(noise)) {
    diagnosis =
      '       The backend rejected these credentials (401). SMOKE_EMAIL must be a\n' +
      '       real account on VITE_API_BASE — the backend authenticates at the\n' +
      '       Identity Platform *project* level, so an account that only ever\n' +
      '       existed in the old tenant will not resolve. Register it with\n' +
      '       POST /v1/register against that same host.'
  }
  console.error(
    'smoke: sign-in did not reach the app shell.\n' +
      `${diagnosis}\n` +
      `       Console so far:\n       ${bucket.join('\n       ') || '(nothing)'}`
  )
  await browser.close()
  process.exit(1)
}

// Reaching `networkidle` once is not enough, and the gap it misses is the normal
// case here rather than an edge one. Almost every composable awaits
// `waitForAccount()` before it builds an account-scoped URL, so its fetch starts
// only after `GET /v1/me` has settled — and the window between the page's own
// assets going quiet and that fetch firing is long enough that the first
// `networkidle` resolves inside it. The route then gets asserted before the
// request that would have failed it was even sent.
//
// Measured, not theorised: in real mode against staging, the same nine-route run
// reported anywhere between one and seven console-error failures depending on
// timing, on identical code. A gate that fails a random subset is worse than a
// slow one, because it also *passes* a random subset.
//
// So: idle, pause long enough for a deferred fetch to be issued, then idle again.
// ~400ms per route, which is the price of the gate meaning what it says.
async function settle() {
  for (const pause of [0, 400]) {
    if (pause) await page.waitForTimeout(pause)
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 })
    } catch {
      // A page that polls never goes idle; that is not a failure on its own.
    }
  }
}

if (SHOTS) mkdirSync('.playwright', { recursive: true })

const failures = []
for (const t of walk) {
  bucket = []
  await page.goto(`${BASE}/#${t.url}`, { waitUntil: 'domcontentloaded' })
  await settle()

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
  `\nsmoke: ${walk.length - failures.length}/${walk.length} routes clean` +
    (skipped.length ? ` (${skipped.length} skipped)` : '')
)
if (failures.length) {
  console.log('\nFailures:')
  for (const f of failures) {
    console.log(`  ${f.route}${f.issue ? ` (#${f.issue})` : ''}`)
    for (const p of f.problems) console.log(`    - ${p}`)
  }
  process.exit(1)
}
