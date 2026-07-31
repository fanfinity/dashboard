<template>
  <div class="flex flex-col gap-3">
    <ToolbarSearch v-model="query" placeholder="Search attributes..." />

    <!-- Nested inside a FormSection card, so the "nothing matched" hint is an
         inline EmptyState rather than a second bordered surface. -->
    <EmptyState
      v-if="!visible.length"
      variant="inline"
      title="No attributes match your search"
      :description="`None of the ${attributes.length} attributes match “${query}”.`"
    />

    <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <SelectableCard
        v-for="attribute in visible"
        :key="attribute.id"
        :selected="modelValue.includes(attribute.id)"
        @select="toggle(attribute.id)"
      >
        <div class="flex w-full items-start justify-between gap-2">
          <span class="text-sm font-medium text-ink">{{ attribute.name }}</span>
          <StatusBadge
            v-if="modelValue.includes(attribute.id)"
            variant="brand"
            label="Returned"
          />
        </div>

        <p class="mt-2 font-mono text-xs text-subtle">{{ attribute.id }}</p>

        <div class="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusBadge
            :variant="attribute.type === 'realtime' ? 'success' : 'neutral'"
            :label="attribute.type === 'realtime' ? 'Real time' : 'Warehouse'"
          />
          <StatusBadge variant="neutral" :label="sourceLabel(attribute)" />
        </div>
      </SelectableCard>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import SelectableCard from '@/components/ui/SelectableCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

// Which attributes the endpoint puts in its response body. Multi-select, with a
// search box because an established workspace has far more attributes than fit
// on a screen — the reference product's picker is a scrolling wall of chips.
//
// Selected attributes always stay visible even when they fall outside the
// current search: an invisible selection is how a user removes one by accident.
const props = defineProps({
  attributes: { type: Array, default: () => [] },
  modelValue: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])

const query = ref('')

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.attributes
  return props.attributes.filter(
    a =>
      props.modelValue.includes(a.id) ||
      `${a.name} ${a.id}`.toLowerCase().includes(q)
  )
})

function toggle(id) {
  const next = props.modelValue.includes(id)
    ? props.modelValue.filter(v => v !== id)
    : [...props.modelValue, id]
  emit('update:modelValue', next)
}

// Warehouse attributes name the model they are computed from; a real-time one
// is derived straight off the event stream and has no model.
function sourceLabel(attribute) {
  return attribute.dataModelName || 'Live events'
}
</script>
