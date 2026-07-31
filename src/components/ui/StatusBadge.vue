<template>
  <span
    :class="badgeClass"
    class="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium"
  >
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup>
import { computed } from 'vue'

// Status pill. The base classes and the success/warn/neutral/brand palettes are
// lifted verbatim from ContactsPage's STATUS lookup (Verified / Pending /
// Lapsed) and its CDP chip. `danger` is the only composed entry — it follows the
// exact amber pattern one hue over (rose-200 / rose-50 / rose-600), matching the
// text-rose-500 already used for error copy in ContactsPage.
const props = defineProps({
  variant: {
    type: String,
    default: '',
    validator: v =>
      v === '' || ['success', 'warn', 'neutral', 'danger', 'brand'].includes(v)
  },
  // Convenience for on/off columns: true -> success, false -> neutral.
  // Ignored when `variant` is set explicitly.
  enabled: { type: Boolean, default: undefined },
  label: { type: String, default: '' }
})

const VARIANTS = {
  success: 'border-success-line bg-success-bg text-success',
  warn: 'border-amber-200 bg-amber-50 text-amber-600',
  neutral: 'border-line2 bg-fill text-subtle',
  danger: 'border-rose-200 bg-rose-50 text-rose-600',
  brand: 'border-brand/30 bg-brand/5 text-brand'
}

const badgeClass = computed(() => {
  if (props.variant) return VARIANTS[props.variant] ?? VARIANTS.neutral
  if (props.enabled !== undefined) {
    return props.enabled ? VARIANTS.success : VARIANTS.neutral
  }
  return VARIANTS.neutral
})
</script>
