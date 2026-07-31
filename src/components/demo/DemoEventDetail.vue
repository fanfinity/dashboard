<template>
  <!-- `min-w-0` all the way down to the <pre>: the payload's longest line is
       this panel's min-content width, and without it Chrome refuses to shrink
       the card below that, which pushes the page into horizontal overflow. -->
  <CardPanel class="min-w-0">
    <template #header>
      <span class="text-sm font-semibold text-ink">Event detail</span>
      <StatusBadge
        v-if="event"
        :variant="event.origin === 'store' ? 'brand' : 'neutral'"
        :label="event.origin === 'store' ? 'Demo Store' : 'Replayed sample'"
      />
    </template>

    <!-- Nothing selected is not a failure and not an error: the inspector is
         working, it just has not been pointed at a row yet. -->
    <EmptyState
      v-if="!event"
      variant="inline"
      title="Select an event to inspect"
      description="Pick a row on the left to see its payload, the pipes it matched and where they delivered it."
    />

    <div v-else class="flex min-w-0 flex-col gap-4">
      <DefinitionList :items="facts" :columns="1">
        <template #value-event>
          <span class="font-mono text-xs text-ink">{{ event.eventName }}</span>
        </template>
        <template #value-source>
          <div class="text-right">
            <p class="text-sm text-ink">{{ event.sourceName }}</p>
            <p class="font-mono text-[11px] text-subtle">{{
              event.sourceId
            }}</p>
          </div>
        </template>
        <template #value-profile>
          <StatusBadge
            v-if="event.profileId"
            variant="success"
            :label="event.profileId"
          />
          <StatusBadge v-else variant="neutral" label="Anonymous" />
        </template>
      </DefinitionList>

      <div class="border-t border-line pt-4">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-medium text-subtle">Routing</p>
          <span class="text-[11px] text-subtle">{{ routingSummary }}</span>
        </div>

        <EmptyState
          v-if="!routes.length"
          variant="inline"
          title="No pipe matched this event"
          :description="`Nothing is listening to ${event.sourceName}, so this event would be collected and stored but not routed anywhere.`"
        />

        <ul v-else class="mt-2 flex flex-col divide-y divide-line">
          <li
            v-for="route in routes"
            :key="route.id"
            class="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
          >
            <div class="min-w-0">
              <p class="truncate text-sm text-ink">{{ route.name }}</p>
              <p class="truncate text-xs text-subtle"
                >→ {{ route.destinationName }}</p
              >
              <p v-if="route.reason" class="truncate text-[11px] text-subtle">{{
                route.reason
              }}</p>
            </div>
            <StatusBadge
              :variant="route.delivered ? 'success' : 'warn'"
              :label="route.status"
            />
          </li>
        </ul>
      </div>

      <div class="min-w-0 border-t border-line pt-4">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-medium text-subtle">Raw payload</p>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click="emit('copy', { label: 'Payload', value: rawPayload })"
          >
            Copy JSON
          </button>
        </div>
        <!-- `whitespace-pre-wrap break-all` rather than the horizontal scroll
             SourceIngestPanel uses: this panel is a ~370px sidebar column, and
             an unwrapped <pre> makes its longest JSON line the column's
             min-content width, which widens the whole page. Wrapping also beats
             scrolling for reading a payload in a narrow column. -->
        <pre
          class="mt-2 max-h-[420px] overflow-y-auto whitespace-pre-wrap break-all rounded-lg border border-line2 bg-sidebar p-3 font-mono text-xs leading-5 text-muted"
          >{{ rawPayload }}</pre
        >
      </div>
    </div>
  </CardPanel>
</template>

<script setup>
import { computed } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { formatEventDateTime } from '@/composables/useDemoEvents'

// The inspector's read-out for one captured event: parsed fields, the pipes it
// matched, and the body itself.
//
// It owns no data and no clipboard call — `copy` goes up to the page, which is
// where the toast lives. `routes` is handed in already resolved; the page owns
// the loading and failure states for the pipes behind it.
const props = defineProps({
  event: { type: Object, default: null },
  routes: { type: Array, default: () => [] }
})
const emit = defineEmits(['copy'])

const CALL_TYPE_LABELS = {
  page: 'page',
  track: 'track',
  identify: 'identify'
}

const facts = computed(() => {
  const e = props.event
  if (!e) return []
  return [
    { label: 'Event', value: e.eventName },
    { label: 'Call type', value: CALL_TYPE_LABELS[e.callType] ?? e.callType },
    { label: 'Source', value: e.sourceName },
    { label: 'Profile', value: e.profileId },
    { label: 'Anonymous ID', value: e.payload.anonymousId },
    { label: 'Received', value: formatEventDateTime(e.occurredAt) },
    { label: 'Message ID', value: e.id },
    // Only a replay carries this; DefinitionList renders an em dash otherwise,
    // so the row is dropped rather than left blank.
    ...(e.replayOf ? [{ label: 'Replay of', value: e.replayOf }] : [])
  ]
})

const routingSummary = computed(() => {
  const delivered = props.routes.filter(r => r.delivered).length
  return `${props.routes.length} matched · ${delivered} delivered`
})

const rawPayload = computed(() =>
  props.event ? JSON.stringify(props.event.payload, null, 2) : ''
)
</script>
