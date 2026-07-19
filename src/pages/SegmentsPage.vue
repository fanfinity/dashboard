<template>
  <q-page class="p-6">
    <!-- Header -->
    <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl! font-semibold! tracking-[-0.5px]! text-ink"
          >Segments</h1
        >
        <p class="mt-1 text-sm text-muted"
          >Group verified, deduplicated fans into addressable audiences.</p
        >
      </div>
      <button
        class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
        @click="builderOpen = true"
      >
        <svg viewBox="0 0 16 16" class="size-4" fill="none">
          <path
            d="M8 3.5v9M3.5 8h9"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
        New Segment
      </button>
    </div>

    <!-- Stat strip -->
    <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div
        v-for="s in stats"
        :key="s.label"
        class="rounded-xl border border-line2 bg-white p-4 shadow-sm"
      >
        <p class="text-sm text-muted">{{ s.label }}</p>
        <p class="mt-2 text-2xl font-semibold tracking-[-0.5px] text-ink">{{
          s.value
        }}</p>
      </div>
    </div>

    <!-- Segments table -->
    <div
      class="overflow-hidden rounded-xl border border-line2 bg-white shadow-sm"
    >
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-line text-left">
            <th
              v-for="h in tableHeads"
              :key="h"
              class="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle"
              :class="h === 'Fans' ? 'text-right' : ''"
              >{{ h }}</th
            >
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td
              :colspan="tableHeads.length"
              class="px-5 py-10 text-center text-muted"
              >Loading segments…</td
            >
          </tr>
          <tr v-else-if="error">
            <td
              :colspan="tableHeads.length"
              class="px-5 py-10 text-center text-rose-500"
              >Couldn't load segments: {{ error }}</td
            >
          </tr>
          <tr v-else-if="!allRows.length">
            <td
              :colspan="tableHeads.length"
              class="px-5 py-10 text-center text-muted"
              >No segments yet.</td
            >
          </tr>
          <tr
            v-for="row in allRows"
            :key="row.key"
            class="border-b border-line last:border-0 hover:bg-sidebar"
          >
            <td class="px-5 py-4">
              <p class="flex items-center gap-2 font-medium text-ink">
                {{ row.name }}
                <span
                  v-if="row.dynamic"
                  class="inline-flex items-center rounded-md bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.4px] text-brand"
                  >Dynamic</span
                >
              </p>
              <p class="mt-0.5 text-xs text-muted">{{ row.definition }}</p>
            </td>
            <td class="px-5 py-4 text-right font-medium text-ink">{{
              row.fans.toLocaleString()
            }}</td>
            <td class="px-5 py-4">
              <div class="flex items-center gap-2">
                <div class="h-2 w-24 rounded-full bg-fill">
                  <div
                    class="h-2 rounded-full bg-brand"
                    :style="{ width: row.index + '%' }"
                  />
                </div>
                <span class="text-xs font-medium text-ink">{{
                  row.index
                }}</span>
              </div>
            </td>
            <td class="px-5 py-4">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="src in row.sources"
                  :key="src"
                  class="inline-flex items-center rounded-md border border-line2 bg-fill px-1.5 py-0.5 text-[11px] text-muted"
                  >{{ src }}</span
                >
              </div>
            </td>
            <td class="px-5 py-4 text-subtle">{{ row.updated }}</td>
            <td class="px-5 py-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <button
                  v-if="row.dynamic"
                  class="rounded-lg border border-line2 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-500 shadow-sm hover:bg-fill"
                  title="Delete segment"
                  @click="deleteSegment(row.id)"
                  >Delete</button
                >
                <button
                  class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-xs font-medium text-brand shadow-sm hover:bg-fill"
                  >Push</button
                >
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <SegmentBuilderDialog
      v-model="builderOpen"
      :events="events"
      @save="onSaveSegment"
    />
  </q-page>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useLiveEvents, DEFAULT_ACTOR_ID } from '@/composables/useLiveEvents'
import {
  useSegments,
  countMatches,
  describeRules
} from '@/composables/useSegments'
import SegmentBuilderDialog from '@/components/SegmentBuilderDialog.vue'

const tableHeads = ['Segment', 'Fans', 'Value index', 'Sources', 'Updated', '']

// Incoming Jitsu events power the live counts for dynamic segments.
const { events, load: loadEvents } = useLiveEvents()
// Dynamic segments persisted in localStorage + their rule engine.
const {
  segments: dynamicSegments,
  loadSegments,
  saveSegment,
  deleteSegment
} = useSegments()

const builderOpen = ref(false)

function onSaveSegment(def) {
  saveSegment(def)
}

