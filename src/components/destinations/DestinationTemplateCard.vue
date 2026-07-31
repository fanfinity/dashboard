<template>
  <SelectableCard :selected="selected" @select="emit('select', template)">
    <div class="flex w-full items-start justify-between gap-2">
      <p class="text-sm font-medium text-ink">{{ template.name }}</p>
      <StatusBadge variant="neutral" :label="template.version" />
    </div>
    <p v-if="template.description" class="mt-1.5 text-xs text-muted">{{
      template.description
    }}</p>
    <div v-if="template.tags?.length" class="mt-3 flex flex-wrap gap-1">
      <StatusBadge
        v-for="tag in template.tags"
        :key="tag"
        variant="neutral"
        :label="tag"
      />
    </div>
  </SelectableCard>
</template>

<script setup>
import SelectableCard from '@/components/ui/SelectableCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

// One option in the create screen's template picker.
//
// SelectableCard is the card surface, the selection ring and the <button> that
// makes it keyboard-reachable; this component is only the option's content plus
// the `select` payload, because SelectableCard emits `select` with none — the
// parent list is what knows which template each card stands for.
defineProps({
  template: { type: Object, required: true },
  selected: { type: Boolean, default: false }
})
const emit = defineEmits(['select'])
</script>
