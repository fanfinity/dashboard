<template>
  <CardPanel>
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div class="min-w-0">
        <p
          class="text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle"
          >Stage {{ stage.step }}</p
        >
        <h3
          class="mt-0.5 text-sm! font-semibold! tracking-[-0.35px]! text-ink"
          >{{ stage.title }}</h3
        >
      </div>
      <StatusBadge :variant="stage.statusVariant" :label="stage.statusLabel" />
    </div>

    <p class="mt-1.5 text-xs leading-5 text-muted">{{ stage.description }}</p>

    <dl class="mt-3 grid grid-cols-3 gap-3">
      <div v-for="tile in tiles" :key="tile.label">
        <dt class="text-[11px] text-subtle">{{ tile.label }}</dt>
        <dd class="mt-0.5 text-lg font-semibold tabular-nums text-ink">{{
          tile.value
        }}</dd>
      </div>
    </dl>

    <p
      class="mt-3 border-t border-line pt-2.5 text-xs leading-5"
      :class="stage.statusVariant === 'success' ? 'text-muted' : 'text-ink'"
      >{{ stage.note }}</p
    >
  </CardPanel>
</template>

<script setup>
import { computed } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

// One stage of the pipeline as a read-out rather than a table row: the three
// numbers an operator compares (depth, throughput, how far behind real time the
// oldest item sits) only mean anything next to each other, and the verdict
// sentence underneath is the thing most people actually read.
const props = defineProps({
  stage: { type: Object, required: true }
})

const tiles = computed(() => [
  { label: 'Waiting', value: props.stage.countLabel },
  { label: 'Processed / min', value: props.stage.processedLabel },
  { label: 'Oldest item', value: props.stage.waitingLabel }
])
</script>
