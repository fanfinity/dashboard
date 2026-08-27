#!/usr/bin/env node
// Builds openapi/sfere-cdp-contract.yaml — the single contract document between
// this dashboard and the backend, served by `pnpm docs:cdp`.
//
// It is generated rather than hand-written for one reason: the shipped half has
// to agree with the running backend byte for byte. A contract that disagrees
// with a live endpoint is worse than no contract, so the shipped operations,
// parameters, request bodies and response schemas are lifted straight out of
// openapi/sfere-api.json (which `pnpm openapi:pull` refreshes from staging)
// instead of being retyped here.
//
// Three inputs, one output:
//
//   openapi/sfere-api.json      what the backend serves today  -> shipped
//   openapi/cdp-proposals.mjs       what the dashboard still needs -> proposed
//   openapi/jitsu-openapi-schema.json  vocabulary + tag prose for the domains
//                                      Jitsu already models
//
// Every operation carries `x-sfere-status: shipped | proposed`, so drift is
// greppable rather than something you rediscover the way `/v1/dashboard` and
// `/v1/errors` were rediscovered (drafted flat, shipped account-scoped).
//
// Run: pnpm contract:build

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { proposedPaths, proposedSchemas } from '../openapi/cdp-proposals.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const openapiDir = resolve(here, '../openapi')

const SHIPPED_SPEC = resolve(openapiDir, 'sfere-api.json')
const JITSU_SPEC = resolve(openapiDir, 'jitsu-openapi-schema.json')
const OUT = resolve(openapiDir, 'sfere-cdp-contract.yaml')

// ---------------------------------------------------------------------------
// YAML emitter
//
// Deliberately dependency-free: neither `yaml` nor `js-yaml` is installed, and
// pulling one in for a docs generator is not worth a lockfile entry. The input
// is always plain JSON-derived data (objects, arrays, strings, numbers,
// booleans, null), which is a small enough subset to emit safely. `pnpm
// contract:check` validates the result with @scalar/cli, so a quoting bug
// fails loudly rather than shipping.
// ---------------------------------------------------------------------------

// Anything outside this set, or that YAML would read back as a non-string
// (`true`, `12`, `~`, a leading `*`), has to be quoted.
const PLAIN_SAFE = /^[A-Za-z_][A-Za-z0-9 _./,()'-]*$/
const YAML_KEYWORD =
  /^(y|Y|yes|Yes|YES|n|N|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF|null|Null|NULL|~)$/

function quote(str) {
  // Match oxfmt's YAML style (`singleQuote: true`) so the generated file is
  // already formatted the way the repo formats everything else. Without this,
  // `pnpm lint` reformats the file and `pnpm contract:build` puts it back —
  // the two fight forever and CI fails whichever ran last.
  //
  // Single-quoted YAML is literal: the only escape it has is `''` for a quote,
  // and it cannot carry a control character. Anything needing more falls back
  // to double-quoted, which is what oxfmt prefers for those too.
  if (!needsDoubleQuotes(str)) return `'${str}'`
  return JSON.stringify(str)
}

function needsDoubleQuotes(str) {
  for (const char of str) {
    const code = char.codePointAt(0)
    if (char === "'" || code < 0x20 || code === 0x7f) return true
  }
  return false
}

function emitScalar(value) {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'number')
    return Number.isFinite(value) ? String(value) : quote(String(value))
  const str = String(value)
  if (str === '') return "''"
  if (YAML_KEYWORD.test(str)) return quote(str)
  if (!PLAIN_SAFE.test(str)) return quote(str)
  if (str.endsWith(' ') || str.endsWith(':')) return quote(str)
  return str
}

function emitKey(key) {
  const str = String(key)
  // Paths (`/v1/...`), templated segments (`{account_id}`) and status codes as
  // keys all fail the plain-scalar test, so most keys here end up quoted.
  if (PLAIN_SAFE.test(str) && !YAML_KEYWORD.test(str)) return str
  return quote(str)
}

// Long prose is emitted as a literal block, which keeps markdown readable: a
// quoted scalar would turn every newline into `\n` and every quote into `\"`,
// and the descriptions here carry lists, tables and fenced code. It does not
// re-wrap long lines — folding them would need `>-`, whose whitespace rules
// would mangle exactly that markdown.
//
// The chomping indicator is load-bearing: `|-` strips every trailing newline,
// and several descriptions in the backend's own spec end with one. Getting this
// wrong silently rewrites a shipped description, which is why
// `pnpm contract:check` diffs the parsed YAML back against this object.
function emitBlockText(text, indent) {
  // A block scalar cannot carry trailing whitespace on a line, nor a leading
  // space on its first line without an explicit indentation indicator, and more
  // than one trailing newline needs `|+` plus padding lines. All three are rare
  // in prose — fall back to a quoted scalar rather than get them subtly wrong.
  if (/[ \t]$/m.test(text)) return null
  if (/^[ \t]/.test(text)) return null

  const body = text.replace(/\n+$/, '')
  const trailingNewlines = text.length - body.length
  if (trailingNewlines > 1) return null

  const pad = ' '.repeat(indent)
  const lines = body.split('\n').map(line => (line ? pad + line : ''))
  // `|` keeps exactly one trailing newline; `|-` keeps none.
  return `${trailingNewlines === 1 ? '|' : '|-'}\n${lines.join('\n')}`
}

