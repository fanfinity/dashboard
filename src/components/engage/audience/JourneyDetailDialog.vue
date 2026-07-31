<template>
  <q-dialog v-model="open">
    <CardPanel :padded="false" class="w-[600px] max-w-[92vw]">
      <template #header>
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-ink">{{
            journey?.name
          }}</p>
          <p class="truncate font-mono text-xs text-subtle">{{
            journey?.id
          }}</p>
        </div>
        <q-btn v-close-popup flat round dense icon="close" size="sm" />
      </template>

      <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
        <NoticeBanner
          v-if="notice"
          :variant="notice.variant"
          class="mb-4"
          :title="notice.title"
          :message="notice.message"
        />

        <!-- How the fans who ever entered are split right now. A stacked bar
             says it in one line where four numbers in a list do not; there is
             no meter primitive, so it is composed here. -->
        <div v-if="progress.enrolled" class="mb-4">
          <div class="flex h-2 w-full overflow-hidden rounded-full bg-fill">
            <div
              class="h-full bg-brand"
              :style="{ width: percent(progress.activeShare) }"
            />
            <div
              class="h-full bg-success"
              :style="{ width: percent(progress.completedShare) }"
            />
            <div
              class="h-full bg-line2"
              :style="{ width: percent(progress.exitedShare) }"
            />
          </div>
          <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span class="flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-brand" aria-hidden="true" />
              {{ formatCount(progress.active) }} in progress
            </span>
            <span class="flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-success" aria-hidden="true" />
              {{ formatCount(progress.completed) }} completed
            </span>
            <span class="flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-line2" aria-hidden="true" />
              {{ formatCount(progress.exited) }} exited early
            </span>
          </div>
        </div>

        <DefinitionList :items="facts" :columns="1">
          <template #value-status>
            <StatusBadge :variant="status.variant" :label="status.label" />
          </template>

          <template #value-goal="{ value }">
            <span v-if="value" class="text-ink">{{ value }}</span>
            <span v-else class="text-subtle">No goal attached</span>
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
  journeyProgress,
  journeyStatusMeta
} from '@/composables/useEngageAudienceJourneys'
import {
  formatCount,
  formatDateTime,
  formatPercent,
  pluralize
} from '@/composables/useEngageAudienceFormat'

// The read-out for one journey.
//
// `/journeys` has no detail route in the manifest, so the row opens this rather
// than navigating. The step *contents* are not in the mock data — a journey
// carries only how many steps it has — so this deliberately does not draw a
// flow diagram it would have to invent.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // The row being inspected; null between openings.
  journey: { type: Object, default: null },
  // Resolved from the goal catalog by the page; empty when the journey has no
  // goal or the catalog failed to load.
  goalName: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

const status = computed(() => journeyStatusMeta(props.journey?.status))

const progress = computed(() => journeyProgress(props.journey))

function percent(share) {
  return formatPercent(share)
}

// Draft and paused are states worth explaining; live and archived speak for
// themselves. None of these is a failure, so none of them is an ErrorState.
const NOTICES = {
  draft: {
    variant: 'info',
    title: 'This journey has never run',
    message:
      'Nobody is enrolled. Launching it enters everyone currently in the entry audience.'
  },
  paused: {
    variant: 'warn',
    title: 'This journey is paused',
    message:
      'Nobody new enters, and fans mid-journey stay where they are until it resumes.'
  }
}

const notice = computed(() => NOTICES[props.journey?.status] ?? null)

const facts = computed(() => {
  const j = props.journey
  if (!j) return []
  return [
    { label: 'Description', value: j.description },
    { label: 'Status', value: j.status },
    {
      label: 'Entry audience',
      value: j.entryAudienceName,
      hint: j.entryAudienceId
    },
    {
      label: 'Goal',
      value: props.goalName,
      hint: props.goalName ? 'What this journey optimises for.' : ''
    },
    {
      label: 'Steps',
      value: pluralize(j.stepCount ?? 0, 'step'),
      hint: 'Waits, branches and sends, in order.'
    },
    { label: 'Fans enrolled', value: formatCount(j.enrolledCount) },
    { label: 'In progress', value: formatCount(j.activeCount) },
    {
      label: 'Completed',
      value: formatCount(j.completedCount),
      hint: j.enrolledCount
        ? `${formatPercent(progress.value.completedShare)} of everyone enrolled`
        : ''
    },
    {
      label: 'Exited early',
      value: formatCount(j.exitedCount),
      hint: 'Left the entry audience, or a branch sent them out.'
    },
    { label: 'Launched', value: formatDateTime(j.launchedAt) },
    // Only ever set on a journey that reached that state — a row of em dashes
    // for the states it never entered is noise, not information.
    ...(j.pausedAt
      ? [{ label: 'Paused', value: formatDateTime(j.pausedAt) }]
      : []),
    ...(j.archivedAt
      ? [{ label: 'Archived', value: formatDateTime(j.archivedAt) }]
      : []),
    { label: 'Created', value: formatDateTime(j.createdAt) },
    { label: 'Last updated', value: formatDateTime(j.updatedAt) },
    { label: 'Config version', value: `v${j.version}` }
  ]
})
</script>
