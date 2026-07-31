<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
    <button
      v-for="t in templates"
      :key="t.id"
      type="button"
      class="flex flex-col items-start gap-2 rounded-xl border bg-white p-4 text-left shadow-sm hover:bg-fill"
      :class="
        modelValue === t.id
          ? 'border-brand ring-1 ring-brand/30'
          : 'border-line2'
      "
      @click="emit('update:modelValue', t.id)"
    >
      <div class="flex w-full items-start justify-between gap-2">
        <span class="text-sm font-medium text-ink">{{ t.name }}</span>
        <StatusBadge
          v-if="modelValue === t.id"
          variant="brand"
          label="Selected"
        />
      </div>

      <p class="text-xs leading-5 text-muted">{{ t.description }}</p>

      <div class="flex flex-wrap items-center gap-1.5">
        <StatusBadge variant="neutral" :label="`v${t.version}`" />
        <StatusBadge
          v-for="tag in t.tags"
          :key="tag"
          variant="neutral"
          :label="tag"
        />
      </div>
    </button>
  </div>
</template>

<script setup>
import StatusBadge from '@/components/ui/StatusBadge.vue'

// The create screen's first step: which template a new source is built from.
//
// A radio group would be the semantic control, but each option is a card with
// its own body copy and chips, so the options are buttons carrying the selected
// state visually. `border-brand` + a brand ring is the only composed styling
// here; everything inside is StatusBadge.
defineProps({
  templates: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])
</script>
