<template>
  <q-page class="p-6">
    <!-- Header -->
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl! font-semibold! tracking-[-0.5px]! text-ink"
          >Live Events</h1
        >
        <p class="mt-2 text-sm text-muted">
          Incoming events received by your sites, in real time.
        </p>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="mb-4 flex flex-wrap items-end gap-3">
      <div class="flex flex-col gap-1">
        <span class="text-xs font-medium text-subtle">Site</span>
        <q-select
          v-model="streamId"
          dense
          outlined
          emit-value
          map-options
          options-dense
          :options="siteOptions"
          style="min-width: 240px"
          class="bg-white"
        />
      </div>

      <div class="flex flex-col gap-1">
        <span class="text-xs font-medium text-subtle">Status</span>
        <q-select
          v-model="level"
          dense
          outlined
          emit-value
          map-options
          options-dense
          :options="levelOptions"
          style="min-width: 110px"
          class="bg-white"
        />
      </div>

      <div class="flex flex-col gap-1">
        <span class="text-xs font-medium text-subtle">From (UTC)</span>
        <input
          v-model="startInput"
          type="datetime-local"
          class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none"
        />
      </div>

      <div class="flex flex-col gap-1">
        <span class="text-xs font-medium text-subtle">To (UTC)</span>
        <input
          v-model="endInput"
          type="datetime-local"
          class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none"
        />
      </div>

      <div class="flex flex-col gap-1">
        <span class="text-xs font-medium text-subtle">Search</span>
        <input
          v-model="searchInput"
          type="text"
          placeholder="Search events..."
          class="h-9 w-[200px] rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
        />
      </div>

      <button
        class="ml-auto flex h-9 items-center gap-2 rounded-lg border border-line2 bg-white px-3 text-sm font-medium text-brand shadow-sm hover:bg-fill"
        :disabled="loading"
        @click="refresh"
      >
        <q-icon
          name="refresh"
          size="18px"
          :class="loading ? 'animate-spin' : ''"
        />
        Refresh
      </button>
    </div>

    <!-- Nothing to read. Distinct from an error: nothing broke, the account's
         live-events endpoint simply has nothing to answer with on the backend
         the Data source switch points at — most often because /v1/me has not
         settled an account yet, or the account has no provisioned source. -->
    <NoticeBanner
      v-if="apiMissing"
      class="mb-4"
      tone="info"
      title="No API yet"
      message="No live events to read on this backend — this account has no source with a provisioned stream yet. Switch Settings → Data source to Demo data to see the feed."
    />

    <!-- Error -->
    <div
      v-else-if="error"
      class="mb-4 flex flex-col items-start gap-2 rounded-xl border border-line2 bg-white p-4"
    >
      <p class="text-sm text-ink">Couldn't load events.</p>
      <p class="text-xs text-muted">{{ error }}</p>
      <button
        class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
        @click="refresh"
      >
        Retry
      </button>
    </div>

    <!-- Table -->
    <div
      class="overflow-hidden rounded-xl border border-line2 bg-white shadow-sm"
    >
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr
            class="border-b border-line text-left text-xs uppercase tracking-[0.4px] text-subtle"
          >
            <th class="w-8 px-3 py-2.5"></th>
            <th class="px-3 py-2.5 font-semibold">Date (UTC)</th>
            <th class="px-3 py-2.5 font-semibold">Type</th>
            <th class="px-3 py-2.5 font-semibold">Page Path</th>
            <th class="px-3 py-2.5 font-semibold">Summary</th>
          </tr>
        </thead>
        <tbody>
          <!-- Loading skeletons -->
          <template v-if="loading && !events.length">
            <tr v-for="n in 8" :key="`sk-${n}`" class="border-b border-line">
              <td colspan="5" class="px-3 py-2.5">
                <q-skeleton height="20px" />
              </td>
            </tr>
          </template>

          <!-- Empty -->
          <tr v-else-if="!events.length">
            <td colspan="5" class="px-3 py-10 text-center text-sm text-muted">
              {{
                apiMissing
                  ? 'No API yet — nothing to read on this backend.'
                  : 'No events found for this site and filters.'
              }}
            </td>
          </tr>

          <!-- Rows -->
          <tr
            v-for="ev in events"
            v-else
            :key="ev.id"
            class="cursor-pointer border-b border-line last:border-0 hover:bg-sidebar"
            @click="openDrawer(ev)"
          >
            <td class="px-3 py-2.5">
              <span
                class="inline-block size-2.5 rounded-full"
                :class="statusDotClass(ev.status)"
                :title="ev.status"
              ></span>
            </td>
            <td class="whitespace-nowrap px-3 py-2.5 text-muted">{{
              formatUTC(ev.date)
            }}</td>
            <td class="px-3 py-2.5">
              <span
                class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
                :class="
                  ev.ingestType === 'browser'
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-purple-50 text-purple-700'
                "
              >
                <q-icon
                  :name="ev.ingestType === 'browser' ? 'public' : 'dns'"
                  size="13px"
                />
                {{ typeLabel(ev) }}
              </span>
            </td>
            <td class="max-w-[260px] truncate px-3 py-2.5 text-muted">
              <a
                v-if="ev.pageURL"
                :href="ev.pageURL"
                target="_blank"
                rel="noreferrer noopener"
                class="text-brand hover:underline"
                @click.stop
                >↗</a
              >
              {{ ev.pagePath }}
            </td>
            <td class="px-3 py-2.5">
              <div v-if="ev.status === 'SKIPPED' || ev.status === 'FAILED'">
                <span
                  class="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
                >
                  <q-icon name="warning" size="13px" /> {{ ev.error }}
                </span>
              </div>
              <div v-else class="flex flex-wrap items-center gap-1.5">
                <span
                  v-if="geoLabel(ev)"
                  class="rounded-md bg-fill px-2 py-0.5 text-xs text-muted"
                >
                  {{ geoLabel(ev) }}
                </span>
                <span
                  v-if="ev.host"
                  class="rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                >
                  {{ ev.host }}
                </span>
                <span
                  v-if="ev.email"
                  class="rounded-md bg-green-50 px-2 py-0.5 text-xs text-green-700"
                >
                  {{ ev.email }}
                </span>
                <span
                  v-else-if="ev.userId"
                  class="rounded-md bg-green-50 px-2 py-0.5 text-xs text-green-700"
                >
                  {{ ev.userId }}
                </span>
                <span
                  v-if="ev.referringDomain && ev.referringDomain !== ev.host"
                  class="rounded-md bg-purple-50 px-2 py-0.5 text-xs text-purple-700"
                >
                  {{ ev.referringDomain }}
                </span>
                <span
                  v-if="!ev.userId && ev.anonymousId"
                  class="rounded-md bg-fill px-2 py-0.5 text-xs text-muted"
                >
                  {{ ev.anonymousId }}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Load previous -->
      <div
        v-if="events.length"
        class="flex justify-center border-t border-line p-3"
      >
        <button
          class="rounded-lg border border-line2 bg-white px-4 py-1.5 text-sm font-medium text-muted hover:bg-fill disabled:opacity-50"
          :disabled="loading"
          @click="loadPrevious"
        >
          {{ loading ? 'Loading…' : 'Load previous events' }}
        </button>
      </div>
    </div>

    <!-- Detail drawer -->
    <q-dialog v-model="drawerOpen" position="right">
      <q-card
        style="width: 560px; max-width: 90vw; height: 100vh"
        class="flex flex-col"
      >
        <div
          class="flex shrink-0 items-center justify-between border-b border-line px-4 py-3"
        >
          <span class="text-sm font-semibold text-ink">Event details</span>
          <q-btn
            flat
            round
            dense
            icon="close"
            size="sm"
            @click="drawerOpen = false"
          />
        </div>
        <q-card-section v-if="selected" class="min-h-0 flex-1 overflow-y-auto">
          <table class="w-full text-sm">
            <tbody>
              <tr
                v-for="row in drawerRows"
                :key="row.name"
                class="border-b border-line align-top"
              >
                <td class="w-[140px] py-2 pr-3 font-medium text-subtle">{{
                  row.name
                }}</td>
                <td class="break-words py-2 text-ink">
                  <span v-if="row.type === 'status'">
                    <span
                      class="rounded-md px-2 py-0.5 text-xs font-medium"
                      :class="statusTagClass(row.value)"
                      >{{ row.value }}</span
                    >
                  </span>
                  <a
                    v-else-if="row.type === 'link' && row.value"
                    :href="row.value"
                    target="_blank"
                    rel="noreferrer noopener"
                    class="text-brand hover:underline"
                    >{{ row.value }}</a
                  >
                  <span v-else>{{ row.value }}</span>
                </td>
              </tr>
            </tbody>
          </table>

          <div class="mt-4">
            <span
              class="text-xs font-semibold uppercase tracking-[0.4px] text-subtle"
              >HTTP Headers</span
            >
            <pre
              class="mt-1 overflow-x-auto whitespace-pre rounded-lg bg-sidebar p-3 text-xs text-muted"
              >{{ headersText }}</pre
            >
          </div>

          <div class="mt-4">
            <span
              class="text-xs font-semibold uppercase tracking-[0.4px] text-subtle"
              >Event Payload</span
            >
            <pre
              class="mt-1 overflow-x-auto whitespace-pre rounded-lg bg-sidebar p-3 text-xs text-ink"
              >{{ payloadText }}</pre
            >
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import { useLiveEvents } from '@/composables/useLiveEvents'