function useBlock(value) {
  return (
    typeof value === 'string' && (value.includes('\n') || value.length > 100)
  )
}

function emit(value, indent = 0) {
  const pad = ' '.repeat(indent)

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const parts = value.map(item => {
      if (item !== null && typeof item === 'object') {
        const nested = emit(item, indent + 2)
        // The first line of a nested block rides on the dash.
        return `${pad}- ${nested.replace(/^\s+/, '')}`
      }
      return `${pad}- ${emitScalar(item)}`
    })
    return `\n${parts.join('\n')}`
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined)
    if (entries.length === 0) return '{}'
    const parts = entries.map(([key, val]) => {
      const k = emitKey(key)
      if (val !== null && typeof val === 'object') {
        const nested = emit(val, indent + 2)
        return nested.startsWith('\n') || nested === '{}' || nested === '[]'
          ? `${pad}${k}:${nested === '{}' || nested === '[]' ? ' ' + nested : nested}`
          : `${pad}${k}:\n${nested}`
      }
      if (useBlock(val)) {
        const block = emitBlockText(val, indent + 2)
        if (block) return `${pad}${k}: ${block}`
      }
      return `${pad}${k}: ${emitScalar(val)}`
    })
    return `\n${parts.join('\n')}`
  }

  return emitScalar(value)
}

function toYaml(doc) {
  // Top level is a map; strip the leading newline emit() adds for nesting.
  return emit(doc, 0).replace(/^\n/, '') + '\n'
}

// ---------------------------------------------------------------------------
// Shipped half — lifted from the backend's own spec
// ---------------------------------------------------------------------------

const shipped = JSON.parse(readFileSync(SHIPPED_SPEC, 'utf8'))
const jitsu = JSON.parse(readFileSync(JITSU_SPEC, 'utf8'))

// Untagged, unversioned routes. `/api/sources/by-store` is an internal lookup
// and `/api/zid/install-report` is a Zid webhook — neither is a dashboard call,
// so neither belongs in a dashboard contract.
const INTERNAL_PATHS = new Set([
  '/api/sources/by-store',
  '/api/zid/install-report'
])

