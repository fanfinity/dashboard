import { ref } from 'vue'
import { useLiveEvents, DEFAULT_ACTOR_ID } from '@/composables/useLiveEvents'

// Turns the raw incoming-events stream (see useLiveEvents) into a list of unique,
// contact-shaped records, so real Jitsu visitors can sit in the same Contacts table
// as the mock contacts. There is no direct ClickHouse/profiles access from the
// browser, so we fold the event log into "contacts" ourselves: one row per unique
// identity (userId / email / anonymousId), carrying the most recent activity.

// How many recent events to scan when deriving contacts.
const EVENT_LIMIT = 1000

// Deterministic avatar colors, matching the Tailwind bg classes used by mock contacts.
const COLORS = [
  'bg-cyan-600',
  'bg-indigo-600',
  'bg-emerald-600',
  'bg-rose-500',
  'bg-amber-600',
  'bg-violet-600',
  'bg-sky-600',
  'bg-teal-600'
]

// Stable color pick from an identity key (no flicker between loads).
function colorFor(key) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

// Short, readable suffix for an anonymous id ("…a8qnb").
function short(id) {
  const s = String(id || '')
  return s.length > 6 ? s.slice(-6) : s
}

// ISO timestamp → relative "Xm/Xh/Xd ago" string. Uses the same unit suffixes the
// Contacts page's engagementRank understands, so these rows sort by real recency.
function relativeTime(iso, now) {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const mins = Math.max(0, Math.round((now - t) / 60000))
  if (mins < 60) return `${mins || 1}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.round(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return `${Math.round(days / 30)}mo ago`
}

/**
 * Reactive hook that exposes Jitsu visitors as contact records.
 * Mirrors the { data, loading, error, load } contract of the other composables.
 */
export function useJitsuContacts() {
  const { events, loading, error, load } = useLiveEvents()
  const jitsuContacts = ref([])

  async function loadJitsuContacts() {
    await load({ actorId: DEFAULT_ACTOR_ID, limit: EVENT_LIMIT })

    const now = Date.now()
    const groups = new Map()

    for (const e of events.value) {
      const key = e.userId || e.email || e.anonymousId
      if (!key) continue
      const existing = groups.get(key)
      if (existing) {
        existing.events.push(e)
        // Keep the most recent event as the representative one.
        if (Date.parse(e.date) > Date.parse(existing.event.date)) {
          existing.event = e
        }
      } else {
        groups.set(key, { key, event: e, events: [e] })
      }
    }

    jitsuContacts.value = Array.from(groups.values()).map(
      ({ key, event, events: rawEvents }) => {
        const traits = event.context?.traits || {}
        const isAnonymous = !event.userId && !event.email
        const email = event.email || traits.email || ''
        const name =
          traits.name ||
          [traits.firstName, traits.lastName].filter(Boolean).join(' ') ||
          email ||
          event.userId ||
          `Anonymous · ${short(event.anonymousId || key)}`

        return {
          origin: 'jitsu',
          isAnonymous,
          eventCount: rawEvents.length,
          // Raw mapped events for this identity, so the detail page can render
          // real CDP activity instead of generated history.
          rawEvents,
          name,
          email,
          phone: traits.phone || '',
          city: traits.city || event.originDomain || '',
          segment: 'CDP',
          source: 'CDP',
          status: isAnonymous ? 'Anonymous' : 'Verified',
          lastSeen: relativeTime(event.date, now),
          color: colorFor(key),
          optedIn: false,
          routeKey: email || event.anonymousId || key
        }
      }
    )
  }

  return { jitsuContacts, loading, error, loadJitsuContacts }
}
