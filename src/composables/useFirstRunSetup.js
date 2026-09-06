import { computed, ref } from 'vue'
import { getSource, testSource } from '@/api/fanfinity'
import { camelizeKeys } from '@/lib/apiShape'
import { checkSourceEvents } from '@/lib/sourceEventCheck'
import { currentAccount, waitForAccount } from '@/composables/useMe'
import { useSourcesAPI } from '@/composables/useSourcesAPI'
import { useSourceProvisioning } from '@/composables/useSourceProvisioning'
import { useDataSource } from '@/composables/useDataSource'
import { slugify } from '@/composables/useSources'
import {
  CATEGORY_DEFAULT_TEMPLATE,
  PLATFORM_NAME_OVERRIDES,
  SOURCE_NAMING
} from '@/config/firstRun'

// The half of the arrival that touches the backend: it creates the source the
// reader's answers describe, asks whether an event has arrived, and reads back
// what the create call provisioned.
//
// WHY IT EXISTS AT ALL, given `/sources/new` does the same three things. The
// arrival used to hand off to that page after its third beat, and CLAUDE.md
// defended the hand-off on duplication grounds — a second install guide and a
// second event checker would have to be kept in agreement with the first. That
// argument was right about the components and wrong about the conclusion: what
// the hand-off actually cost was the arrival stopping mid-sentence, dropping a
// reader who had answered two questions onto a create form with a stepper of its
// own and a details form nobody had prepared them for. So the BEATS moved and the
// components did not: the connect beat renders `SourceInstallGuide`, the verify
// beat runs the same `listSourceEvents` check with the same success test, and the
// provisioning read is `useSourceProvisioning` itself. This file is the small
// amount of glue that was genuinely missing, not a second implementation.
//
// MODULE SINGLETON, the same pattern as useOnboarding and useFeatures and for the
// same reason: `MainLayout` drives the beat machine and each beat renders what
// this holds, so both have to read one object or a created source would exist in
// one and not the other in the same tick.
//
// IT HOLDS NO SECRET LONGER THAN THE SESSION. `source.writeKey` is the one thing
// here that the backend issues exactly once — every later read of it is masked —
// so it lives in this ref and is never persisted. That is also why `restore()`
// below cannot put a reader back on the install beat: see its comment.

const { isReal } = useDataSource()
const sourcesAPI = useSourcesAPI()
const provisioning = useSourceProvisioning()

// The created source, camelCase, with `templateId` re-attached.
//
// RE-ATTACHED RATHER THAN READ BACK, and it matters: the backend's `Source`
// record carries no `template_id`, and `methodsForSource()` keys the install
// guide's method tabs off exactly that field. Without it a web source falls
// through to "every method" and offers an `AppDelegate.swift` tab to somebody
// with a website. `SourceCreatePage` does the same thing for the same reason.
const source = ref(null)

// Demo data mode. The arrival still runs every beat, with a fabricated source and
// a fabricated key, because a reader who has switched to Demo mode to look around
// should still be able to see what onboarding looks like — but nothing is written
// and every beat says so. `SourceInstallGuide` already has a `preview` prop that
// makes its own check answer "nothing to check in preview mode", so the honesty
// is not re-implemented here either.
const preview = ref(false)

const creating = ref(false)
const createError = ref('')

// The verification beat's state. `verified` is one-way within a run: an event
// that arrived cannot un-arrive, and the beat that follows is unlocked by it.
const checking = ref(false)
const verified = ref(false)
const checkResult = ref(null)
const lastCheckedAt = ref('')

// The store-only connection test. Kept apart from `checkResult` because they
// answer different questions — "has anything arrived?" and "can we reach your
// store?" — and collapsing them would let a green connection test read as an
// event that never came.
const testing = ref(false)
const testResult = ref(null)

/** Whether this source type can be asked "can you reach the upstream system?" */
const canTestConnection = computed(() => {
  const type = source.value?.sourceType
  return Boolean(!preview.value && (type === 'zid' || type === 'salla'))
})

/**
 * What to call the source the arrival is about to create, derived from answers
 * the reader has already given rather than asked for.
 *
 * THE PROTOTYPE ASKS FOR NEITHER A NAME NOR A SLUG, and the backend requires
 * both. Inserting a details form to collect them would add a beat the prototype
 * does not have, to ask about a string that has one sensible value at this point
 * in the flow — so it is derived, and the source page can rename it later.
 */
function nameFor({ intentKey, templateId, platformKey }) {
  const override = PLATFORM_NAME_OVERRIDES[platformKey]
  if (override) return override
  return (
    SOURCE_NAMING[templateId]?.name ??
    SOURCE_NAMING[intentKey]?.name ??
    'My source'
  )
}

