<template>
  <!-- Grid: a card-shaped block per tile, for a catalog. -->
  <div
    v-if="variant === 'grid'"
    class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    aria-hidden="true"
  >
    <div
      v-for="n in rows"
      :key="n"
      :class="[block, 'h-[74px] rounded-sfere-xl']"
    />
  </div>

  <!-- Form: label bar + control bar per field, at the kit's own control height. -->
  <div
    v-else-if="variant === 'form'"
    class="flex flex-col gap-4"
    aria-hidden="true"
  >
    <div v-for="n in rows" :key="n" class="flex flex-col gap-1.5">
      <div :class="[block, 'h-3 w-24 rounded-sfere-sm']" />
      <div :class="[block, 'h-10 rounded-sfere']" />
    </div>
  </div>

  <!-- Table: stacked full-width row bars inside the same bordered frame the
       real table lands in, so nothing shifts when the rows arrive. -->
  <div v-else :class="frameClasses" aria-hidden="true">
    <div class="flex flex-col gap-2.5 p-4">
      <div v-for="n in rows" :key="n" :class="[block, 'h-8 rounded-sfere']" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// Skeletons, not spinners, wherever the final shape is known — the placeholder
// doing a rough impression of the content is what stops the layout jumping when
// the data lands. SfereSkeleton is the generic text-block version; this is the
// three page shapes we actually build, so a screen says `variant="table"` and
// gets the right one instead of guessing at row counts and heights.
//
// `variant` and `rows` are carried over from the placeholder this replaced,
// including the `form` variant.
//
// Heights track the controls as they are NOW — 40px for a field (SfereInput),
// 32px + px-4 py-3 for a table row (SfereTable) — not the 36px controls this
// kit replaced. A skeleton drawn at the wrong height reads as a jump when the
// data lands, which is the one thing a skeleton exists to prevent.
const props = defineProps({
  variant: {
    type: String,
    default: 'table',
    validator: v => ['table', 'grid', 'form'].includes(v)
  },
  rows: { type: Number, default: 6 },
  onDark: { type: Boolean, default: false }
})

const block = computed(() => [
  'animate-pulse motion-reduce:animate-none',
  props.onDark ? 'bg-white/10' : 'bg-sfere-line'
])

const frameClasses = computed(() => [
  'overflow-hidden rounded-sfere-xl border',
  props.onDark
    ? 'border-sfere-hairline bg-sfere-ink-raised'
    : 'border-sfere-line bg-sfere-surface'
])
</script>
