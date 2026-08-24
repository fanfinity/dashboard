import { computed, ref } from 'vue'
import { PERSONA_KEYS, PERSONAS } from '@/config/personas'
import { user } from '@/composables/useAuth'

// What we know about the person using the dashboard, and how far through
// onboarding they are.
//
// Module-level state, the same pattern as useAuth/useFeatures and for
// the same reason: the question overlay in MainLayout and the "Your role" control
// in Settings are two components that must read and write one object, so a toggle
// in either is true in the other in the same tick without a bus or a refetch.
//
// There is no backend to store this in (see CLAUDE.md, "Data architecture"), so
// it is localStorage — the precedent set by the feature-activation overrides
// key. One key holds the whole record.
const STORAGE_KEY = 'sfere_onboarding'

// Bumped only when the shape changes incompatibly. A record at any other version
// is discarded rather than migrated: the whole thing is one question and some
// progress, so re-asking costs the user two seconds and a migration path costs
// more than that to maintain.
const STATE_VERSION = 1

// Shape in storage:
//
//   { v: 1, uid, persona, askedAt, skipped, completedAt, chapters: {}, runs: [] }
//
// `chapters` and `runs` are written empty today and are here on purpose: the tour
// itself (the stepper, the strip, the completion card) is a later phase, and
// having it find a record it can extend beats having it invent a second key.
//
// `uid` is what makes "ask on first login" true rather than "ask once per
// browser". A shared machine would otherwise hand the second person to sign in
// the first person's answer, silently and unaskably. A record whose uid does not
// match the signed-in user reads as unanswered.
function emptyRecord() {
  return {
    v: STATE_VERSION,
    uid: null,
    persona: null,
    askedAt: null,
    skipped: false,
    completedAt: null,
    chapters: {},
    runs: []
  }
}

function readRecord() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyRecord()
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return emptyRecord()
    if (parsed.v !== STATE_VERSION) return emptyRecord()

    // Validate the persona against the registry rather than trusting the string.
    // A key renamed in src/config/personas.js, or anything hand-edited into the
    // store, must read as unanswered — not as a truthy persona nothing can
    // render.
    const persona = PERSONA_KEYS.includes(parsed.persona)
      ? parsed.persona
      : null

    return {
      v: STATE_VERSION,
      uid: typeof parsed.uid === 'string' ? parsed.uid : null,
      persona,
      askedAt: typeof parsed.askedAt === 'string' ? parsed.askedAt : null,
      skipped: parsed.skipped === true,
      completedAt:
        typeof parsed.completedAt === 'string' ? parsed.completedAt : null,
      chapters:
        parsed.chapters &&
        typeof parsed.chapters === 'object' &&
        !Array.isArray(parsed.chapters)
          ? parsed.chapters
          : {},
      runs: Array.isArray(parsed.runs) ? parsed.runs : []
    }
  } catch {
    // Private mode, a disabled store, corrupt JSON. Falling back to an empty
    // record means the worst case is being asked the question again, which is
    // recoverable in one click.
    return emptyRecord()
  }
}

const record = ref(readRecord())

function commit(next) {
  record.value = next
  // Not persisted while signed out: a record with no uid answers for nobody, and
  // the next real sign-in would treat it as a mismatch anyway. The in-memory ref
  // still updated, so the current session behaves correctly either way.
  if (!next.uid) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Same reasoning as readRecord: a refused write costs the answer on the next
    // page load, nothing more.
  }
}

const PERSONA_BY_KEY = new Map(PERSONAS.map(p => [p.key, p]))

export function useOnboarding() {
  // The record only speaks for the user it was written by. Anyone else gets the
  // question, and answering it overwrites the record.
  const isOurs = computed(
    () => Boolean(user.value?.uid) && record.value.uid === user.value.uid
  )

  const persona = computed(() => (isOurs.value ? record.value.persona : null))

  const personaMeta = computed(() =>
    persona.value ? (PERSONA_BY_KEY.get(persona.value) ?? null) : null
  )

  const skipped = computed(() => isOurs.value && record.value.skipped)

  // Answered means the question is settled — picked OR skipped. Skipping is a
  // real answer, not a deferral; the way back is the Settings control.
  const hasAnswered = computed(() =>
    Boolean(isOurs.value && (record.value.persona || record.value.skipped))
  )

  const needsPersona = computed(() => !hasAnswered.value)

  function base() {
    // Start from our own record when it is ours, and from a blank one when it
    // belongs to somebody else — inheriting a stranger's chapter progress would
    // show a tour half-done that this user never ran.
    return isOurs.value ? { ...record.value } : emptyRecord()
  }

  function setPersona(key) {
    if (!PERSONA_KEYS.includes(key)) return
    const current = base()
    commit({
      ...current,
      uid: user.value?.uid ?? null,
      persona: key,
      askedAt: current.askedAt ?? new Date().toISOString(),
      skipped: false,
      // Chapter ids belong to one script (`eng-*`, `mkt-*`, `ana-*`), so
      // progress from another persona's script cannot be carried over. Nothing
      // the user built is touched — this is the tour's own bookkeeping.
      chapters: current.persona === key ? current.chapters : {},
      completedAt: current.persona === key ? current.completedAt : null
    })
  }

  // Quiet, real and unpunished: no "no thanks, I don't want more fans". It
  // records the answer so the question does not come back on every load.
  function skip() {
    const current = base()
    commit({
      ...current,
      uid: user.value?.uid ?? null,
      persona: null,
      askedAt: current.askedAt ?? new Date().toISOString(),
      skipped: true,
      chapters: {},
      completedAt: null
    })
  }

  // Back to unanswered, so the question appears again on Home. Exposed for the
  // Settings control, where "I would rather not say" needs somewhere to go.
  function askAgain() {
    commit({ ...emptyRecord(), uid: user.value?.uid ?? null })
  }

  return {
    personas: PERSONAS,
    record,
    persona,
    personaMeta,
    skipped,
    hasAnswered,
    needsPersona,
    setPersona,
    skip,
    askAgain
  }
}
