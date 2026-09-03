import { computed, ref } from 'vue'
import { camelizeKeys } from '@/lib/apiShape'
import { currentAccount } from '@/composables/useMe'
import { useMockResource, fetchCollection } from '@/composables/useMockResource'

/**
 * Real-data profiles, derived by the backend from ClickHouse `identify` events
 * (backend `listProfiles` / `getProfile`). Unlike the mock `useProfilesSearch`,
 * this talks to the live account-scoped endpoint through `useMockResource`, which
 * gates real vs demo and reads `data/profiles-list.json` in Demo mode.
 *
 *   GET /v1/accounts/{account}/profiles?page&size&q&identifier_type   (paged)
 *   GET /v1/accounts/{account}/profiles/{profile_id}                  (one)
 *
 * A profile groups identify events by identity (user_id → email → phone); its
 * shape is `{ id, traits:{name,email,phone}, identifiers:[…], firstSeenAt,
 * lastSeenAt, eventCount, confidence }` after camelisation.
 */

/** Identifier-type filter options; values match the backend's `identifier_type`. */
export const IDENTIFIER_TYPE_OPTIONS = [
  { label: 'Any identifier', value: '' },
  { label: 'User ID', value: 'user_id' },
  { label: 'Email', value: 'email' },
  { label: 'Phone', value: 'phone' },
  { label: 'Anonymous ID', value: 'anonymous_id' }
]

export function useProfileList() {
  const page = ref(1)
  const size = ref(50)
  const q = ref('')
  const identifierType = ref('')

  function queryString() {
    const params = { page: page.value, size: size.value }
    if (q.value.trim()) params.q = q.value.trim()
    if (identifierType.value) params.identifier_type = identifierType.value
    return Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')
  }

  // The backend answers a Page envelope; keep the whole object as `data` and read
  // items/total/pages off it. `api.select` camelises snake_case; the Demo fixture
  // is already camelCase, so no top-level `select` is needed for the mock path.
  const { data, loading, error, apiMissing, load } = useMockResource(
    'profiles-list',
    {
      initial: { items: [], total: 0, page: 1, size: 50, pages: 0 },
      api: {
        path: () =>
          currentAccount.value &&
          `/v1/accounts/${currentAccount.value.id}/profiles?${queryString()}`,
        select: camelizeKeys
      }
    }
  )

  const items = computed(() => data.value.items ?? [])
  const total = computed(() => data.value.total ?? 0)
  const pages = computed(() => data.value.pages ?? 0)

  return {
    page,
    size,
    q,
    identifierType,
    items,
    total,
    pages,
    loading,
    error,
    apiMissing,
    load,
    identifierTypeOptions: IDENTIFIER_TYPE_OPTIONS
  }
}

/**
 * Fetch one profile by its identity key. Returns the `fetchCollection` result
 * (`{ ok, data, apiMissing?, error? }`). In Demo mode it reads the list fixture
 * and picks the matching profile, so the detail page works without a backend.
 *
 * @param {string} id
 */
export async function fetchProfile(id) {
  return fetchCollection('profiles-list', {
    select: payload =>
      (camelizeKeys(payload).items ?? []).find(
        p => String(p.id) === String(id)
      ) ?? null,
    api: {
      path: () =>
        currentAccount.value &&
        `/v1/accounts/${currentAccount.value.id}/profiles/${encodeURIComponent(id)}`,
      select: camelizeKeys
    }
  })
}
