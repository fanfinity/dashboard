<template>
  <CardPanel :padded="false">
    <template #header>
      <div class="min-w-0 flex-1">
        <span class="text-sm font-medium text-ink">{{ headerTitle }}</span>
        <p class="mt-0.5! text-xs text-subtle">{{ headerHint }}</p>
      </div>
    </template>

    <div class="p-4">
      <!-- Demo mode, or an account with no ClickHouse behind the source: the
           events endpoint is the only real reader here, so there is nothing to
           stand in for it. -->
      <p v-if="!apiAvailable" class="text-sm text-muted">
        Recent events are read from the backend, so this list is empty in Demo
        data mode. Switch to real data in Settings to see what is arriving.
      </p>

      <LoadingState v-else-if="loading" variant="table" :rows="4" />

      <ErrorState
        v-else-if="error"
        title="Couldn't load recent events."
        :message="error"
        @retry="reload"
      />

      <EmptyState
        v-else-if="!events.length"
        variant="inline"
        title="No events in the recent window"
        :description="`Nothing has arrived at ${sourceName || 'this source'} lately, so this pipe has had nothing to carry.`"
      />

      <ul v-else class="grid gap-2">
        <li
          v-for="(event, index) in events"
          :key="`${event.timestamp}-${index}`"
          class="flex flex-nowrap items-center gap-3 rounded-sfere-lg border border-sfere-line bg-sfere-fill px-3 py-2"
        >
          <span
            class="shrink-0 font-sfere-mono text-sfere-xs text-sfere-fg-muted"
            >{{ formatDateTime(event.timestamp) }}</span
          >
          <span class="min-w-0 flex-1 truncate text-sfere-sm text-sfere-fg">{{
            event.eventName || NOT_KNOWN
          }}</span>
          <StatusBadge
            v-if="event.eventType"
            tone="neutral"
            :label="event.eventType"
          />
        </li>
      </ul>
    </div>
  </CardPanel>
</template>

<script setup>
import { onMounted } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { NOT_KNOWN } from '@/lib/emptyValue'
import { formatDateTime } from '@/composables/usePipes'
import { useSourceDataAPI } from '@/composables/useSourceDataAPI'

// What has recently arrived at the pipe's SOURCE — and the header says so
// rather than saying "recent activity", because it is not a record of this
// pipe's deliveries. `GET …/sources/{id}/events` is the only real per-record
// event read the backend offers; there is no per-pipeline equivalent, and the
// diagram's `events_in_window` is a literal zero until ClickHouse is behind it.
// Two pipes reading one source therefore show the same list, which is true and
// is why the source is named in the header.
//
// MOUNTED IS THE LOAD, which makes the read lazy: the page only renders this
// component while its tab is open, so an account whose source has no ClickHouse
// database behind it never issues the request from the default tab.
const props = defineProps({
  sourceId: { type: String, default: '' },
  sourceName: { type: String, default: '' },
  // `useDataSource().isReal` — this panel has no fixture to fall back on.
  apiAvailable: { type: Boolean, default: false }
})

const {
  events,
  eventsLoading: loading,
  eventsError: error,
  listSourceEvents
} = useSourceDataAPI()

const headerTitle = 'Recent events at the source'

const headerHint = props.sourceName
  ? `Arriving at ${props.sourceName}, shared by every pipe that reads from it. Deliveries through this pipe are not counted yet.`
  : 'Deliveries through this pipe are not counted yet.'

function reload() {
  if (!props.apiAvailable || !props.sourceId) return
  listSourceEvents(props.sourceId, { page: 1, size: 20 })
}

onMounted(reload)
</script>
