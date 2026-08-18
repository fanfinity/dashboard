<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    class="shrink-0 animate-spin motion-reduce:animate-none"
    role="status"
    :aria-label="label"
  >
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="currentColor"
      stroke-opacity="0.25"
      stroke-width="3"
    />
    <path
      d="M21 12a9 9 0 0 0-9-9"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
    />
  </svg>
</template>

<script setup>
// Inline SVG rather than a border-spin div: the CSP forbids data: URIs, and a
// bordered pseudo-element can't inherit `currentColor` on every button variant.
defineProps({
  size: { type: [Number, String], default: 16 },
  label: { type: String, default: 'Loading' }
})
</script>
