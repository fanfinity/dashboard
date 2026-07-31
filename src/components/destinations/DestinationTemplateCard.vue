<template>
  <button
    type="button"
    class="rounded-xl text-left"
    :class="selected ? 'ring-2 ring-brand' : ''"
    :aria-pressed="selected"
    @click="emit('select', template)"
  >
    <CardPanel class="h-full hover:bg-fill">
      <div class="flex items-start justify-between gap-2">
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
    </CardPanel>
  </button>
</template>

<script setup>
import CardPanel from '@/components/ui/CardPanel.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

// One option in the create screen's template picker.
//
// There is no selectable-card primitive, and CardPanel is a plain <div> — making
// it clickable by hanging a listener off attribute fallthrough would give a card
// you cannot reach with a keyboard. So the card itself stays CardPanel and only
// the button wrapper + selection ring are composed here.
defineProps({
  template: { type: Object, required: true },
  selected: { type: Boolean, default: false }
})
const emit = defineEmits(['select'])
</script>
