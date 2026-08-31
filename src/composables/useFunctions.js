import { NONE } from '@/lib/emptyValue'
import { camelizeKeys, pageItems } from '@/lib/apiShape'
import { currentAccount } from '@/composables/useMe'
import { useMockResource, sendMutation } from '@/composables/useMockResource'
import { ApiError, customFetch } from '@/api/mutator'
import { useDataSource } from '@/composables/useDataSource'

/**
 * Account-level transform functions — the code that runs on an event between a
 * source and a destination. Full CRUD plus a test runner, all live as of backend
 * PR #16:
 *
 *   GET/POST       …/functions
 *   GET/PUT/DELETE …/functions/{id}
 *   POST           …/functions/{id}/test
 *
 * NOT `usePipelineFunctions`, which is the per-pipeline attachment list — the
 * same function can be attached to several pipes, and that composable answers
 * "what runs on THIS pipe, in what order". This one answers "what functions does
 * this account have".
 *
 * ## Four things about the endpoints that shape the UI
 *
 * 1. **`PUT …/functions/{id}` persists only `code`.** The handler is explicit
 *    about it: "The SDK update path replaces code only; name/description are
 *    echoed back from the request but are not persisted upstream." So the
 *    response you get looks like a successful rename and a re-read disagrees.
 *    `update()` below therefore sends only `code`, and the editor's name field is
 *    read-only with a sentence saying why — the alternative is a form that
 *    reports a save and loses the value, which is the worst of the three
 *    possible behaviours.
 * 2. **`DELETE` answers `409` while the function is attached to any pipeline**,
 *    with the pipeline ids in the message. That is a real branch, not a failure:
 *    the fix is to detach first, and `remove()` reports it as `conflict` so the
 *    confirm dialog can say which pipes are holding it.
 * 3. **`POST …/functions/{id}/test` takes an optional `code`**, which runs the
 *    editor's unsaved content instead of what is stored. That is the whole value
 *    of the test button — testing what you just typed rather than what you last
 *    saved.
 * 4. **`result: null` with `dropped: true` is SUCCESS for a `filter`**, not an
 *    error. A filter's job is to drop events; a test panel that painted that red
 *    would tell you your working filter is broken. `describeTestResult()` below
 *    is the one place that reading lives.
 *
 * `attached_pipeline_ids` is real and is what makes the delete confirm able to
 * name the pipes rather than just refusing.
 */

/** What a function does to an event. */
export const FUNCTION_KINDS = [
  {
    value: 'transform',
    label: 'Transform',
    description: 'Reshapes the event and passes it on.'
  },
  {
    value: 'filter',
    label: 'Filter',
    description:
      'Decides whether the event continues. Dropping an event is success, not failure.'
  },
  {
    value: 'enrich',
    label: 'Enrich',
    description: 'Adds fields to the event without changing what is there.'
  }
]

/**
 * `'Drop test users'` -> `'drop-test-users'`.
 *
 * `FunctionCreate` requires both `name` and `slug`, so the form derives one and
 * lets it be overridden rather than asking twice for the same thing.
 *
 * @param {string} name
 * @returns {string}
 */