// FastAPI derives summaries from function names ("List Sources Route"), which
// reads as noise in Scalar's sidebar. Paths, parameters, bodies, responses and
// operationIds are carried over untouched; only the prose is rewritten, plus a
// pointer at the Jitsu operation each one corresponds to.
const SHIPPED_DOCS = {
  getMe: {
    summary: 'Get the signed-in user',
    description:
      'Returns the authenticated user and every account membership they hold. The dashboard calls this once on sign-in and on cold load into an authed route; `memberships[0].account` is what settles the current account that the rest of these paths are scoped to.'
  },
  register: {
    summary: 'Register a user',
    description:
      'Creates the user at the Identity Platform **project** level and provisions their first account. The backend requires a verified email before `/v1/auth/token` will succeed.'
  },
  login: {
    summary: 'Exchange credentials for tokens',
    description:
      'OAuth2 password grant, `application/x-www-form-urlencoded`. Returns a short-lived (~1h) access token plus a refresh token. Sign-in goes through the backend rather than the Identity Platform SDK, so the browser never talks to Identity Platform directly.'
  },
  refresh: {
    summary: 'Refresh an access token',
    description:
      'Trades a refresh token for a fresh pair. The dashboard calls this once on a 401 and retries the original request; a failed refresh clears the session and the router guard bounces to `/login`.'
  },
  createAccount: {
    summary: 'Create an account',
    description:
      "Registration already creates the caller's first account, so this is for additional ones — an agency running several brands, or a customer separating staging from production data."
  },
  listAccounts: {
    summary: 'List accounts',
    description: 'Accounts the caller is a member of.',
    jitsu: 'GET /api/workspace'
  },
  getAccount: {
    summary: 'Get an account',
    description:
      'An account is the tenancy boundary for everything in this contract. `jitsu_workspace_id` is the workspace the backend provisions behind it — it is exposed for support and debugging, not for the dashboard to call.',
    jitsu: 'GET /api/workspace/{workspaceIdOrSlug}'
  },
  listCustomers: {
    summary: 'List customers',
    description:
      'Flat, not account-scoped: this is the cross-account customer index.\n\n**This endpoint requires no authentication today.** That is what the backend serves, so it is what this contract records — but a cross-account customer list reachable without a token is worth a second look, and nothing in the dashboard relies on it staying open.'
  },
  getCustomer: {
    summary: 'Get a customer',
    description: 'Unauthenticated today, like the rest of the customer index.'
  },
  listCustomerEvents: {
    summary: "List a customer's events",
    description: 'Unauthenticated today, like the rest of the customer index.'
  },
  listMembers: {
    summary: 'List account members',
    description:
      'Roles are `owner`, `admin`, `member`, `viewer`, and they gate writes on everything below. Whether a module is *built* is a separate question — see `x-sfere-status`.'
  },
  inviteMember: {
    summary: 'Invite a member',
    description: "Invites by email. A role above the inviter's own is refused."
  },
  removeMember: {
    summary: 'Remove a member',
    description:
      'Revokes access immediately. Removing the last owner is refused.'
  },
  createSupportSession: {
    summary: 'Open a support session',
    description:
      'Grants time-boxed support access to an account. Flat by design — a support session spans accounts.'
  },
  listSupportSessions: {
    summary: 'List support sessions',
    description:
      'Sessions the caller can see — their own, or all of them for a support role.'
  },
  endSupportSession: {
    summary: 'End a support session',
    description:
      'Revokes the access early rather than waiting for it to expire.'
  },

  listSources: {
    summary: 'List sources',
    description:
      'A source is where data enters. Two kinds today: an `event_stream` (Web/iOS/Android SDK, HTTP API) that receives events on a write key, and a `cloud_app` (Zid, Shopify, Stripe) that the backend polls on a schedule. Jitsu models those as two objects — a stream and a service; Sfere models them as one, distinguished by `source_type`. `jitsu_site_id` is null until a site is provisioned, and a source without one has no event log.',
    jitsu: 'GET /api/{workspaceId}/config/stream + /config/service'
  },
  createSource: {
    summary: 'Create a source',
    description:
      'Provisions the underlying site and write key, so this does more than write a row — it is why creates go through the generated client rather than the flat mutation helper.',
    jitsu: 'POST /api/{workspaceId}/config/stream'
  },
  getSource: {
    summary: 'Get a source',
    description:
      'Same shape as a row from the list. `write_key` is present only for an `event_stream`, and only in full on the create response.',
    jitsu: 'GET /api/{workspaceId}/config/stream/{id}'
  },
  updateSource: {
    summary: 'Enable or pause a source',
    description:
      'The only mutable field today is `is_enabled`. Renaming and reconfiguring are proposed, not shipped.',
    jitsu: 'PUT /api/{workspaceId}/config/stream/{id}'
  },
  deleteSource: {
    summary: 'Delete a source',
    description:
      'Hard delete. Soft-delete with a restore window is proposed under Trash — the dashboard has a trash screen with no endpoint behind it.',
    jitsu: 'DELETE /api/{workspaceId}/config/stream/{id}'
  },
  getZidConnectStatus: {
    summary: 'Get Zid connection status',
    description:
      'Whether the store has completed the Zid OAuth handshake, and what the backend knows about it.'
  },
  connectZidSource: {
    summary: 'Connect a Zid store',
    description:
      'Zid-specific because Zid is the first `cloud_app` connector to ship. The proposed generic replacement is the OAuth authorization flow under Authorizations.'
  },
  triggerSourceSync: {
    summary: 'Trigger a sync run',
    description:
      'Starts a pull from a `cloud_app` source. `mode` picks the window: `full` re-pulls everything, `incremental` resumes from the last watermark, `date_range` uses `date_from`/`date_to`.',
    jitsu: 'GET /api/{workspaceId}/sources/run'
  },
  listSourceSyncRuns: {
    summary: 'List sync runs',
    description:
      'Newest first. `counts` is an open object so a connector can report its own per-entity totals.',
    jitsu: 'GET /api/{workspaceId}/sources/tasks'
  },
  listSourceCustomers: {
    summary: 'List customers pulled from a source',
    description:
      "What this source's last sync actually landed, scoped to the account. Not the same as `/v1/customers`, which is the cross-account index."
  },
  listSourceOrders: {
    summary: 'List orders pulled from a source',
    description:
      'Only meaningful for a `cloud_app` source syncing commerce data; an event stream has none.'
  },
  listSourceEvents: {
    summary: 'List event-type counts for a source',
    description:
      'Counts per event type, not the events themselves — for those, use the live event log.'
  },

  listDestinations: {
    summary: 'List destinations',
    description:
      'A destination is where data lands — a warehouse the backend provisions per account, or a downstream service. `config` is typed per `destination_type`; see `AnyDestinationConfig`.',
    jitsu: 'GET /api/{workspaceId}/config/destination'
  },
  createDestination: {
    summary: 'Create a destination',
    description:
      'For a warehouse destination the backend provisions a per-account ClickHouse database, which is why `clickhouse_database` appears on the response and not on the request.',
    jitsu: 'POST /api/{workspaceId}/config/destination'
  },
  getDestination: {
    summary: 'Get a destination',
    description:
      'Credentials in `config` are always masked as `"***"` on read.',
    jitsu: 'GET /api/{workspaceId}/config/destination/{id}'
  },
  updateDestination: {
    summary: 'Enable or pause a destination',
    description:
      'Only `is_enabled` is mutable. Pausing stops delivery but leaves the pipelines pointing here wired up, so re-enabling resumes without rebuilding anything.',
    jitsu: 'PUT /api/{workspaceId}/config/destination/{id}'
  },
  deleteDestination: {
    summary: 'Delete a destination',
    description:
      'Hard delete, and the provisioned warehouse database goes with it. Pipelines pointing here are left referring to a destination that no longer exists — soft-delete with a restore window is proposed under Trash.',
    jitsu: 'DELETE /api/{workspaceId}/config/destination/{id}'
  },
  listDestinationEvents: {
    summary: 'List event-type counts for a destination',
    description:
      'What actually arrived here, by event type. Comparing it with the source-side counts is how you spot a pipeline dropping events.'
  },

  listLiveEvents: {
    summary: 'Stream the live event log',
    description:
      "Returns already-flattened, vendor-neutral records: unwrapping ingest envelopes, redacting credential headers and masking write keys are the backend's job, not the dashboard's. `source_id` filters to one source — the Live events screen calls a source a \"stream\", which is Jitsu's word for the same thing."
  },

  getDashboardOverview: {
    summary: 'Get the dashboard overview',
    description:
      'One aggregate call that feeds the whole home screen: totals, per-source and per-destination stats, and time buckets. `minutes` sizes the window (5–180).',
    jitsu: 'GET /api/{workspaceId}/metrics'
  },

  listPipelines: {
    summary: 'List pipelines',
    description:
      'A pipeline wires one source to one destination. Jitsu calls this a link or a connection; the dashboard calls it a pipe. `jitsu_link_id` is the provisioned delivery link.',
    jitsu: 'GET /api/{workspaceId}/config/link'
  },
  createPipeline: {
    summary: 'Create a pipeline',
    description:
      'Provisions the delivery link between the two, so this is a typed create rather than a flat write.',
    jitsu: 'POST /api/{workspaceId}/config/link'
  },
  getPipeline: {
    summary: 'Get a pipeline',
    description:
      'The wiring only — `source_id`, `destination_id` and whether it is enabled. The transforms that run on it are a separate read.'
  },
  updatePipeline: {
    summary: 'Enable or pause a pipeline',
    description:
      'Only `is_enabled` is mutable; a pipeline cannot be repointed at a different source or destination, so changing either means creating a new one. Pausing stops delivery without discarding the attached functions.',
    jitsu: 'PUT /api/{workspaceId}/config/link'
  },
  deletePipeline: {
    summary: 'Delete a pipeline',
    description:
      'Tears down the delivery link. The source and destination survive — only the wiring between them goes.',
    jitsu: 'DELETE /api/{workspaceId}/config/link'
  },
  listPipelineFunctions: {
    summary: "List a pipeline's functions",
    description:
      'Transforms that run on events flowing through this pipeline, in order. Each is instantiated from a template at a version; `latest_template_version` above `template_version` means an upgrade is available.',
    jitsu: 'GET /api/{workspaceId}/config/function'
  },
  updatePipelineFunction: {
    summary: 'Update a pipeline function',
    description:
      "Replaces the function's code. The template link is kept so a reset can still restore it.",
    jitsu: 'PUT /api/{workspaceId}/config/function/{id}'
  },
  resetPipelineFunction: {
    summary: 'Reset a pipeline function to its template',
    description:
      'Discards local edits and re-instantiates from `latest_template_version`.'
  },

  version_version_get: {
    summary: 'Build and release info',
    description:
      'Commit and build stamp of the running service. Unauthenticated and unversioned.'
  },
  healthz_healthz_get: {
    summary: 'Liveness probe',
    description:
      "Whether the process is up. Says nothing about whether an account's data is flowing — that is `/v1/accounts/{account_id}/health`."
  },
  readyz_readyz_get: {
    summary: 'Readiness probe',
    description: 'Whether the service can serve traffic, dependencies included.'
  }
}

