import { NOT_KNOWN, NOT_SET } from '@/lib/emptyValue'
import { useMockResource } from '@/composables/useMockResource'
import { useIdentifierTypes } from '@/composables/useIdentifierTypes'
import {
  canReadProfiles,
  useApiTokens,
  LEGACY_PROFILE_READ_SCOPE
} from '@/composables/useApiTokens'

/**
 * Profile API = the read side of the fan graph.
 *
 * An *endpoint* is a configured, named lookup: a public path, the identifier
 * type a caller may look a fan up by, the attributes that come back, and the
 * auth guarding it. Other systems (a CRM sidebar, a kiosk, a web personaliser)
 * call these; nothing in the dashboard does.
 *
 * NOT the same as `useProfiles*` (the profile records themselves) or
 * `useProfileDwhSyncs*` (pushing profiles into a warehouse) — those are other
 * packets. This file owns only the HTTP surface in front of the profiles.
 *
 * Data is mock JSON (`public/data/profile-api-endpoints.json`) read through
 * `useMockResource`, so everything here inherits the repo-wide
 * `{ data, loading, error, load() }` contract and never throws.
 *
 * Writes have no backend. `setEnabled` / `remove` / `add` mutate the loaded
 * array and nothing else — a reload re-reads the JSON and the change is gone.
 * That is deliberate: the screens must not pretend to persist. Pages own the
 * user feedback (a `useQuasar().notify()` toast).
 */

/**
 * Origin every endpoint path hangs off. One constant so the list screen, the
 * curl snippet and the create screen's slug preview cannot drift apart.
 */
export const PROFILE_API_BASE_URL = 'https://api.sfere.io'

/** Path prefix a new endpoint's slug is mounted under. */
export const PROFILE_API_PATH_PREFIX = '/v1/profile'

/**
 * Thousands-separated count, with a dash for nothing at all.
 *
 * @param {number|null|undefined} n
 * @returns {string}
 */
export function formatCount(n) {
  const value = Number(n)
  if (!Number.isFinite(value)) return NOT_KNOWN
  return value.toLocaleString('en-GB')
}

/**
 * `41` -> `41 ms`. A null latency means the endpoint has served nothing, which
 * is a dash rather than `0 ms` — `Number(null)` is `0`, so the null has to be
 * caught before the coercion.
 *
 * @param {number|null|undefined} ms
 * @returns {string}
 */
export function formatLatency(ms) {
  if (ms === null || ms === undefined || ms === '') return NOT_KNOWN
  const value = Number(ms)
  if (!Number.isFinite(value)) return NOT_KNOWN
  return `${formatCount(value)} ms`
}

/**
 * `2026-06-20T09:00:00.000Z` -> `20 Jun 2026`.
 *
 * Locale and time zone are both pinned so the same ISO string renders the same
 * characters on a dev box, in CI and in the smoke run's DOM.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDate(iso, fallback = NOT_KNOWN) {
  if (!iso) return fallback
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  })
}

/**
 * `2026-06-20T09:00:00.000Z` -> `20 Jun 2026, 09:00`.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDateTime(iso, fallback = NOT_KNOWN) {
  if (!iso) return fallback
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  const time = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC'
  })
  return `${formatDate(iso)}, ${time}`
}

/**
 * URL-safe identifier derived from a display name.
 *
 * @param {string} value
 * @returns {string} e.g. `'Matchday kiosk'` -> `'matchday-kiosk'`
 */
export function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Fully-qualified URL for an endpoint record.
 *
 * @param {object} endpoint
 * @returns {string}
 */
export function endpointUrl(endpoint) {
  return `${PROFILE_API_BASE_URL}${endpoint?.path ?? ''}`
}

/**
 * A key only ever exists here as its last four characters — the full value is
 * shown once, at creation, and never stored. `masked` is what a screen shows
 * before the user asks to see it; `revealed` is the most there is to show.
 *
 * @param {string|null|undefined} lastFour
 * @param {boolean} revealed
 * @returns {string}
 */
export function maskKey(lastFour, revealed) {
  if (!lastFour) return NOT_SET
  return revealed ? `ffp_key_••••${lastFour}` : `ffp_key_${'•'.repeat(12)}`
}

/**
 * Same idea for an account API token, whose stored preview (`ffp_live_…4d02`)
 * is already partial.
 *
 * @param {string|null|undefined} preview
 * @param {boolean} revealed
 * @returns {string}
 */
export function maskToken(preview, revealed) {
  if (!preview) return NOT_SET
  if (revealed) return preview
  const [prefix] = String(preview).split('…')
  return `${prefix}${'•'.repeat(12)}`
}

/**
 * The example request for an endpoint, as a copyable shell command.
 *
 * The key is a shell variable rather than a real value: no screen ever holds a
 * usable key, and printing one that looks usable would be a lie.
 *
 * @param {object} endpoint
 * @returns {string}
 */
