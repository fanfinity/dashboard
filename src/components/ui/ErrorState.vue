<template>
  <div
    data-smoke="error"
    class="flex flex-col items-start gap-3 rounded-xl border border-line2 bg-white p-6"
  >
    <p class="text-sm text-ink">{{ title }}</p>
    <p v-if="message" class="text-xs text-muted">{{ message }}</p>
    <button
      class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
      @click="emit('retry')"
    >
      Retry
    </button>
  </div>
</template>

<script setup>
// The single failure surface for the whole app. `data-smoke="error"` on the root
// is the one selector scripts/smoke.mjs looks for on every route — if a screen
// renders this, the screen is broken. Never put that attribute anywhere else,
// and never render a bespoke error card instead of this component.
// Classes lifted verbatim from ConnectorsPage's error card + Retry button.
defineProps({
  title: { type: String, default: 'Something went wrong' },
  message: { type: String, default: '' }
})
const emit = defineEmits(['retry'])
</script>