// The document declares a global `security: [{ HTTPBearer: [] }]`, so an
// operation with no `security` key of its own inherits it. FastAPI omits the key
// entirely on routes that take no auth dependency rather than emitting
// `security: []`, so those routes have to opt out explicitly or the contract
// claims you need a token to get a token — and Scalar draws a padlock on
// `/healthz`.
//
// The opt-out itself is derived from the spec (`op.security ?? []`), so this set
// is not the source of truth — it is an assertion about what the backend
// currently leaves open, checked below. An endpoint quietly gaining or losing
// auth is worth failing the build over rather than regenerating past.
//
// `listCustomers` / `getCustomer` / `listCustomerEvents` being here is a live
// finding, not a design decision on our side: the backend serves the customer
// index unauthenticated today. The contract records that faithfully and says so
// in the prose.
const PUBLIC_OPERATIONS = new Set([
  'register',
  'login',
  'refresh',
  'listCustomers',
  'getCustomer',
  'listCustomerEvents',
  'version_version_get',
  'healthz_healthz_get',
  'readyz_readyz_get'
])

// sfere-api.json tags operations in lowercase and ships no top-level tag
// list. Map onto the tag set declared below so Scalar groups them under prose.
const TAG_MAP = {
  identity: 'Identity',
  accounts: 'Accounts',
  members: 'Members',
  support: 'Support',
  customers: 'Customers',
  sources: 'Sources',
  destinations: 'Destinations',
  pipelines: 'Pipelines',
  events: 'Events',
  dashboard: 'Dashboard',
  health: 'Health'
}

