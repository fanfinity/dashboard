#!/usr/bin/env node
// Gate for openapi/sfere-cdp-contract.yaml. Three checks, in order of how
// expensive the failure is to discover later:
//
//   1. The committed YAML is what the current inputs produce. A stale contract
//      is the whole failure mode this document exists to prevent, so a forgotten
//      `pnpm contract:build` has to fail rather than pass quietly.
//
//   2. The YAML round-trips. scripts/build-cdp-contract.mjs emits YAML with a
//      hand-rolled emitter (no `yaml` dependency), so "it validates" is not the
//      same as "it says what the builder meant" — a quoting bug can turn the
//      string "null" into null, or "on" into true, and still validate.
//
//   3. Every shipped operation still matches openapi/sfere-api.json field
//      for field. This is the promise `x-sfere-status: shipped` makes.
//
// Run: pnpm contract:check (which also runs @scalar/cli's own validation)

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const CONTRACT = resolve(root, 'openapi/sfere-cdp-contract.yaml')
const SHIPPED_SPEC = resolve(root, 'openapi/sfere-api.json')

const work = mkdtempSync(join(tmpdir(), 'sfere-contract-'))
const failures = []

function fail(check, detail) {
  failures.push({ check, detail })
}

try {
  // -- 1. the committed file is current ------------------------------------
  const committed = readFileSync(CONTRACT, 'utf8')
  const rebuiltJson = join(work, 'rebuilt.json')

  execFileSync(
    'node',
    [resolve(here, 'build-cdp-contract.mjs'), '--json', rebuiltJson],
    {
      cwd: root,
      stdio: 'pipe'
    }
  )

  const rebuilt = readFileSync(CONTRACT, 'utf8')
  if (rebuilt !== committed) {
    fail(
      'up to date',
      'openapi/sfere-cdp-contract.yaml is not what the current inputs produce.\n' +
        '    Run `pnpm contract:build` and commit the result.'
    )
  }

  // -- 2. the YAML round-trips --------------------------------------------
  const intended = JSON.parse(readFileSync(rebuiltJson, 'utf8'))
  const roundTripped = join(work, 'roundtrip.json')

  // `scalar document format` reserialises YAML to JSON without resolving $refs,
  // so the result is structurally comparable to what the builder held.
  execFileSync(
    'npx',
    ['scalar', 'document', 'format', CONTRACT, '--output', roundTripped],
    {
      cwd: root,
      stdio: 'pipe'
    }
  )

  const parsed = JSON.parse(readFileSync(roundTripped, 'utf8'))

  const diffs = []
  function compare(a, b, path) {
    if (diffs.length >= 20) return
    if (a === b) return

    if (
      a === null ||
      b === null ||
      typeof a !== 'object' ||
      typeof b !== 'object'
    ) {
      diffs.push(
        `${path}: builder had ${JSON.stringify(a)}, YAML parsed as ${JSON.stringify(b)}`
      )
      return
    }

    if (Array.isArray(a) !== Array.isArray(b)) {
      diffs.push(`${path}: array/object mismatch`)
      return
    }

    if (Array.isArray(a)) {
      if (a.length !== b.length) {
        diffs.push(`${path}: length ${a.length} vs ${b.length}`)
        return
      }
      a.forEach((item, i) => compare(item, b[i], `${path}[${i}]`))
      return
    }

    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const key of keys) {
      if (!(key in a)) {
        diffs.push(`${path}.${key}: absent in builder, present in YAML`)
        continue
      }
      if (!(key in b)) {
        diffs.push(`${path}.${key}: present in builder, lost in YAML`)
        continue
      }
      compare(a[key], b[key], `${path}.${key}`)
    }
  }

  compare(intended, parsed, '')

  if (diffs.length) {
    fail(
      'YAML round-trip',
      `the emitter and the parser disagree — likely a quoting bug in scripts/build-cdp-contract.mjs:\n` +
        diffs.map(d => `    ${d}`).join('\n')
    )
  }

  // -- 3. shipped operations still match the backend ----------------------
  const shipped = JSON.parse(readFileSync(SHIPPED_SPEC, 'utf8'))
  const METHODS = new Set([
    'get',
    'put',
    'post',
    'delete',
    'patch',
    'options',
    'head',
    'trace'
  ])

  // The builder rewrites prose and hoists the repeated Problem schema; neither
  // changes the wire contract, so both are expected to differ.
  const PROSE = new Set([
    'summary',
    'description',
    'tags',
    'x-sfere-status',
    'x-jitsu-equivalent'
  ])

  function stripProblem(node) {
    if (Array.isArray(node)) return node.map(stripProblem)
    if (!node || typeof node !== 'object') return node
    if (node.title === 'Problem' && node.properties?.instance)
      return { $ref: '#/components/schemas/Problem' }
    const out = {}
    for (const [k, v] of Object.entries(node)) out[k] = stripProblem(v)
    return out
  }

  let checked = 0
  const mismatches = []

  for (const [path, item] of Object.entries(shipped.paths)) {
    if (path.startsWith('/api/')) continue // internal routes, deliberately excluded

    for (const [method, backendOp] of Object.entries(item)) {
      if (!METHODS.has(method)) continue

      const contractOp = parsed.paths?.[path]?.[method]
      if (!contractOp) {
        mismatches.push(
          `${method.toUpperCase()} ${path} is served by the backend but missing from the contract`
        )
        continue
      }
      if (contractOp['x-sfere-status'] !== 'shipped') {
        mismatches.push(
          `${method.toUpperCase()} ${path} is live on the backend but marked "${contractOp['x-sfere-status']}"`
        )
        continue
      }

      checked += 1

      for (const field of [
        'operationId',
        'parameters',
        'requestBody',
        'responses',
        'security'
      ]) {
        if (PROSE.has(field)) continue
        // FastAPI omits `security` on an unauthenticated route; the contract
        // states `[]` there, because an absent key would inherit the document's
        // global bearer requirement and claim the route needs a token.
        const want =
          field === 'security'
            ? (backendOp.security ?? [])
            : stripProblem(backendOp[field])
        const got = contractOp[field]
        if (JSON.stringify(want) !== JSON.stringify(got)) {
          mismatches.push(
            `${method.toUpperCase()} ${path} → ${field} drifted from the backend spec`
          )
        }
      }
    }
  }

  if (mismatches.length) {
    fail(
      'shipped fidelity',
      'the contract disagrees with openapi/sfere-api.json on an endpoint it calls shipped:\n' +
        mismatches.map(m => `    ${m}`).join('\n')
    )
  }

  if (!failures.length) {
    console.log(
      `contract ok — up to date, round-trips, ${checked} shipped operations match the backend spec`
    )
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}

if (failures.length) {
  for (const { check, detail } of failures)
    console.error(`\n✗ ${check}\n    ${detail}`)
  console.error('')
  process.exit(1)
}
