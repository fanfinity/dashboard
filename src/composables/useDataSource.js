import { computed, ref } from 'vue'

// Whether the app is reading mock JSON or a real backend. One global switch —
// not per-module like useFeatures — because no domain has a real endpoint yet;
// there is nothing for per-module granularity to control until one ships.
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
    return stored === REAL ? REAL : MOCK
  } catch {
    // Private mode or a disabled store — mock is always the safe default.
    return MOCK
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