// Sources carry a lot of weight in the shipped spec; split the sync and
// per-source data reads out so the Sources tag stays navigable.
const OPERATION_TAG_OVERRIDES = {
  triggerSourceSync: 'Syncs',
  listSourceSyncRuns: 'Syncs',
  listSourceCustomers: 'Customers',
  listSourceOrders: 'Customers',
  listSourceEvents: 'Events',
  listDestinationEvents: 'Events',
  listPipelineFunctions: 'Functions',
  updatePipelineFunction: 'Functions',
  resetPipelineFunction: 'Functions',
  getDashboardOverview: 'Dashboard'
}

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

// The backend inlines the full RFC 9457 Problem schema into every single error
// response — about a kilobyte each, well over a hundred times. Hoisting it to
// one component leaves the resolved contract identical and takes ~120KB off the
// file, which is the difference between Scalar rendering briskly and crawling.
const PROBLEM_REF = { $ref: '#/components/schemas/Problem' }

function isProblemSchema(schema) {
  return (
    schema &&
    typeof schema === 'object' &&
    schema.title === 'Problem' &&
    schema.properties &&
    'instance' in schema.properties
  )
}

function hoistProblems(node) {
  if (Array.isArray(node)) return node.map(hoistProblems)
  if (!node || typeof node !== 'object') return node
  if (isProblemSchema(node)) return { ...PROBLEM_REF }
  const out = {}
  for (const [key, value] of Object.entries(node))
    out[key] = hoistProblems(value)
  return out
}

const shippedPaths = {}
const securityDrift = []
const shippedOperationIds = new Set()
let shippedOpCount = 0

for (const [path, item] of Object.entries(shipped.paths)) {
  if (INTERNAL_PATHS.has(path)) continue

  const outItem = {}
  for (const [method, op] of Object.entries(item)) {
    if (!METHODS.has(method)) {
      outItem[method] = hoistProblems(op)
      continue
    }

    const docs = SHIPPED_DOCS[op.operationId] ?? {}
    if (!SHIPPED_DOCS[op.operationId]) {
      console.warn(
        `  ! no prose for shipped operation ${op.operationId} (${method.toUpperCase()} ${path})`
      )
    }
    const isPublic = !op.security || op.security.length === 0
    if (isPublic !== PUBLIC_OPERATIONS.has(op.operationId)) {
      securityDrift.push(
        isPublic
          ? `${op.operationId} (${method.toUpperCase()} ${path}) now needs no auth — add it to PUBLIC_OPERATIONS`
          : `${op.operationId} (${method.toUpperCase()} ${path}) now requires auth — remove it from PUBLIC_OPERATIONS`
      )
    }

    shippedOperationIds.add(op.operationId)
    shippedOpCount += 1

    const tag =
      OPERATION_TAG_OVERRIDES[op.operationId] ??
      TAG_MAP[(op.tags ?? [])[0]] ??
      'Uncategorised'

    // Key order is the render order in Scalar, so build it deliberately rather
    // than inheriting FastAPI's.
    outItem[method] = {
      tags: [tag],
      summary: docs.summary ?? op.summary,
      description: docs.description,
      operationId: op.operationId,
      'x-sfere-status': 'shipped',
      'x-jitsu-equivalent': docs.jitsu,
      parameters: op.parameters ? hoistProblems(op.parameters) : undefined,
      requestBody: op.requestBody ? hoistProblems(op.requestBody) : undefined,
      responses: hoistProblems(op.responses),
      // `[]` is the explicit opt-out from the global requirement. Authenticated
      // operations carry the backend's own array; neither is ever `undefined`,
      // which would silently mean "inherit".
      security: op.security ?? []
    }
  }
  shippedPaths[path] = outItem
}

if (securityDrift.length) {
  console.error(
    "\nThe backend's auth requirements changed. Confirm the change is intended, then"
  )
  console.error('update PUBLIC_OPERATIONS in this file:')
  securityDrift.forEach(line => console.error(`  ${line}`))
  process.exit(1)
}

// The backend's spec documents `DestinationConfig.password` as 'Always "***" in
// API responses' but does not mark it `writeOnly`, which is the machine-readable
// way to say exactly that. Stating it lets Scalar stop offering the field in a
// "try it" response example and lets a generator keep it out of read types —
// this records the behaviour the backend already has, it does not ask for a new
// one. Keep this list tiny and only for that case; anything that would *change*
// the shipped contract belongs in a backend change, not here.
const SHIPPED_SCHEMA_PATCHES = {
  DestinationConfig: schema => ({
    ...schema,
    properties: {
      ...schema.properties,
      password: { ...schema.properties.password, writeOnly: true }
    }
  })
}

// Schemas the shipped operations actually reach, walked transitively so a
// backend schema that no longer has a caller does not ride along.
function collectRefs(node, found = new Set()) {
  if (Array.isArray(node)) {
    node.forEach(item => collectRefs(item, found))
    return found
  }
  if (!node || typeof node !== 'object') return found
  for (const [key, value] of Object.entries(node)) {
    if (key === '$ref' && typeof value === 'string') {
      const name = value.replace('#/components/schemas/', '')
      if (!found.has(name)) {
        found.add(name)
        collectRefs(shipped.components.schemas[name], found)
      }
      continue
    }
    collectRefs(value, found)
  }
  return found
}