export function slugify(name) {
  return String(name ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** One wire `FunctionDefinition`. */
export function adaptFunction(raw) {
  const f = camelizeKeys(raw)
  return {
    id: f.id,
    accountId: f.accountId ?? null,
    name: f.name || '',
    slug: f.slug || '',
    description: f.description || '',
    kind: f.kind || 'transform',
    code: f.code || '',
    version: f.version ?? null,
    template: f.template ?? null,
    templateVersion: f.templateVersion ?? null,
    latestTemplateVersion: f.latestTemplateVersion ?? null,
    attachedPipelineIds: Array.isArray(f.attachedPipelineIds)
      ? f.attachedPipelineIds
      : [],
    createdAt: f.createdAt ?? null,
    updatedAt: f.updatedAt ?? null
  }
}

/** Whether the function's template has moved on since it was created. */
export function hasTemplateUpgrade(fn) {
  return (
    fn?.template &&
    fn.templateVersion != null &&
    fn.latestTemplateVersion != null &&
    fn.latestTemplateVersion > fn.templateVersion
  )
}

/**
 * A `FunctionTestResult` as something to render.
 *
 * The `filter` reading is the reason this exists. `{ok: true, dropped: true,
 * result: null}` is a filter working — it looked at the event and said no. For a
 * `transform` the same shape would mean the code returned nothing, which is
 * usually a bug. Only the function's own `kind` distinguishes them, so the kind
 * has to be passed in.
 *
 * @param {object|null} result  A camelCase `FunctionTestResult`.
 * @param {string} kind         The function's `kind`.
 * @returns {{tone: string, title: string, message: string}|null}
 */
export function describeTestResult(result, kind) {
  if (!result) return null
  if (!result.ok) {
    return {
      tone: 'danger',
      title: 'The function threw',
      message:
        result.error ||
        'It raised an error and gave no message. The log below is what it wrote before it stopped.'
    }
  }
  if (result.dropped) {
    return kind === 'filter'
      ? {
          tone: 'success',
          title: 'The event was dropped',
          message:
            'That is what a filter is for: this event would not continue down the pipe. Try an event you expect to keep, to check the other direction too.'
        }
      : {
          tone: 'warn',
          title: 'The event was dropped',
          message: `A ${kind} function returning nothing drops the event. If that was not the intent, check that every path through the code returns it.`
        }
  }
  return {
    tone: 'success',
    title: 'The event passed through',
    message: 'The result below is what the next stage of the pipe would see.'
  }
}

function functionsPath() {
  return (
    currentAccount.value && `/v1/accounts/${currentAccount.value.id}/functions`
  )
}

export function useFunctions() {
  const { isMock } = useDataSource()

  const {
    data: functions,
    loading,
    error,
    apiMissing,
    load
  } = useMockResource('functions', {
    api: {
      path: functionsPath,
      select: payload => pageItems(payload).map(adaptFunction)
    }
  })

  function findById(id) {
    return functions.value.find(f => f.id === id) ?? null
  }

  /**
   * @param {{ name: string, slug?: string, description?: string, kind?: string, code?: string, template?: string }} input
   */
  async function create(input) {
    const res = await sendMutation({
      method: 'POST',
      path: functionsPath,
      body: {
        name: input.name,
        slug: input.slug || slugify(input.name),
        ...(input.description ? { description: input.description } : {}),
        ...(input.kind ? { kind: input.kind } : {}),
        ...(input.code ? { code: input.code } : {}),
        ...(input.template ? { template: input.template } : {})
      }
    })
    if (!res.ok || res.skipped) return res
    const fn = adaptFunction(camelizeKeys(res.data))
    functions.value = [...functions.value, fn]
    return { ok: true, data: fn }
  }

  /**
   * Save the code. ONLY the code — see note 1 at the top of this file. Passing a
   * name here would come back looking saved and would not be.
   *
   * @param {string} id
   * @param {string} code
   */
  async function update(id, code) {
    const res = await sendMutation({
      // PUT, not PATCH — `updateFunction` replaces the function rather than
      // patching it, which is also why only `code` is sent: anything else in the
      // body is echoed back and dropped upstream.
      method: 'PUT',
      path: () => {
        const base = functionsPath()
        return base && `${base}/${id}`
      },
      body: { code }
    })
    if (!res.ok || res.skipped) return res
    const fn = adaptFunction(camelizeKeys(res.data))
    functions.value = functions.value.map(f => (f.id === id ? fn : f))
    return { ok: true, data: fn }
  }

  /**
   * Delete a function.
   *
   * `409` while it is attached to a pipeline is a real state, so it is reported
   * as `conflict` with the backend's message (which names the pipeline ids)
   * rather than as a generic failure. `sendMutation` cannot make that
   * distinction — it collapses every non-404 into `error` — which is why this
   * one call is hand-written.
   *
   * @param {string} id
   * @returns {Promise<{ok: true} | {ok: false, conflict?: true, apiMissing?: true, error?: string}>}
   */
  async function remove(id) {
    if (isMock.value) {
      functions.value = functions.value.filter(f => f.id !== id)
      return { ok: true, skipped: true }
    }
    const base = functionsPath()
    if (!base) return { ok: false, apiMissing: true }
    try {
      await customFetch(`${base}/${id}`, { method: 'DELETE' })
      functions.value = functions.value.filter(f => f.id !== id)
      return { ok: true }
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        return { ok: false, conflict: true, error: e.message }
      }
      if (e instanceof ApiError && e.status !== 404) {
        return { ok: false, error: e.message }
      }
      return { ok: false, apiMissing: true }
    }
  }

  /**
   * Run one event through the function.
   *
   * @param {string} id
   * @param {{ event: object, code?: string }} input
   *   `code` runs the editor's unsaved content instead of what is stored, which
   *   is the point of the button.
   */
  async function test(id, { event, code }) {
    if (isMock.value) return { ok: false, apiMissing: true }
    const base = functionsPath()
    if (!base) return { ok: false, apiMissing: true }
    try {
      const { data } = await customFetch(`${base}/${id}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({ event, ...(code ? { code } : {}) })
      })
      const r = camelizeKeys(data) ?? {}
      return {
        ok: true,
        data: {
          ok: Boolean(r.ok),
          result: r.result ?? null,
          dropped: Boolean(r.dropped),
          error: r.error ?? null,
          logs: Array.isArray(r.logs) ? r.logs.map(camelizeKeys) : [],
          durationMs: Number.isFinite(Number(r.durationMs))
            ? Number(r.durationMs)
            : null
        }
      }
    } catch (e) {
      if (e instanceof ApiError && e.status !== 404) {
        return { ok: false, error: e.message }
      }
      return { ok: false, apiMissing: true }
    }
  }

  return {
    functions,
    loading,
    error,
    apiMissing,
    load,
    findById,
    create,
    update,
    remove,
    test
  }
}

/**
 * How many pipes a function runs on, as a phrase. `NONE` rather than `0`,
 * because an empty list here is a genuinely empty collection.
 *
 * @param {object} fn
 * @returns {string}
 */
export function attachmentLabel(fn) {
  const n = fn?.attachedPipelineIds?.length ?? 0
  if (!n) return NONE
  return `${n} pipe${n === 1 ? '' : 's'}`
}
