import { ref } from 'vue'
import { useJitsuContacts } from '@/composables/useJitsuContacts'

// Probabilistic identity resolution ("identity stitching"): given the CDP
// contacts derived from the live event log (see useJitsuContacts), find pairs
// of profiles that are *probably the same person* even though they were never
// linked by a shared email/userId. This is the inferential counterpart to
// deterministic matching — we compare behavioral and technical signals and
// produce a confidence score instead of an exact join.
//
// The catch: our events come from a single test stream, so device / IP / geo
// are nearly uniform across every visitor. A naive overlap score would flag
// everyone as a match. We therefore weight each shared signal by its RARITY
// (inverse-frequency, à la Fellegi–Sunter record linkage): a value the whole
// population shares is weak evidence; a value only two profiles share is strong
// evidence. That keeps confident matches down to a believable handful.

// Only surface pairs at/above this confidence; below it isn't worth showing.
const MIN_CONFIDENCE = 45
// Cap the number of example matches rendered (strongest first).
const MAX_MATCHES = 6
// Dimension weights for the combined confidence score (sum to 1).
const WEIGHTS = { device: 0.3, geo: 0.25, behavioral: 0.25, temporal: 0.2 }

// ---- signal extraction -----------------------------------------------------

// "Chrome 124 on macOS" from a raw user-agent, for human-readable reasons.
function parseUserAgent(ua) {
  if (!ua) return ''
  let browser = ''
  const bm = ua.match(/(Edg|OPR|Chrome|Firefox|Safari)\/(\d+)/)
  if (bm) {
    const names = { Edg: 'Edge', OPR: 'Opera' }
    browser = `${names[bm[1]] || bm[1]} ${bm[2]}`
  }
  let os = ''
  if (/Windows/.test(ua)) os = 'Windows'
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS'
  else if (/Android/.test(ua)) os = 'Android'
  else if (/iPhone|iPad|iOS/.test(ua)) os = 'iOS'
  else if (/Linux/.test(ua)) os = 'Linux'
  return [browser, os].filter(Boolean).join(' on ')
}

// Folds an identity's raw events (see mapIncomingEvent) into sets of signal
// values per dimension, plus an hour-of-day histogram for temporal overlap.
function fingerprint(contact) {
  const fp = {
    uas: new Set(),
    oses: new Set(),
    screens: new Set(),
    locales: new Set(),
    ips: new Set(),
    cities: new Set(),
    regions: new Set(),
    countries: new Set(),
    paths: new Set(),
    refs: new Set(),
    campaigns: new Set(),
    hours: Array.from({ length: 24 }, () => 0)
  }
  for (const e of contact.rawEvents || []) {
    const c = e.context || {}

    // Device / browser.
    if (c.userAgent) fp.uas.add(c.userAgent)
    const os = c.os ? `${c.os.name || ''} ${c.os.version || ''}`.trim() : ''
    if (os) fp.oses.add(os)
    if (c.screen?.width && c.screen?.height) {
      fp.screens.add(`${c.screen.width}x${c.screen.height}`)
    }
    if (c.locale) fp.locales.add(c.locale)

    // Geo / IP. IP may come through the context or the forwarded header.
    const ip =
      c.ip ||
      (e.httpHeaders?.['x-forwarded-for'] || '').split(',')[0].trim()
    if (ip) fp.ips.add(ip)
    const geo = c.geo || {}
    const country = geo.country?.name || geo.country?.code
    const region = geo.region?.name || geo.region?.code
    const city = geo.city?.name
    if (country) fp.countries.add(country)
    if (region) fp.regions.add(region)
    if (city) fp.cities.add(city)

    // Behavioral.
    const path = e.pagePath || e.pageURL
    if (path) fp.paths.add(path)
    const ref = e.referringDomain || c.page?.referring_domain
    if (ref) fp.refs.add(ref)
    const campaign = c.campaign?.name || c.campaign?.source
    if (campaign) fp.campaigns.add(campaign)

    // Temporal.
    const t = Date.parse(e.date)
    if (!Number.isNaN(t)) fp.hours[new Date(t).getHours()]++
  }
  return fp
}

