import { NEVER } from '@/lib/emptyValue'
import { computed } from 'vue'
import { useMockResource } from '@/composables/useMockResource'
import { useIdentifierTypes } from '@/composables/useIdentifierTypes'
import {
  formatAgo,
  formatAttributeValue,
  formatDate,
  formatDateTime,
  formatNumber,
  initialsOf
} from '@/composables/useProfilesFormat'

/**
 * Profile search: find a fan by *any* identifier — email, phone, browser
 * cookie, account id, mobile device id, ticket reference or the profile id
 * itself — and read back the resolved profile behind it.
 *
 * There is no search backend. `data/profiles.json` is loaded once and filtered
 * client-side, which is also what makes the "matched on" column possible: the
 * matcher knows *which* identifier hit, not just that the record did.
 *
 * Resources, all mock JSON through `useMockResource`:
 *
 * - `data/profiles.json`         **primary** — the fans. Its failure is the
 *   page-level `ErrorState`.
 * - `data/identifier-types.json` labels for the identifier rows and the type
 *   filter
 * - `data/attributes.json`       what a profile carries, and where each
 *   attribute comes from
 * - `data/audiences.json`        membership
 * - `data/sources.json`          names for `profile.sourceIds`
 * - `data/dashboard.json`        `lastProfiles` / `lastEvents` for the
 *   no-query state and the activity tab
 *
 * Everything after the first is secondary: a failure there degrades one panel,
 * which keeps its own retry, rather than blanking the screen.
 *
 * @example
 * const search = useProfilesSearch()
 * onMounted(search.load)
 * const results = computed(() => search.search('layla', ''))
 */
