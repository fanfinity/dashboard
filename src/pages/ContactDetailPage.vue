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

// Locally register the ApexCharts component for use in the template.
const apexchart = VueApexCharts

const route = useRoute()
const router = useRouter()

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
  const rnd = seededRandom(base?.email ?? 'anon')
  const history = generateHistory(base?.email)
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
    const base = Array.isArray(contacts)
      ? contacts.find(c => c.email === email)
      : null
    contact.value = base ?? null
    if (base) {
      detail.value = details[email] ?? fallbackDetail(base)
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
