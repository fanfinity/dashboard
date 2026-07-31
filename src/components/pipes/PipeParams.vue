<template>
  <dl v-if="entries.length" class="flex flex-col divide-y divide-line">
    <div
      v-for="entry in entries"
      :key="entry.key"
      class="flex flex-wrap items-baseline justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
    >
      <dt class="text-xs font-medium text-subtle">{{ entry.key }}</dt>
      <dd class="min-w-0 break-all text-sm text-ink">{{ entry.value }}</dd>
    </div>
  </dl>
  <p v-else class="text-sm text-muted">{{ emptyText }}</p>
</template>

<script setup>
import { computed } from 'vue'

// Key/value read-out for a pipe's `destinationParams` — the per-pipe options
// handed to the destination (`table`, `batchSize`, `pixel_id`, …). The shape is
// free-form JSON, so every value is stringified defensively: a nested object
// prints as JSON rather than as "[object Object]".
//
// Not a DataTable: this is two columns of at most a handful of rows inside a
// card, and DataTable would bring sorting and a pagination footer with it.
const props = defineProps({
  params: { type: Object, default: () => ({}) },
  emptyText: { type: String, default: 'No destination parameters set.' }
})

function render(value) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const entries = computed(() =>
  Object.entries(props.params || {}).map(([key, value]) => ({
    key,
    value: render(value)
  }))
)
</script>
