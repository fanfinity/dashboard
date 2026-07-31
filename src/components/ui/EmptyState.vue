<template>
  <div data-smoke="empty" :class="rootClass">
    <img v-if="icon" :src="icon" alt="" :class="iconClass" />
    <p :class="titleClass">{{ title }}</p>
    <p v-if="description" :class="descriptionClass">{{ description }}</p>
    <div v-if="$slots.cta" :class="inline ? 'mt-1.5' : 'mt-2'">
      <slot name="cta" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// "Nothing here yet" panel. Carries data-smoke="empty" — in BOTH variants — so
// scripts/smoke.mjs can tell an intentionally-empty screen apart from a broken
// one.
//
//   card    (default) the full bordered surface. Unchanged from Phase 0.
//   inline  a compact centred hint with no border and no background, for a
//           nested slot. PipelineFlowPanel's per-column empty and ActivityList's
//           empty both hand-rolled `py-2 text-sm text-subtle` rather than nest a
//           bordered card inside an already-bordered CardPanel; `inline` is that
//           hint, and it keeps the smoke hook those hand-rolled versions lost.
const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: '' },
  variant: {
    type: String,
    default: 'card',
    validator: v => ['card', 'inline'].includes(v)
  }
})

const inline = computed(() => props.variant === 'inline')

const rootClass = computed(() =>
  inline.value
    ? 'flex flex-col items-center gap-1 px-4 py-6 text-center'
    : 'flex flex-col items-center gap-2 rounded-xl border border-line2 bg-white px-6 py-12 text-center'
)

const iconClass = computed(() =>
  inline.value ? 'size-5 opacity-40' : 'mb-1 size-8 opacity-40'
)

const titleClass = computed(() =>
  inline.value ? 'text-sm text-subtle' : 'text-sm font-medium text-ink'
)

const descriptionClass = computed(() =>
  inline.value ? 'max-w-md text-xs text-subtle' : 'max-w-md text-sm text-muted'
)
</script>
