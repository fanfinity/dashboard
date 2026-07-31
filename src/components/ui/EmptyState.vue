<template>
  <div
    data-smoke="empty"
    class="flex flex-col items-center gap-2 rounded-xl border border-line2 bg-white px-6 py-12 text-center"
  >
    <img v-if="icon" :src="icon" alt="" class="mb-1 size-8 opacity-40" />
    <p class="text-sm font-medium text-ink">{{ title }}</p>
    <p v-if="description" class="max-w-md text-sm text-muted">{{
      description
    }}</p>
    <div v-if="$slots.cta" class="mt-2">
      <slot name="cta" />
    </div>
  </div>
</template>

<script setup>
// "Nothing here yet" panel. Carries data-smoke="empty" so scripts/smoke.mjs can
// tell an intentionally-empty screen apart from a broken one.
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: '' }
})
</script>
