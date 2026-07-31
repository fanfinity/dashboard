<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
    <SelectableCard
      v-for="type in identifierTypes"
      :key="type.id"
      :selected="modelValue.includes(type.id)"
      @select="toggle(type.id)"
    >
      <div class="flex w-full items-start justify-between gap-2">
        <span class="text-sm font-medium text-ink">{{
          type.displayName || type.name
        }}</span>
        <StatusBadge
          v-if="modelValue.includes(type.id)"
          variant="brand"
          label="Accepted"
        />
      </div>

      <p class="mt-2 font-mono text-xs text-subtle">{{ type.name }}</p>

      <div class="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusBadge variant="neutral" :label="sourceLabel(type)" />
        <StatusBadge variant="neutral" :label="limitLabel(type)" />
      </div>
    </SelectableCard>
  </div>
</template>

<script setup>
import SelectableCard from '@/components/ui/SelectableCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

// Which identifier types a caller may look a fan up by. Multi-select: an
// endpoint that accepts both an email and a ticket reference is normal.
//
// Each option is a card rather than a checkbox because it carries where the
// identifier comes from and how many of them a profile may hold; SelectableCard
// keeps that a real <button> with `aria-pressed`.
const props = defineProps({
  identifierTypes: { type: Array, default: () => [] },
  modelValue: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])

function toggle(id) {
  const next = props.modelValue.includes(id)
    ? props.modelValue.filter(v => v !== id)
    : [...props.modelValue, id]
  emit('update:modelValue', next)
}

function sourceLabel(type) {
  const n = (type.eventTypes ?? []).length + (type.dataModels ?? []).length
  return `${n} feed${n === 1 ? '' : 's'}`
}

function limitLabel(type) {
  return type.maxIdentifiers
    ? `Max ${type.maxIdentifiers} per fan`
    : 'Unlimited per fan'
}
</script>
