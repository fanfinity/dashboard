import { computed, ref } from 'vue'

// One localStorage record holding every "I have read this, stop showing it"
// answer in the app, keyed by band.
//
// ONE KEY RATHER THAN ONE KEY PER BAND, which is the only decision here worth
// stating. The teaching bands on Sources, Destinations, Pipes and Functions are
// four instances of the same affordance, and a `sfere_dismissed_sources_intro`
// / `sfere_dismissed_pipes_intro` / … family means four strings to keep in step
// with four components and no way to answer "what has this person dismissed?"
// without knowing the list in advance. It also makes the reset — which Settings
// will want the day somebody asks for "show me the tips again" — one removal.
//
// Module-level state, the same pattern as useFeatures/useDataSource: two bands
// on one screen must not each hold their own copy of the record, or dismissing
// one leaves the other reading a stale map until the next reload.
const STORAGE_KEY = 'sfere_dismissed'

// Not versioned, deliberately. The record is a flat `{ [key]: true }` map of
// strings the app wrote itself; there is no shape here that a later version
// could fail to understand, and the worst case of an unknown key is a band that
// no longer exists staying "dismissed" — invisible and harmless. A version gate
// would throw away real answers to protect against nothing.
function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {}
    // Coerce rather than trust: a hand-edited store holding `{"x": "yes"}` must
    // read as dismissed-or-not, never leak a string into a `v-if`.
    const out = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (value === true) out[key] = true
    }
    return out
  } catch {
    // Private mode, a disabled store, corrupt JSON. An empty map means the band
    // comes back, which costs one click.
    return {}
  }
}

const dismissed = ref(read())

function commit(next) {
  dismissed.value = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // A refused write costs the dismissal on the next page load, nothing more.
    // The in-memory ref is already updated, so this session behaves correctly.
  }
}

/**
 * Whether a dismissible surface has been dismissed, and how to dismiss it.
 *
 * Deliberately NOT uid-scoped, unlike `useOnboarding`. That record answers a
 * question about a person and a shared machine must not hand the second reader
 * the first reader's answer. This one records that a browser has already been
 * shown a paragraph of explanatory copy — the cost of getting it wrong is one
 * band that is missing or one band too many, and scoping it would mean the copy
 * reappears on every sign-in of a machine used by two people.
 *
 * @param {string} key A stable id for the surface, e.g. `'sources-intro'`.
 */
export function useDismissed(key) {
  const isDismissed = computed(() => dismissed.value[key] === true)

  function dismiss() {
    if (dismissed.value[key] === true) return
    commit({ ...dismissed.value, [key]: true })
  }

  function restore() {
    if (dismissed.value[key] !== true) return
    const next = { ...dismissed.value }
    delete next[key]
    commit(next)
  }

  return { isDismissed, dismiss, restore }
}

/** Bring every dismissed surface back. For a Settings control. */
export function restoreAllDismissed() {
  commit({})
}

export default useDismissed
