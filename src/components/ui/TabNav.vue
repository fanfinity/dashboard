<template>
  <div class="mb-4 flex flex-wrap items-center gap-1 border-b border-line">
    <button
      v-for="t in tabs"
      :key="t.key"
      class="-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm"
      :class="
        modelValue === t.key
          ? 'border-brand font-medium text-brand'
          : 'border-transparent text-muted hover:text-ink'
      "
      @click="emit('update:modelValue', t.key)"
    >
      {{ t.label }}
      <span
        v-if="t.count !== undefined && t.count !== null"
        class="inline-flex items-center rounded-md border border-line2 bg-fill px-1.5 py-0.5 text-[11px] text-muted"
        >{{ t.count }}</span
      >
    </button>
  </div>
</template>

<script setup>
// Underline tabs. There is no existing tab bar in the app, so the underline
// itself is composed: the active/inactive colours are the same brand/muted pair
// ContactsPage uses for its filter chips, and the count pill is that page's
// `rounded-md border border-line2 bg-fill` segment chip at a tighter padding.
defineProps({
  modelValue: { type: String, default: '' },
  // [{ key, label, count? }]
  tabs: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])
</script>