// ---- rarity-weighted scoring ----------------------------------------------

// How many distinct identities carry each value of each signal — the basis for
// inverse-frequency weighting.
function buildFrequencies(fingerprints) {
  const fields = [
    'uas',
    'oses',
    'screens',
    'locales',
    'ips',
    'cities',
    'regions',
    'countries',
    'paths',
    'refs',
    'campaigns'
  ]
  const freq = {}
  for (const f of fields) freq[f] = new Map()
  for (const fp of fingerprints) {
    for (const f of fields) {
      for (const v of fp[f]) freq[f].set(v, (freq[f].get(v) || 0) + 1)
    }
  }
  return freq
}

// Inverse-frequency rarity in 0..1: ~0 when everyone shares the value, ~1 when
// it is near-unique to the pair.
function rarity(value, field, freq, n) {
  if (!value || n <= 1) return 0
  const df = freq[field]?.get(value) || 1
  return Math.min(1, Math.log(n / df) / Math.log(n))
}

function shared(a, b) {
  const out = []
  for (const v of a) if (b.has(v)) out.push(v)
  return out
}

// Best (rarest) shared value of one sub-signal, scored with a small floor so a
// match still counts even when the value is common.
function subScore(a, b, field, freq, n) {
  const sh = shared(a, b)
  if (!sh.length) return { score: 0, value: null }
  let best = sh[0]
  let bestRarity = rarity(best, field, freq, n)
  for (const v of sh) {
    const r = rarity(v, field, freq, n)
    if (r > bestRarity) {
      bestRarity = r
      best = v
    }
  }
  return { score: 0.4 + 0.6 * bestRarity, value: best }
}

