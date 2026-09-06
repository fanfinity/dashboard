<template>
  <q-page class="p-6">
    <div class="mx-auto w-full max-w-[1400px]">
      <PageHeader
        title="Live Events"
        subtitle="Incoming events from your connected sources, updated in real time."
      />

      <!-- COUNTS OF WHAT IS LOADED, NOT OF A WINDOW. There is no aggregate
           endpoint behind this screen, so these are derived from the exact
           array the table below renders — which is what keeps them and the
           table's "Showing 1-N of N" footer from ever disagreeing. They are
           hidden entirely until rows exist rather than printed as `0`: a
           confident zero beside "No API yet" would be a measurement nobody
           took. There is deliberately no success percentage; a rate is a claim
           about a population, and this is one page of results. -->
      <div
        v-if="events.length"
        class="mb-6 grid gap-4"
        :class="level === 'error' ? 'sm:grid-cols-2' : 'sm:grid-cols-3'"
      >
        <StatCard
          label="Events loaded"
          :value="formatCount(events.length)"
          hint="Counted from the rows below, not an hourly total"
        />
        <!-- Dropped on the Errors tab, where it is structurally always zero:
             a truthful zero is still noise beside a tab named Errors. -->
        <StatCard
          v-if="level !== 'error'"
          label="Succeeded"
          :value="formatCount(succeededCount)"
          hint="Status SUCCESS"
        />
        <StatCard
          label="Failed or skipped"
          :value="formatCount(failedCount)"
          :tone="failedCount ? 'danger' : 'neutral'"
          hint="Status FAILED or SKIPPED"
        />
      </div>

      <!-- The tab and the Status select are two affordances over ONE piece of
           state: `level`, which goes out as the endpoint's own parameter. Do
           not give the select a "Success" option — `load()` takes `all` or
           `error` and nothing else, so anything more would be a local
           narrowing of one page of results sitting next to a server-side
           filter and looking like its peer. -->
      <TabNav v-model="level" :tabs="TABS" />

      <!-- Container queries, not breakpoints: the sidebar collapses without
           changing the viewport, so one 1024px window has two content widths
           (see CLAUDE.md collision #6). The `@container` element and the one
           reading the query have to be two different elements.

           EVERY TIER IS SIZED OFF THE DATE FIELDS, and the widest tier is an
           unequal template rather than `grid-cols-6`. A native
           `datetime-local` has a min-content width of ~222px at Inter 14px
           (measured; en-GB's `dd/mm/yyyy, --:-- --` is the widest common
           format), and a grid item's default `min-width: auto` means it cannot
           be squeezed under that — so six equal 1fr tracks under ~1500px of
           container did not shrink the two date fields, it pushed them over
           the neighbours to their right: the picker icon landed inside the
           next field. `min-w-0` on all six cells is what stops the overlap;
           the 16rem date tracks are what stop it from becoming a clipped
           picker icon instead, which is the same bug one step quieter. The two
           halves only work together — do not drop either.

           The unequal `fr` weights are the other half of that: six equal
           tracks wide enough for a date field would need ~1600px of container,
           so the row only reached one line on a monitor almost nobody has.
           Pinning the two dates and letting Source, Status and Search share
           what is left fits all six from 72rem up, which is the width the
           sidebar leaves on a 1500px window. -->
      <div class="@container mb-4">
        <div
          class="grid items-end gap-3 @min-[34rem]:grid-cols-2 @min-[52rem]:grid-cols-3 @min-[72rem]:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_16rem_16rem_minmax(0,1.2fr)_auto]"
        >
          <FormField label="Source" for-id="le-source" class="min-w-0">
            <SfereSelect
              id="le-source"
              v-model="streamId"
              :options="sourceOptions"
              :disabled="!sourceOptions.length"
              :placeholder="sourceOptions.length ? '' : 'No sources yet'"
            />
          </FormField>

          <FormField label="Status" for-id="le-status" class="min-w-0">
            <SfereSelect
              id="le-status"
              v-model="level"
              :options="LEVEL_OPTIONS"
            />
          </FormField>

          <FormField label="From (UTC)" for-id="le-from" class="min-w-0">
            <SfereInput
              id="le-from"
              v-model="startInput"
              type="datetime-local"
            />
          </FormField>

          <FormField label="To (UTC)" for-id="le-to" class="min-w-0">
            <SfereInput id="le-to" v-model="endInput" type="datetime-local" />
          </FormField>

          <FormField label="Search" for-id="le-search" class="min-w-0">
            <ToolbarSearch
              id="le-search"
              v-model="searchInput"
              block
              placeholder="Event, path or ID"
            />
          </FormField>

          <div class="flex min-w-0">
            <SfereButton
              variant="secondary"
              :loading="loading"
              @click="refresh"
            >
              Refresh
            </SfereButton>
          </div>
        </div>
      </div>

      <!-- `loading` only while the table has nothing to show: "Load previous
           events" appends, and swapping the rows for a skeleton mid-append
           would throw away what the reader was looking at. -->
      <DataTable
        :columns="COLUMNS"
        :rows="events"
        :loading="loading && !events.length"
        :error="error"
        :api-missing="apiMissing"
        :per-page="2000"
        clickable-rows
        :empty-title="emptyTitle"
        :empty-description="emptyDescription"
        @row-click="openDrawer"
        @retry="refresh"
      >
        <template #cell-status="{ row }">
          <span
            class="inline-block size-2.5 rounded-full"
            :class="statusDotClass(row.status)"
          />
          <span class="sr-only">{{ row.status || NOT_KNOWN }}</span>
        </template>

        <template #cell-date="{ row }">
          <span class="font-sfere-mono text-sfere-xs whitespace-nowrap">{{
            formatUTC(row.date)
          }}</span>
        </template>

        <template #cell-type="{ row }">
          <StatusBadge
            :tone="row.ingestType === 'browser' ? 'brand' : 'neutral'"
            dot
            >{{ typeLabel(row) }}</StatusBadge
          >
        </template>

        <template #cell-pagePath="{ row }">
          <span
            class="block max-w-[260px] truncate text-sfere-fg-muted"
            :title="row.pagePath || undefined"
            >{{ row.pagePath || NOT_KNOWN }}</span
          >
        </template>

        <!-- Where the event came from and who it is about, in that order. A
             failed or skipped event says why instead: its origin is the least
             interesting thing about it. -->
        <template #cell-summary="{ row }">
          <span
            v-if="row.error"
            class="text-sfere-xs font-medium text-sfere-danger"
            >{{ row.error }}</span
          >
          <span v-else class="flex flex-wrap items-center gap-1.5">
            <StatusBadge v-if="geoLabel(row)" tone="neutral">{{
              geoLabel(row)
            }}</StatusBadge>
            <StatusBadge v-if="row.host" tone="neutral">{{
              row.host
            }}</StatusBadge>
            <StatusBadge v-if="identityOf(row)" :tone="identityOf(row).tone">{{
              identityOf(row).label
            }}</StatusBadge>
          </span>
        </template>

        <!-- A plain button rather than SfereIconButton, for the reason
             RowActionsMenu carries no tooltip: SfereTable wraps the whole table
             in `overflow-x-auto`, which clips a SfereTooltip bubble. The
             `aria-label` names the row, since the glyph alone cannot. The whole
             row opens the same drawer, so this is a signpost to that rather
             than the only way in. -->
        <template #cell-actions="{ row }">
          <span class="flex justify-end">
            <button
              type="button"
              :aria-label="`View event ${typeLabel(row)}`"
              class="grid size-8 place-items-center rounded-sfere text-sfere-fg-muted transition-colors duration-150 hover:bg-sfere-fill hover:text-sfere-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sfere-500/60"
              @click.stop="openDrawer(row)"
            >
              <SfereIcon name="eye" />
            </button>
          </span>
        </template>
      </DataTable>

      <!-- The screen's only pagination. DataTable's own pager is deliberately
           set past any loaded set (`per-page` above: each fetch takes 100, so
           2000 is twenty clicks of this), because two pagination models on one
           table means a click here appends rows onto a page the reader is not
           looking at. The feed reads top to bottom; this reaches further back.
           DataTable's footer still answers "is this everything?". -->
      <div v-if="events.length" class="mt-4 grid place-items-center">
        <SfereButton
          variant="secondary"
          size="sm"
          :loading="loading"
          @click="loadPrevious"
        >
          Load previous events
        </SfereButton>
      </div>

      <LiveEventDrawer
        v-model="drawerOpen"
        :event="selected"
        :source-name="selectedSourceName"
      />
    </div>
  </q-page>
</template>

<script setup>
import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import DataTable from '@/components/ui/DataTable.vue'
import FormField from '@/components/ui/FormField.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereIcon from '@/components/ui/SfereIcon.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import SfereSelect from '@/components/ui/SfereSelect.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TabNav from '@/components/ui/TabNav.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import LiveEventDrawer from '@/components/live-events/LiveEventDrawer.vue'
import {
  formatUTC,
  geoLabel,
  identityOf,
  statusDotClass,
  typeLabel
} from '@/components/live-events/liveEventFormat.js'
import { useLiveEvents } from '@/composables/useLiveEvents'

// Reads GET /v1/accounts/{account}/events/live through the Sfere backend and
// nothing else. There is no vendor id, no ingest key and no proxy in this page
// any more — see the header comment in useLiveEvents.js.
//
// This route is in `legacyScreens`, so `pnpm smoke:dist` does not walk it: a
// console error here reaches a user before it reaches a gate. Hence every field
// read below is optional-chained or guarded, and the four states are DataTable's
// rather than hand-rolled.
const { events, streams, loading, error, apiMissing, load, loadStreams } =
  useLiveEvents()

const streamId = ref('')
const level = ref('all')
const startInput = ref('')
const endInput = ref('')
const searchInput = ref('')

// Both the tab bar and the Status select are bound to `level`. Same keys, same
// ref, so the two can never disagree.
const TABS = [
  { key: 'all', label: 'Events' },
  { key: 'error', label: 'Errors' }
]

const LEVEL_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Errors', value: 'error' }
]

