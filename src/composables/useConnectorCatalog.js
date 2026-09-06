import { computed, ref } from 'vue'
import { camelizeKeys } from '@/lib/apiShape'
import { useMockResource, fetchCollection } from '@/composables/useMockResource'

/**
 * The browsable catalog of connector *types* — what could be connected — behind
 * `/connectors`, a sub-screen of Sources.
 *
 * NOT the sources at `/sources` (that is `useSources`, the streams already
 * configured for this account) and not `useSourceTemplates()` either, which
 * backs the create screen's picker with workspace-shaped defaults.
 *
 * This used to fetch a third-party vendor's public catalog endpoint directly,
 * including per-connector logo images from that host — which is why the CSP
 * had to whitelist it under both `connect-src` and `img-src`. It now reads
 * `GET /v1/connectors` like every other screen: the dashboard talks to the
 * Sfere backend and to nothing else, and the backend owns whichever upstream
 * catalog it aggregates.
 *
 * ## The live catalog is a different list, not just a different shape
 *
 * `GET /v1/connectors` is real as of backend PR #16, and three things about the
 * response change what this screen can say:
 *
 * 1. **It is small and deliberate.** `app/services/connectors.py` serves the
 *    Zid cloud app plus the Airbyte source connectors already hosted on Jitsu
 *    (Firebase, Attio, Linear, MongoDB) — not the couple of hundred the
 *    fixture carries. The Web SDK is not in it, because a connector pulls
 *    existing data and a source receives new events.
 * 2. **`kind` mixes sources and destinations in one list.** This screen is the
 *    source half of `/sources`, so it filters on `kind === 'source'` rather
 *    than rendering warehouse types as things to add a source from.
 * 3. **`icon` is a slug, not a URL** (`"zid"`, `"firebase"`). Building an
 *    `<img src>` out of it would be a broken image at best; under
 *    `img-src 'self'` it is a blocked request. The card falls back to its
 *    bundled glyph, which is what it already did for a null `iconUrl`.
 *
 * Both payloads are normalised into one record by `adaptConnector()` /
 * `adaptMockConnector()`, so the card and the grouping are written once.
 */

/** Which `status` values a person is allowed to pick. */
const SELECTABLE_STATUS = new Set(['available', 'beta'])

const STATUS_LABEL = {
  available: '',
  beta: 'Beta',
  coming_soon: 'Coming soon'
}

/**
 * A wire `Connector` in the shape the catalog renders.
 *
 * `category` is the grouping key and it is derived from `protocol`, which is
 * the real distinction the backend states: a `native` connector is one Sfere
 * implements and an `airbyte` one is hosted on Jitsu. The fixture grouped by an
 * invented `meta.connectorSubtype` (database / api / file); that vocabulary has
 * no counterpart on the wire, so re-deriving it from `tags` would be guessing.
 *
 * @param {object} raw  A snake_case `Connector`.
 * @returns {object}
 */
export function adaptConnector(raw) {
  const c = camelizeKeys(raw)
  return {
    id: c.id,
    name: c.name || c.id,
    description: c.description || '',
    kind: c.kind || 'source',
    sourceType: c.sourceType ?? null,
    destinationType: c.destinationType ?? null,
    protocol: c.protocol ?? null,
    packageId: c.package || c.id,
    version: c.version || '',
    // A slug, not a URL — never rendered as an image source. See note 3 above.
    iconSlug: c.icon ?? null,
    iconUrl: null,
    tags: Array.isArray(c.tags) ? c.tags : [],
    status: c.status || 'available',
    statusLabel: STATUS_LABEL[c.status] ?? '',
    requiresOauth: Boolean(c.requiresOauth),
    selectable: SELECTABLE_STATUS.has(c.status || 'available'),
    // No licence on the wire record. Absent rather than empty-string so the
    // card's `v-if` drops the chip instead of drawing a blank one.
    license: null,
    category: c.protocol || 'other',
    categoryLabel:
      c.protocol === 'native'
        ? 'Built by Sfere'
        : c.protocol === 'airbyte'
          ? 'Airbyte connectors'
          : 'Other'
  }
}

/**
 * One fixture row in the same normalised shape, so Demo mode and real mode go
 * through one render path. The fixture stays as it is — it is
 * cross-referentially consistent with the rest of `public/data/` and its ids
 * are load-bearing for `scripts/smoke.mjs`.
 *
 * @param {object} raw  A row of `public/data/connectors.json`.
 * @returns {object}
 */
