<template>
  <SelectableCard :selected="selected" @select="emit('select', template)">
    <div class="flex w-full items-start justify-between gap-2">
      <p class="text-sm font-medium text-ink">{{ template.name }}</p>
      <!-- Licensing outranks the version here. In a 29-template catalog the
           question every reader has is "does this cost extra?", and the version
           string answers a question nobody is asking until after they have
           picked. `standard` renders nothing — a badge on everything is a badge
           on nothing. -->
      <StatusBadge v-if="licence" :tone="licence.tone" :label="licence.label" />
    </div>
    <p
      v-if="template.description"
      class="mt-1.5 text-xs leading-5 text-muted"
      >{{ template.description }}</p
    >
    <div class="mt-3 flex flex-wrap items-center gap-1">
      <StatusBadge
        v-for="tag in template.tags ?? []"
        :key="tag"
        tone="neutral"
        :label="tag"
      />
      <span class="ml-auto font-sfere-mono text-sfere-label text-subtle">{{
        template.version
      }}</span>
    </div>
  </SelectableCard>
</template>

<script setup>
import { computed } from 'vue'
import SelectableCard from '@/components/ui/SelectableCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

// One option in the create screen's template picker.
//
// SelectableCard is the card surface, the selection ring and the <button> that
// makes it keyboard-reachable; this component is only the option's content plus
// the `select` payload, because SelectableCard emits `select` with none — the
// parent list is what knows which template each card stands for.
const props = defineProps({
  template: { type: Object, required: true },
  selected: { type: Boolean, default: false }
})
const emit = defineEmits(['select'])

const LICENCES = {
  included: { tone: 'success', label: 'Included' },
  addon: { tone: 'warn', label: 'Add-on' }
}

const licence = computed(() => LICENCES[props.template.licensing] ?? null)
</script>
