import { computed, ref } from 'vue'

// Where the app reads its data from. Two states, flipped through
// Settings → Data source:
// - 'real' the Fanfinity backend via VITE_API_BASE. The default: the app is
//          wired to that API, so a signed-in user should see their own data
//          without touching Settings. Only the wired domains (sources,
//          destinations, pipelines, events, connectors) actually call it; a
//          screen whose endpoint is still only proposed in
//          openapi/sfere-cdp-contract.yaml (`x-sfere-status: proposed`)
//          reports `apiMissing` ("No API yet").
// - 'mock' the static JSON in public/data/. A backend-free demo, and the only
//          way to walk every screen with populated data today.
//
// There was briefly a third state ('mockApi') pointing at a local Scalar mock
// server generated from the draft spec. It was scaffolding for a backend that
// did not exist yet; sources, destinations and pipelines now have real
// endpoints, so mocking a draft of them is cost without benefit. The spec
// itself stays — as openapi/sfere-cdp-contract.yaml, the contract for what is
// shipped and what is not, browsable with `pnpm docs:cdp`.
//
// One global switch, not per-module like useFeatures: the modes differ in
// which host answers, not in which features exist, so there is nothing for
// per-module granularity to control.
//
// Same module-singleton pattern as useAuth/useFeatures: one ref, so the
// Settings toggle and the footer banner agree without a bus or a refetch.
const STORAGE_KEY = 'sfere_data_source_mode'
const MOCK = 'mock'
const REAL = 'real'

// Only an explicit stored 'mock' opts out; everything else — unset, garbage, a
// stale 'mockApi' from before that mode was removed — resolves to real.
function sanitize(value) {
  return value === MOCK ? MOCK : REAL
}

const mode = ref(readMode())

function readMode() {
  try {
    return sanitize(localStorage.getItem(STORAGE_KEY))
  } catch {
    // Private mode or a disabled store — fall back to the real default.
    return REAL
  }
}

function writeMode(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Same reasoning as useFeatures: the in-memory ref still updated, so the
    // session behaves correctly even when the write is refused.
  }
}

export function useDataSource() {
  function setMode(value) {
    const next = sanitize(value)
    mode.value = next
    writeMode(next)
  }

  return {
    mode,
    isMock: computed(() => mode.value === MOCK),
    isReal: computed(() => mode.value === REAL),
    setMode
  }
}