// Reads GET /v1/accounts/{account}/events/live through the Sfere backend and
// nothing else. There is no vendor id, no ingest key and no proxy in this page
// any more — see the header comment in useLiveEvents.js.
const { events, streams, loading, error, apiMissing, load, loadStreams } =
  useLiveEvents()

const streamId = ref('')
const level = ref('all')
const startInput = ref('')
const endInput = ref('')
const searchInput = ref('')

const levelOptions = [
  { label: 'All', value: 'all' },
  { label: 'Errors', value: 'error' }
]

const siteOptions = computed(() => {
  const opts = streams.value.map(s => ({ label: s.name || s.id, value: s.id }))
  // Keep whatever is selected addressable even before the stream list lands,
  // otherwise the q-select renders a blank while the two requests race.
  if (streamId.value && !opts.some(o => o.value === streamId.value)) {
    opts.unshift({ label: streamId.value, value: streamId.value })
  }
  return opts
})

// Treats the datetime-local input (which is timezone-naive) as UTC.
function parseUTCInput(value) {
  if (!value) return undefined
  const d = new Date(`${value}:00Z`)
  return isNaN(d.getTime()) ? undefined : d
}

function currentFilters(extra = {}) {
  return {
    streamId: streamId.value,
    level: level.value,
    start: parseUTCInput(startInput.value),
    end: parseUTCInput(endInput.value),
    search: searchInput.value.trim() || undefined,
    ...extra
  }
}