// Short, human descriptions per segment. Only labels are static here —
// every number below is derived from the loaded contacts.
const DEFINITIONS = {
  'Super Fans': 'Engaged repeatedly · last 30 days',
  'Hot Al-Hilal': 'Riyadh · Al-Hilal supporters',
  'La Liga readers': 'Opened La Liga newsletter',
  'Match-day buyers': 'Bought a ticket in last 90 days',
  'Lapsed fans': 'No engagement · 60+ days',
  'Repeat Fan': 'Returned 3+ times',
  'Travel Fan': 'Bought away-match travel'
}

const contacts = ref([])
const loading = ref(false)
const error = ref(null)

// Same source-of-truth as the Contacts page — segments are aggregated from it.
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
    contacts.value = Array.isArray(data) ? data : []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    contacts.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadContacts()
  loadSegments()
  // Pull a generous recent window so dynamic-segment counts are meaningful.
  loadEvents({ actorId: DEFAULT_ACTOR_ID, limit: 1000 })
})

// Turn an ISO event date into a relative "Xh ago" label (event dates are ISO,
// unlike the contacts' pre-formatted strings).
function relativeTime(iso) {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (isNaN(then)) return '—'
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

// Turn an "engagement" string like "2h ago" / "74d ago" into minutes, so we can
// find the most-recent contact in a segment (smaller = more recently seen).
const UNIT_MINUTES = { m: 1, h: 60, d: 1440, w: 10080, mo: 43200, y: 525600 }
function engagementRank(s) {
  const m = String(s).match(/(\d+)\s*([a-z]+)/i)
  if (!m) return Infinity
  return Number(m[1]) * (UNIT_MINUTES[m[2].toLowerCase()] ?? 60)
}

// Compact a large fan count to e.g. "842K" / "1.2M".
function compact(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

// Aggregate the raw contacts into one row per segment. Every figure — fan count,
// value index, sources, last-updated, match rate — is computed from real members.
const segments = computed(() => {
  const groups = new Map()
  for (const c of contacts.value) {
    const key = c.segment || 'Unsegmented'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(c)
  }

  const rows = []
  for (const [name, members] of groups) {
    const fans = members.length
    const verified = members.filter(c => c.status === 'Verified').length
    const optedIn = members.filter(c => c.optedIn === true).length

    // Value index (0–100): blend of how verified, opted-in and recently active the
    // segment is, normalised against the freshest possible contact (~1h).
    const avgRecency =
      members.reduce((s, c) => s + engagementRank(c.lastSeen), 0) / fans
    const recencyScore = Math.max(
      0,
      1 - avgRecency / engagementRank('120d ago')
    )
    const score =
      0.4 * (verified / fans) + 0.3 * (optedIn / fans) + 0.3 * recencyScore
    const index = Math.round(score * 100)

    // Top sources within the segment, busiest first.
    const srcCount = {}
    for (const c of members) srcCount[c.source] = (srcCount[c.source] || 0) + 1
    const sources = Object.entries(srcCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([s]) => s)

    // Most recently seen member drives the "Updated" column.
    const updated = members.reduce(
      (best, c) =>
        engagementRank(c.lastSeen) < engagementRank(best) ? c.lastSeen : best,
      members[0].lastSeen
    )

    rows.push({
      name,
      definition: DEFINITIONS[name] || 'Custom audience',
      fans,
      index,
      matchRate: Math.round((optedIn / fans) * 100),
      sources,
      updated
    })
  }

  // Largest audiences first.
  return rows.sort((a, b) => b.fans - a.fans)
})

// Dynamic segments → table rows, with counts computed live from loaded events.
const dynamicRows = computed(() => {
  const total = events.value.length || 1
  return dynamicSegments.value.map(seg => {
    const { eventCount, fanCount, hosts, lastSeen } = countMatches(
      events.value,
      seg
    )
    return {
      key: `dyn-${seg.id}`,
      id: seg.id,
      dynamic: true,
      name: seg.name,
      definition: seg.description || describeRules(seg),
      fans: fanCount,
      index: Math.round((eventCount / total) * 100),
      matchRate: 0,
      sources: hosts,
      updated: lastSeen ? relativeTime(lastSeen) : '—'
    }
  })
})

// Dynamic segments first, then the contacts-derived ones.
const allRows = computed(() => [
  ...dynamicRows.value,
  ...segments.value.map(r => ({ ...r, key: `seg-${r.name}`, dynamic: false }))
])

// Stat strip — figures roll up from the contacts-derived segments; the segment
// count includes dynamic segments too.
const stats = computed(() => {
  const rows = segments.value
  const totalFans = rows.reduce((sum, r) => sum + r.fans, 0)
  const avgMatch = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + r.matchRate, 0) / rows.length)
    : 0
  return [
    { label: 'Total segments', value: allRows.value.length.toLocaleString() },
    { label: 'Addressable fans', value: compact(totalFans) },
    { label: 'Avg. match rate', value: `${avgMatch}%` }
  ]
})
</script>
