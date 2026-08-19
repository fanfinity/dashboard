<template>
  <q-dialog v-model="open">
    <CardPanel :padded="false" class="w-[560px] max-w-[92vw]">
      <template #header>
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-ink">{{
            sync?.name
          }}</p>
          <p class="truncate font-mono text-xs text-subtle">{{ sync?.id }}</p>
        </div>
        <q-btn v-close-popup flat round dense icon="close" size="sm" />
      </template>

      <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
        <!-- A failed run is information about a working screen, so it is a
             notice and not an ErrorState — nothing here carries data-smoke. -->
        <NoticeBanner
          v-if="sync?.lastRunMessage"
          :tone="sync.lastRunStatus === 'failed' ? 'danger' : 'warn'"
          class="mb-4"
          :title="
            sync.lastRunStatus === 'failed'
              ? 'The last run did not finish'
              : 'The last run finished with warnings'
          "
          :message="sync.lastRunMessage"
        />

        <NoticeBanner
          v-if="connection && !isConnectionHealthy(connection)"
          tone="warn"
          class="mb-4"
          :title="`${connection.name} is not accepting connections`"
          :message="
            connection.lastError ||
            'Runs will keep failing until the warehouse connection is repaired.'
          "
        />

        <DefinitionList :items="facts" :columns="1">
          <template #value-status>
            <StatusBadge
              :tone="Boolean(sync?.isEnabled) ? 'success' : 'neutral'"
              :label="sync?.isEnabled ? 'Enabled' : 'Paused'"
            />
          </template>

          <template #value-direction="{ value }">
            <StatusBadge tone="neutral" :label="value" />
          </template>

          <template #value-reads-from="{ value }">
            <code class="font-mono text-xs text-ink">{{ value }}</code>
          </template>

          <template #value-writes-to="{ value }">
            <code class="font-mono text-xs text-ink">{{ value }}</code>
          </template>

          <template #value-last-run="{ value }">
            <div class="flex flex-wrap items-center justify-end gap-2">
              <StatusBadge :tone="lastRun.variant" :label="lastRun.label" />
              <span>{{ value }}</span>
            </div>
          </template>
        </DefinitionList>
      </div>

      <template #footer>
        <p class="text-xs text-subtle">Read-only — demo data.</p>
        <button
          v-close-popup
          class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
        >
          Close
        </button>
      </template>
    </CardPanel>
  </q-dialog>
</template>

<script setup>
import { computed } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import {
  directionDescription,
  directionLabel,
  formatCount,
  formatDateTime,
  formatDuration,
  isConnectionHealthy,
  runStatusMeta,
  syncScheduleLabel
} from '@/composables/useDwhSyncs'

// The read-out for one DWH sync.
//
// `/dwh-syncs` has no detail route — the manifest ships a list, a create form
// and a trash. A sync still carries more than a table row can hold (both ends of the copy, the
// cron behind the friendly label, the last run's message), so the row opens
// this instead. Same q-dialog-wrapping-CardPanel shape as the profile packet's
// dialog, so the two read as one product.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // The row being inspected; null between openings.
  sync: { type: Object, default: null },
  // The warehouse connection the sync points at, when it resolves. Passed in
  // rather than fetched here: primitives and dialogs stay dumb, and the list
  // has already loaded the connections for its own banner.
  connection: { type: Object, default: null }
})
const emit = defineEmits(['update:modelValue'])

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

const lastRun = computed(() => runStatusMeta(props.sync?.lastRunStatus))

const facts = computed(() => {
  const s = props.sync
  if (!s) return []
  return [
    { label: 'Status', value: s.isEnabled },
    {
      label: 'Direction',
      value: directionLabel(s.direction),
      hint: directionDescription(s.direction)
    },
    { label: 'Reads from', value: s.sourceTable },
    { label: 'Writes to', value: s.targetTable },
    { label: 'Warehouse', value: s.dwhConnectionName, hint: s.dwhConnectionId },
    {
      label: 'Schedule',
      value: syncScheduleLabel(s),
      hint: s.schedule
    },
    { label: 'Last run', value: formatDateTime(s.lastRunAt) },
    { label: 'Rows last run', value: formatCount(s.lastRunRowCount) },
    { label: 'Run duration', value: formatDuration(s.lastRunDurationMs) },
    { label: 'Next run', value: formatDateTime(s.nextRunAt) },
    { label: 'Created', value: formatDateTime(s.createdAt) },
    { label: 'Last updated', value: formatDateTime(s.updatedAt) },
    { label: 'Config version', value: `v${s.version}` }
  ]
})
</script>
