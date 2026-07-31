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
          variant="danger"
          class="mb-4"
          title="The last run did not finish"
          :message="sync.lastRunMessage"
        />

        <DefinitionList :items="facts" :columns="1">
          <template #value-status>
            <StatusBadge
              :enabled="Boolean(sync?.isEnabled)"
              :label="sync?.isEnabled ? 'Enabled' : 'Paused'"
            />
          </template>

          <template #value-target-table="{ value }">
            <code class="font-mono text-xs text-ink">{{ value }}</code>
          </template>

          <template #value-last-run="{ value }">
            <div class="flex flex-wrap items-center justify-end gap-2">
              <StatusBadge :variant="lastRun.variant" :label="lastRun.label" />
              <span>{{ value }}</span>
            </div>
          </template>

          <template #value-attributes>
            <div class="flex flex-wrap justify-end gap-1">
              <code
                v-for="a in attributeColumns"
                :key="a"
                class="rounded bg-fill px-1.5 py-0.5 font-mono text-xs text-muted"
                >{{ a }}</code
              >
              <span v-if="!attributeColumns.length" class="text-subtle">—</span>
            </div>
          </template>

          <template #value-identifier-columns>
            <div class="flex flex-wrap justify-end gap-1">
              <code
                v-for="i in identifierColumns"
                :key="i"
                class="rounded bg-fill px-1.5 py-0.5 font-mono text-xs text-muted"
                >{{ i }}</code
              >
              <span v-if="!identifierColumns.length" class="text-subtle"
                >—</span
              >
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
  columnName,
  formatCount,
  formatDateTime,
  formatDuration,
  runStatusMeta,
  scheduleLabel,
  writeModeLabel
} from '@/composables/useProfileDwhSyncs'

// The read-out for one sync.
//
// `/profile-dwh-syncs` has no detail route — the manifest ships a list, a create
// form and a trash, and adding a fourth route would mean editing frozen router
// files. A sync still carries more than a table row can hold (the whole column
// map, the last run's message, the cron behind the friendly label), so the row
// opens this instead. It is a q-dialog wrapping CardPanel rather than a bespoke
// surface, so it is the same white card as everywhere else.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // The row being inspected; null between openings.
  sync: { type: Object, default: null }
})
const emit = defineEmits(['update:modelValue'])

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

// The catalogs are not loaded here: the ids stored on a sync already *are* the
// warehouse column names (`season_ticket_tier`), and an identifier type's is its
// id minus the `idt_` prefix. Deriving them beats loading two more files to
// render a chip, and it cannot go stale.
const attributeColumns = computed(() =>
  (props.sync?.attributes ?? []).map(columnName)
)

const identifierColumns = computed(() =>
  (props.sync?.identifierTypes ?? []).map(id =>
    columnName(String(id).replace(/^idt_/, ''))
  )
)

const lastRun = computed(() => runStatusMeta(props.sync?.lastRunStatus))

const WRITE_MODE_HINTS = {
  upsert: 'Existing rows are matched on the identifier columns and updated.',
  append: 'Every run adds rows; the table keeps the full history.',
  replace: 'The target table is truncated before each run.'
}

const facts = computed(() => {
  const s = props.sync
  if (!s) return []
  return [
    { label: 'Status', value: s.isEnabled },
    { label: 'Warehouse', value: s.dwhConnectionName, hint: s.dwhConnectionId },
    { label: 'Target table', value: s.targetTable },
    {
      label: 'Write mode',
      value: writeModeLabel(s.writeMode),
      hint: WRITE_MODE_HINTS[s.writeMode] ?? ''
    },
    { label: 'Schedule', value: scheduleLabel(s.schedule), hint: s.schedule },
    { label: 'Attributes', value: s.attributes },
    { label: 'Identifier columns', value: s.identifierTypes },
    { label: 'Last run', value: formatDateTime(s.lastRunAt) },
    { label: 'Profiles written', value: formatCount(s.lastRunProfileCount) },
    { label: 'Run duration', value: formatDuration(s.lastRunDurationMs) },
    { label: 'Next run', value: formatDateTime(s.nextRunAt) },
    { label: 'Created', value: formatDateTime(s.createdAt) },
    { label: 'Last updated', value: formatDateTime(s.updatedAt) },
    { label: 'Config version', value: `v${s.version}` }
  ]
})
</script>