/**
 * The `source_type` to POST, which is NOT the template fixture's own field.
 *
 * `public/data/source-templates.json` says `web-sdk` is an `event_stream` and
 * that `zid`/`salla` are `cloud_app`; the backend wants `web`, `zid` and `salla`.
 * `SourceCreatePage` overrides the same three on the same grounds, and posting
 * the fixture's value instead is not a cosmetic error: `cloud_app` narrows the
 * install guide to "Nothing to install" for a source that does have a write key,
 * and only `web` and `zid` provision a destination and pipeline at all.
 */
function sourceTypeFor(templateId) {
  return SOURCE_NAMING[templateId]?.sourceType ?? null
}

/** The template a category resolves to when no platform beat asked. */
export function templateFor(intentKey, templateId) {
  return templateId || CATEGORY_DEFAULT_TEMPLATE[intentKey] || ''
}

/**
 * Create the source for this arrival, once.
 *
 * IDEMPOTENT ON PURPOSE. The connect beat calls this on mount, and a reader who
 * walks Back from the verify beat mounts it again — a second call would create a
 * second source and orphan the first, which on a `web` template also orphans a
 * ClickHouse destination (the backend's `DELETE` does not clean those up). So a
 * source already created for this run is returned as-is.
 *
 * @param {object} answers
 * @param {string} answers.intentKey  A SOURCE_INTENTS key.
 * @param {string} [answers.templateId] The platform beat's answer, if it ran.
 * @param {string} [answers.platformKey] The platform card's own key.
 * @param {string} [answers.storeId] Required for a Zid or Salla source.
 * @returns {Promise<object|null>} the source, or null if the create failed.
 */
async function ensureSource(answers) {
  if (source.value) return source.value
  if (creating.value) return null

  const templateId = templateFor(answers.intentKey, answers.templateId)
  const name = nameFor({ ...answers, templateId })
  const sourceType = sourceTypeFor(templateId)

  createError.value = ''

  // DEMO MODE FABRICATES, IT DOES NOT SILENTLY SUCCEED. Same shape and the same
  // unmistakable key as `SourceCreatePage`'s preview branch, so the guide's
  // snippets render with something that is visibly not a credential.
  if (!isReal.value) {
    preview.value = true
    source.value = {
      id: 'preview',
      name,
      slug: slugify(name),
      templateId,
      sourceType,
      writeKey: 'sfere_wk_preview_not_a_real_key'
    }
    return source.value
  }

  preview.value = false
  creating.value = true
  try {
    const created = await createWithUniqueName({
      name,
      templateId,
      sourceType,
      storeId: answers.storeId ?? null
    })

    source.value = {
      ...created,
      templateId,
      sourceType: sourceType ?? created.sourceType ?? null,
      name: created.name ?? name,
      slug: created.slug ?? slugify(name)
    }
    return source.value
  } catch (e) {
    createError.value =
      e?.body?.detail || e?.message || 'We could not create your source.'
    return null
  } finally {
    creating.value = false
  }
}

/**
 * Create, and step the name aside if that one is taken.
 *
 * A brand-new account cannot collide, so this exists for the second run:
 * `Restart onboarding` on Settings → General replays the arrival on an account
 * that may already own a source called "Website". Failing the create there would
 * strand the reader on a beat whose only error is a name they never chose and
 * cannot edit, so it retries with a suffix. Four tries, because a fifth would be
 * answering a different problem.
 */
async function createWithUniqueName({ name, templateId, sourceType, storeId }) {
  let lastError = null
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const candidate = attempt === 0 ? name : `${name} ${attempt + 1}`
    try {
      const created = await sourcesAPI.create({
        name: candidate,
        slug: slugify(candidate),
        sourceType,
        templateId,
        storeId
      })
      return created
    } catch (e) {
      lastError = e
      // Only a conflict is worth renaming for. A 4xx about the store id or a 500
      // would retry three more times and report the wrong cause.
      const status = e?.status
      const conflict =
        status === 409 ||
        (status === 400 &&
          /exist|taken|conflict|duplicate/i.test(
            String(e?.body?.detail ?? e?.message ?? '')
          ))
      if (!conflict) throw e
    }
  }
  throw lastError
}

/**
 * Has a real event reached this source?
 *
 * THE SAME QUESTION AND THE SAME SUCCESS TEST AS `SourceInstallGuide`, and now
 * literally the same code: `checkSourceEvents()` in `src/lib/sourceEventCheck.js`
 * owns the request, the `total > 0` test and the 400-is-ordinary rule. This
 * function only maps its four states onto the beat's `tone`, and adds the
 * `preview` fifth one, which is the single thing about the question that is
 * specific to the arrival.
 */
