import { computed, ref } from 'vue'
import { TOURS } from '@/config/tours'
import { SOURCE_INTENTS } from '@/config/sourceIntents'
import { PLATFORM_CHOICES } from '@/config/firstRun'
import { me } from '@/composables/useMe'

const TOUR_IDS = Object.keys(TOURS)
const INTENT_KEYS = SOURCE_INTENTS.map(i => i.key)

// Which beat of the arrival can be recorded as the one somebody is on.
//
// `welcome` IS NOT IN THE LIST, on purpose and for two reasons that happen to
// agree. Nobody parks on the welcome — the control that parks you is offered
// there, but Back from the category beat lands on it, and "resume" that replays
// a paragraph you have read reads as "start over". And there is nothing on it to
// resume TO: no answer has been given yet, so `category` is the honest floor.
//
// IT GREW FROM TWO TO SEVEN when the arrival grew from three beats to seven. A
// reader who leaves to paste a snippet on their own site is on `connect`, which
// is the single most likely place in the whole flow to walk away from — the
// install guide's own copy invites it ("come back here anytime to confirm the
// connection") — so it has to be a beat the record can name.
const ARRIVAL_STEPS = [
  'category',
  'platform',
  'authorize',
  'connect',
  'verify',
  'setup',
  'ready'
]

// Every template id the platform beat can hand back, flattened out of the same
// registry the beat renders from. Validated rather than trusted for the reason
// `intent` is: a hand-edited record naming a template that no longer exists
// would rehydrate as a create form pre-selecting nothing, silently.
const PLATFORM_TEMPLATE_IDS = Object.values(PLATFORM_CHOICES)
  .flatMap(group => group.options)
  .map(option => option.templateId)
  .filter(Boolean)

// How far through first-run onboarding this person is.
//
// Module-level state, the same pattern as useAuth/useFeatures and for the same
// reason: the overlay in MainLayout and anything else that wants to know whether
// the arrival has happened must read and write one object, so an answer in
// either is true in the other in the same tick without a bus or a refetch.
//
// There is no backend to store this in (see CLAUDE.md, "Data architecture"), so
// it is localStorage — the precedent set by the feature-activation overrides
// key. One key holds the whole record.
const STORAGE_KEY = 'sfere_onboarding'

// Bumped when the shape changes incompatibly. A record at any other version is
// discarded rather than migrated: the whole thing is one question and some
// progress, so re-asking costs the reader two seconds where a migration path
// costs more than that to maintain forever.
//
// VERSION 2 DROPPED `persona`. Version 1 recorded which of engineer / marketer /
// analyst somebody picked, and that answer ordered the sidebar and the
// dashboard's blocks. Both orderings are gone, so a v1 record answers a question
// nobody asks any more — and worse, a v1 record would read as "already
// onboarded" and suppress the new arrival for every existing user, who has
// therefore never seen it. Discarding is the correct outcome here rather than
// merely the cheap one.
//
// VERSION 4 MADE THE ARRIVAL SIGN-UP-ONLY. Up to v3 the record answered "has
// this browser been asked?", so ANY record-less browser opened the arrival —
// which meant an existing user signing in on a new laptop, after clearing their
// storage, or in a private window was met by a full-page welcome over the
// dashboard they had been using for months. The record now has to be OPENED by a
// registration (`beginFirstRun`), and a v3 record cannot say whether it was, so
// it is discarded — the safe direction, since the failure mode of discarding is
// that one genuinely new account misses the welcome, and the failure mode of
// keeping is every returning user being shown it.
//
// VERSION 5 IS THE SEVEN-BEAT ARRIVAL. Three fields changed meaning at once, so
// there is nothing a v4 record could be read as. `pausedStep` became `step` and
// is now written on every advance rather than only when the reader parks — the
// arrival creates a real source part-way through, so a reload has to be able to
// put somebody back where they were instead of restarting a flow that would
// create a SECOND source and orphan the first. `sourceId` is new for the same
// reason. And `hasOnboarded` is keyed on `completedAt` rather than on `intent`,
// because recording the category used to settle the arrival — which was correct
// when the category was the last question and is wrong now that four beats
// follow it: it would close the surface under the reader mid-flow.
//
// VERSION 3 CHANGED WHAT `skipped` MEANS. In v2 skipping was final: the record
// said "asked and dismissed" and nothing brought the arrival back. It is now a
// PAUSE — `paused` plus the beat you were on — and the Dashboard offers the way
// back in. A v2 record has a `skipped: true` with no `paused` beside it, which
// under the new rules would read as "dismissed for good, and unresumable", so it
// is discarded rather than migrated: the cost is one reader seeing the arrival
// once more, and the alternative is a population that can never reach the
// resume path.
const STATE_VERSION = 5