export function buildCurlSnippet(endpoint) {
  if (!endpoint) return ''
  const param = endpoint.identifierTypeName || 'email'
  const url = `${endpointUrl(endpoint)}?${param}=FAN_IDENTIFIER`
  return (
    `curl -s "${url}" \\\n` +
    `  -H "Authorization: Bearer $SFERE_PROFILE_API_KEY" \\\n` +
    `  -H "Accept: application/json"`
  )
}

/**
 * The shape that comes back, built from the attributes the endpoint returns.
 * Values are placeholders — this is documentation, not a live call.
 *
 * @param {object} endpoint
 * @returns {string} pretty-printed JSON
 */
export function buildResponseSample(endpoint) {
  if (!endpoint) return ''
  const attributes = {}
  for (const id of endpoint.attributes ?? []) attributes[id] = '…'
  return JSON.stringify(
    {
      profileId: 'prof_…',
      identifier: { type: endpoint.identifierTypeName, value: '…' },
      attributes,
      resolvedAt: '2026-07-31T12:00:00.000Z'
    },
    null,
    2
  )
}

/**
 * The configured Profile API endpoints, plus local-only mutations.
 *
 * @returns {{
 *   endpoints: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   findById: (id: string) => object|null,
 *   setEnabled: (id: string, isEnabled: boolean) => void,
 *   remove: (id: string) => void,
 *   add: (endpoint: object) => object
 * }}
 *
 * @example
 * const { endpoints, loading, error, load } = useProfileApiEndpoints()
 * onMounted(load)
 */
export function useProfileApiEndpoints() {
  const {
    data: endpoints,
    loading,
    error,
    load
  } = useMockResource('profile-api-endpoints')

  function findById(id) {
    return endpoints.value.find(e => e.id === id) ?? null
  }

  function setEnabled(id, isEnabled) {
    endpoints.value = endpoints.value.map(e =>
      e.id === id ? { ...e, isEnabled } : e
    )
  }

  function remove(id) {
    endpoints.value = endpoints.value.filter(e => e.id !== id)
  }

  function add(endpoint) {
    const slug = slugify(endpoint.slug || endpoint.name) || String(Date.now())
    const record = {
      id: `papi_${slug.replace(/-/g, '_')}`,
      slug,
      path: `${PROFILE_API_PATH_PREFIX}/${slug}`,
      method: 'GET',
      attributes: [],
      isEnabled: true,
      rateLimitPerMinute: 600,
      cacheTtlSeconds: 60,
      keyLastFour: null,
      keyRotatedAt: null,
      requestCountLastHour: 0,
      p95LatencyMs: null,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...endpoint
    }
    endpoints.value = [...endpoints.value, record]
    return record
  }

  return {
    endpoints,
    loading,
    error,
    load,
    findById,
    setEnabled,
    remove,
    add
  }
}

/**
 * Identifier types a lookup may accept — the create screen's first picker.
 *
 * Shared reference data (`public/data/identifier-types.json`), read-only here.
 *
 * @returns {{
 *   identifierTypes: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>
 * }}
 */
export function useProfileApiIdentifierTypes() {
  const { identifierTypes, loading, error, apiMissing, load } =
    useIdentifierTypes()

  return { identifierTypes, loading, error, apiMissing, load }
}

/**
 * Attributes an endpoint may return — the create screen's second picker.
 *
 * @returns {{
 *   attributes: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>
 * }}
 */
export function useProfileApiAttributes() {
  const {
    data: attributes,
    loading,
    error,
    load
  } = useMockResource('attributes')

  return { attributes, loading, error, load }
}

/**
 * Account API tokens. The list screen shows only the ones that can actually
 * call a Profile API endpoint, which is why the scope filter lives here rather
 * than in the page.
 *
 * @returns {{
 *   tokens: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>
 * }}
 */
export function useProfileApiTokens() {
  const { tokens, loading, error, apiMissing, load } = useApiTokens()

  return { tokens, loading, error, apiMissing, load }
}

/**
 * Scope a token needs before it can read a profile.
 *
 * @deprecated The wire vocabulary is coarse — `ApiTokenScope` is
 * `read | write | admin` — so there is no per-resource profile scope to match
 * on. This string is the fixture's, kept only so the two modes can be told
 * apart; ask `canReadProfiles()` instead of comparing against it.
 */
export const PROFILE_READ_SCOPE = LEGACY_PROFILE_READ_SCOPE

/**
 * Tokens that can read a profile, newest use first.
 *
 * The scope test moved to `canReadProfiles()` in `useApiTokens`, which accepts
 * both vocabularies. This used to require the literal `'profiles:read'`, which
 * no live token can ever carry — so against the real endpoint the list was
 * always empty and the screen said no token could reach the Profile API while
 * several could.
 *
 * @param {Array} tokens
 * @returns {Array}
 */
export function profileReadTokens(tokens) {
  return (
    (tokens ?? [])
      .filter(t => !t.isRevoked && canReadProfiles(t))
      .slice()
      // `lastUsedAt` is null on every live token (nothing writes it), so in real
      // mode this sort is a no-op rather than a wrong order. Left as it is: it is
      // the right order the moment the backend starts recording it.
      .sort((a, b) => String(b.lastUsedAt).localeCompare(String(a.lastUsedAt)))
  )
}
