<template>
  <!-- `sfere-flush` and grid `gap`, not `mt-*`: every <p> in this repo carries
       Quasar's unlayered `margin: 0 0 16px`, so a layered `mt-1` on one of these
       computes to `margin-top: 0` and the card would render on a flat 16px
       rhythm ignoring every value written here. CLAUDE.md collision #5. -->
  <div :class="rootClasses">
    <SfereIconChip class="justify-self-center">
      <FlowNodeIcon kind="destination" :subtype="subtype" :size="22" />
    </SfereIconChip>

    <p class="font-sfere-display text-sfere-sm font-semibold text-sfere-fg">{{
      title
    }}</p>
    <p v-if="subtitle" class="text-sfere-xs text-sfere-fg-muted">{{
      subtitle
    }}</p>

    <StatusBadge
      v-if="badge"
      class="justify-self-center"
      :tone="badgeTone"
      dot
      :label="badge"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SfereIconChip from '@/components/ui/SfereIconChip.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import FlowNodeIcon from '@/components/flow/FlowNodeIcon.vue'

// The small figure an IntroBand carries in its `#aside` slot on the two
// Destinations screens: a mark, what the destination is, and one badge.
//
// A component rather than markup on each page because the list's "Sfere Data
// Warehouse / Powered by ClickHouse / Included with Sfere" card and the detail
// hero's "ClickHouse / Managed by Sfere" card are the same object drawn twice,
// and a band's aside is exactly the place two screens drift apart.
//
// It states nothing of its own: every string is a prop, so a caller can only
// print what it can derive from the record.
const props = defineProps({
  // A `destination_type` (`clickhouse`, `webhook`, ...). Unknown strings fall
  // through to FlowNodeIcon's warehouse mark rather than throwing.
  subtype: { type: String, default: '' },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  badge: { type: String, default: '' },
  badgeTone: { type: String, default: 'brand' }
})

// `w-full` below `lg`, where IntroBand stacks its aside under the copy; a fixed
// measure above it, or the figure wins the width from the sentence it
// illustrates.
const rootClasses = computed(() => [
  'sfere-flush grid gap-2 rounded-sfere-lg border p-4 text-center',
  'w-full lg:w-60',
  props.badgeTone === 'brand'
    ? 'border-sfere-200 bg-sfere-surface'
    : 'border-sfere-line bg-sfere-surface'
])
</script>