export function useProfilesSearch() {
  const {
    data: profiles,
    loading,
    error,
    load: loadProfiles
  } = useMockResource('profiles')

  const {
    identifierTypes,
    error: typesError,
    load: loadTypes
  } = useIdentifierTypes()

  const {
    data: attributes,
    error: attributesError,
    load: loadAttributes
  } = useMockResource('attributes')

  const {
    data: audiences,
    error: audiencesError,
    load: loadAudiences
  } = useMockResource('audiences')

  const {
    data: sources,
    error: sourcesError,
    load: loadSources
  } = useMockResource('sources')

  const {
    data: dashboard,
    loading: recentLoading,
    error: recentError,
    load: loadDashboard
  } = useMockResource('dashboard', { initial: {} })

  /** One retry for every lookup the profile panel leans on. */
  async function loadLookups() {
    await Promise.all([
      loadTypes(),
      loadAttributes(),
      loadAudiences(),
      loadSources()
    ])
  }

  async function load() {
    await Promise.all([loadProfiles(), loadLookups(), loadDashboard()])
  }

  const lookupsError = computed(
    () =>
      typesError.value ||
      attributesError.value ||
      audiencesError.value ||
      sourcesError.value ||
      null
  )

  // ------------------------------------------------------------------ lookups

  const typeIndex = computed(
    () => new Map(identifierTypes.value.map(t => [t.id, t]))
  )
  const audienceIndex = computed(
    () => new Map(audiences.value.map(a => [a.id, a]))
  )
  const sourceIndex = computed(() => new Map(sources.value.map(s => [s.id, s])))

  function typeLabel(identifier) {
    const type = typeIndex.value.get(identifier.typeId)
    return type?.displayName || type?.name || identifier.type
  }

  /** Options for the identifier-type filter, "Any" first. */
  const typeOptions = computed(() => [
    { label: 'Any identifier', value: '' },
    ...identifierTypes.value.map(t => ({
      label: t.displayName || t.name,
      value: t.id
    }))
  ])

  // ------------------------------------------------------------------- search

  /** One result row, pre-formatted for `DataTable`. */
  function toRow(profile, matchedLabel, matchedValue, matchedIdentifier) {
    return {
      id: profile.id,
      profile,
      displayName: profile.displayName,
      matchedLabel,
      matchedValue,
      matchedIdentifier,
      identifierCount: (profile.identifiers ?? []).length,
      audienceCount: (profile.audiences ?? []).length,
      lastSeenAt: profile.lastSeenAt,
      lastSeen: formatAgo(profile.lastSeenAt, NEVER)
    }
  }

  /**
   * Filter the loaded fans. An empty query is NOT an error and NOT a match-all:
   * the page shows recent fans instead, so this returns an empty list and the
   * caller decides what that means.
   *
   * @param {string} query      free text, matched case-insensitively as a
   *                            substring of any identifier value, the profile
   *                            id or the display name
   * @param {string} [typeId]   restrict matching to one identifier type; the
   *                            id / name fallbacks are skipped, because
   *                            "search browser cookies" should not return a fan
   *                            whose *name* happens to contain the string
   * @returns {Array<object>} rows, most recently seen first
   */
  function search(query, typeId = '') {
    const q = String(query ?? '')
      .trim()
      .toLowerCase()
    if (!q) return []

    const hits = []
    for (const profile of profiles.value) {
      const identifier = (profile.identifiers ?? []).find(
        i =>
          (!typeId || i.typeId === typeId) &&
          String(i.value ?? '')
            .toLowerCase()
            .includes(q)
      )
      if (identifier) {
        hits.push(
          toRow(
            profile,
            typeLabel(identifier),
            identifier.value,
            identifier.value
          )
        )
        continue
      }
      if (typeId) continue

      if (String(profile.id).toLowerCase().includes(q)) {
        hits.push(toRow(profile, 'Profile ID', profile.id, null))
        continue
      }
      if (
        String(profile.displayName ?? '')
          .toLowerCase()
          .includes(q)
      ) {
        hits.push(toRow(profile, 'Display name', profile.displayName, null))
      }
    }

    return hits.sort((a, b) =>
      String(b.lastSeenAt ?? '').localeCompare(String(a.lastSeenAt ?? ''))
    )
  }

  /**
   * `lastProfiles` re-joined to the full records, as rows — the no-query state.
   * A search box with nothing typed in it is a legitimate state, not an error,
   * and "here is who the platform touched last" is more use than a blank panel.
   */
  const recentRows = computed(() => {
    const index = new Map(profiles.value.map(p => [p.id, p]))
    return (dashboard.value.lastProfiles ?? [])
      .map(p => index.get(p.id) ?? null)
      .filter(Boolean)
      .map(p => toRow(p, 'Recently updated', p.primaryEmail ?? p.id, null))
  })

  function findProfile(id) {
    return profiles.value.find(p => p.id === id) ?? null
  }

  // ------------------------------------------------------------ resolved view

  /**
   * Everything the profile panel renders, pre-formatted. Returns `null` for an
   * unknown id — the caller renders `EmptyState`, never `ErrorState`: the fetch
   * worked, the answer was "no such fan".
   *
   * @param {object|null} profile
   * @param {string} [matchedIdentifier] identifier value to flag in the table
   */
  function resolve(profile, matchedIdentifier = null) {
    if (!profile) return null

    const identifiers = [...(profile.identifiers ?? [])].sort((a, b) =>
      String(a.firstSeenAt ?? '').localeCompare(String(b.firstSeenAt ?? ''))
    )

    const identifierRows = identifiers.map((i, index) => ({
      id: `${i.typeId}-${i.value}`,
      typeLabel: typeLabel(i),
      typeName: i.type,
      value: i.value,
      firstSeenAt: i.firstSeenAt,
      firstSeen: formatDateTime(i.firstSeenAt),
      role: index === 0 ? 'Anchor' : 'Stitched',
      isMatch: matchedIdentifier !== null && i.value === matchedIdentifier
    }))

    const carried = profile.attributes ?? {}
    const attributeRows = attributes.value.map(a => ({
      label: a.name,
      value: formatAttributeValue(carried[a.id]),
      hint:
        a.type === 'warehouse'
          ? `Warehouse · ${a.dataModelName ?? 'model'}`
          : 'Real-time · event stream'
    }))

    const audienceRows = (profile.audiences ?? []).map(id => {
      const a = audienceIndex.value.get(id)
      return {
        id,
        name: a?.name ?? id,
        description: a?.description ?? '',
        type: a?.type === 'warehouse' ? 'Warehouse' : 'Real-time',
        size: formatNumber(a?.profileCount)
      }
    })

    const eventRows = (dashboard.value.lastEvents ?? [])
      .filter(e => e.profileId === profile.id)
      .map(e => ({
        id: e.id,
        eventName: e.eventName,
        sourceName: e.sourceName,
        occurredAtIso: e.occurredAt,
        occurredAt: formatDateTime(e.occurredAt),
        ago: formatAgo(e.occurredAt)
      }))

    const sourceNames = (profile.sourceIds ?? []).map(
      id => sourceIndex.value.get(id)?.name ?? id
    )

    return {
      id: profile.id,
      displayName: profile.displayName,
      primaryEmail: profile.primaryEmail,
      isAnonymous: !profile.primaryEmail,
      initials: initialsOf(profile.displayName),
      identifierRows,
      attributeRows,
      audienceRows,
      eventRows,
      sourceNames,
      stats: [
        {
          label: 'Identifiers',
          value: formatNumber(identifierRows.length),
          hint:
            identifierRows.length > 1
              ? `${identifierRows.length - 1} stitched onto the anchor.`
              : 'Never stitched. One identifier only.'
        },
        {
          label: 'Audiences',
          value: formatNumber(audienceRows.length),
          hint: audienceRows.length
            ? 'Evaluated on every profile refresh.'
            : 'Not in any audience yet.'
        },
        {
          label: 'Events (30 days)',
          value: formatNumber(profile.eventCountLast30Days),
          hint: `${sourceNames.length} source(s) feeding this fan.`
        },
        {
          label: 'Last seen',
          value: formatAgo(profile.lastSeenAt, NEVER),
          hint: formatDateTime(profile.lastSeenAt, NEVER)
        }
      ],
      facts: [
        { label: 'Profile ID', value: profile.id },
        {
          label: 'Primary email',
          value: profile.primaryEmail,
          hint: profile.primaryEmail
            ? ''
            : 'Anonymous. No declared identity yet.'
        },
        { label: 'First seen', value: formatDate(profile.createdAt) },
        { label: 'Profile updated', value: formatDateTime(profile.updatedAt) },
        {
          label: 'Sources',
          value: sourceNames.join(', ') || null
        },
        {
          label: 'Audiences',
          value: audienceRows.map(a => a.name).join(', ') || null
        }
      ]
    }
  }

  return {
    profiles,
    loading,
    error,
    load,
    // Secondary resources, each with the retry the panel that owns it calls.
    lookupsError,
    loadLookups,
    recentLoading,
    recentError,
    loadDashboard,
    typeOptions,
    search,
    findProfile,
    recentRows,
    resolve
  }
}
