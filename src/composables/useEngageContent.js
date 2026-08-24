import { useQuasar } from 'quasar'
import { useMockResource } from '@/composables/useMockResource'

/**
 * Engage — content: the asset library (`/assets`) and the catalogs (`/catalogs`).
 *
 * Both screens are "things a campaign reaches for": an asset is a file a message
 * embeds (hero image, PDF, teaser video), a catalog is a table of rows a message
 * personalises from (products, fixtures, hospitality packages). They share this
 * file because they share their formatters and their honesty rules, not because
 * they share a shape — assets render as a card grid, catalogs as a table.
 *
 * Data is mock JSON in `public/data/` read through `useMockResource`, so every
 * accessor here inherits the repo-wide `{ data, loading, error, load() }`
 * contract and never throws.
 *
 * Nothing persists. `remove` / `insert` / `setEnabled` mutate the loaded array
 * and nothing else — a reload re-reads the JSON and the change is gone. Pages
 * own the user feedback (`useEngageContentToasts`), so these stay side-effect
 * free.
 */

// Pinned locale and zone: these lists are date-dense (uploaded, updated, last
// synced) and a bare toLocaleDateString() renders differently on the smoke
// runner, in CI and on a dev box.
const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
})

const TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC'
})

/**
 * `'2026-07-19T14:00:00.000Z'` -> `'19 Jul 2026'`.
 *
 * @param {string|null|undefined} iso
 * @returns {string} `'—'` when absent or unparseable.
 */
export function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : DATE.format(d)
}

/**
 * `'2026-07-31T04:30:00.000Z'` -> `'31 Jul 2026 · 04:30 UTC'`.
 *
 * @param {string|null|undefined} iso
 * @returns {string} `'—'` when absent or unparseable.
 */
