<template>
  <q-page class="p-6">
    <!-- Loading / error / not-found -->
    <div v-if="loading" class="py-20 text-center text-muted"
      >Loading contact…</div
    >
    <div v-else-if="error" class="py-20 text-center text-rose-500"
      >Couldn't load contact: {{ error }}</div
    >
    <div v-else-if="!contact" class="py-20 text-center">
      <p class="text-muted">We couldn't find that contact.</p>
      <button
        class="mt-3 rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm text-muted hover:bg-fill"
        @click="goBack"
        >← Back to Contacts</button
      >
    </div>

    <template v-else>
      <!-- Back link -->
      <button
        class="mb-4 inline-flex items-center gap-1.5 rounded-full border border-line2 bg-white px-3 py-1 text-xs font-medium text-muted shadow-sm hover:bg-fill"
        @click="goBack"
        >← Back to Contacts</button
      >

      <!-- Header -->
      <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div class="flex items-center gap-3">
          <span
            class="flex size-11 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white"
            :class="contact.color"
            >{{ initials(contact.name) }}</span
          >
          <div>
            <h1 class="text-2xl! font-semibold! tracking-[-0.5px]! text-ink">{{
              contact.name
            }}</h1>
            <p class="mt-0.5 text-sm text-muted">{{ contact.email }}</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            class="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
            >Edit</button
          >
          <button
            class="inline-flex items-center gap-1.5 rounded-lg border border-line2 bg-white px-3.5 py-2 text-sm font-medium text-muted shadow-sm hover:bg-fill"
            >Send email</button
          >
        </div>
      </div>

      <!-- Two-column layout -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <!-- Main column -->
        <div class="flex flex-col gap-6">
          <!-- About / generated bio -->
          <section
            class="rounded-xl border border-line2 bg-white p-5 shadow-sm"
          >
            <div class="mb-2.5 flex items-center justify-between">
              <h2 class="text-sm! font-semibold! text-ink">About</h2>
              <span
                class="inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand"
                >{{ engagementBadge }}</span
              >
            </div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="(t, i) in aboutTags"
                :key="t"
                class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium"
                :class="tagClass(i)"
                >{{ t }}</span
              >
            </div>
            <div class="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              <span
                v-for="stat in bioStats"
                :key="stat.label"
                class="inline-flex items-center gap-1.5 rounded-lg border border-line2 bg-fill px-2.5 py-1 text-xs"
              >
                <span class="font-semibold text-ink">{{ stat.value }}</span>
                <span class="text-subtle">{{ stat.label }}</span>
              </span>
            </div>
          </section>

          <!-- Engagements chart -->
          <section
            class="rounded-xl border border-line2 bg-white p-5 shadow-sm"
          >
            <div class="mb-2 flex items-center justify-between">
              <h2 class="text-sm! font-semibold! text-ink">Engagements</h2>
            </div>
            <apexchart
              type="area"
              height="240"
              :options="chartOptions"
              :series="chartSeries"
            />
          </section>

          <!-- History -->
          <section
            class="overflow-hidden rounded-xl border border-line2 bg-white shadow-sm"
          >
            <div class="flex items-center gap-2 border-b border-line px-5 py-3">
              <span class="text-sm font-semibold text-brand">History</span>
              <span
                class="inline-flex min-w-5 items-center justify-center rounded-full bg-brand/10 px-1.5 py-0.5 text-[11px] font-semibold text-brand"
                >{{ history.length }}</span
              >
            </div>

            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-line text-left">
                  <th class="w-10 px-5 py-3"></th>
                  <th
                    class="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle"
                    >Event Name</th
                  >
                  <th
                    class="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle"
                    >Event Type</th
                  >
                  <th
                    class="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle"
                    >Event Timestamp</th
                  >
                </tr>
              </thead>
              <tbody>
                <tr v-if="!history.length">
                  <td colspan="4" class="px-5 py-10 text-center text-muted"
                    >No activity recorded yet.</td
                  >
                </tr>
                <tr
                  v-for="(e, i) in history"
                  :key="i"
                  class="border-b border-line last:border-0 hover:bg-sidebar"
                >
                  <td class="px-5 py-3.5 align-top text-subtle">
                    <span
                      v-html="eventIcon(e.icon)"
                      class="inline-flex size-4"
                    />
                  </td>
                  <td class="px-5 py-3.5">
                    <span
                      v-if="e.link"
                      class="break-all font-medium text-brand"
                      >{{ e.name }}</span
                    >
                    <span v-else class="font-medium text-ink">{{
                      e.name
                    }}</span>
                  </td>
                  <td class="px-5 py-3.5 text-muted">{{ e.type }}</td>
                  <td
                    class="whitespace-nowrap px-5 py-3.5 text-right text-muted"
                    >{{ e.timestamp }}</td
                  >
                </tr>
              </tbody>
            </table>
          </section>
        </div>

        <!-- Right sidebar -->
        <aside class="flex flex-col gap-6">
          <!-- Points -->
          <section
            class="flex flex-col items-center rounded-xl border border-line2 bg-white p-5 text-center shadow-sm"
          >
            <span
              class="flex size-20 items-center justify-center rounded-full text-2xl font-semibold text-white"
              :class="contact.color"
              >{{ initials(contact.name) }}</span
            >
            <p class="mt-3 text-3xl font-semibold text-ink"
              >{{ detail.points.toLocaleString() }}
              <span class="text-base font-normal text-muted">points</span></p
            >
            <p class="mt-1 text-sm text-muted">{{ detail.stage }}</p>
          </section>

          <!-- Contact info -->
          <section
            class="rounded-xl border border-line2 bg-white p-5 shadow-sm"
          >
            <h2 class="mb-3 text-sm! font-semibold! text-ink">Contact</h2>
            <dl class="space-y-3 text-sm">
              <div>
                <dt class="text-xs text-subtle">Contact owner</dt>
                <dd class="text-muted">{{ detail.owner }}</dd>
              </div>
              <div>
                <dt class="text-xs text-subtle">Address</dt>
                <dd class="text-muted">{{ formattedAddress }}</dd>
              </div>
              <div>
                <dt class="text-xs text-subtle">Email</dt>
                <dd class="break-all text-muted">{{ contact.email }}</dd>
              </div>
              <div>
                <dt class="text-xs text-subtle">Phone — home</dt>
                <dd class="text-muted">{{ detail.phoneHome }}</dd>
              </div>
              <div>
                <dt class="text-xs text-subtle">Phone — mobile</dt>
                <dd class="text-muted">{{ detail.phoneMobile }}</dd>
              </div>
            </dl>
          </section>

          <!-- Channels -->
          <section
            class="rounded-xl border border-line2 bg-white p-5 shadow-sm"
          >
            <h2 class="mb-3 text-sm! font-semibold! text-ink">Channels</h2>
            <ul class="space-y-3">
              <li
                v-for="ch in channels"
                :key="ch.name"
                class="flex items-center gap-3"
              >
                <span
                  class="flex size-9 shrink-0 items-center justify-center rounded-lg"
                  :class="
                    ch.active ? 'bg-brand/10 text-brand' : 'bg-fill text-subtle'
                  "
                  v-html="channelIcon(ch.icon)"
                />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-sm font-medium text-ink">{{
                      ch.name
                    }}</span>
                    <span
                      class="inline-flex items-center gap-1 text-[11px] font-medium"
                      :class="ch.active ? 'text-emerald-600' : 'text-subtle'"
                    >
                      <span
                        class="size-1.5 rounded-full"
                        :class="ch.active ? 'bg-emerald-500' : 'bg-line2'"
                      />
                      {{ ch.status }}
                    </span>
                  </div>
                  <p class="truncate text-xs text-muted">{{ ch.detail }}</p>
                </div>
              </li>
            </ul>
          </section>

          <!-- Upcoming events -->
          <section
            class="rounded-xl border border-line2 bg-white p-5 shadow-sm"
          >
            <h2 class="mb-2 text-sm! font-semibold! text-ink"
              >Upcoming Events</h2
            >
            <p v-if="!detail.upcomingEvents.length" class="text-sm text-muted"
              >Add your lead to a segment or campaign to see upcoming
              activities.</p
            >
            <ul v-else class="space-y-2 text-sm text-muted">
              <li v-for="(u, i) in detail.upcomingEvents" :key="i">{{ u }}</li>
            </ul>
          </section>

          <!-- Segments -->
          <section
            v-if="detail.segments.length"
            class="rounded-xl border border-line2 bg-white p-5 shadow-sm"
          >
            <h2 class="mb-3 text-sm! font-semibold! text-ink">Segments</h2>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="(s, i) in detail.segments"
                :key="s"
                class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium"
                :class="tagClass(i)"
                >{{ s }}</span
              >
            </div>
          </section>

          <!-- Companies -->
          <section
            v-if="detail.companies.length"
            class="rounded-xl border border-line2 bg-white p-5 shadow-sm"
          >
            <h2 class="mb-3 text-sm! font-semibold! text-ink">Companies</h2>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="(c, i) in detail.companies"
                :key="c"
                class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium"
                :class="tagClass(i + 2)"
                >{{ c }}</span
              >
            </div>
          </section>
        </aside>
      </div>
    </template>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VueApexCharts from 'vue3-apexcharts'
