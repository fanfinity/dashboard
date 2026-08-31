<template>
  <q-dialog v-model="open">
    <CardPanel :padded="false" class="w-[600px] max-w-[92vw]">
      <template #header>
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-ink">{{
            goal?.name
          }}</p>
          <p class="truncate font-mono text-xs text-subtle">{{ goal?.id }}</p>
        </div>
        <q-btn v-close-popup flat round dense icon="close" size="sm" />
      </template>

      <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
        <NoticeBanner
          v-if="goal && !goal.isEnabled"
          tone="warn"
          class="mb-4"
          title="This goal is paused"
          message="It is no longer being measured, and journeys attached to it are not optimising against it."
        />

        <GoalProgressBar :goal="goal" class="mb-4" />

        <DefinitionList :items="facts" :columns="1">
          <template #value-status>
            <StatusBadge :tone="status.variant" :label="status.label" />
          </template>

          <template #value-measured>
            <StatusBadge tone="neutral" :label="metricLabel(goal?.metric)" />
          </template>

          <template #value-attached-journeys>
            <div class="flex flex-wrap justify-end gap-1">
              <span
                v-for="j in journeys"
                :key="j.id"
                class="rounded bg-fill px-1.5 py-0.5 text-xs text-muted"
                >{{ j.name }}</span
              >
              <span v-if="!journeys.length" class="text-subtle">None</span>
            </div>
          </template>
        </DefinitionList>
      </div>

      <template #footer>
        <p class="text-xs text-subtle">Read-only demo data.</p>
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
import GoalProgressBar from '@/components/engage/audience/GoalProgressBar.vue'
import {
  goalStatusMeta,
  metricHint,
  metricLabel
} from '@/composables/useEngageAudienceGoals'
import {
  formatAmount,
  formatDateTime,
  formatPercent,
  pluralize
} from '@/composables/useEngageAudienceFormat'

// The read-out for one goal.
//
// `/goals` has no detail route in the manifest, so the row opens this rather
// than navigating. The journeys attached to the goal are the piece a table row
// cannot carry: `attachmentCount` is a number, and the names are what tells you
// whether pausing this goal matters.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // The row being inspected; null between openings.
  goal: { type: Object, default: null },
  // Every journey; the ones pointing at this goal are picked out below, so the
  // page hands over one flat list. Empty when the catalog failed to load.
  allJourneys: { type: Array, default: () => [] },
  // The attribute this goal is measured over, when the catalog resolved it.
  attribute: { type: Object, default: null }
})
const emit = defineEmits(['update:modelValue'])

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

const status = computed(() => goalStatusMeta(props.goal?.status))

const journeys = computed(() =>
  props.allJourneys.filter(j => j.goalId === props.goal?.id)
)

const ATTRIBUTE_KIND = {
  realtime: 'Real-time attribute',
  warehouse: 'Warehouse attribute'
}

const attributeHint = computed(() => {
  const g = props.goal
  if (!g?.attributeId) {
    return 'Not bound to an attribute. This goal is tracked manually.'
  }
  const kind = ATTRIBUTE_KIND[props.attribute?.type]
  return kind ? `${kind} · ${g.attributeId}` : g.attributeId
})

const facts = computed(() => {
  const g = props.goal
  if (!g) return []
  return [
    { label: 'Description', value: g.description },
    { label: 'Status', value: g.status },
    {
      label: 'Enabled',
      value: g.isEnabled ? 'Yes, measured continuously' : 'No, paused'
    },
    { label: 'Measured', value: g.metric, hint: metricHint(g.metric) },
    { label: 'Attribute', value: g.attributeName, hint: attributeHint.value },
    { label: 'Target', value: formatAmount(g.targetValue, g.unit) },
    { label: 'Current', value: formatAmount(g.currentValue, g.unit) },
    {
      label: 'Progress',
      value: formatPercent(g.progress),
      hint:
        Number(g.progress) >= 1 ? 'Target met for this window.' : 'Of target.'
    },
    {
      label: 'Window',
      value: pluralize(g.windowDays ?? 0, 'day'),
      hint: 'Rolling. The measurement only counts activity inside it.'
    },
    {
      label: 'Attached journeys',
      value: journeys.value.length ? journeys.value : null,
      hint:
        journeys.value.length || !g.attachmentCount
          ? ''
          : `${g.attachmentCount} attached. Names unavailable.`
    },
    { label: 'Created', value: formatDateTime(g.createdAt) },
    { label: 'Last updated', value: formatDateTime(g.updatedAt) },
    { label: 'Config version', value: `v${g.version}` }
  ]
})
</script>