export function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${DATE.format(d)} · ${TIME.format(d)} UTC`
}

/**
 * Thousands-separated integer. An absent value is an em dash rather than `0`,
 * so "unknown" never reads as "none".
 *
 * @param {number|null|undefined} n
 * @returns {string}
 *
 * @example
 * formatCount(1284) // '1,284'
 */
export function formatCount(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('en-GB')
}

const BYTE_UNITS = ['KB', 'MB', 'GB', 'TB']

/**
 * Binary file size in the largest unit that stays readable.
 *
 * @param {number|null|undefined} bytes
 * @returns {string}
 *
 * @example
 * formatBytes(284119)   // '277.5 KB'
 * formatBytes(18442019) // '17.6 MB'
 */
export function formatBytes(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${Math.round(n)} B`
  let value = n / 1024
  let unit = 0
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${BYTE_UNITS[unit]}`
}

/**
 * `1200 × 630`, or an em dash for anything without pixel dimensions (a PDF).
 *
 * @param {number|null|undefined} width
 * @param {number|null|undefined} height
 * @returns {string}
 */
export function formatDimensions(width, height) {
  if (!width || !height) return '—'
  return `${formatCount(width)} × ${formatCount(height)}`
}

/**
 * Uppercase file extension from a filename, used as the label on the typed
 * placeholder tile.
 *
 * @param {string|null|undefined} name
 * @returns {string} e.g. `'welcome-hero.png'` -> `'PNG'`; `'FILE'` when absent.
 */
export function fileExtension(name) {
  const parts = String(name ?? '').split('.')
  if (parts.length < 2) return 'FILE'
  return parts.pop().slice(0, 5).toUpperCase()
}

const ASSET_TYPES = {
  image: { label: 'Image', glyph: 'image' },
  video: { label: 'Video', glyph: 'video' },
  document: { label: 'Document', glyph: 'document' }
}

/**
 * Human label plus the glyph key `AssetThumbnail` draws for an asset's `type`.
 *
 * @param {string|null|undefined} type
 * @returns {{ label: string, glyph: string }}
 */
export function assetTypeMeta(type) {
  return ASSET_TYPES[type] ?? { label: 'File', glyph: 'document' }
}

const SYNC_STATUS = {
  success: { label: 'Synced', variant: 'success' },
  failed: { label: 'Sync failed', variant: 'danger' },
  running: { label: 'Syncing', variant: 'brand' }
}

/**
 * Badge label + `StatusBadge` variant for a catalog's `lastSyncStatus`.
 *
 * A catalog that has never synced is neutral, not a failure.
 *
 * @param {string|null|undefined} status
 * @returns {{ label: string, variant: string }}
 */
export function syncStatusMeta(status) {
  return SYNC_STATUS[status] ?? { label: 'Never synced', variant: 'neutral' }
}

const CONNECTION_STATUS = {
  connected: { label: 'Connected', variant: 'success' },
  error: { label: 'Connection failed', variant: 'danger' },
  validating: { label: 'Validating', variant: 'brand' }
}

/**
 * Badge label + variant for the health of the warehouse connection a catalog
 * syncs from. An unknown or unresolvable connection is neutral — the catalog
 * may simply not have one (a CSV upload).
 *
 * @param {string|null|undefined} status
 * @returns {{ label: string, variant: string }}
 */
export function connectionStatusMeta(status) {
  return CONNECTION_STATUS[status] ?? { label: 'Unknown', variant: 'neutral' }
}

const CATALOG_SOURCE_LABELS = {
  warehouse: 'Warehouse',
  csv: 'CSV upload',
  api: 'API'
}

/**
 * Human label for a catalog's `sourceType`.
 *
 * @param {string|null|undefined} sourceType
 * @returns {string}
 */
export function catalogSourceLabel(sourceType) {
  return CATALOG_SOURCE_LABELS[sourceType] ?? 'Other'
}

/**
 * A toast that never implies persistence. Every mutation on these two screens
 * is local to the session, and the caption says so on every single one.
 *
 * @returns {{ toast: (message: string) => void }}
 *
 * @example
 * const { toast } = useEngageContentToasts()
 * toast('“welcome-hero.png” moved to trash')
 */
export function useEngageContentToasts() {
  const $q = useQuasar()

  function toast(message) {
    $q.notify({
      message,
      caption: 'Local preview only — nothing is stored.',
      color: 'dark',
      timeout: 2500
    })
  }

  return { toast }
}

/**
 * The asset library — every file a campaign can embed.
 *
 * @returns {{
 *   assets: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   findById: (id: string) => object|null,
 *   remove: (id: string) => void,
 *   insert: (asset: object) => void
 * }}
 *
 * @example
 * const { assets, loading, error, load } = useEngageAssets()
 * onMounted(load)
 */
export function useEngageAssets() {
  const { data: assets, loading, error, load } = useMockResource('assets')

  function findById(id) {
    return assets.value.find(a => a.id === id) ?? null
  }

  function remove(id) {
    assets.value = assets.value.filter(a => a.id !== id)
  }

  function insert(asset) {
    if (!asset) return
    assets.value = [asset, ...assets.value.filter(a => a.id !== asset.id)]
  }

  return { assets, loading, error, load, findById, remove, insert }
}

/**
 * Assets that were deleted — the `assets` slice of the shared trash file.
 *
 * Secondary to the library itself: it backs one tab, so a failure here degrades
 * that tab rather than the screen.
 *
 * @returns {{
 *   deletedAssets: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   remove: (id: string) => void,
 *   insert: (asset: object) => void
 * }}
 */
export function useEngageAssetTrash() {
  const {
    data: deletedAssets,
    loading,
    error,
    load
  } = useMockResource('trash', { select: payload => payload.assets })

  function remove(id) {
    deletedAssets.value = deletedAssets.value.filter(a => a.id !== id)
  }

  function insert(asset) {
    if (!asset) return
    deletedAssets.value = [
      asset,
      ...deletedAssets.value.filter(a => a.id !== asset.id)
    ]
  }

  return { deletedAssets, loading, error, load, remove, insert }
}

/**
 * Which campaigns reference which asset.
 *
 * A secondary resource on `/assets`: the grid renders the `usedByCount` the
 * asset itself carries, and only the details dialog needs the campaign names.
 * If this fails the dialog says so and offers its own retry.
 *
 * @returns {{
 *   campaigns: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   usedBy: (assetId: string) => Array
 * }}
 */
export function useEngageAssetUsage() {
  const {
    data: campaigns,
    loading,
    error,
    load
  } = useMockResource('channel-campaigns')

  function usedBy(assetId) {
    if (!assetId) return []
    return campaigns.value.filter(c =>
      Array.isArray(c.assetIds) ? c.assetIds.includes(assetId) : false
    )
  }

  return { campaigns, loading, error, load, usedBy }
}

/**
 * The catalogs — row sets a message can personalise from.
 *
 * @returns {{
 *   catalogs: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   findById: (id: string) => object|null,
 *   setEnabled: (id: string, isEnabled: boolean) => void
 * }}
 */
export function useEngageCatalogs() {
  const { data: catalogs, loading, error, load } = useMockResource('catalogs')

  function findById(id) {
    return catalogs.value.find(c => c.id === id) ?? null
  }

  function setEnabled(id, isEnabled) {
    catalogs.value = catalogs.value.map(c =>
      c.id === id ? { ...c, isEnabled } : c
    )
  }

  return { catalogs, loading, error, load, findById, setEnabled }
}

/**
 * The warehouse connections catalogs sync from.
 *
 * Read-only here — connections are created and repaired on `/dwh-connections`,
 * which another packet owns. This screen only needs to name one and know
 * whether it is healthy, which is why a failure degrades the "Source" column
 * rather than the whole table.
 *
 * @returns {{
 *   connections: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   findById: (id: string) => object|null
 * }}
 */
export function useEngageCatalogConnections() {
  const {
    data: connections,
    loading,
    error,
    load
  } = useMockResource('dwh-connections')

  function findById(id) {
    if (!id) return null
    return connections.value.find(c => c.id === id) ?? null
  }

  return { connections, loading, error, load, findById }
}