// Shape in storage:
//
//   { v: 5, uid, seenAt, awaitingFirstRun, skipped, paused, step, intent,
//     platform, sourceId, completedAt, tour, chapters: {}, runs: [] }
//
// `awaitingFirstRun` is the sign-up gate. It is written by `beginFirstRun()` and
// by nothing else, and `needsFirstRun` reads it — so the arrival is a thing that
// happens to an account that was just created, not a thing that happens to a
// browser with no record in it.
//
// `intent` is a SOURCE_INTENTS key — the category picked on the arrival's second
// beat. Recorded rather than merely passed through to the URL because it is the
// one thing the reader told us about their own business, and the day a second
// surface wants it (a resume-setup strip, a "you were connecting a store" hint)
// it should find it here rather than invent a second key.
//
// `chapters` and `runs` are written empty and are here on purpose: the scripted
// tour beyond the current one-tour spotlight is a later phase, and it should find
// a record it can extend rather than inventing another key.
//
// `tour` is the id of the walkthrough currently running, or null. Persisted —
// unlike the current STEP, which lives in memory in useGuidedTour — because the
// walkthrough spans a navigation and a plausible reload: `/sources/new` step 3 is
// where somebody leaves to paste a snippet on their own site, and useSourceDraft
// already restores the form they come back to. Losing the guidance exactly there
// would drop it at the one moment it is worth most.
//
// `uid` is what makes this "first login" rather than "once per browser". A shared
// machine would otherwise hand the second person to sign in the first person's
// answer, silently and unaskably. A record whose uid does not match the
// signed-in user reads as un-onboarded.
function emptyRecord() {
  return {
    v: STATE_VERSION,
    uid: null,
    seenAt: null,
    awaitingFirstRun: false,
    skipped: false,
    paused: false,
    step: null,
    intent: null,
    platform: null,
    sourceId: null,
    completedAt: null,
    tour: null,
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

    return {
      v: STATE_VERSION,
      uid: typeof parsed.uid === 'string' ? parsed.uid : null,
      seenAt: typeof parsed.seenAt === 'string' ? parsed.seenAt : null,
      awaitingFirstRun: parsed.awaitingFirstRun === true,
      skipped: parsed.skipped === true,
      paused: parsed.paused === true,
      // Validated against the list rather than trusted, so a record naming a
      // beat that no longer exists resumes at the first one instead of opening
      // the overlay on nothing.
      step: ARRIVAL_STEPS.includes(parsed.step) ? parsed.step : null,
      // Validated against the registry rather than trusted. An intent renamed in
      // src/config/sourceIntents.js, or anything hand-edited into the store,
      // must read as "no category chosen" — not as a truthy key that a later
      // consumer resolves to nothing and renders as a blank.
      intent: INTENT_KEYS.includes(parsed.intent) ? parsed.intent : null,
      // The platform picked on the third beat, as a source-template id. Same
      // validation and the same reason as `intent`: a record naming a template
      // that no longer exists must read as "nothing chosen".
      //
      // IT IS A LIVE INPUT NOW, which it was not in v4. It used to be written
      // only at the hand-off that closed the arrival, so nothing ever read it
      // back; the four beats that follow the platform question all need it —
      // the authorize beat to know whose panel to render, and the create to know
      // what to build — and after a reload this is the only copy of it.
      platform: PLATFORM_TEMPLATE_IDS.includes(parsed.platform)
        ? parsed.platform
        : null,
      // The source the arrival created, if it got that far. NOT the write key,
      // which is deliberately absent: the backend issues it exactly once and
      // every later read is masked, so persisting it to survive a reload would
      // put a live credential in localStorage to save a click. What that costs is
      // stated on `useFirstRunSetup().restore()` — a resumed run lands on the
      // verify beat rather than back on the install one.
      sourceId: typeof parsed.sourceId === 'string' ? parsed.sourceId : null,
      completedAt:
        typeof parsed.completedAt === 'string' ? parsed.completedAt : null,
      // Validated the same way, for the same reason: a tour id that no longer
      // exists must read as "nothing running", not as a truthy tour whose steps
      // nothing can resolve.
      tour: TOUR_IDS.includes(parsed.tour) ? parsed.tour : null,
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
    // record means the worst case is seeing the arrival again, which is one
    // click to get past.
    return emptyRecord()
  }
}

const record = ref(readRecord())

// A resume that has been asked for but not yet opened. IN MEMORY, NEVER
// PERSISTED, and the distinction matters: `paused` is a fact about the account
// that survives a reload ("this reader left setup part-way"), while this is a
// click that happened three hundred milliseconds ago on the Dashboard. Persisting
// it would reopen the arrival on every load until it was answered, which is the
// modal-that-keeps-coming-back this file's v2 comment was right to warn about.
//
// Holds the beat to open at, or null.
const resumeStep = ref(null)

// How many times the arrival surface has closed in THIS session. IN MEMORY,
// NEVER PERSISTED, and it is a counter rather than a flag or a timestamp: a
// reader can park the arrival, resume it from the band and finish it in one
// session, and each of those closes is a separate event that a boolean would
// collapse and a same-millisecond timestamp could miss.
//
// WHY IT EXISTS. The arrival is a surface over a FULLY-RENDERED Home, not a
// route, so the Dashboard beneath it is mounted the whole time and its reads
// ran before a single beat did — and by the last beat the account owns a
// source, and on a `web` or `zid` template a destination and a pipeline too. So
// a reader who had just watched the arrival build all three landed on
// "Let's get your activity data flowing · 0 / 3 done", which is the setup
// tracker reporting an account that stopped existing several beats ago. Nothing
// remounts the page to correct it: closing the arrival IS arriving at the
// dashboard.
//
// It lives here rather than in MainLayout because the two sides are a layout
// and a page inside its `<router-view>` — the same reason the record itself is
// a module singleton. `MainLayout` bumps it from `finishArrival()`, which is the
// one funnel every exit goes through; the Dashboard watches it and refetches.
const arrivalClosedCount = ref(0)

function commit(next) {
  record.value = next
  // Not persisted while signed out: a record with no uid answers for nobody, and
  // the next real sign-in would treat it as a mismatch anyway. The in-memory ref
  // is still updated, so the current session behaves correctly either way.
  if (!next.uid) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Same reasoning as readRecord: a refused write costs the answer on the next
    // page load, nothing more.
  }
}