export function adaptMockConnector(raw) {
  const subtype = raw?.meta?.connectorSubtype || 'other'
  const LABELS = {
    database: 'Databases',
    api: 'APIs',
    file: 'Files',
    'custom image': 'Custom'
  }
  return {
    id: raw.id,
    name: raw.meta?.name || raw.packageId,
    description: '',
    kind: 'source',
    sourceType: null,
    destinationType: null,
    protocol: raw.packageType ?? null,
    packageId: raw.packageId,
    version: '',
    iconSlug: null,
    iconUrl: raw.iconUrl || null,
    tags: [],
    status: 'available',
    statusLabel: '',
    requiresOauth: false,
    selectable: true,
    license: raw.meta?.license || null,
    sortIndex: raw.sortIndex ?? null,
    category: subtype,
    categoryLabel:
      LABELS[subtype] || subtype.charAt(0).toUpperCase() + subtype.slice(1)
  }
}

export function useConnectorCatalog() {
  const {
    data: connectors,
    loading,
    error,
    apiMissing,
    load
  } = useMockResource('connectors', {
    select: payload =>
      (Array.isArray(payload) ? payload : []).map(adaptMockConnector),
    api: {
      path: '/v1/connectors',
      select: payload => (payload?.items ?? []).map(adaptConnector)
    }
  })

  /** The source half. A destination type is not something to add a source from. */
  const sourceConnectors = computed(() =>
    connectors.value.filter(c => c.kind === 'source')
  )

  return { connectors, sourceConnectors, loading, error, apiMissing, load }
}

/**
 * One connector's configuration contract — `GET /v1/connectors/{id}/spec`.
 *
 * This is the endpoint that replaces the guesswork in
 * `src/config/connectorCredentials.js`: it returns the connector's real
 * `config_schema` (a JSON Schema), the sync `supported_modes` it can run, and a
 * `documentation_url`.
 *
 * **`pending: true` is a loading state, not an empty one.** The spec is fetched
 * from the connector image on demand, so the first read of an Airbyte connector
 * can come back pending with nothing else filled in. Rendering that as "this
 * connector needs no credentials" would be wrong in the most expensive
 * direction, so `load()` polls while it is pending, up to `MAX_POLLS`, and
 * reports `pending` to the caller throughout.
 *
 * Read one at a time rather than through `useMockResource` because the id is an
 * argument, which `load()` there deliberately cannot take.
 *
 * @returns {object} `{ spec, pending, loading, error, apiMissing, load(id) }`
 *
 * @example
 * const { spec, pending, load } = useConnectorSpec()
 * watch(() => connector.id, id => id && load(id), { immediate: true })
 */
export function useConnectorSpec() {
  const MAX_POLLS = 6
  const POLL_MS = 1500

  const spec = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const apiMissing = ref(false)
  const pending = ref(false)

  async function readOnce(connectorId) {
    return fetchCollection('connectors', {
      // No fixture equivalent — the mock catalog carries no schemas. Demo mode
      // therefore reports apiMissing here and the form falls back to the
      // hand-written spec, which is exactly what it used to always do.
      select: () => null,
      api: {
        path: `/v1/connectors/${connectorId}/spec`,
        select: payload => {
          const s = camelizeKeys(payload) ?? {}
          return {
            connectorId: s.connectorId ?? connectorId,
            version: s.version ?? '',
            pending: Boolean(s.pending),
            error: s.error ?? null,
            configSchema: s.configSchema ?? null,
            supportedModes: Array.isArray(s.supportedModes)
              ? s.supportedModes
              : [],
            documentationUrl: s.documentationUrl ?? null
          }
        }
      }
    })
  }

  async function load(connectorId) {
    if (!connectorId) return
    loading.value = true
    error.value = null
    apiMissing.value = false
    pending.value = false
    try {
      for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
        const res = await readOnce(connectorId)
        // Demo mode takes the `!res.data` branch: `fetchCollection` reads the
        // fixture and the select above deliberately returns null, because the
        // mock catalog carries no schemas. Same outcome as a 404 — fall back to
        // the hand-written spec — so it is reported the same way.
        if (!res.ok || !res.data) {
          if (res.ok || res.apiMissing) apiMissing.value = true
          else error.value = res.error
          spec.value = null
          return
        }
        spec.value = res.data
        pending.value = Boolean(res.data?.pending)
        if (!pending.value) return
        // Still building. Wait before asking again, but keep `pending` true so
        // the form shows a spinner rather than an empty field list.
        await new Promise(resolve => setTimeout(resolve, POLL_MS))
      }
      // Gave up while still pending. `pending` stays true: the honest report is
      // "still being fetched", not "there is nothing here".
    } finally {
      loading.value = false
    }
  }

  return { spec, pending, loading, error, apiMissing, load }
}
