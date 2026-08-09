<template>
  <div :class="rootClasses">
    <SfereIconChip v-if="$slots.icon" :on-dark="onDark" class="mb-4">
      <slot name="icon" />
    </SfereIconChip>

    <p :class="titleClasses">{{ title }}</p>
    <p v-if="description" :class="descriptionClasses">{{ description }}</p>

    <div v-if="$slots.cta" class="mt-5">
      <slot name="cta" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SfereIconChip from './SfereIconChip.vue'

// "Nothing here" is information, not failure — this surface stays calm and
// never borrows the danger colour.
//
// A list with no rows is in one of two situations and they need different copy:
// filters matched nothing ("No X match your search" → Clear filters) versus
// nothing exists yet ("No X yet" → the create action). Offering "create your
// first" to someone with forty records and a typo in the search box is the
// failure mode worth designing around.
const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  // `inline` drops the border so this can nest inside a card without reading
  // as a rendering bug (a bordered box inside a bordered box).
  variant: {
    type: String,
    default: 'card',
    validator: v => ['card', 'inline'].includes(v)
  },
  onDark: { type: Boolean, default: false }
})

const rootClasses = computed(() => [
  'flex flex-col items-center text-center',
  props.variant === 'card'
    ? [
        'rounded-sfere-xl border px-6 py-12',
        props.onDark
          ? 'border-sfere-hairline bg-sfere-ink-raised'
          : 'border-sfere-line bg-sfere-surface'
      ]
    : 'px-2 py-6'
])

const titleClasses = computed(() => [
  'text-sfere-sm font-semibold',
  props.onDark ? 'text-white' : 'text-sfere-fg'
])

const descriptionClasses = computed(() => [
  'mt-1 max-w-sm text-sfere-sm',
  props.onDark ? 'text-white/55' : 'text-sfere-fg-muted'
])
</script>