const reachable = collectRefs(shippedPaths)
const shippedSchemas = {}
for (const name of [...reachable].sort()) {
  if (name === 'Problem') continue // hoisted below with prose of its own
  const schema = shipped.components.schemas[name]
  if (!schema) {
    console.warn(`  ! shipped spec references missing schema ${name}`)
    continue
  }
  const patch = SHIPPED_SCHEMA_PATCHES[name]
  shippedSchemas[name] = patch ? patch(schema) : schema
}

// ---------------------------------------------------------------------------
// Tags — prose borrowed from Jitsu where Jitsu already says it well, with the
// Sfere mapping appended so a reader lands on the right vocabulary.
// ---------------------------------------------------------------------------

const jitsuTag = name =>
  (jitsu.tags ?? []).find(t => t.name === name)?.description ?? ''

// Strip Jitsu's trailing "[Learn more](...)" line and its doc links: those
// point at Jitsu's docs, and this document describes Sfere's API.
const borrow = name =>
  jitsuTag(name)
    .split('\n')
    .filter(line => !line.startsWith('[Learn more'))
    .join('\n')
    .trim()

const tags = [
  {
    name: 'Identity',
    description:
      'Registration, sign-in and the signed-in user. Sign-in is a backend call, not an Identity Platform SDK call — the browser holds no Firebase config and talks to no host but this API.'
  },
  {
    name: 'Accounts',
    description: `The tenancy boundary. Everything a customer owns hangs off an account, and almost every path below is scoped \`/v1/accounts/{account_id}/…\`.\n\nThis is Sfere's name for what Jitsu calls a workspace: ${borrow('Workspace')}`
  },
  {
    name: 'Members',
    description:
      'Who can see an account, and at what role — owner, admin, member or viewer.'
  },
  {
    name: 'Support',
    description: 'Time-boxed support access to a customer account.'
  },
  {
    name: 'Customers',
    description:
      "End customers — the people an account's data is about, as distinct from the users who sign in to the dashboard."
  },
  {
    name: 'Sources',
    description: `Where data enters. A source is either an **event stream** that receives events on a write key, or a **cloud app** the backend polls on a schedule; \`source_type\` says which.\n\nJitsu splits these into two objects. Its stream: ${borrow('Streams')}\n\nAnd its service: ${borrow('Services')}\n\nSfere merges them, because "add a source" is one job in the product.`
  },
  {
    name: 'Destinations',
    description: `Where data lands.\n\n${borrow('Destinations')}`
  },
  {
    name: 'Pipelines',
    description: `One source wired to one destination. The dashboard calls this a **pipe**; Jitsu calls it a link.\n\n${borrow('Connections')}`
  },
  {
    name: 'Functions',
    description: `Transforms that run on events in flight.\n\n${borrow('Functions')}`
  },
  {
    name: 'Syncs',
    description: `Pulling data from a cloud-app source on demand or on a schedule.\n\n${borrow('Syncs')}`
  },
  {
    name: 'Events',
    description:
      'The live event log and per-source/per-destination event counts. Records come back already flattened and vendor-neutral; the dashboard has no ingestion path and cannot send an event.'
  },
  {
    name: 'Dashboard',
    description:
      'The home screen aggregate — one call that feeds totals, per-entity stats and time buckets.'
  },
  {
    name: 'Metrics',
    description: `Event volume over time, for charts rather than for the home screen tiles.\n\n${borrow('Metrics')}`
  },
  {
    name: 'Connectors',
    description:
      'The catalog of source and destination types available to pick from, and the config schema each one needs. Global rather than account-scoped: the catalog is the same for everybody.'
  },
  {
    name: 'Profiles',
    description: `Per-person profiles built by stitching identities across events.\n\n${borrow('Profile builders')}`
  },
  {
    name: 'Domains',
    description: `Custom ingestion domains.\n\n${borrow('Domains')}`
  },
  {
    name: 'Notifications',
    description: `Where account alerts go.\n\n${borrow('Notification channels')}`
  },
  {
    name: 'Warehouse',
    description: 'Warehouse connections and the models built on top of them.'
  },
  {
    name: 'Monitoring',
    description: 'Delivery errors, error statistics and queue health.'
  },
  {
    name: 'Trash',
    description:
      'Soft-deleted resources and the window in which they can be restored.'
  },
  {
    name: 'Secrets',
    description:
      'Credentials a destination or connector needs, stored by the backend and never returned in full.'
  },
  {
    name: 'Authorizations',
    description:
      "OAuth grants that let the backend pull from a third-party account on the customer's behalf."
  },
  {
    name: 'API tokens',
    description: 'Programmatic access to this API for an account.'
  },
  {
    name: 'Health',
    description:
      'Liveness, readiness and build identity. Unversioned and unauthenticated.'
  }
]

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------