import { useJitsuContacts } from '@/composables/useJitsuContacts'

// Locally register the ApexCharts component for use in the template.
const apexchart = VueApexCharts

const route = useRoute()
const router = useRouter()

// CDP-derived contacts (anonymous + identified) live in the event log, not
// contacts.json — used as a fallback when a row isn't in the mock data.
const { jitsuContacts, loadJitsuContacts } = useJitsuContacts()

const contact = ref(null)
const detail = ref(null)
const loading = ref(false)
const error = ref(null)

// The 7-month window the engagements chart spans. The chart is DERIVED from the
// history events (see chartData) so the two can never disagree.
const WINDOW = [
  { name: 'December', year: 2025, label: 'Dec 2025', days: 31 },
  { name: 'January', year: 2026, label: 'Jan 2026', days: 31 },
  { name: 'February', year: 2026, label: 'Feb 2026', days: 28 },
  { name: 'March', year: 2026, label: 'Mar 2026', days: 31 },
  { name: 'April', year: 2026, label: 'Apr 2026', days: 30 },
  { name: 'May', year: 2026, label: 'May 2026', days: 31 },
  { name: 'June', year: 2026, label: 'Jun 2026', days: 21 }
]
const CHART_MONTHS = WINDOW.map(w => w.label)
const MONTH_ABBR = {
  January: 'Jan',
  February: 'Feb',
  March: 'Mar',
  April: 'Apr',
  May: 'May',
  June: 'Jun',
  July: 'Jul',
  August: 'Aug',
  September: 'Sep',
  October: 'Oct',
  November: 'Nov',
  December: 'Dec'
}

