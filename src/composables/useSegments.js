import { ref } from 'vue'

// Dynamic segments are filter definitions over the incoming Jitsu events shown on
// the Live Events page. There is no backend to write a segments.json, so — like
// the Jitsu consent banner (see useJitsu.js) — we persist them in localStorage.
const STORAGE_KEY = 'fanfinity_dynamic_segments'

// Fields a rule can target. Each accessor reads the *mapped* event object
// produced by useLiveEvents' mapIncomingEvent(). Keep these in sync with that
// mapper if its shape changes.
export const FIELDS = [
  { value: 'type', label: 'Event type', accessor: ev => ev.type },
  { value: 'eventName', label: 'Event name', accessor: ev => ev.event?.event },
  { value: 'host', label: 'Host', accessor: ev => ev.host },
  { value: 'pagePath', label: 'Page path', accessor: ev => ev.pagePath },
  { value: 'pageURL', label: 'Page URL', accessor: ev => ev.pageURL },
  { value: 'pageTitle', label: 'Page title', accessor: ev => ev.pageTitle },
  { value: 'email', label: 'Email', accessor: ev => ev.email },
  { value: 'userId', label: 'User ID', accessor: ev => ev.userId },
  {
    value: 'anonymousId',
    label: 'Anonymous ID',
    accessor: ev => ev.anonymousId
  },
  {
    value: 'referringDomain',
    label: 'Referring domain',
    accessor: ev => ev.referringDomain
  },
  {
    value: 'originDomain',
    label: 'Origin domain',
    accessor: ev => ev.originDomain
  },
  { value: 'status', label: 'Status', accessor: ev => ev.status },
  { value: 'ingestType', label: 'Source', accessor: ev => ev.ingestType },
  {
    value: 'country',
    label: 'Country',
    accessor: ev => ev.context?.geo?.country?.code
  }
]

// Operators available per rule. `needsValue: false` ones (exists / not_exists)
// hide the value input in the builder.
export const OPERATORS = [
  { value: 'is', label: 'is', needsValue: true },
  { value: 'is_not', label: 'is not', needsValue: true },
  { value: 'contains', label: 'contains', needsValue: true },
  { value: 'exists', label: 'is set', needsValue: false },
  { value: 'not_exists', label: 'is not set', needsValue: false }
]

const FIELD_BY_VALUE = Object.fromEntries(FIELDS.map(f => [f.value, f]))

export function fieldLabel(value) {
  return FIELD_BY_VALUE[value]?.label || value
}

// Evaluate a single rule against an event.
function matchRule(ev, rule) {
  const field = FIELD_BY_VALUE[rule.field]
  if (!field) return false
  const raw = field.accessor(ev)
  const has = raw !== undefined && raw !== null && raw !== ''

  switch (rule.operator) {
    case 'exists':
      return has
    case 'not_exists':
      return !has
    case 'is':
      return (
        has && String(raw).toLowerCase() === String(rule.value).toLowerCase()
      )
    case 'is_not':
      return (
        !has || String(raw).toLowerCase() !== String(rule.value).toLowerCase()
      )
    case 'contains':
      return (
        has &&
        String(raw).toLowerCase().includes(String(rule.value).toLowerCase())
      )
    default:
      return false
  }
}

// Does an event match a segment? Rules combine with ALL (every) or ANY (some).
// A segment with no rules matches nothing (avoids "everything" surprises).
export function matchEvent(ev, segment) {
  const rules = segment?.rules || []
  if (!rules.length) return false
  return segment.match === 'any'
    ? rules.some(r => matchRule(ev, r))
    : rules.every(r => matchRule(ev, r))
}

// Roll up the matching events into the figures the Segments table renders.
// fanCount = distinct identities; hosts = busiest hosts; lastSeen = most recent.
export function countMatches(events, segment) {
  const matches = (events || []).filter(ev => matchEvent(ev, segment))
  const fans = new Set()
  const hostCount = {}
  let lastSeen = null
  for (const ev of matches) {
    const identity = ev.userId || ev.email || ev.anonymousId
    if (identity) fans.add(identity)
    if (ev.host) hostCount[ev.host] = (hostCount[ev.host] || 0) + 1
    if (ev.date && (!lastSeen || new Date(ev.date) > new Date(lastSeen))) {
      lastSeen = ev.date
    }
  }
  const hosts = Object.entries(hostCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([h]) => h)
  return { eventCount: matches.length, fanCount: fans.size, hosts, lastSeen }
}

// Human-readable one-liner for a segment's rules, used as the table description.
export function describeRules(segment) {
  const rules = segment?.rules || []
  if (!rules.length) return 'No rules'
  const op = segment.match === 'any' ? ' OR ' : ' AND '
  return rules
    .map(r => {
      const opDef = OPERATORS.find(o => o.value === r.operator)
      const label = `${fieldLabel(r.field)} ${opDef?.label || r.operator}`
      return opDef?.needsValue ? `${label} "${r.value}"` : label
    })
    .join(op)
}

export function useSegments() {
  const segments = ref([])

  function loadSegments() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      segments.value = Array.isArray(stored) ? stored : []
    } catch {
      segments.value = []
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(segments.value))
  }

  // Create or update a segment (matched by id). Returns the saved record.
  function saveSegment(def) {
    const record = {
      id: def.id || `seg_${Date.now()}`,
      name: def.name,
      description: def.description || '',
      match: def.match === 'any' ? 'any' : 'all',
      rules: def.rules || [],
      createdAt: def.createdAt || new Date().toISOString()
    }
    const idx = segments.value.findIndex(s => s.id === record.id)
    if (idx >= 0) segments.value.splice(idx, 1, record)
    else segments.value.push(record)
    persist()
    return record
  }

  function deleteSegment(id) {
    segments.value = segments.value.filter(s => s.id !== id)
    persist()
  }

  return { segments, loadSegments, saveSegment, deleteSegment }
}
