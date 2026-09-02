// Field-drift test: for each PR#16-wired composable, collect the camelCase
// identifiers it reads off a record and check each against the camelized
// property set of the endpoint's success schema in the new contract.
import fs from 'node:fs'

const spec = JSON.parse(fs.readFileSync('openapi/fanfinity-api.json', 'utf8'))
const S = spec.components.schemas
const camel = s => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())

// Walk a schema and collect every property name reachable (nested included).
function collect(node, out = new Set(), depth = 0, seen = new Set()) {
  if (!node || depth > 6) return out
  if (node.$ref) {
    const n = node.$ref.split('/').pop()
    if (seen.has(n)) return out
    seen.add(n)
    return collect(S[n], out, depth + 1, seen)
  }
  for (const key of ['anyOf', 'oneOf', 'allOf']) {
    if (node[key]) node[key].forEach(s => collect(s, out, depth, seen))
  }
  if (node.items) collect(node.items, out, depth, seen)
  if (node.properties) {
    for (const [p, v] of Object.entries(node.properties)) {
      out.add(camel(p))
      out.add(p)
      collect(v, out, depth + 1, seen)
    }
  }
  return out
}

function fieldsFor(paths) {
  const out = new Set()
  for (const p of paths) {
    const item = spec.paths[p]
    if (!item) {
      console.log(`  !! PATH MISSING FROM CONTRACT: ${p}`)
      continue
    }
    for (const op of Object.values(item)) {
      for (const [code, r] of Object.entries(op.responses || {})) {
        if (!['200', '201', '202'].includes(code)) continue
        const sch = r.content?.['application/json']?.schema
        if (sch) collect(sch, out)
      }
      const rb = op.requestBody?.content?.['application/json']?.schema
      if (rb) collect(rb, out)
    }
  }
  return out
}

const A = '/v1/accounts/{account_id}'
const MAP = {
  useApiTokens: [`${A}/api-tokens`, `${A}/api-tokens/{api_token_id}`],
  useFunctions: [
    `${A}/functions`,
    `${A}/functions/{function_id}`,
    `${A}/functions/{function_id}/test`
  ],
  usePipelineFunctions: [
    `${A}/pipelines/{pipeline_id}/functions`,
    `${A}/pipelines/{pipeline_id}/functions/{function_id}`,
    `${A}/pipelines/{pipeline_id}/functions/{function_id}/reset`
  ],
  useIdentifierTypes: [`${A}/identifier-types`],
  useMonitoringHealth: [`${A}/health`],
  useDiagram: [`${A}/pipelines/diagram`],
  useIngestDomains: [
    `${A}/domains`,
    `${A}/domains/{domain_id}`,
    `${A}/domains/{domain_id}/verify`
  ],
  useNotificationChannels: [
    `${A}/notification-channels`,
    `${A}/notification-channels/{notification_channel_id}`,
    `${A}/notification-channels/{notification_channel_id}/test`
  ],
  useProfileBuilders: [
    `${A}/profile-builders`,
    `${A}/profile-builders/{profile_builder_id}`
  ],
  useConnectorImages: [
    `${A}/connector-images`,
    `${A}/connector-images/{connector_image_id}`
  ],
  useZidConnections: [`${A}/zid-connections`, `${A}/zid-authorize`],
  useSourceWriteKeys: [
    `${A}/sources/{source_id}/write-keys`,
    `${A}/sources/{source_id}/write-keys/{write_key_id}`
  ],
  useSourceIngestSettings: [`${A}/sources/{source_id}/ingest-settings`],
  useSourceCatalogAPI: [
    `${A}/sources/{source_id}/catalog`,
    `${A}/sources/{source_id}/discover`,
    `${A}/sources/{source_id}/sync-schedule`,
    `${A}/sources/{source_id}/test`
  ],
  useDestinationBrowser: [
    `${A}/destinations/{destination_id}/tables`,
    `${A}/destinations/{destination_id}/tables/{table_name}/rows`,
    `${A}/destinations/{destination_id}/query`,
    `${A}/destinations/{destination_id}/test`,
    `${A}/destinations/test`
  ],
  useTeam: [`${A}/members`, `${A}/members/{user_id}`],
  useSourceSyncAPI: [
    `${A}/sources/{source_id}/sync`,
    `${A}/sources/{source_id}/sync-runs`,
    `${A}/sources/{source_id}/sync-runs/{sync_run_id}`,
    `${A}/sources/{source_id}/sync-runs/{sync_run_id}/cancel`,
    `${A}/sources/{source_id}/sync-runs/{sync_run_id}/logs`
  ],
  useConnectorCatalog: [
    '/v1/connectors',
    '/v1/connectors/{connector_id}',
    '/v1/connectors/{connector_id}/spec'
  ]
}

// Identifiers that are local plumbing, not record fields.
const IGNORE = new Set(
  (
    'data loading error apiMissing load reload state ok skipped value length map filter find ' +
    'push slice sort join then catch finally toString valueOf id name type status kind code ' +
    'message detail items total page size pages label title text key index i j n x y ' +
    'account currentAccount isReal isEnabled path select api options mockOnly get set ' +
    'forEach reduce some every includes toLowerCase toUpperCase trim split replace ' +
    'JSON console Math Object Array Number String Boolean Date Promise ref computed watch ' +
    'unref shallowRef reactive onMounted nextTick default toFixed padStart concat ' +
    'entries keys values from of in for if else return const let var function async await ' +
    'response body headers method json ms now random floor round min max abs'
  ).split(/\s+/)
)

let issues = 0
for (const [file, paths] of Object.entries(MAP)) {
  const src = fs.readFileSync(`src/composables/${file}.js`, 'utf8')
  const allowed = fieldsFor(paths)
  // Property reads: `.foo` and destructuring is harder; use `.foo` + `foo:` in
  // object literals built from a raw record, plus `r.foo` / `row.foo` patterns.
  const reads = new Set()
  for (const m of src.matchAll(
    /\b(?:r|row|rec|record|raw|d|item|it|entry|src|res|payload|obj)\.([a-zA-Z_][a-zA-Z0-9_]*)/g
  )) {
    reads.add(m[1])
  }
  const unknown = [...reads]
    .filter(f => !allowed.has(f) && !IGNORE.has(f))
    .sort()
  if (unknown.length) {
    issues += unknown.length
    console.log(`\n${file}`)
    console.log(`  reads not in contract: ${unknown.join(', ')}`)
  }
}
console.log(
  `\n--- ${issues} candidate drift identifiers (review each; some are local vars) ---`
)
