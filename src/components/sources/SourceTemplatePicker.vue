<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
    <SelectableCard
      v-for="t in templates"
      :key="t.id"
      :selected="modelValue === t.id"
      @select="emit('update:modelValue', t.id)"
    >
      <div class="flex w-full items-start justify-between gap-2">
        <span class="text-sm font-medium text-ink">{{ t.name }}</span>
        <StatusBadge v-if="modelValue === t.id" tone="brand" label="Selected" />
      </div>

      <p class="mt-2 text-xs leading-5 text-muted">{{ t.description }}</p>

      <div class="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusBadge tone="neutral" :label="`v${t.version}`" />
        <StatusBadge
          v-for="tag in t.tags"
          :key="tag"
          tone="neutral"
          :label="tag"
        />
      </div>
    </SelectableCard>
  </div>
</template>

<script setup>
import SelectableCard from '@/components/ui/SelectableCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

// The create screen's first step: which template a new source is built from.
//
// A radio group would be the semantic control, but each option is a card with
// its own body copy and chips, so each option is a SelectableCard — a real
// <button> carrying `aria-pressed` and the selection ring. SelectableCard has no
// gap between its children, so the spacing the old `gap-2` gave is `mt-2` here.
defineProps({
  templates: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])
</script>
