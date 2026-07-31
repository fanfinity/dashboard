<template>
  <DefinitionList v-if="entries.length" :items="entries" :columns="1" />
  <p v-else class="text-sm text-muted">{{ emptyText }}</p>
</template>

<script setup>
import { computed } from 'vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'

// Key/value read-out for a pipe's `destinationParams` — the per-pipe options
// handed to the destination (`table`, `batchSize`, `pixel_id`, …). The shape is
// free-form JSON; DefinitionList stringifies defensively, so a nested object
// prints as JSON rather than as "[object Object]" and a null prints as an em
// dash.
//
// Not a DataTable: this is two columns of at most a handful of rows inside a
// card, and DataTable would bring sorting and a pagination footer with it.
const props = defineProps({
  params: { type: Object, default: () => ({}) },
  emptyText: { type: String, default: 'No destination parameters set.' }
})

const entries = computed(() =>
  Object.entries(props.params || {}).map(([label, value]) => ({ label, value }))
)
</script>
