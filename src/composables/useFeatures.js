import { computed, ref } from 'vue'
import { FEATURES } from '@/config/features'

// Reads and writes which modules are switched on.
//
// Two layers, deliberately: the committed defaults in src/config/features.js are
// the shipped truth, and localStorage holds per-browser overrides on top. So
// flipping a toggle in Settings → Feature activation is a local experiment that
// survives a reload, while shipping a module to everyone stays a one-line edit in
// the config. `pendingOverrides` is what makes that difference visible in the UI.
//
// Module-level state, the same pattern as useAuth/useEntitlements: the
// sidebar, the route gate and the settings panel all read one source, so a toggle
// updates every one of them in the same tick without a bus or a refetch.
const STORAGE_KEY = 'sfere_feature_activation'

// Shape in storage: { [key]: boolean }. Only keys the user actually touched are
// written, so a default flipped in the config still reaches anyone who never
// touched that particular switch.
const overrides = ref(readOverrides())

function readOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {}
    // Drop anything that isn't a known key or isn't a boolean, so a stale entry
    // from a renamed feature cannot resurrect as a truthy string.
    const clean = {}
    for (const feature of FEATURES) {
      const value = parsed[feature.key]
      if (typeof value === 'boolean') clean[feature.key] = value
    }
    return clean
  } catch {
    // Private mode, a disabled store or corrupt JSON. Falling back to the
    // committed defaults is always safe — worst case a toggle does not persist.
    return {}
  }
}

function writeOverrides(next) {
  try {
    if (Object.keys(next).length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Same reasoning as readOverrides: the in-memory ref still updated, so the
    // session behaves correctly even when the write is refused.
  }
}

const DEFAULTS = new Map(FEATURES.map(f => [f.key, f]))

export function useFeatures() {
  // An unknown key is off rather than on. This registry is an allowlist — the
  // whole point is that a module is dark until someone switches it on — and
  // src/router/routes.js already throws at module load for a screen whose group
  // is missing here, so an unknown key reaching this function means a nav entry
  // typo, not a route.
  function isActive(key) {
    if (!key) return true
    const override = overrides.value[key]
    if (typeof override === 'boolean') return override
    return Boolean(DEFAULTS.get(key)?.enabled)
  }

  function isLocked(key) {
    return Boolean(DEFAULTS.get(key)?.locked)
  }

  function setActive(key, value) {
    // Guard here as well as in the UI: the panel disables the locked toggle, but
    // this function is the actual door and nothing else should be able to shut
    // Settings from underneath the user.
    if (isLocked(key)) return
    if (!DEFAULTS.has(key)) return

    const next = { ...overrides.value }
    const wanted = Boolean(value)
    if (wanted === Boolean(DEFAULTS.get(key).enabled)) {
      // Back at the committed default — drop the override instead of storing a
      // value identical to it, so the config keeps steering this key later.
      delete next[key]
    } else {
      next[key] = wanted
    }
    overrides.value = next
    writeOverrides(next)
  }

  function reset() {
    overrides.value = {}
    writeOverrides({})
  }

  // The registry, resolved. `active` is what to obey; `isOverridden` is what to
  // label, so the panel can say "on for this browser only" rather than implying
  // the change shipped.
  const features = computed(() =>
    FEATURES.map(feature => ({
      ...feature,
      active: isActive(feature.key),
      isOverridden: typeof overrides.value[feature.key] === 'boolean'
    }))
  )

  const overriddenCount = computed(
    () => features.value.filter(f => f.isOverridden).length
  )

  const activeCount = computed(
    () => features.value.filter(f => f.active).length
  )

  return {
    features,
    activeCount,
    overriddenCount,
    isActive,
    isLocked,
    setActive,
    reset
  }
}
