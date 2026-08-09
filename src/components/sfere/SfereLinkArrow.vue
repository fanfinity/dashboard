<template>
  <component :is="tag" v-bind="linkAttrs" :class="classes">
    <slot>{{ label }}</slot>
    <svg
      class="size-3 shrink-0 transition-transform duration-200 ease-sfere-ui group-hover/arrow:translate-x-0.5"
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        d="m221.66 133.66l-72 72a8 8 0 0 1-11.32-11.32L196.69 136H40a8 8 0 0 1 0-16h156.69l-58.35-58.34a8 8 0 0 1 11.32-11.32l72 72a8 8 0 0 1 0 11.32"
      />
    </svg>
  </component>
</template>

<script setup>
import { computed } from 'vue'

// The tertiary action: brand-coloured text with an arrow that nudges right on
// hover. On the site the gap itself animates; here the arrow translates
// instead, which reads the same and doesn't reflow the label.
const props = defineProps({
  label: { type: String, default: '' },
  to: { type: [String, Object], default: null },
  href: { type: String, default: '' },
  onDark: { type: Boolean, default: false }
})

const tag = computed(() => {
  if (props.to) return 'router-link'
  if (props.href) return 'a'
  return 'span'
})

const linkAttrs = computed(() => {
  if (tag.value === 'router-link') return { to: props.to }
  if (tag.value === 'a') return { href: props.href }
  return {}
})

const classes = computed(() => [
  'group/arrow inline-flex items-center gap-1.5 text-sfere-sm font-semibold',
  'rounded-sfere transition duration-200 ease-sfere-ui',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sfere-500/60 focus-visible:ring-offset-2',
  props.onDark
    ? 'text-sfere-300 hover:text-white focus-visible:ring-offset-transparent'
    : 'text-sfere-brand-text hover:text-sfere-900'
])
</script>
