import { NEVER, NONE, NOT_KNOWN, NOT_SET } from '@/lib/emptyValue'
import { camelizeKeys, pageItems } from '@/lib/apiShape'
import { currentAccount } from '@/composables/useMe'
import { useMockResource, sendMutation } from '@/composables/useMockResource'

/**
 * Profile builders — the identity-stitching configuration. Full CRUD, live as of
 * backend PR #16:
 *
 *   GET/POST       …/profile-builders
 *   GET/PUT/DELETE …/profile-builders/{id}
 *
 * ## This is not Profile search, and the distinction is load-bearing
 *
 * `GET …/profiles` (the search screen's data) is still unbuilt — it is one of
 * the 27 operations in the spec with no router behind it. What shipped is the
 * *configuration*: which identifiers a profile is assembled from, in what order
 * of trust, on what schedule, and into which destination. So `/profile-builders`
 * is real while `/profiles/search` still reports `apiMissing`, and a screen that
 * conflated them would claim one endpoint's existence for the other.
 *
 * ## `identifier_types` is ORDERED, most trusted first
 *
 * That ordering is the whole configuration — it decides which identifier wins
 * when two of them disagree about who a profile is. So the editor moves entries
 * up and down rather than offering a checkbox set, and the list is sent in the
 * order shown. A UI that sorted them alphabetically for tidiness would silently
 * change the merge behaviour.
 *
 * The values are `IdentifierType.key`s — `email`, `phone`, `user_id`,
 * `anonymous_id`, `device_id` — from `GET …/identifier-types`, which is why
 * `useIdentifierTypes()` is the picker's source rather than a hardcoded list.
 *
 * ## `profile_count` and `last_run_at` are nullable and mean different things
 *
 * A null `last_run_at` is `NEVER` — the builder genuinely has not run. A null
 * `profile_count` is `NOT_KNOWN`: nothing counted it, and printing `0` would
 * claim a builder produced no profiles when it may have produced thousands.
 */

/** One wire `ProfileBuilder`. */
export function adaptProfileBuilder(raw) {
  const b = camelizeKeys(raw)
  return {
    id: b.id,
    accountId: b.accountId ?? null,
    name: b.name || '',
    slug: b.slug || '',
    isEnabled: Boolean(b.isEnabled),
    destinationId: b.destinationId ?? null,
    // Order is the configuration — never re-sorted. See the note above.
    identifierTypes: Array.isArray(b.identifierTypes) ? b.identifierTypes : [],
    code: b.code ?? null,
    cron: b.cron ?? null,
    lastRunAt: b.lastRunAt ?? null,
    // Null, not 0 — nothing counted it.
    profileCount: b.profileCount ?? null,
    createdAt: b.createdAt ?? null,
    updatedAt: b.updatedAt ?? null
  }
}

/** `'Fan profile'` -> `'fan-profile'`. `ProfileBuilderCreate` needs both. */
export function slugifyBuilder(name) {
  return String(name ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** How many profiles this builder has produced, as a phrase. */
export function profileCountLabel(builder) {
  return builder?.profileCount == null
    ? NOT_KNOWN
    : builder.profileCount.toLocaleString('en-GB')
}

/** When it last ran. `NEVER` is right: this is a dated event, not a measurement. */
export function lastRunLabel(builder, formatDateTime) {
  return formatDateTime(builder?.lastRunAt, NEVER)
}

/** Its schedule. `NOT_SET` — an absent cron is an unfilled field, user-fixable. */
export function scheduleLabel(builder) {
  return builder?.cron || NOT_SET
}

/** Its identifier order, as a sentence. `NONE` — a genuinely empty collection. */
export function identifierLabel(builder, labelFor) {
  const keys = builder?.identifierTypes ?? []
  if (!keys.length) return NONE
  return keys.map(key => labelFor(key)).join(' → ')
}

function buildersPath() {
  return (
    currentAccount.value &&
    `/v1/accounts/${currentAccount.value.id}/profile-builders`
  )
}

export function useProfileBuilders() {
  const {
    data: builders,
    loading,
    error,
    apiMissing,
    load
  } = useMockResource('profile-builders', {
    api: {
      path: buildersPath,
      select: payload => pageItems(payload).map(adaptProfileBuilder)
    }
  })

  function builderPath(id) {
    const base = buildersPath()
    return base && `${base}/${id}`
  }

  /**
   * @param {{ name: string, slug?: string, identifierTypes: string[], destinationId?: string|null, cron?: string|null, code?: string|null }} input
   */
  async function create(input) {
    const res = await sendMutation({
      method: 'POST',
      path: buildersPath,
      body: {
        name: input.name,
        slug: input.slug || slugifyBuilder(input.name),
        // Sent in the order given. Required by the schema even when empty.
        identifier_types: input.identifierTypes ?? [],
        ...(input.destinationId ? { destination_id: input.destinationId } : {}),
        ...(input.cron ? { cron: input.cron } : {}),
        ...(input.code ? { code: input.code } : {})
      }
    })
    if (!res.ok || res.skipped) return res
    const builder = adaptProfileBuilder(camelizeKeys(res.data))
    builders.value = [...builders.value, builder]
    return { ok: true, data: builder }
  }

  /**
   * `PUT`, so this replaces the builder. Every field the caller wants kept has
   * to be in `next` — `ProfileBuilderUpdate` is not a patch, and sending only
   * `is_enabled` would blank the identifier order that IS the configuration.
   *
   * @param {string} id
   * @param {object} next
   */
  async function update(id, next) {
    const res = await sendMutation({
      method: 'PUT',
      path: () => builderPath(id),
      body: {
        name: next.name,
        identifier_types: next.identifierTypes ?? [],
        is_enabled: Boolean(next.isEnabled),
        ...(next.destinationId ? { destination_id: next.destinationId } : {}),
        ...(next.cron ? { cron: next.cron } : {}),
        ...(next.code ? { code: next.code } : {})
      }
    })
    if (!res.ok) return res
    if (res.skipped) {
      builders.value = builders.value.map(b =>
        b.id === id ? { ...b, ...next } : b
      )
      return res
    }
    const builder = adaptProfileBuilder(camelizeKeys(res.data))
    builders.value = builders.value.map(b => (b.id === id ? builder : b))
    return { ok: true, data: builder }
  }

  /**
   * Enable or pause. Goes through `update()` and therefore re-sends the whole
   * record, because `PUT` replaces it — a body carrying only the flag would
   * wipe the identifier order.
   *
   * @param {string} id
   * @param {boolean} isEnabled
   */
  async function setEnabled(id, isEnabled) {
    const current = builders.value.find(b => b.id === id)
    if (!current) return { ok: false, error: 'No such profile builder.' }
    return update(id, { ...current, isEnabled })
  }

  async function remove(id) {
    const res = await sendMutation({
      method: 'DELETE',
      path: () => builderPath(id)
    })
    if (res.ok) builders.value = builders.value.filter(b => b.id !== id)
    return res
  }

  return {
    builders,
    loading,
    error,
    apiMissing,
    load,
    create,
    update,
    setEnabled,
    remove
  }
}