const overlap = Object.keys(proposedPaths).filter(p => p in shippedPaths)
const proposedOnShippedPath = []
for (const path of overlap) {
  for (const method of Object.keys(proposedPaths[path])) {
    if (METHODS.has(method) && shippedPaths[path]?.[method]) {
      proposedOnShippedPath.push(`${method.toUpperCase()} ${path}`)
    }
  }
}
if (proposedOnShippedPath.length) {
  console.error(
    '\nA proposal collides with a shipped operation — the shipped one wins, so remove it from'
  )
  console.error(
    'openapi/cdp-proposals.mjs or the contract will claim an endpoint is unbuilt when it is live:'
  )
  proposedOnShippedPath.forEach(op => console.error(`  ${op}`))
  process.exit(1)
}

// Shipped and proposed operations can share a path (a shipped GET beside a
// proposed PUT), so merge per path item rather than per path.
const paths = { ...shippedPaths }
for (const [path, item] of Object.entries(proposedPaths)) {
  paths[path] = { ...paths[path], ...item }
}

let proposedOpCount = 0
for (const item of Object.values(proposedPaths)) {
  for (const method of Object.keys(item))
    if (METHODS.has(method)) proposedOpCount += 1
}

// Sort so related paths sit together in Scalar's sidebar regardless of which
// input contributed them.
const sortedPaths = {}
for (const path of Object.keys(paths).sort()) sortedPaths[path] = paths[path]

const clash = Object.keys(proposedSchemas).filter(
  name => name in shippedSchemas
)
if (clash.length) {
  console.error(
    `\nProposed schemas reuse a shipped name, which would silently redefine it: ${clash.join(', ')}`
  )
  process.exit(1)
}

const problemSchema = {
  type: 'object',
  title: 'Problem',
  description:
    'RFC 9457 problem details, served as `application/problem+json`. Every error response in this contract uses this shape. The dashboard surfaces `detail` and throws `ApiError` carrying `status` plus this body.',
  properties: {
    type: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      default: 'about:blank',
      title: 'Type'
    },
    title: { type: 'string', title: 'Title' },
    status: { type: 'integer', title: 'Status' },
    detail: { anyOf: [{ type: 'string' }, { type: 'null' }], title: 'Detail' },
    instance: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      title: 'Instance'
    }
  },
  required: ['title', 'status']
}

const schemas = { Problem: problemSchema }
for (const name of [
  ...Object.keys(shippedSchemas),
  ...Object.keys(proposedSchemas)
].sort()) {
  schemas[name] = shippedSchemas[name] ?? proposedSchemas[name]
}

