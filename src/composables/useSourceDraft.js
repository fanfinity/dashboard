import { computed, ref } from 'vue'
import { me } from '@/composables/useMe'
import { intentByKey, isTemplateComingSoon } from '@/config/sourceIntents'

// A half-finished "Connect a source" so a reload does not throw it away.
//
// This REVERSES what SourceCreatePage's header comment used to defend — "a
// reload restarts the flow cleanly, which is the honest behaviour". Honest it
// was, but the thing being discarded is not a scratch selection: by the middle
// of step 2 someone has picked a platform, named the source, taken a slug they
// had to think about, and possibly walked off to Zid's site and back. Losing all
// of it to a refresh (or to a link opened in the same tab) is not clean, it is
// an unannounced undo. What the old comment was actually right about is step 3,
// and that exception survives intact below.
//
// Module-level state, the same pattern as useOnboarding/useFeatures and for the
// same reason: the page reads and writes one record, and a second instance
// would be a second answer to "is there a draft?".
//
// There is no backend for this and there should not be — a draft is a
// this-browser-this-person thing, so it is localStorage, exactly like
// `sfere_onboarding` and the feature-activation overrides.
const STORAGE_KEY = 'sfere_source_draft'

// Bumped when the shape changes incompatibly. A record at any other version is
// discarded rather than migrated: worst case someone re-picks a platform and
// retypes a name, which costs less than a migration path costs to maintain.
const DRAFT_VERSION = 1

// STEP 3 IS NEVER IN HERE, and that is the one hard rule of this file.
//
// `created.id` and the write key on step 3 come out of the create response and
// exist exactly once — every later read of a key is masked. A persisted step 3
// would rehydrate as an install guide with no key to show, next to a "your
// pipeline is live" panel for a source the reader may or may not still own. So
// the record holds steps 1-2 only, and step 3 is unreachable on reload by
// design rather than by omission.
function emptyRecord() {
  return {
    v: DRAFT_VERSION,
    uid: null,
    intent: '',
    templateId: '',
    form: null,
    savedAt: null
  }
}

// The form fields worth carrying, named one by one rather than spread. A
// whitelist is what stops a future field on the page — a token, a fetched
// secret — reaching localStorage because somebody added it to the reactive
// object and nothing here objected.
function pickForm(form) {
  if (!form || typeof form !== 'object') return null
  return {
    name: typeof form.name === 'string' ? form.name : '',
    slug: typeof form.slug === 'string' ? form.slug : '',
    description: typeof form.description === 'string' ? form.description : '',
    // The Zid store id is an account-scoped identifier the backend hands back
    // from a grant, not a credential — the tokens for that store live on the
    // backend and never reach this browser. Carrying it is what keeps a
    // restored Zid draft from asking for the authorization a second time.
    storeId: typeof form.storeId === 'string' ? form.storeId : '',
    isEnabled: form.isEnabled !== false,
    serverKey: form.serverKey === true,
    strictMode: form.strictMode === true,
    // Whether the slug was hand-edited. Without it, restoring name+slug lets
    // the page's `name -> slugify(name)` watcher fire on the restored name and
    // quietly overwrite a slug somebody deliberately typed.
    slugTouched: form.slugTouched === true
  }
}

function readRecord() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyRecord()
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return emptyRecord()
    if (parsed.v !== DRAFT_VERSION) return emptyRecord()

    // Validate against the registry rather than trusting the strings, the same
    // posture useOnboarding takes against PERSONA_KEYS. Two things this catches
    // that matter: an intent key renamed in sourceIntents.js, and — the
    // expensive one — a `templateId` that has since become coming-soon. A draft
    // written before Shopify was greyed out would otherwise rehydrate step 2
    // with a submittable form for a source that can never receive an event,
    // which is precisely what greying it out exists to prevent.
    const intent = intentByKey(parsed.intent) ? parsed.intent : ''
    const templateId =
      typeof parsed.templateId === 'string' &&
      !isTemplateComingSoon(parsed.templateId)
        ? parsed.templateId
        : ''

    return {
      v: DRAFT_VERSION,
      uid: typeof parsed.uid === 'string' ? parsed.uid : null,
      intent,
      templateId,
      form: pickForm(parsed.form),
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : null
    }
  } catch {
    // Private mode, a disabled store, corrupt JSON. An empty record means the
    // worst case is the old behaviour — the flow starts at step 1.
    return emptyRecord()
  }
}

const record = ref(readRecord())

export function useSourceDraft() {
  // The draft only speaks for the user who wrote it. A shared machine must not
  // hand the second person to sign in the first person's half-built source —
  // same reasoning as useOnboarding's `isOurs`, and here the stakes are a
  // little higher, because the thing being inherited would end up as a row in
  // somebody's workspace with somebody else's name on it.
  const isOurs = computed(
    () => Boolean(me.value?.id) && record.value.uid === me.value.id
  )

  // Only worth restoring if a platform was actually chosen. An intent with no
  // template is a card someone clicked and abandoned inside one second, and
  // resuming into it says "welcome back" about nothing.
  const hasDraft = computed(() => {
    if (!isOurs.value) return false
    return Boolean(record.value.intent && record.value.templateId)
  })

  const draft = computed(() => (isOurs.value ? record.value : null))

  function save({ intent, templateId, form }) {
    const uid = me.value?.id ?? null
    const next = {
      v: DRAFT_VERSION,
      uid,
      intent: intent || '',
      templateId: templateId || '',
      form: pickForm(form),
      savedAt: new Date().toISOString()
    }
    record.value = next

    // NEVER WHILE SIGNED OUT. A record with no uid answers for nobody, and the
    // next real sign-in would read it as a mismatch anyway — so the only thing
    // writing it achieves is leaving one person's work in another's browser.
    if (!uid) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // A refused write costs the resume, nothing else. The in-memory record is
      // still updated, so the current session behaves identically.
    }
  }

  // Called the moment `create()` succeeds. A draft that outlives the source it
  // describes is worse than no draft at all: it resurrects a form for something
  // the person already made, and the obvious reaction to that is to submit it
  // again.
  function clear() {
    record.value = emptyRecord()
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Nothing to do. The in-memory record is empty either way, so the flow
      // will not offer to restore inside this session.
    }
  }

  return { draft, hasDraft, save, clear }
}
