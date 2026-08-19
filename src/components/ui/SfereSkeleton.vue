<template>
  <div class="flex flex-col gap-2.5" aria-hidden="true">
    <div
      v-for="n in Number(rows)"
      :key="n"
      :class="barClasses"
      :style="{ width: widthFor(n) }"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'

// Skeletons, not spinners, wherever the final shape is known — the placeholder
// doing a rough impression of the content stops the layout jumping when data
// lands.
//
// The last bar is short on purpose: uniform full-width bars read as a striped
// pattern, whereas a ragged final line reads as text.
const props = defineProps({
  rows: { type: [Number, String], default: 4 },
  onDark: { type: Boolean, default: false }
})

const barClasses = computed(() => [
  'h-4 rounded-sfere animate-pulse motion-reduce:animate-none',
  props.onDark ? 'bg-white/10' : 'bg-sfere-line'
])

function widthFor(n) {
  return n === Number(props.rows) ? '58%' : '100%'
}
</script>
