<template>
  <img :src="src" :alt="alt" :class="classes" :width="width" :height="height" />
</template>

<script setup>
import { computed } from 'vue'

// Two lockups and a mark, served as real files from public/brand/ — the app's
// CSP is `default-src 'self'` with no `data:`, and `assetsInlineLimit` is
// forced to 0 for exactly that reason, so an inlined SVG would be blocked.
//
// The wordmark ink flips, the sphere never does: the purple works on both
// canvases and re-colouring it is the one thing that breaks the identity.
const props = defineProps({
  variant: {
    type: String,
    default: 'lockup',
    validator: v => ['lockup', 'mark'].includes(v)
  },
  onDark: { type: Boolean, default: false },
  // Rendered height in px; width follows the intrinsic ratio.
  height: { type: [Number, String], default: 28 },
  alt: { type: String, default: 'Sfere' }
})

const RATIO = { lockup: 190 / 38, mark: 42 / 38 }

const src = computed(() => {
  const base = import.meta.env.BASE_URL
  if (props.variant === 'mark') return `${base}brand/sfere-mark.svg`
  return props.onDark
    ? `${base}brand/sfere-logo-on-dark.svg`
    : `${base}brand/sfere-logo.svg`
})

const width = computed(() =>
  Math.round(Number(props.height) * RATIO[props.variant])
)

const classes = computed(() => ['w-auto', 'select-none'])
</script>
