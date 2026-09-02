import { ref } from 'vue'
import { ApiError, customFetch } from '@/api/mutator'
import { camelizeKeys } from '@/lib/apiShape'
import { currentAccount } from '@/composables/useMe'
import { useDataSource } from '@/composables/useDataSource'

/**
 * A source's ingest settings — `GET/PUT …/sources/{id}/ingest-settings`, live as
 * of backend PR #16. This is the fourth item in
 * `todos/backend-ask-source-settings.md`: **Strict mode is real now**, along
 * with the authorised-domain lists it depends on.
 *
 * ## It is `web` only, and the predicate's name says otherwise
 *
 * The route is guarded by `is_event_stream()` in `app/services/sources.py`,
 * which is:
 *
 *     def is_event_stream(source: Source) -> bool:
 *         """Event-stream sources (Web SDK) are the ones with ingest settings."""
 *         return source.source_type == "web"
 *
 * So it `404`s for `zid`, for `cloud_app`, **and for a source whose
 * `source_type` is literally `event_stream`** — an iOS or Android SDK source,
 * which is the one case the name actively misleads you about. The scope looks
 * deliberate (only a browser SDK site has origins to authorise), so
 * `hasIngestSettings()` below gates on `web` to match the code rather than the
 * name, and the panel hides the section instead of showing a control that
 * cannot load. Raised on the backend PR as Problem 6.
 *
 * ## Strict mode is a real trade-off, so the copy has to state both sides
 *
 * `strict: false` means an event arriving without a valid write key is still
 * matched to this source by domain. That is forgiving while wiring up and wrong
 * once you are live: a mistyped key lands somewhere quietly instead of failing.
 * Both halves are in the panel's prose, unchanged from when the control was
 * disabled — the sentence was already right, only the switch was dead.
 *
 * `PUT` replaces the whole record: `SourceIngestSettingsUpdate` requires
 * `domains`, `authorized_javascript_domains` and `strict` together. So `save()`
 * always sends all three, sourced from the loaded record, rather than patching
 * one field and blanking the other two.
 */

/**
 * Whether this source has ingest settings at all.
 *
 * @param {object|null} source  A camelCase source record.
 * @returns {boolean}
 */
export function hasIngestSettings(source) {
  return source?.sourceType === 'web'
}

/**
 * One wire `SourceIngestSettings` in camelCase.
 *
 * @param {object} raw
 * @returns {object}
 */
export function adaptIngestSettings(raw) {
  const s = camelizeKeys(raw)
  return {
    sourceId: s.sourceId ?? null,
    domains: Array.isArray(s.domains) ? s.domains : [],
    authorizedJavascriptDomains: Array.isArray(s.authorizedJavascriptDomains)
      ? s.authorizedJavascriptDomains
      : [],
    strict: Boolean(s.strict),
    deduplicateWindowMs: Number.isFinite(Number(s.deduplicateWindowMs))
      ? Number(s.deduplicateWindowMs)
      : null,
    updatedAt: s.updatedAt ?? null
  }
}

export function useSourceIngestSettings() {
  const { isMock } = useDataSource()

  const settings = ref(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref(null)
  const apiMissing = ref(false)

  function path(sourceId) {
    const account = currentAccount.value
    return (
      account &&
      `/v1/accounts/${account.id}/sources/${sourceId}/ingest-settings`
    )
  }

  async function load(sourceId) {
    settings.value = null
    error.value = null
    apiMissing.value = false

    if (isMock.value) {
      apiMissing.value = true
      return
    }
    const url = path(sourceId)
    if (!url) {
      apiMissing.value = true
      return
    }

    loading.value = true
    try {
      const { data } = await customFetch(url, { method: 'GET' })
      settings.value = adaptIngestSettings(data)
    } catch (e) {
      if (e instanceof ApiError && e.status !== 404) error.value = e.message
      else apiMissing.value = true
    } finally {
      loading.value = false
    }
  }

  /**
   * Replace the record. All three required fields go every time — see the note
   * above; a partial body would blank whichever lists it left out.
   *
   * @param {string} sourceId
   * @param {{ domains: string[], authorizedJavascriptDomains: string[], strict: boolean, deduplicateWindowMs?: number|null }} next
   */
  async function save(sourceId, next) {
    if (isMock.value) return { ok: false, apiMissing: true }
    const url = path(sourceId)
    if (!url) return { ok: false, apiMissing: true }
    saving.value = true
    try {
      const { data } = await customFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domains: next.domains ?? [],
          authorized_javascript_domains: next.authorizedJavascriptDomains ?? [],
          strict: Boolean(next.strict),
          ...(next.deduplicateWindowMs != null
            ? { deduplicate_window_ms: next.deduplicateWindowMs }
            : {})
        })
      })
      settings.value = adaptIngestSettings(data)
      return { ok: true, data: settings.value }
    } catch (e) {
      if (e instanceof ApiError && e.status !== 404) {
        return { ok: false, error: e.message }
      }
      return { ok: false, apiMissing: true }
    } finally {
      saving.value = false
    }
  }

  return { settings, loading, saving, error, apiMissing, load, save }
}
