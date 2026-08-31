import { camelizeKeys } from '@/lib/apiShape'
import { currentAccount } from '@/composables/useMe'
import { useMockResource } from '@/composables/useMockResource'

/**
 * The identifier types the platform can stitch a profile on — email, phone,
 * user id, anonymous id, device id.
 *
 * ONE composable for what used to be seven copies of
 * `useMockResource('identifier-types')`, in `useProfilesIdentityResolution`,
 * `useProfilesSearch`, `useAttributes`' create page, `useProfileApi`,
 * `useProfileDwhSyncs`, `useLiveProfileSyncs` and `useWarehouseModels`. They
 * all read the same reference list, so they now all read the same endpoint,
 * through the same adapter, and a change to the shape is one edit rather than
 * seven.
 *
 * `GET /v1/accounts/{account}/identifier-types` is live as of backend PR #16.
 * Two things about it that the screens above were not written for:
 *
 * 1. **The record is narrower than the fixture was.** `IdentifierType` is
 *    `{key, name, is_unique, is_pii, distinct_count?, coverage?}`. The fixture
 *    invented `maxIdentifiers`, `priority`, `version`, `eventTypes` and
 *    `dataModels`; none of those exist on the wire. `adaptIdentifierType()`
 *    below maps what is real and — deliberately — does NOT synthesise the rest.
 *    A `dataModels: []` would read as "this identifier collects from no model",
 *    which is a measured-sounding claim about a field the backend has no
 *    concept of; leaving it absent makes every `t.dataModels?.includes(...)`
 *    site fall through instead.
 * 2. **`distinct_count` and `coverage` are always null today.** The backend's
 *    own docstring says per-account analytics "are not computed here, so they
 *    are null" (`app/services/account_insights.py`). They are passed through
 *    as null rather than defaulted to `0`, so a screen printing them reaches
 *    for `NOT_KNOWN` and never states a count nobody took.
 *
 * The catalog is fixed and account-independent on the backend, but the route is
 * account-scoped, so the path is a function like every other one here.
 *
 * @returns {{ identifierTypes: import('vue').Ref<object[]>, loading: import('vue').Ref<boolean>, error: import('vue').Ref<string|null>, apiMissing: import('vue').Ref<boolean>, load: () => Promise<void> }}
 *
 * @example
 * const { identifierTypes, load } = useIdentifierTypes()
 * onMounted(load)
 */
export function useIdentifierTypes() {
  const {
    data: identifierTypes,
    loading,
    error,
    apiMissing,
    load
  } = useMockResource('identifier-types', {
    api: {
      path: () =>
        currentAccount.value &&
        `/v1/accounts/${currentAccount.value.id}/identifier-types`,
      select: payload => (payload?.items ?? []).map(adaptIdentifierType)
    }
  })

  return { identifierTypes, loading, error, apiMissing, load }
}

/**
 * One wire `IdentifierType` in the shape the profile screens read.
 *
 * `key` is the machine name a profile builder references and `name` is the
 * human label, which is the opposite way round from the fixture: there, `name`
 * was the machine name and `displayName` the label. Every consumer renders
 * `t.displayName || t.name`, so the label goes to `displayName` and the key to
 * both `id` and `name` — that keeps the mono `{{ type.name }}` line in
 * `ProfileApiIdentifierPicker` showing a key rather than repeating the label.
 *
 * `maxIdentifiers` is a translation, not an invention: `is_unique` means one
 * such identifier per profile, so a unique type caps at 1 and a non-unique one
 * has no cap the backend states — null, which `uniquenessOf()` already reads as
 * unknown.
 *
 * @param {object} raw  A snake_case `IdentifierType`.
 * @returns {object}
 */
export function adaptIdentifierType(raw) {
  const t = camelizeKeys(raw)
  return {
    id: t.key,
    key: t.key,
    name: t.key,
    displayName: t.name,
    isUnique: Boolean(t.isUnique),
    isPii: Boolean(t.isPii),
    maxIdentifiers: t.isUnique ? 1 : null,
    // Null on every response today. Left null on purpose — see the note above.
    distinctCount: t.distinctCount ?? null,
    coverage: t.coverage ?? null
  }
}
