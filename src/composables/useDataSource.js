import { computed, ref } from 'vue'

// Whether the app is reading mock JSON or a real backend. One global switch —
// not per-module like useFeatures — flipped through Settings → Data source.
//
// Default is REAL: the app is wired to the accounts backend, so a signed-in
// user should see their own data without touching Settings. Only the wired
// domains (sources, destinations, pipelines, live/per-source events) actually
// call the backend; the rest report `apiMissing` ("No API yet"). Switch to mock
// for a backend-free demo. `smoke` runs against whatever this default is.
//
// Same module-singleton pattern as useAuth/useJitsu/useFeatures: one ref, so
// the Settings toggle and the footer banner agree without a bus or a refetch.
const STORAGE_KEY = 'sfere_data_source_mode'
const MOCK = 'mock'
const REAL = 'real'

const mode = ref(readMode())

function readMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    // Only an explicit stored 'mock' opts out; everything else (unset,
    // garbage, 'real') resolves to real.
    return stored === MOCK ? MOCK : REAL
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
    const next = value === REAL ? REAL : MOCK
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
