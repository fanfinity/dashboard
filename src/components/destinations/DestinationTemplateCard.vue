<template>
  <SelectableCard :selected="selected" @select="emit('select', template)">
    <div class="flex w-full items-start justify-between gap-2">
      <p class="text-sm font-medium text-ink">{{ template.name }}</p>
      <!-- In a 28-template catalog the question every reader has is "does this
           cost extra?". `standard` renders nothing — a badge on everything is a
           badge on nothing. `included` is unused today (the one included
           template is provisioned, so the picker never renders a card for it)
           and stays for the next one that is not. -->
      <StatusBadge v-if="licence" :tone="licence.tone" :label="licence.label" />
    </div>
    <p
      v-if="template.description"
      class="mt-1.5 text-xs leading-5 text-muted"
      >{{ template.description }}</p
    >
    <!-- No `template.version` here. It is a real field — the list and detail
         screens compare a destination's `templateVersion` against it to offer
         an upgrade — but on a card you have not created anything from it is an
         unlabelled date answering nothing: you can only ever create the latest.
         Every card carrying one made it read as a property of the product. -->
    <div class="mt-3 flex flex-wrap items-center gap-1">
      <StatusBadge
        v-for="tag in template.tags ?? []"
        :key="tag"
        tone="neutral"
        :label="tag"
      />
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