function cosine(a, b) {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < 24; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

// Human label for the busiest shared part of the day.
function peakHours(a, b) {
  const combined = a.map((v, i) => v + b[i])
  let peak = -1
  let peakVal = 0
  combined.forEach((v, i) => {
    if (v > peakVal) {
      peakVal = v
      peak = i
    }
  })
  if (peak < 0) return ''
  const fmt = h => {
    const ampm = h >= 12 ? 'pm' : 'am'
    const hr = h % 12 || 12
    return `${hr}${ampm}`
  }
  return `${fmt(peak)}–${fmt((peak + 2) % 24)}`
}

function deviceSignal(a, b, freq, n) {
  const ua = subScore(a.uas, b.uas, 'uas', freq, n)
  const os = subScore(a.oses, b.oses, 'oses', freq, n)
  const sc = subScore(a.screens, b.screens, 'screens', freq, n)
  const lo = subScore(a.locales, b.locales, 'locales', freq, n)
  const score =
    ua.score * 0.45 + os.score * 0.2 + sc.score * 0.2 + lo.score * 0.15
  let reason = 'No shared device signals'
  if (ua.value) reason = `Same ${parseUserAgent(ua.value) || 'browser'}`
  else if (os.value) reason = `Same ${os.value}`
  else if (sc.value) reason = `Same ${sc.value} screen`
  else if (lo.value) reason = `Same locale (${lo.value})`
  return { key: 'device', label: 'Device & browser', score, reason }
}

function geoSignal(a, b, freq, n) {
  const ip = subScore(a.ips, b.ips, 'ips', freq, n)
  const city = subScore(a.cities, b.cities, 'cities', freq, n)
  const region = subScore(a.regions, b.regions, 'regions', freq, n)
  const country = subScore(a.countries, b.countries, 'countries', freq, n)
  let score = 0
  let reason = 'No shared location'
  if (ip.value) {
    score = Math.max(0.7, ip.score)
    reason = 'Same IP address'
  } else if (city.value) {
    score = city.score
    reason = `Same city — ${city.value}`
  } else if (region.value) {
    score = region.score * 0.7
    reason = `Same region — ${region.value}`
  } else if (country.value) {
    score = country.score * 0.4
    reason = `Same country — ${country.value}`
  }
  return { key: 'geo', label: 'Geo & IP', score, reason }
}

function behavioralSignal(a, b, freq, n) {
  const sharedPaths = shared(a.paths, b.paths)
  const union = new Set([...a.paths, ...b.paths])
  const jaccard = union.size ? sharedPaths.length / union.size : 0
  const avgRarity = sharedPaths.length
    ? sharedPaths.reduce((s, p) => s + rarity(p, 'paths', freq, n), 0) /
      sharedPaths.length
    : 0
  let score = jaccard * (0.4 + 0.6 * avgRarity)
  const campSh = shared(a.campaigns, b.campaigns)
  const refSh = shared(a.refs, b.refs)
  if (campSh.length) score = Math.min(1, score + 0.2)
  if (refSh.length) score = Math.min(1, score + 0.1)
  let reason = 'No shared pages'
  if (sharedPaths.length) {
    reason = `${sharedPaths.length} of ${union.size} shared pages`
    if (campSh.length) reason += `, same campaign (${campSh[0]})`
    else if (refSh.length) reason += `, same referrer (${refSh[0]})`
  } else if (campSh.length) {
    reason = `Same campaign (${campSh[0]})`
  } else if (refSh.length) {
    reason = `Same referrer (${refSh[0]})`
  }
  return { key: 'behavioral', label: 'Behavioral', score, reason }
}

function temporalSignal(a, b) {
  const score = cosine(a.hours, b.hours)
  const window = peakHours(a.hours, b.hours)
  const reason =
    score > 0 && window
      ? `Both most active ${window}`
      : 'No overlapping activity window'
  return { key: 'temporal', label: 'Temporal', score, reason }
}

function verdictFor(confidence) {
  if (confidence >= 75) return 'High confidence'
  if (confidence >= 60) return 'Medium confidence'
  return 'Low confidence'
}

// Scores one ordered pair (anonymous profile → candidate identity).
function scorePair(anon, candidate, fpA, fpB, freq, n) {
  const signals = [
    deviceSignal(fpA, fpB, freq, n),
    geoSignal(fpA, fpB, freq, n),
    behavioralSignal(fpA, fpB, freq, n),
    temporalSignal(fpA, fpB)
  ].map(s => {
    // Attach the weighted-sum arithmetic so the UI can show the full
    // calculation: contribution = score × dimension weight (in points of the
    // final 0–100 confidence).
    const weight = WEIGHTS[s.key]
    return {
      ...s,
      weight,
      contribution: s.score * weight * 100
    }
  })
  const combined = signals.reduce((sum, s) => sum + s.contribution, 0)
  const confidence = Math.round(combined)
  return {
    id: `${anon.routeKey}__${candidate.routeKey}`,
    confidence,
    verdict: verdictFor(confidence),
    anon,
    candidate,
    signals
  }
}

/**
 * Reactive hook exposing probabilistic identity matches computed from the live
 * event signals. Mirrors the { data, loading, error, load } contract.
 */
export function useIdentityResolution() {
  const { jitsuContacts, loading, error, loadJitsuContacts } =
    useJitsuContacts()
  const matches = ref([])

  async function loadMatches() {
    await loadJitsuContacts()

    // Only CDP-derived identities with at least one event carry signals.
    const pool = jitsuContacts.value.filter(c => (c.rawEvents || []).length > 0)
    const fps = pool.map(fingerprint)
    const n = pool.length
    const freq = buildFrequencies(fps)

    const results = []
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const a = pool[i]
        const b = pool[j]
        // Probabilistic matching only applies when an identity is unresolved:
        // at least one side must still be anonymous.
        if (!a.isAnonymous && !b.isAnonymous) continue
        // Orient the pair so `anon` is an anonymous profile.
        const [anon, cand, fpAnon, fpCand] = a.isAnonymous
          ? [a, b, fps[i], fps[j]]
          : [b, a, fps[j], fps[i]]
        results.push(scorePair(anon, cand, fpAnon, fpCand, freq, n))
      }
    }

    matches.value = results
      .filter(m => m.confidence >= MIN_CONFIDENCE)
      .sort((x, y) => y.confidence - x.confidence)
      .slice(0, MAX_MATCHES)
  }

  return { matches, loading, error, loadMatches }
}