function refresh() {
  load(currentFilters())
}

// Loads older events using the last loaded event's date as the upper bound.
function loadPrevious() {
  const last = events.value[events.value.length - 1]
  if (!last) return
  const before = new Date(last.date)
  load(currentFilters({ end: before, append: true }))
}

// Debounced reactive reload when filters change. `ready` keeps the watcher
// quiet for the initial streamId assignment in onMounted, which would
// otherwise queue a second, identical request 400ms behind the first.
let debounceTimer = null
let ready = false
watch([streamId, level, startInput, endInput, searchInput], () => {
  if (!ready) return
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(refresh, 400)
})

// --- Drawer ---
const drawerOpen = ref(false)
const selected = ref(null)

function openDrawer(ev) {
  selected.value = ev
  drawerOpen.value = true
}

const drawerRows = computed(() => {
  const ev = selected.value
  if (!ev) return []
  const rows = [
    { name: 'Date (UTC)', value: formatUTC(ev.date) },
    { name: 'Source', value: ev.ingestType },
    { name: 'Message ID', value: ev.messageId },
    { name: 'Type', value: ev.type },
    { name: 'Status', value: ev.status, type: 'status' }
  ]
  if (ev.error) rows.push({ name: 'Error', value: ev.error })
  rows.push(
    { name: 'User ID', value: ev.userId },
    { name: 'Email', value: ev.email },
    { name: 'Anonymous ID', value: ev.anonymousId },
    { name: 'Page Title', value: ev.pageTitle },
    { name: 'Page URL', value: ev.pageURL, type: 'link' },
    { name: 'Destinations', value: (ev.destinations || []).join(', ') },
    { name: 'Origin Domain', value: ev.originDomain },
    { name: 'Write Key', value: ev.writeKey }
  )
  return rows.filter(
    r => r.value !== undefined && r.value !== null && r.value !== ''
  )
})

// The backend redacts credential headers and masks write keys before they
// leave the API (see the LiveEvent schema in openapi/sfere-api.json), so
// this renders what it is given. The page used to scrub the upstream vendor's
// name out of every string it displayed; there is no upstream vendor in this
// page's world any more, so there is nothing to scrub.
const headersText = computed(() => {
  const h = selected.value?.httpHeaders
  if (!h) return '—'
  return JSON.stringify(h, null, 2)
})

const payloadText = computed(() =>
  selected.value?.payload
    ? JSON.stringify(selected.value.payload, null, 2)
    : '—'
)

// --- Render helpers ---
function formatUTC(date) {
  const d = new Date(date)
  if (isNaN(d.getTime())) return String(date)
  const p = n => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
  )
}

function typeLabel(ev) {
  const name = ev.type === 'track' ? ev.payload?.event || ev.type : ev.type
  return name || '—'
}

function geoLabel(ev) {
  const geo = ev.context?.geo
  const code = geo?.country?.code
  if (!code) return ''
  return [code, geo?.city?.name].filter(Boolean).join(' · ')
}

function statusDotClass(status) {
  switch (status) {
    case 'SUCCESS':
      return 'bg-success'
    case 'FAILED':
      return 'bg-red-500'
    case 'SKIPPED':
      return 'bg-amber-500'
    default:
      return 'bg-gray-300'
  }
}

function statusTagClass(status) {
  switch (status) {
    case 'SUCCESS':
      return 'bg-green-50 text-green-700'
    case 'FAILED':
      return 'bg-red-50 text-red-700'
    case 'SKIPPED':
      return 'bg-amber-50 text-amber-700'
    default:
      return 'bg-fill text-muted'
  }
}

onMounted(async () => {
  // The stream list has to land first: `streamId` is a required query
  // parameter, so there is no sensible default to fire a request with. This is
  // what the hardcoded vendor cuid used to stand in for.
  await loadStreams()
  if (!streamId.value) streamId.value = streams.value[0]?.id || ''
  await nextTick()
  ready = true
  refresh()
})
</script>