const COLUMNS = [
  { key: 'status', label: 'Status', width: '84px' },
  { key: 'date', label: 'Date (UTC)', sortable: true, width: '190px' },
  { key: 'type', label: 'Type' },
  { key: 'pagePath', label: 'Page path' },
  { key: 'summary', label: 'Summary' },
  { key: 'actions', label: '', align: 'right', width: '72px' }
]

const sourceOptions = computed(() => {
  const opts = streams.value.map(s => ({ label: s.name || s.id, value: s.id }))
  // Keep whatever is selected addressable even before the stream list lands,
  // otherwise the select renders a blank while the two requests race.
  if (streamId.value && !opts.some(o => o.value === streamId.value)) {
    opts.unshift({ label: streamId.value, value: streamId.value })
  }
  return opts
})

const selectedSourceName = computed(() => {
  const id = selected.value?.streamId
  if (!id) return ''
  return streams.value.find(s => s.id === id)?.name || ''
})

const succeededCount = computed(
  () => events.value.filter(ev => ev.status === 'SUCCESS').length
)

const failedCount = computed(
  () =>
    events.value.filter(ev => ev.status === 'FAILED' || ev.status === 'SKIPPED')
      .length
)

const anyFilter = computed(() =>
  Boolean(
    level.value !== 'all' ||
    startInput.value ||
    endInput.value ||
    searchInput.value.trim()
  )
)

