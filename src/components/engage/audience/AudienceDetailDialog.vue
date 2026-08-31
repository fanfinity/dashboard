<template>
  <q-dialog v-model="open">
    <CardPanel :padded="false" class="w-[600px] max-w-[92vw]">
      <template #header>
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-ink">{{
            audience?.name
          }}</p>
          <p class="truncate font-mono text-xs text-subtle">{{
            audience?.id
          }}</p>
        </div>
        <q-btn v-close-popup flat round dense icon="close" size="sm" />
      </template>

      <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
        <!-- A paused audience is a working screen reporting a real state, so it
             is a notice and carries no data-smoke hook. -->
        <NoticeBanner
          v-if="audience && !audience.isEnabled"
          tone="warn"
          class="mb-4"
          title="This audience is paused"
          message="Its membership is frozen at the last evaluation, and anything reading it keeps the profiles it had then."
        />

        <DefinitionList :items="facts" :columns="1">
          <template #value-status>
            <StatusBadge
              :tone="Boolean(audience?.isEnabled) ? 'success' : 'neutral'"
              :label="audience?.isEnabled ? 'Active' : 'Paused'"
            />
          </template>

          <template #value-membership>
            <div class="flex flex-wrap items-center justify-end gap-2">
              <span class="text-ink">{{
                formatCount(audience?.profileCount)
              }}</span>
              <span v-if="changeLabel" class="text-xs" :class="changeClass"
                >{{ changeArrow }} {{ changeLabel }} in 7 days</span
              >
            </div>
          </template>

          <template #value-conditions>
            <ul class="flex flex-col items-end gap-1">
              <li
                v-for="(line, i) in conditionLines"
                :key="i"
                class="text-right text-sm text-ink"
                >{{ line }}</li
              >
            </ul>
            <span v-if="!conditionLines.length" class="text-subtle">None</span>
          </template>

          <template #value-feeds>
            <div class="flex flex-wrap justify-end gap-1">
              <span
                v-for="s in syncs"
                :key="s.id"
                class="rounded bg-fill px-1.5 py-0.5 text-xs text-muted"
                >{{ s.profileDestinationName }}</span
              >
              <span v-if="!syncs.length" class="text-subtle">None</span>
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
import { NEVER } from '@/lib/emptyValue'
import { computed } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import {
  audienceTypeHint,
  audienceTypeLabel,
  conditionLabel
} from '@/composables/useEngageAudiences'
import {
  formatChange,
  formatCount,
  formatDateTime,
  pluralize,
  trendDirection
} from '@/composables/useEngageAudienceFormat'

// The read-out for one audience.
//
// `/audiences` has no detail route — the manifest ships a single list screen.
// An audience still carries more than a table row can hold (its whole condition set, which
// destinations it feeds, when it was last evaluated), so the row opens this
// instead. Same q-dialog-wrapping-CardPanel shape as the wave-2 sync dialogs.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // The row being inspected; null between openings.
  audience: { type: Object, default: null },
  // The attribute catalog, keyed by id. Empty when it failed to load, which
  // costs the conditions their proper names and nothing else.
  attributesById: { type: Object, default: () => ({}) },
  // Every live profile sync; the ones drawing from this audience are picked out
  // below rather than by the page, so the page hands over one flat list.
  liveSyncs: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

const conditionLines = computed(() =>
  (props.audience?.conditions ?? []).map(c =>
    conditionLabel(c, props.attributesById)
  )
)

const syncs = computed(() =>
  props.liveSyncs.filter(s => s.audienceId === props.audience?.id)
)

const changeLabel = computed(() =>
  formatChange(props.audience?.profileCountChange7d)
)

const CHANGE = {
  up: { arrow: '↑', cls: 'text-success' },
  down: { arrow: '↓', cls: 'text-rose-600' },
  flat: { arrow: '→', cls: 'text-muted' }
}

const change = computed(
  () => CHANGE[trendDirection(props.audience?.profileCountChange7d)]
)
const changeArrow = computed(() => change.value.arrow)
const changeClass = computed(() => change.value.cls)

const facts = computed(() => {
  const a = props.audience
  if (!a) return []
  return [
    { label: 'Description', value: a.description },
    { label: 'Status', value: a.isEnabled },
    {
      label: 'Evaluation',
      value: audienceTypeLabel(a.type),
      hint: audienceTypeHint(a.type)
    },
    { label: 'Membership', value: a.profileCount },
    // An audience with no conditions matches every resolved profile; say so
    // rather than leaving DefinitionList to render an em dash for a set that is
    // deliberately empty.
    {
      label: 'Conditions',
      value: conditionLines.value.length ? conditionLines.value : null,
      hint: conditionLines.value.length
        ? 'All conditions must match.'
        : 'No conditions. Every resolved profile is a member.'
    },
    {
      label: 'Feeds',
      value: syncs.value.length ? syncs.value : null,
      hint: syncs.value.length
        ? pluralize(syncs.value.length, 'live profile sync')
        : 'No live profile sync draws from this audience yet.'
    },
    { label: 'Attached goals', value: pluralize(a.goalCount ?? 0, 'goal') },
    {
      label: 'Last evaluated',
      value: formatDateTime(a.lastEvaluatedAt, NEVER)
    },
    { label: 'Created', value: formatDateTime(a.createdAt) },
    { label: 'Last updated', value: formatDateTime(a.updatedAt) },
    { label: 'Config version', value: `v${a.version}` }
  ]
})
</script>