/**
 * The arrival surface has closed — finished, parked, or handed off. Called by
 * `MainLayout.finishArrival()` and by nothing else.
 *
 * It says only that the surface went away; what the account now holds is for the
 * screen underneath to re-read, which is deliberately not this file's business.
 */
function markArrivalClosed() {
  arrivalClosedCount.value += 1
}

export function useOnboarding() {
  // The record only speaks for the user it was written by. Anybody else gets the
  // arrival, and answering it overwrites the record.
  const isOurs = computed(
    () => Boolean(me.value?.id) && record.value.uid === me.value.id
  )

  /** The category the reader picked on the arrival, or null. */
  const intent = computed(() => (isOurs.value ? record.value.intent : null))

  /** The platform picked on the third beat, as a source-template id, or null. */
  const platform = computed(() => (isOurs.value ? record.value.platform : null))

  const skipped = computed(() => isOurs.value && record.value.skipped)

  // Left part-way through rather than answered. THIS IS A REVERSAL of what this
  // file used to do, and the reason it is safe here is the reason it was not
  // then. v2's skip was final on the grounds that "a modal that returns after
  // being dismissed is the thing people learn to click past without reading" —
  // and that is still true of a modal that returns BY ITSELF. Nothing here
  // returns by itself: the arrival stays closed until the reader presses a
  // control on the Dashboard that says what it will do. What the old rule
  // actually cost was the person who pressed `Skip setup · Go to dashboard` to
  // look around, and then had no way back to the three screens that would have
  // connected their data.
  const paused = computed(() => isOurs.value && record.value.paused)

  /** The source the arrival created, if it got that far. */
  const sourceId = computed(() => (isOurs.value ? record.value.sourceId : null))

  /**
   * The beat this reader is on, or should be returned to.
   *
   * WRITTEN ON EVERY ADVANCE, not only when the reader parks, which is what
   * makes a mid-flow reload survivable now that the arrival creates a real
   * source. The CALLER still decides whether that beat can be re-entered — four
   * of the seven need a source, and one of those needs a write key that no
   * longer exists — so this reports where they were, never where to put them.
   */
  const step = computed(() =>
    isOurs.value ? (record.value.step ?? 'category') : 'category'
  )

  // Settled means the arrival is done with for now — it was FINISHED or the
  // reader parked it. A paused record still counts as settled, so the arrival
  // does not reappear on the next load; `resumeStep` is the only thing that
  // reopens it.
  //
  // KEYED ON `completedAt`, NOT ON `intent`, AND THAT IS THE v5 CHANGE. When the
  // category was the arrival's last question, recording it and settling the
  // arrival were the same event, so reading `intent` here was right. Four beats
  // follow it now, and the record has to be written as the reader moves through
  // them — a source gets created part-way, and a reload that forgot it would
  // create a second one. So progress is recorded continuously, and only the last
  // beat's control or the skip settles anything.
  const hasOnboarded = computed(() =>
    Boolean(isOurs.value && (record.value.completedAt || record.value.skipped))
  )

  // TWO CONDITIONS, AND THE FIRST ONE IS THE FIX. An absent record used to mean
  // "ask", which made the arrival a property of the BROWSER rather than of the
  // account: signing in on a second machine, in a private window, or after
  // clearing storage opened a full-page welcome over a workspace somebody had
  // been using for months, and — because the welcome beat's only control points
  // forwards — it read as the app refusing to let them in. Registration is the
  // only thing that opens the door now.
  const needsFirstRun = computed(
    () =>
      Boolean(isOurs.value && record.value.awaitingFirstRun) &&
      !hasOnboarded.value
  )

  function base() {
    // Start from our own record when it is ours, and from a blank one when it
    // belongs to somebody else — inheriting a stranger's chapter progress would
    // show a tour half-done that this user never ran.
    return isOurs.value ? { ...record.value } : emptyRecord()
  }

  /**
   * Record the category picked on the arrival's second beat, which also settles
   * the arrival.
   *
   * Refuses an unknown key rather than storing it, so the record can never name
   * a category nothing resolves. A refused key leaves the arrival unsettled,
   * which is the safe failure: the reader sees the question again rather than
   * being sent into a create flow with nothing selected.
   *
   * @param {string} key A key of SOURCE_INTENTS.
   */
  function setIntent(key) {
    if (!INTENT_KEYS.includes(key)) return
    const current = base()
    commit({
      ...current,
      uid: me.value?.id ?? null,
      intent: key,
      seenAt: current.seenAt ?? new Date().toISOString(),
      // Answering ends the pause. Both flags, not just `paused`: a record left
      // saying `skipped: true` beside a real intent would read as "dismissed"
      // to anything that only looks at that field.
      skipped: false,
      paused: false
    })
  }

  /**
   * Record which beat the reader is on.
   *
   * CALLED ON EVERY ADVANCE, and it is what makes the arrival survivable. It is
   * safe to call mid-flow — unlike the v4 `setIntent`, nothing here settles the
   * arrival, so writing it does not close the surface under the reader.
   *
   * @param {string} next One of ARRIVAL_STEPS. Anything else is dropped, so an
   *   unknown beat leaves the last known one in place rather than blanking it.
   */
  function setStep(next) {
    if (!ARRIVAL_STEPS.includes(next)) return
    commit({ ...base(), uid: me.value?.id ?? null, step: next })
  }

  /**
   * Record the source the arrival created.
   *
   * THE ID ONLY, NEVER THE WRITE KEY. The key is issued once and every later
   * read is masked, so a persisted copy would be a live credential sitting in
   * localStorage for the sake of one screen; `useFirstRunSetup().restore()` says
   * what that costs and how a resumed run works around it.
   *
   * @param {string} id
   */
  function setSource(id) {
    if (typeof id !== 'string' || !id) return
    commit({ ...base(), uid: me.value?.id ?? null, sourceId: id })
  }

  /**
   * The arrival finished: the source exists, an event arrived, and the reader
   * pressed the last beat's control.
   *
   * THIS IS WHAT SETTLES IT NOW, and it is the only thing besides the skip that
   * does. `completedAt` is what `hasOnboarded` reads, so nothing before this
   * point can close the surface.
   */
  function complete() {
    const current = base()
    commit({
      ...current,
      uid: me.value?.id ?? null,
      seenAt: current.seenAt ?? new Date().toISOString(),
      completedAt: new Date().toISOString(),
      skipped: false,
      paused: false,
      step: 'ready'
    })
    resumeStep.value = null
  }

  /**
   * Record the platform picked on the third beat, as a source-template id.
   *
   * Refuses an id the platform registry does not offer, for the reason
   * `setIntent` refuses an unknown key: the record must never name a template
   * the create form cannot pre-select. An empty string is legal and clears it —
   * that is the "Both" card, which deliberately leaves the choice to the form.
   *
   * @param {string} templateId A `templateId` from PLATFORM_CHOICES, or ''.
   */
  function setPlatform(templateId) {
    if (templateId && !PLATFORM_TEMPLATE_IDS.includes(templateId)) return
    commit({
      ...base(),
      uid: me.value?.id ?? null,
      platform: templateId || null
    })
  }

  /**
   * Park the arrival and go to the Dashboard, remembering the beat so the reader
   * can be put back on it.
   *
   * THE CATEGORY IS RECORDED HERE RATHER THAN WHEN IT IS CLICKED, and that is
   * not a tidying: `setIntent` settles the arrival, so calling it the moment a
   * card is picked closes the surface in the same tick — which is fine for a
   * category that hands straight off and wrong for one that has a platform beat
   * still to show. Recording it on the way OUT means the record is written
   * exactly once per exit, by whichever exit was taken.
   *
   * @param {string} step The beat they were on: 'category' or 'platform'.
   * @param {string} [intentKey] The category chosen, if the platform beat was
   *   reached. Anything the registry does not know is dropped.
   */
  function pause(atStep, intentKey = '') {
    const current = base()
    commit({
      ...current,
      uid: me.value?.id ?? null,
      seenAt: current.seenAt ?? new Date().toISOString(),
      // THE CATEGORY IS STILL WRITTEN HERE even though `setIntent` now runs
      // mid-flow, because Back clears the in-memory answer and the caller passes
      // what is true at the moment of parking. A record saying `intent: 'app'`
      // beside `step: 'category'` promised "Finish connecting your mobile app"
      // and then opened on "Where does your customer activity happen?".
      intent: INTENT_KEYS.includes(intentKey) ? intentKey : null,
      skipped: true,
      paused: true,
      step: ARRIVAL_STEPS.includes(atStep) ? atStep : 'category'
    })
    resumeStep.value = null
  }

  /**
   * Ask for the arrival to reopen, on the beat it was parked on. Called by the
   * Dashboard's resume band and by nothing else — the arrival never reopens
   * itself.
   */
  function requestResume() {
    resumeStep.value = step.value
  }

  /** The reopen has been honoured (or abandoned). */
  function clearResume() {
    resumeStep.value = null
  }

  /**
   * Open the arrival for a freshly registered account. Two callers and no
   * others: the sign-up branch of `LoginPage`, and `askAgain()` below, which is
   * somebody explicitly asking for it on Settings → General. A SIGN-IN MUST
   * NEVER REACH IT, which is the whole point of the flag — the invariant is
   * that nothing re-arms the arrival implicitly, not that only registration
   * ever does.
   *
   * Starts from a blank record rather than from `base()`: this is a brand-new
   * account, so anything already in storage belongs to somebody else or to a
   * previous version.
   */
  function beginFirstRun() {
    resumeStep.value = null
    commit({
      ...emptyRecord(),
      uid: me.value?.id ?? null,
      awaitingFirstRun: true,
      seenAt: new Date().toISOString()
    })
  }

  /**
   * Back to un-onboarded, so the arrival appears again on Home. This is
   * `Restart onboarding` on Settings → General and nothing else.
   *
   * It RE-ARMS rather than resumes, which is what makes it different from the
   * Dashboard's resume band: the recorded category and platform go, and the
   * replay starts at the welcome. The control that calls it says so before it
   * runs, because the answers are the only thing here that cannot be got back.
   *
   * Re-arming alone does not reopen anything on a screen that is not Home —
   * `MainLayout` binds the surface to `route.path` — so the caller navigates to
   * `/`, and `MainLayout` watches `needsFirstRun` to clear the session flag that
   * would otherwise keep the surface shut.
   */
  function askAgain() {
    beginFirstRun()
  }

  // Which walkthrough is running, if any. Null for a record that is not ours,
  // the same as `intent` — a tour is guidance for one person's account, and
  // resuming a stranger's would spotlight a step they took, not one you owe.
  const tour = computed(() => (isOurs.value ? record.value.tour : null))

  /**
   * Start a walkthrough. Refuses an unknown id rather than storing it, so a
   * caller cannot leave the record naming a tour nothing can render.
   *
   * @param {string} id A key of TOURS.
   */
  function startTour(id) {
    if (!TOUR_IDS.includes(id)) return
    commit({ ...base(), uid: me.value?.id ?? null, tour: id })
  }

  // Finished, skipped or abandoned — one exit, because none of the three should
  // leave a coachmark waiting on the next load and there is nothing else to
  // distinguish them with yet. When `runs` grows a real writer, that is where
  // the difference belongs.
  function endTour() {
    if (!isOurs.value) return
    commit({ ...record.value, tour: null })
  }

  return {
    record,
    intent,
    platform,
    skipped,
    paused,
    step,
    sourceId,
    resumeStep,
    arrivalClosedCount,
    markArrivalClosed,
    hasOnboarded,
    needsFirstRun,
    beginFirstRun,
    setIntent,
    setPlatform,
    setStep,
    setSource,
    complete,
    pause,
    requestResume,
    clearResume,
    askAgain,
    tour,
    startTour,
    endTour
  }
}
