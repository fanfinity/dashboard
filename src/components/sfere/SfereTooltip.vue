<template>
  <span class="group/tip relative inline-flex">
    <slot />

    <span :class="bubbleClasses" role="tooltip">
      {{ text }}
    </span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

// CSS-only: shown on hover and on keyboard focus inside the wrapper, so it is
// reachable without a pointer. There is no positioning engine here, which is
// the deliberate trade — it will clip inside an `overflow: hidden` ancestor.
//
// A tooltip is never the only place information lives. If the label matters,
// put it on the page; if it is a name for an icon-only button, that button
// still needs its own aria-label.
const props = defineProps({
  text: { type: String, required: true },
  placement: {
    type: String,
    default: 'top',
    validator: v => ['top', 'bottom'].includes(v)
  }
})

const PLACEMENT = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2'
}

const bubbleClasses = computed(() => [
  'pointer-events-none absolute z-50 whitespace-nowrap rounded-sfere px-2.5 py-1.5',
  'bg-sfere-ink text-sfere-xs text-white shadow-sfere-ink',
  'opacity-0 transition-opacity duration-150 ease-sfere-ui',
  'group-hover/tip:opacity-100 group-focus-within/tip:opacity-100',
  'motion-reduce:transition-none',
  PLACEMENT[props.placement]
])
</script>
