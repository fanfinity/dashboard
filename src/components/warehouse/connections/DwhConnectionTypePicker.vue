<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
    <SelectableCard
      v-for="t in types"
      :key="t.value"
      :selected="modelValue === t.value"
      @select="emit('update:modelValue', t.value)"
    >
      <div class="flex w-full items-start justify-between gap-2">
        <span class="text-sm font-medium text-ink">{{ t.label }}</span>
        <StatusBadge
          v-if="modelValue === t.value"
          variant="brand"
          label="Selected"
        />
      </div>

      <p class="mt-2 text-xs leading-5 text-muted">{{ t.description }}</p>

      <div class="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusBadge variant="neutral" :label="`Port ${t.defaultPort}`" />
        <StatusBadge variant="neutral" :label="t.usernameLabel" />
      </div>
    </SelectableCard>
  </div>
</template>

<script setup>
import SelectableCard from '@/components/ui/SelectableCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

// Step one of creating a connection: which warehouse engine it points at.
//
// The engine decides what every field below it is called — a Postgres "Host" is
// a BigQuery "API endpoint" and a Databricks "Workspace host" — so it is picked
// before the credentials rather than sitting inside them as a dropdown.
//
// Each option is a SelectableCard (a real <button> carrying `aria-pressed`)
// rather than a radio, because each option carries body copy and chips.
defineProps({
  types: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])
</script>