// Two empty states, because they need different answers: a filter that matched
// nothing is undone by widening it, an empty stream is not.
const emptyTitle = computed(() =>
  anyFilter.value ? 'No events match these filters' : 'No events yet'
)

const emptyDescription = computed(() =>
  anyFilter.value
    ? 'Widen the time range, clear the search, or switch back to the Events tab.'
    : 'Nothing has been received on this source yet. Events appear here within seconds of arriving.'
)

/** Counted rows, so a plain formatted integer. Never a stand-in for a gap. */
function formatCount(n) {
  return n.toLocaleString('en-GB')
}

// Treats the datetime-local input (which is timezone-naive) as UTC.
function parseUTCInput(value) {
  if (!value) return undefined
  const d = new Date(`${value}:00Z`)
  return Number.isNaN(d.getTime()) ? undefined : d
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
  if (Number.isNaN(before.getTime())) return
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
  if (!ev) return
  selected.value = ev
  drawerOpen.value = true
}

onMounted(async () => {
  // The stream list has to land first: `streamId` is a required query
  // parameter, so there is no sensible default to fire a request with. Sources
  // with no provisioned site are already left out of that list — they have no
  // event log, so offering one would select a stream that can only ever come
  // back empty.
  await loadStreams()
  if (!streamId.value) streamId.value = streams.value[0]?.id || ''
  await nextTick()
  ready = true
  refresh()
})
</script>