// Maps a history timestamp to its chart-month label. Relative stamps
// ("Yesterday, …", "2h ago") fall into the most recent month.
function monthLabelOf(timestamp) {
  const s = String(timestamp)
  if (/yesterday|today|ago/i.test(s))
    return CHART_MONTHS[CHART_MONTHS.length - 1]
  const m = s.match(/([A-Za-z]+)\s+\d{1,2},\s*(\d{4})/)
  if (!m) return null
  const label = `${MONTH_ABBR[m[1]] ?? m[1].slice(0, 3)} ${m[2]}`
  return CHART_MONTHS.includes(label) ? label : null
}

// Deterministic PRNG seeded from the contact email, so a given contact always
// gets the same generated history (no flicker between visits).
function seededRandom(email) {
  let h = 2166136261
  for (let i = 0; i < email.length; i++) {
    h ^= email.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let a = h >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const EVENT_TEMPLATES = [
  {
    type: 'Page hit',
    icon: 'link',
    link: true,
    names: [
      'https://marketing.seekwithinyou.com/promo/season-pass',
      'https://marketing.seekwithinyou.com/laliga/matchday',
      'https://marketing.seekwithinyou.com/tickets/checkout',
      'https://marketing.seekwithinyou.com/travel/away-days'
    ]
  },
  {
    type: 'Email sent',
    icon: 'mail',
    link: false,
    names: [
      'Match-day Reminder',
      'Weekend Digest',
      'Your membership update',
      'Single match tickets on sale'
    ]
  },
  {
    type: 'Asset downloaded',
    icon: 'download',
    link: true,
    names: [
      'Season Wallpaper Pack',
      'Match-day Ticket - Block C',
      'Travel Itinerary'
    ]
  },
  {
    type: 'Segment membership change',
    icon: 'segment',
    link: false,
    names: ['Added to segment Match-day buyers', 'Added to segment Repeat Fan']
  },
  {
    type: 'Campaign external trigger',
    icon: 'trigger',
    link: false,
    names: ['Welcome journey started', 'Re-engagement journey started']
  }
]

function formatStamp(month, day, rnd) {
  let hour = 1 + Math.floor(rnd() * 12)
  const min = String(Math.floor(rnd() * 60)).padStart(2, '0')
  const ampm = rnd() < 0.5 ? 'am' : 'pm'
  return `${month.name} ${day}, ${month.year} ${hour}:${min} ${ampm}`
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

// Formats a CDP event's ISO date the same way generated stamps look, so
// monthLabelOf (and therefore the chart) reads it correctly.
function formatEventStamp(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  let hour = d.getHours()
  const ampm = hour >= 12 ? 'pm' : 'am'
  hour = hour % 12 || 12
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${hour}:${min} ${ampm}`
}

// Maps one mapped CDP event (see useLiveEvents) to a history row.
function cdpEventToHistory(e) {
  const payload = e.event || {}
  let type,
    icon,
    link = false,
    name
  switch (e.type) {
    case 'page':
      type = 'Page hit'
      icon = 'link'
      link = true
      name =
        e.pageURL || e.pagePath || e.pageTitle || payload.name || 'Page view'
      break
    case 'track':
      type = 'Track event'
      icon = 'trigger'
      name = payload.event || payload.name || 'Custom event'
      break
    case 'identify':
      type = 'Identify'
      icon = 'segment'
      name = e.email || payload.userId || 'Identified user'
      break
    case 'group':
      type = 'Group'
      icon = 'segment'
      name = payload.groupId || 'Group association'
      break
    default:
      type = e.type ? e.type[0].toUpperCase() + e.type.slice(1) : 'Event'
      icon = 'mail'
      name = e.pageURL || payload.event || e.type || 'Event'
  }
  return {
    icon,
    name,
    type,
    link,
    timestamp: formatEventStamp(e.date),
    sort: Date.parse(e.date) || 0
  }
}

// Builds a detail record for a CDP contact from its real event activity,
// rather than the generated mock history used for other contacts.
function cdpDetail(base) {
  const history = (base.rawEvents || [])
    .map(cdpEventToHistory)
    .sort((a, b) => b.sort - a.sort)
    .map(({ sort, ...h }) => h)
  return {
    points: history.length * 10,
    stage: base.isAnonymous ? 'Anonymous visitor' : 'Identified — CDP',
    owner: '—',
    address: {
      line1: '—',
      city: base.city || '',
      region: '',
      country: '',
      postal: ''
    },
    phoneHome: base.phone || '—',
    phoneMobile: base.phone || '—',
    segments: ['CDP'],
    companies: [],
    upcomingEvents: [],
    history
  }
}

// Generates a coherent, repeatable activity history for any contact. The chart
// is computed from this list, so engagements/points always match what's shown.
function generateHistory(email) {
  const rnd = seededRandom(email || 'anon')
  const count = 5 + Math.floor(rnd() * 8) // 5–12 events
  const events = []
  for (let i = 0; i < count; i++) {
    const month = WINDOW[Math.floor(rnd() * WINDOW.length)]
    const day = 1 + Math.floor(rnd() * month.days)
    const tpl = EVENT_TEMPLATES[Math.floor(rnd() * EVENT_TEMPLATES.length)]
    const name = tpl.names[Math.floor(rnd() * tpl.names.length)]
    events.push({
      icon: tpl.icon,
      name,
      type: tpl.type,
      link: tpl.link,
      timestamp: formatStamp(month, day, rnd),
      sort: WINDOW.indexOf(month) * 100 + day
    })
  }
  // Most-recent first, then drop the helper sort key.
  return events.sort((a, b) => b.sort - a.sort).map(({ sort, ...e }) => e)
}

const OWNERS = [
  'Shawngela Pierce',
  'Dana Whitfield',
  'Marcus Reed',
  'Lena Osei'
]
const STAGES = ['2 - Nurture', '3 - Engaged', '4 - Advocate', '5 - Repurchase']

// Builds a sensible fallback detail record for contacts that don't have a
// hand-authored entry in contact-details.json, so any contact still renders
// with coherent (generated) data.
function fallbackDetail(base) {
  // Seed from email when present, else the CDP routeKey (anonymousId), so each
  // anonymous contact gets its own stable history rather than all sharing one.
  const seed = base?.email || base?.routeKey || 'anon'
  const rnd = seededRandom(seed)
  const history = generateHistory(seed)
  return {
    points: 200 + history.length * (60 + Math.floor(rnd() * 180)),
    stage: STAGES[Math.floor(rnd() * STAGES.length)],
    owner: OWNERS[Math.floor(rnd() * OWNERS.length)],
    address: {
      line1: '—',
      city: base?.city ?? '',
      region: '',
      country: 'Saudi Arabia',
      postal: ''
    },
    phoneHome: base?.phone ?? '—',
    phoneMobile: base?.phone ?? '—',
    segments: base?.segment ? [base.segment] : [],
    companies: [],
    upcomingEvents: [],
    history
  }
}

async function fetchJson(path) {
  const res = await fetch(`${import.meta.env.BASE_URL}${path}`, {
    headers: { Accept: 'application/json' }
  })
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return res.json()
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const email = route.params.email
    const [contacts, details] = await Promise.all([
      fetchJson('data/contacts.json'),
      fetchJson('data/contact-details.json')
    ])
    let base = Array.isArray(contacts)
      ? contacts.find(c => c.email === email)
      : null
    // Not in the mock data → it may be a CDP contact, keyed by email or
    // anonymousId (its routeKey). Resolve it from the live event log.
    if (!base) {
      await loadJitsuContacts()
      base = jitsuContacts.value.find(c => (c.routeKey ?? c.email) === email)
    }
    contact.value = base ?? null
    if (base) {
      // CDP contacts render their real event activity; mock contacts use the
      // hand-authored entry, falling back to generated history.
      detail.value =
        base.origin === 'jitsu'
          ? cdpDetail(base)
          : (details[email] ?? fallbackDetail(base))
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    contact.value = null
  } finally {
    loading.value = false
  }
}

// Re-fetch when the :email param changes — the component is reused across
// contact-detail routes, so onMounted alone wouldn't refire on navigation.
watch(() => route.params.email, load, { immediate: true })

function goBack() {
  router.push({ name: 'contacts' })
}

function initials(name) {
  return String(name)
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
}

const history = computed(() => detail.value?.history ?? [])

const formattedAddress = computed(() => {
  const a = detail.value?.address
  if (!a) return '—'
  return [a.line1, a.city, a.region, a.country, a.postal]
    .filter(p => p && p !== '—')
    .join(', ')
})

// ── Activity-derived profile (channels + bio) ───────────────────────────────
// Everything below is computed from the same `history` the table/chart use, so
// the bio and channel reachability can never disagree with the activity shown.
const activityStats = computed(() => {
  const h = history.value
  const byType = {}
  const byMonth = {}
  for (const e of h) {
    byType[e.type] = (byType[e.type] || 0) + 1
    const label = monthLabelOf(e.timestamp)
    if (label) byMonth[label] = (byMonth[label] || 0) + 1
  }
  const top = obj =>
    Object.entries(obj).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  return {
    total: h.length,
    byType,
    topType: top(byType),
    topMonth: top(byMonth),
    last: h[0] ?? null
  }
})

// The channels a contact is reachable on, with reachability inferred from their
// profile fields (source, phone, email, opt-in) and real activity counts.
const channels = computed(() => {
  const c = contact.value
  if (!c) return []
  const byType = activityStats.value.byType
  const pageHits = byType['Page hit'] || 0
  const emails = byType['Email sent'] || 0
  return [
    {
      name: 'WhatsApp',
      icon: 'whatsapp',
      active: c.source === 'WhatsApp' || !!c.phone,
      status:
        c.source === 'WhatsApp'
          ? 'Primary source'
          : c.phone
            ? 'Connected'
            : 'Not connected',
      detail: c.phone || '—'
    },
    {
      name: 'Email',
      icon: 'mail',
      active: !!c.email,
      status: c.optedIn
        ? 'Subscribed'
        : c.email
          ? 'Not subscribed'
          : 'No address',
      detail: emails ? `${emails} sent` : c.email || '—'
    },
    {
      name: 'Web',
      icon: 'globe',
      active: pageHits > 0,
      status: pageHits > 0 ? 'Tracked' : 'No visits',
      detail: pageHits
        ? `${pageHits} page ${pageHits === 1 ? 'hit' : 'hits'}`
        : '—'
    },
    {
      name: 'SMS',
      icon: 'phone',
      active: !!c.phone,
      status: c.phone ? 'Reachable' : 'No number',
      detail: c.phone || '—'
    }
  ]
})

function engagementLevel(n) {
  if (n >= 10) return 'highly engaged'
  if (n >= 5) return 'actively engaged'
  if (n >= 2) return 'moderately engaged'
  if (n === 1) return 'newly engaged'
  return 'not yet engaged'
}

const engagementBadge = computed(() => {
  const w = engagementLevel(activityStats.value.total)
  return w.charAt(0).toUpperCase() + w.slice(1)
})

// Factual labels describing the contact — segment, status, source, location and
// dominant activity. No generated prose; every tag is a value pulled straight
// from the contact's profile or activity counts.
const aboutTags = computed(() => {
  const c = contact.value
  const d = detail.value
  if (!c) return []
  const tags = []
  if (c.status) tags.push(c.status)
  const segs = d?.segments?.length ? d.segments : c.segment ? [c.segment] : []
  segs.forEach(s => tags.push(s))
  if (c.source) tags.push(c.source)
  if (c.city) tags.push(c.city)
  if (c.optedIn) tags.push('Opted in')
  // Activity types the contact has actually triggered, most frequent first.
  Object.entries(activityStats.value.byType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, n]) => tags.push(`${type} · ${n}`))
  return tags
})

// Quick-glance stat chips shown under the bio.
const bioStats = computed(() => {
  const s = activityStats.value
  const d = detail.value
  const out = [{ label: 'engagements', value: s.total }]
  if (d?.points) out.push({ label: 'points', value: d.points.toLocaleString() })
  if (s.topMonth) out.push({ label: 'peak', value: s.topMonth })
  if (contact.value?.lastSeen)
    out.push({ label: 'last seen', value: contact.value.lastSeen })
  return out
})

// Small palette cycled through for segment / company tags.
const TAG_PALETTE = [
  'border-violet-200 bg-violet-50 text-violet-700',
  'border-cyan-200 bg-cyan-50 text-cyan-700',
  'border-amber-200 bg-amber-50 text-amber-700',
  'border-emerald-200 bg-emerald-50 text-emerald-700',
  'border-rose-200 bg-rose-50 text-rose-700',
  'border-sky-200 bg-sky-50 text-sky-700'
]
function tagClass(i) {
  return TAG_PALETTE[i % TAG_PALETTE.length]
}

// Inline SVGs for the history event-type icons (stroke = currentColor).
const ICONS = {
  download:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>',
  segment:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  trigger:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>'
}
function eventIcon(name) {
  return ICONS[name] || ICONS.link
}

// Inline SVGs for the channel cards (sized 18px to sit in the 36px tile).
const CHANNEL_ICONS = {
  whatsapp:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[18px]"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
  mail: ICONS.mail.replace('size-4', 'size-[18px]'),
  globe:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[18px]"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  phone:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[18px]"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.56 2.81.69A2 2 0 0 1 22 16.92z"/></svg>'
}
function channelIcon(name) {
  return CHANNEL_ICONS[name] || CHANNEL_ICONS.globe
}

// Chart is derived from the history events so it always matches the table:
// "Engagements" = events per month; "Points" = the point-earning subset
// (downloads + email opens), which is naturally a lower line.
const POINT_TYPES = new Set(['Asset downloaded', 'Email sent'])
const chartData = computed(() => {
  const engagements = CHART_MONTHS.map(() => 0)
  const points = CHART_MONTHS.map(() => 0)
  for (const e of history.value) {
    const label = monthLabelOf(e.timestamp)
    if (!label) continue
    const idx = CHART_MONTHS.indexOf(label)
    engagements[idx]++
    if (POINT_TYPES.has(e.type)) points[idx]++
  }
  return { months: CHART_MONTHS, engagements, points }
})

const chartSeries = computed(() => [
  { name: 'Engagements', data: chartData.value.engagements },
  { name: 'Points', data: chartData.value.points }
])

const chartOptions = computed(() => ({
  chart: {
    toolbar: { show: false },
    zoom: { enabled: false },
    fontFamily: 'inherit'
  },
  colors: ['#3800c1', '#0d9488'],
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: [2, 2] },
  fill: {
    type: ['gradient', 'solid'],
    gradient: { opacityFrom: 0.35, opacityTo: 0.02 },
    opacity: [0.35, 0]
  },
  legend: {
    position: 'top',
    horizontalAlign: 'center',
    markers: { radius: 12 }
  },
  grid: { borderColor: '#e7e9ed', strokeDashArray: 4 },
  xaxis: {
    categories: chartData.value.months,
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: { style: { colors: '#6a7282' } }
  },
  yaxis: { labels: { style: { colors: '#6a7282' } } },
  tooltip: { theme: 'light' }
}))
</script>
