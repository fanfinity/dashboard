<template>
  <q-page class="p-6">
    <!-- Header -->
    <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl! font-semibold! tracking-[-0.5px]! text-ink"
          >Contacts</h1
        >
        <p class="mt-1 text-sm text-muted"
          ><span class="font-medium text-ink">{{ totalLabel }}</span> verified,
          deduplicated fans across all your sources.</p
        >
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div
          class="flex h-9 w-full max-w-[280px] items-center gap-2 rounded-lg border border-line2 bg-white px-2.5 shadow-sm"
        >
          <img :src="icSearch" alt="" class="size-4 shrink-0" />
          <input
            v-model="query"
            type="text"
            placeholder="Search contacts..."
            class="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-subtle"
          />
        </div>
      </div>
    </div>

    <!-- Filter chips -->
    <div class="mb-4 flex flex-wrap gap-2">
      <button
        v-for="f in filters"
        :key="f.label"
        class="rounded-lg border px-3 py-1.5 text-sm"
        :class="
          activeFilter === f.label
            ? 'border-brand/40 bg-brand/5 font-medium text-brand'
            : 'border-line2 bg-white text-muted hover:bg-fill'
        "
        @click="activeFilter = f.label"
      >
        {{ f.label }}
      </button>
    </div>

    <!-- Contacts table -->
    <div
      class="overflow-hidden rounded-xl border border-line2 bg-white shadow-sm"
    >
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-line text-left">
            <th
              v-for="h in tableHeads"
              :key="h.key"
              class="cursor-pointer select-none px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle hover:text-ink"
              :class="h.key === 'lastSeen' ? 'text-right' : ''"
              @click="toggleSort(h.key)"
            >
              <span
                class="inline-flex items-center gap-1"
                :class="h.key === 'lastSeen' ? 'flex-row-reverse' : ''"
              >
                {{ h.label }}
                <span
                  class="text-[8px] leading-none"
                  :class="sortKey === h.key ? 'text-brand' : 'text-transparent'"
                  >{{
                    sortKey === h.key && sortDir === 'desc' ? '▼' : '▲'
                  }}</span
                >
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td
              :colspan="tableHeads.length"
              class="px-5 py-10 text-center text-muted"
              >Loading contacts…</td
            >
          </tr>
          <tr v-else-if="error">
            <td
              :colspan="tableHeads.length"
              class="px-5 py-10 text-center text-rose-500"
              >Couldn't load contacts: {{ error }}</td
            >
          </tr>
          <tr v-else-if="!filteredContacts.length">
            <td
              :colspan="tableHeads.length"
              class="px-5 py-10 text-center text-muted"
              >No contacts match your filters.</td
            >
          </tr>
          <tr
            v-for="c in pagedContacts"
            :key="c.routeKey ?? c.email"
            class="cursor-pointer border-b border-line last:border-0 hover:bg-sidebar"
            @click="
              router.push({
                name: 'contact-detail',
                params: { email: c.routeKey ?? c.email }
              })
            "
          >
            <td class="px-5 py-3.5">
              <div class="flex items-center gap-3">
                <span
                  class="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  :class="c.color"
                  >{{ initials(c.name) }}</span
                >
                <div class="min-w-0">
                  <p class="truncate font-medium text-ink">{{ c.name }}</p>
                  <p class="truncate text-xs text-muted">{{ c.city }}</p>
                </div>
              </div>
            </td>
            <td class="px-5 py-3.5">
              <p class="text-muted">{{ c.email }}</p>
              <p class="text-xs text-subtle">{{ c.phone }}</p>
            </td>
            <td class="px-5 py-3.5">
              <span
                class="inline-flex items-center rounded-md border border-line2 bg-fill px-2 py-0.5 text-xs text-muted"
                >{{ c.segment }}</span
              >
            </td>
            <td class="px-5 py-3.5 text-muted">
              <span
                v-if="c.origin === 'jitsu'"
                class="inline-flex items-center gap-1.5 rounded-md border border-brand/30 bg-brand/5 px-2 py-0.5 text-xs font-medium text-brand"
              >
                <span class="size-1.5 rounded-full bg-brand"></span>
                CDP
              </span>
              <span v-else>{{ c.source }}</span>
            </td>
            <td class="px-5 py-3.5">
              <span
                :class="badgeClass(c.status)"
                class="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium"
                >{{ c.status }}</span
              >
            </td>
            <td class="px-5 py-3.5 text-right text-muted">{{ c.lastSeen }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Footer -->
      <div
        class="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-muted"
      >
        <span
          >Showing {{ rangeStart }}–{{ rangeEnd }} of
          {{ filteredContacts.length.toLocaleString() }} contacts</span
        >
        <div class="flex items-center gap-1">
          <button
            class="rounded-md border border-line2 bg-white px-2.5 py-1 hover:bg-fill disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="page <= 1"
            @click="page--"
            >Prev</button
          >
          <span class="px-1">Page {{ page }} of {{ pageCount }}</span>
          <button
            class="rounded-md border border-line2 bg-white px-2.5 py-1 hover:bg-fill disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="page >= pageCount"
            @click="page++"
            >Next</button
          >
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import icSearch from '@/assets/dashboard/ic-search.svg'
import { useJitsuContacts } from '@/composables/useJitsuContacts'

const router = useRouter()

// Real Jitsu visitors, derived from the incoming-events log. These sit in the same
// table as the mock contacts and power the "Anonymous users" / "Jitsu users" filters.
const { jitsuContacts, loadJitsuContacts } = useJitsuContacts()

const query = ref('')
const activeFilter = ref('All')
const page = ref(1)
const PER_PAGE = 25

// Default to sorting by engagement (most recently seen first).
const sortKey = ref('lastSeen')
const sortDir = ref('asc')

// Each column carries the contact field it sorts by. 'Contact' sorts by email,
// 'Engagement' sorts by recency (see engagementRank).
const tableHeads = [
  { label: 'Name', key: 'name' },
  { label: 'Contact', key: 'email' },
  { label: 'Segment', key: 'segment' },
  { label: 'Source', key: 'source' },
  { label: 'Status', key: 'status' },
  { label: 'Engagement', key: 'lastSeen' }
]

function toggleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

const filters = [
  { label: 'All' },
  { label: 'Anonymous users' },
  { label: 'CDP users' },
  { label: 'Verified' },
  { label: 'Super Fans' },
  { label: 'Opted in' },
  { label: 'Lapsed' }
]

// Maps each filter chip to a predicate over a contact. 'All' has no predicate.
// 'Anonymous users' / 'Jitsu users' split the Jitsu-derived rows by whether the
// visitor has been identified (userId/email) or is still anonymous.
const FILTER_PREDICATES = {
  'Anonymous users': c => c.origin === 'jitsu' && c.isAnonymous,
  'CDP users': c => c.origin === 'jitsu' && !c.isAnonymous,
  Verified: c => c.status === 'Verified',
  'Super Fans': c => c.segment === 'Super Fans',
  'Opted in': c => c.optedIn === true,
  Lapsed: c => c.status === 'Lapsed'
}

const contacts = ref([])
const loading = ref(false)
const error = ref(null)

async function loadContacts() {
  loading.value = true
  error.value = null
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/contacts.json`, {
      headers: { Accept: 'application/json' }
    })
    if (!res.ok) {
      throw new Error(`Request failed (${res.status})`)
    }
    const data = await res.json()
    contacts.value = Array.isArray(data)
      ? data.map(c => ({ ...c, origin: 'mock' }))
      : []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    contacts.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadContacts()
  // Best-effort: a Jitsu fetch failure must never break the mock-contacts table,
  // so we don't await it or surface its error here (the composable swallows it).
  loadJitsuContacts()
})

// Mock contacts plus the live Jitsu-derived ones, shown together in one table.
const allContacts = computed(() => [...contacts.value, ...jitsuContacts.value])

const totalLabel = computed(() => allContacts.value.length.toLocaleString())

// Fields the search box matches against — every column the user can see.
const SEARCH_FIELDS = [
  'name',
  'city',
  'email',
  'phone',
  'segment',
  'source',
  'status'
]

const filteredContacts = computed(() => {
  const q = query.value.trim().toLowerCase()
  const predicate = FILTER_PREDICATES[activeFilter.value]
  return allContacts.value.filter(c => {
    if (predicate && !predicate(c)) return false
    if (!q) return true
    return SEARCH_FIELDS.some(f =>
      String(c[f] ?? '')
        .toLowerCase()
        .includes(q)
    )
  })
})

// Converts an "engagement" string like "2h ago" / "74d ago" into minutes, so the
// column sorts by real recency (smaller = more recently seen) instead of alphabetically.
const UNIT_MINUTES = { m: 1, h: 60, d: 1440, w: 10080, mo: 43200, y: 525600 }
function engagementRank(s) {
  const m = String(s).match(/(\d+)\s*([a-z]+)/i)
  if (!m) return Infinity
  return Number(m[1]) * (UNIT_MINUTES[m[2].toLowerCase()] ?? 60)
}

function sortValue(c, key) {
  if (key === 'lastSeen') return engagementRank(c.lastSeen)
  const v = c[key]
  return typeof v === 'string' ? v.toLowerCase() : v
}

const sortedContacts = computed(() => {
  if (!sortKey.value) return filteredContacts.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...filteredContacts.value].sort((a, b) => {
    const av = sortValue(a, sortKey.value)
    const bv = sortValue(b, sortKey.value)
    if (av < bv) return -dir
    if (av > bv) return dir
    return 0
  })
})

const pageCount = computed(() =>
  Math.max(1, Math.ceil(filteredContacts.value.length / PER_PAGE))
)

const pagedContacts = computed(() => {
  const start = (page.value - 1) * PER_PAGE
  return sortedContacts.value.slice(start, start + PER_PAGE)
})

const rangeStart = computed(() =>
  filteredContacts.value.length ? (page.value - 1) * PER_PAGE + 1 : 0
)
const rangeEnd = computed(() =>
  Math.min(page.value * PER_PAGE, filteredContacts.value.length)
)

// Reset to the first page whenever the result set changes.
watch([query, activeFilter], () => {
  page.value = 1
})

function initials(name) {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
}

const STATUS = {
  Verified: 'border-success-line bg-success-bg text-success',
  Pending: 'border-amber-200 bg-amber-50 text-amber-600',
  Anonymous: 'border-violet-200 bg-violet-50 text-violet-600',
  Lapsed: 'border-line2 bg-fill text-subtle'
}
function badgeClass(status) {
  return STATUS[status] || STATUS.Lapsed
}
</script>