const doc = {
  openapi: '3.1.0',
  info: {
    title: 'Sfere CDP API',
    version: '2026-08-26',
    summary: 'The contract between the Sfere dashboard and the Sfere backend.',
    description: `This document is the agreed interface between the Sfere dashboard and the Sfere backend. It is
one document on purpose, covering both what the backend serves today and what the dashboard
still needs, because two documents that disagree are worse than one that admits what is missing.

## Read the status field first

Every operation carries \`x-sfere-status\`:

- **\`shipped\`** — live on the backend now. Generated directly from the backend's own OpenAPI
  output, so these agree with the running service by construction. Treat them as fixed:
  the dashboard already calls them.
- **\`proposed\`** — not built. Shape, path and vocabulary are a proposal for the backend team,
  derived from what the dashboard's screens need and from how Jitsu models the same domain.
  Nothing here is settled; this is the half to argue with.

An operation that also names \`x-jitsu-equivalent\` has a counterpart in the Jitsu API, given so
the two can be read side by side.

## What Sfere borrows from Jitsu, and what it does not

The backend runs Jitsu underneath — \`Account.jitsu_workspace_id\`, \`Source.jitsu_site_id\`,
\`Destination.jitsu_destination_id\` and \`Pipeline.jitsu_link_id\` are all provisioned there. So
Jitsu's model informs the payload shapes and much of the vocabulary in the proposed half.

It informs **nothing** about the surface:

| Jitsu | Sfere |
| --- | --- |
| \`/api/{workspaceId}/config/stream\` | \`/v1/accounts/{account_id}/sources\` |
| workspace | account |
| stream, service | source (\`source_type\` distinguishes them) |
| link, connection | pipeline (the dashboard says "pipe") |
| \`camelCase\` | \`snake_case\` |
| bare arrays | \`{items, total, page, size, pages}\` |
| \`keyId:secret\` bearer | Identity Platform bearer token |

Jitsu is an implementation detail of the backend, not a host the dashboard knows. The dashboard's
CSP names only the Sfere API hosts, so any endpoint in this document is served by Sfere or it
cannot be called at all.

## Conventions that hold everywhere

- **Scoping follows ownership, not uniformity.** Anything an account owns is under
  \`/v1/accounts/{account_id}/…\`. Identity, the customer index, support sessions, the connector
  catalog and health are flat, because none of them belong to one account.
- **Collections are paginated** with \`page\` (from 1) and \`size\` (max 100), and answer the
  \`Page[…]\` envelope. A read that is inherently bounded — a pipeline's functions, the live event
  log — returns a plain list instead and says so.
- **Fields are \`snake_case\`.** The dashboard camelizes at the edge (\`src/lib/apiShape.js\`);
  do not pre-camelize on the backend to save it the trouble.
- **Errors are RFC 9457** \`application/problem+json\`, the \`Problem\` schema below.
- **Every operation needs a bearer token** unless it states \`security: []\`. Nine do:
  registration, the two token endpoints, the three health probes — and the three
  \`/v1/customers\` reads, which the backend currently serves open. Shipped operations carry the
  backend's own \`security\` verbatim; proposed ones inherit the global requirement.
- **Timestamps are RFC 3339 UTC.**
- **Creates that provision infrastructure accept \`Idempotency-Key\`.** Creating a source, a
  destination or a pipeline has side effects beyond a row, so a retried POST must not double up.
- **Secrets are write-only.** A credential sent in a config comes back as \`"***"\`, never in full.

## Regenerating this file

\`\`\`bash
pnpm openapi:pull      # refresh openapi/sfere-api.json from staging
pnpm contract:build    # regenerate this document
pnpm contract:check    # validate it
pnpm docs:cdp          # browse it on :3001
\`\`\`

The shipped half comes from \`openapi/sfere-api.json\`; the proposed half is hand-written in
\`openapi/cdp-proposals.mjs\`. Edit the proposals there — this file is generated and edits to it
are lost on the next build.`,
    contact: {
      name: 'Sfere',
      url: 'https://sfere.io',
      // Who to argue with about the proposed half. Swap for a team alias when
      // there is one — `contact-properties` wants all three fields present.
      email: 'm.anas@sfere.io'
    },
    // Not an open API. Stated because `info-license` and `license-url` ask for
    // it, and "proprietary" is the honest answer rather than a placeholder MIT.
    license: {
      name: 'Proprietary — Sfere internal',
      url: 'https://sfere.io'
    }
  },
  servers: [
    {
      url: 'https://api-staging.sfere.io',
      description: 'Staging — what the dashboard at app-staging.sfere.io calls'
    },
    {
      url: 'https://api.sfere.io',
      description:
        'Production — not live yet; the production overlay has never been applied'
    },
    {
      url: 'http://localhost:8080',
      description: 'Local backend (../backend, `make run`)'
    }
  ],
  security: [{ HTTPBearer: [] }],
  tags,
  paths: sortedPaths,
  components: {
    securitySchemes: {
      HTTPBearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Identity Platform ID token from `POST /v1/auth/token`, sent as `Authorization: Bearer <access_token>`. Short-lived (~1h); trade the refresh token at `POST /v1/auth/refresh` when it expires. Unlike Jitsu, this is not a `keyId:secret` API key — per-account API tokens are proposed under API tokens.'
      }
    },
    schemas
  }
}

// Every $ref must resolve. A dangling one is easy to introduce by hand in
// cdp-proposals.mjs (a Page_X_ referenced before it is written) and surfaces as
// an opaque Scalar validation failure much later, so catch it here.
const defined = new Set(Object.keys(schemas))
const dangling = new Map()
function checkRefs(node, trail) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => checkRefs(item, `${trail}[${i}]`))
    return
  }
  if (!node || typeof node !== 'object') return
  for (const [key, value] of Object.entries(node)) {
    if (key === '$ref' && typeof value === 'string') {
      const name = value.replace('#/components/schemas/', '')
      if (!defined.has(name) && !dangling.has(name)) dangling.set(name, trail)
      continue
    }
    checkRefs(value, `${trail}.${key}`)
  }
}
checkRefs({ paths: sortedPaths, schemas }, '')

if (dangling.size) {
  console.error(
    '\nUnresolved $ref — define it in openapi/cdp-proposals.mjs or fix the name:'
  )
  for (const [name, trail] of dangling)
    console.error(`  ${name}  (first seen at ${trail})`)
  process.exit(1)
}

writeFileSync(OUT, toYaml(doc))

// `--json <path>` writes the same document as JSON, straight from the object
// the emitter was handed. `pnpm contract:check` diffs that against the YAML
// parsed back by @scalar/cli, which is what proves the hand-rolled emitter did
// not quietly turn a string into a boolean somewhere.
const jsonFlag = process.argv.indexOf('--json')
if (jsonFlag !== -1) {
  const jsonPath = process.argv[jsonFlag + 1]
  if (!jsonPath) {
    console.error('--json needs a path')
    process.exit(1)
  }
  writeFileSync(jsonPath, JSON.stringify(doc, null, 2))
}

const bytes = Buffer.byteLength(readFileSync(OUT))
console.log(
  `\nwrote openapi/sfere-cdp-contract.yaml (${(bytes / 1024).toFixed(0)} KB)`
)
console.log(
  `  ${Object.keys(sortedPaths).length} paths — ${shippedOpCount} shipped, ${proposedOpCount} proposed operations`
)
console.log(
  `  ${Object.keys(schemas).length} schemas — ${Object.keys(shippedSchemas).length} shipped, ${Object.keys(proposedSchemas).length} proposed`
)
console.log(`  ${tags.length} tags`)
