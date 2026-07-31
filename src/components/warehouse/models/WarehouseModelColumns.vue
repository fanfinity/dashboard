<template>
  <div class="overflow-hidden rounded-lg border border-line2 bg-white">
    <div
      class="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2"
    >
      <span class="text-xs font-medium text-ink">{{ countLabel }}</span>
      <span class="text-xs text-subtle">{{ checkedLabel }}</span>
    </div>

    <EmptyState
      v-if="!columns.length"
      variant="inline"
      title="No columns read yet"
      description="Write the select above and validate it — the columns it produces are listed here."
    />

    <div v-else class="divide-y divide-line">
      <div
        v-for="(column, i) in columns"
        :key="`${column.name || 'expr'}-${i}`"
        class="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
      >
        <div class="min-w-0">
          <code
            v-if="column.name"
            class="rounded bg-fill px-1.5 py-0.5 font-mono text-xs text-ink"
            >{{ column.name }}</code
          >
          <span v-else class="text-xs text-subtle">Unnamed expression</span>
          <p
            v-if="column.expression !== column.name"
            class="mt-1 truncate font-mono text-xs text-subtle"
            >{{ column.expression }}</p
          >
        </div>

        <div class="flex shrink-0 flex-wrap items-center gap-1.5">
          <StatusBadge
            v-for="role in rolesFor(column)"
            :key="role.label"
            :variant="role.variant"
            :label="role.label"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

// The column read-out for a model: what the select produces, and which of those
// columns plays a role in the mapping.
//
// It renders whatever it is handed — the parse lives in `useWarehouseModels`,
// so this stays a display component and the same read-out can be reused by a
// detail screen later.
const props = defineProps({
  // From `parseModelColumns()`: [{ name, expression, star, aliased }]
  columns: { type: Array, default: () => [] },
  // { primaryKey, identifier, timestamp } — column names, any of them empty.
  roles: { type: Object, default: () => ({}) },
  // Pre-formatted; the component does no date formatting.
  checkedAt: { type: String, default: '' }
})

const countLabel = computed(() => {
  const n = props.columns.length
  if (!n) return 'Columns'
  const named = props.columns.filter(c => c.name).length
  return named === n
    ? `${n} column${n === 1 ? '' : 's'}`
    : `${n} entries · ${named} named`
})

const checkedLabel = computed(() =>
  props.checkedAt
    ? `Parsed locally at ${props.checkedAt} — no query was run`
    : 'Read from the select above, not from the warehouse'
)

function rolesFor(column) {
  const badges = []
  if (!column.name) return badges
  if (column.name === props.roles.primaryKey) {
    badges.push({ label: 'Primary key', variant: 'neutral' })
  }
  if (column.name === props.roles.identifier) {
    badges.push({ label: 'Identifier', variant: 'brand' })
  }
  if (column.name === props.roles.timestamp) {
    badges.push({ label: 'Timestamp', variant: 'neutral' })
  }
  return badges
}
</script>