async function checkEvents() {
  if (preview.value) {
    // Nothing was created, so there is nothing to have received. Said plainly
    // rather than dressed as a pass, which would make Demo mode the one place
    // onboarding lies.
    checkResult.value = {
      tone: 'info',
      state: 'preview'
    }
    verified.value = true
    return
  }

  if (!source.value?.id) return

  checking.value = true
  checkResult.value = null
  const { state, total, message } = await checkSourceEvents(source.value.id)
  checking.value = false
  lastCheckedAt.value = new Date().toLocaleTimeString()

  if (state === 'found') {
    verified.value = true
    checkResult.value = { tone: 'success', state: 'found', total }
    return
  }
  if (state === 'unsupported') {
    checkResult.value = { tone: 'info', state: 'unsupported' }
    return
  }
  if (state === 'error') {
    checkResult.value = { tone: 'danger', state: 'error', message }
    return
  }
  checkResult.value = { tone: 'warn', state: 'empty' }
}

/**
 * Can the backend reach the store behind this source?
 *
 * THIS IS WHAT THE PROTOTYPE'S "SEND A TEST EVENT" BECOMES, and only for the two
 * source types it can honestly become it for. The dashboard cannot send an event
 * — writing to a collector is the backend's job and the CSP names no collector
 * host — so a button labelled "Send a test event" would report a test it never
 * sent. `POST …/sources/{id}/test` asks a real question with a real answer, and
 * a failed test is a `200` with `ok: false` rather than a thrown error, so the
 * false case is a result and not a catch.
 */
async function testConnection() {
  if (!canTestConnection.value || !source.value?.id) return

  testing.value = true
  testResult.value = null
  try {
    await waitForAccount()
    const accountId = currentAccount.value?.id
    if (!accountId) throw new Error('No account selected')

    const { data } = await testSource(accountId, source.value.id)
    const result = camelizeKeys(data ?? {})
    testResult.value = {
      tone: result.ok ? 'success' : 'warn',
      ok: Boolean(result.ok),
      message: result.message || result.detail || ''
    }
  } catch (e) {
    testResult.value = {
      tone: 'danger',
      ok: false,
      message: e?.body?.detail || e?.message || 'The request failed.'
    }
  } finally {
    testing.value = false
  }
}

/**
 * Read back what the create call built. Real mode only — in Demo mode this would
 * answer out of `pipes.json` and name a pipeline belonging to the fixture.
 */
async function discoverProvisioning() {
  if (preview.value || !source.value?.id) return
  await provisioning.discover(source.value.id)
}

/**
 * Put a resumed run back on its feet, as far as it can be.
 *
 * IT CANNOT RESTORE THE INSTALL BEAT, and that is a property of the backend
 * rather than a shortcut. The write key exists exactly once, in the create
 * response — every later read is masked, which is why `SecretRevealDialog`
 * exists — so a source loaded back by id has no key to put in a snippet, and the
 * install beat would render the guide's `provisioning…` placeholder over a key
 * that had in fact been issued. Persisting the key to survive the reload is not
 * the fix: it would put a live credential in `localStorage` to save a click.
 *
 * So a reader who parked on the install beat and came back after a reload
 * resumes on VERIFY, which needs only the id, and can reach the snippet from the
 * source's own Setup instructions tab — the same component, which is the point of
 * it being the same component. The caller decides that; this only reports whether
 * there is a source to work with.
 *
 * @param {string} sourceId
 * @returns {Promise<boolean>} whether a source was loaded.
 */
async function restore(sourceId) {
  if (!sourceId || !isReal.value) return false
  if (source.value?.id === sourceId) return true
  try {
    await waitForAccount()
    const accountId = currentAccount.value?.id
    if (!accountId) return false
    const { data } = await getSource(accountId, sourceId)
    const loaded = camelizeKeys(data ?? {})
    if (!loaded?.id) return false
    source.value = { ...loaded, templateId: loaded.templateId ?? '' }
    verified.value = false
    checkResult.value = null
    return true
  } catch {
    // A source that cannot be read is one the reader cannot be put back on.
    // Falling through to the question beats is the caller's job.
    return false
  }
}

/** Whether the install beat can render a real snippet for what we hold. */
const hasWriteKey = computed(() => Boolean(source.value?.writeKey))

/** Forget everything, so a restarted arrival does not inherit a run. */
function reset() {
  source.value = null
  preview.value = false
  creating.value = false
  createError.value = ''
  checking.value = false
  verified.value = false
  checkResult.value = null
  lastCheckedAt.value = ''
  testing.value = false
  testResult.value = null
  provisioning.state.value = 'idle'
  provisioning.pipe.value = null
  provisioning.destination.value = null
}

export function useFirstRunSetup() {
  return {
    source,
    preview,
    creating,
    createError,
    hasWriteKey,

    checking,
    verified,
    checkResult,
    lastCheckedAt,
    checkEvents,

    canTestConnection,
    testing,
    testResult,
    testConnection,

    provisioningState: provisioning.state,
    provisionedPipe: provisioning.pipe,
    provisionedDestination: provisioning.destination,
    provisioned: provisioning.provisioned,
    discoverProvisioning,

    ensureSource,
    restore,
    reset
  }
}

export default useFirstRunSetup
