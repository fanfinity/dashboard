<template>
  <div class="mt-3 rounded-lg border border-line bg-sidebar p-4">
    <!-- The raw message is the thing an operator actually reads, so it leads and
         keeps its own wrapping rather than being truncated into the table cell. -->
    <p class="font-mono text-xs leading-6 text-ink break-words">{{
      row.message
    }}</p>

    <DefinitionList class="mt-3" :items="facts" :columns="2" />

    <template v-if="row.context.length">
      <p
        class="mt-4 mb-2 text-[11px]! font-semibold! uppercase leading-4! tracking-[0.4px]! text-subtle"
        >Context</p
      >
      <DefinitionList :items="row.context" :columns="2" />
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'

// Expanded detail for one row of the error log. Deliberately NOT an ErrorState:
// the fetch succeeded and this is a record we are displaying, so rendering
// data-smoke="error" here would make the smoke gate report a working screen as
// broken.
const props = defineProps({
  row: { type: Object, required: true }
})

const facts = computed(() => [
  { label: 'Code', value: props.row.code },
  { label: 'Severity', value: props.row.severityLabel },
  { label: 'Category', value: props.row.categoryLabel },
  { label: 'Occurred', value: props.row.occurredAtLabel },
  { label: props.row.entityTypeLabel || 'Entity', value: props.row.entityName },
  { label: 'Occurrences', value: props.row.countLabel }
])
</script>
