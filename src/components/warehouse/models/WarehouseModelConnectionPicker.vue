<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
    <SelectableCard
      v-for="connection in connections"
      :key="connection.id"
      :selected="modelValue === connection.id"
      :disabled="!isConnectionHealthy(connection)"
      @select="emit('update:modelValue', connection.id)"
    >
      <div class="flex w-full items-start justify-between gap-2">
        <span class="text-sm font-medium text-ink">{{ connection.name }}</span>
        <StatusBadge
          v-if="modelValue === connection.id"
          tone="brand"
          label="Selected"
        />
        <StatusBadge
          v-else-if="!isConnectionHealthy(connection)"
          tone="danger"
          label="Unreachable"
        />
        <StatusBadge
          v-else-if="connection.isPrimary"
          tone="neutral"
          label="Primary"
        />
      </div>

      <p class="mt-1.5 text-xs leading-5 text-muted"
        >{{ connectionTypeLabel(connection.type) }} ·
        <span class="font-mono"
          >{{ connection.database }}.{{ connection.schema }}</span
        ></p
      >

      <p class="mt-1 text-xs text-subtle">{{ statusLine(connection) }}</p>
    </SelectableCard>
  </div>
</template>

<script setup>
import SelectableCard from '@/components/ui/SelectableCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import {
  connectionTypeLabel,
  formatCount,
  isConnectionHealthy
} from '@/composables/useWarehouseModels'

// Which warehouse a model reads from.
//
// A failing connection is shown rather than filtered out: hiding it makes the
// picker look like the connection was deleted, when the fix is to repair it on
// the connections screen. `SelectableCard`'s `disabled` suppresses the select
// event, so it cannot be chosen by mouse or keyboard.
defineProps({
  modelValue: { type: String, default: '' },
  connections: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])

function statusLine(connection) {
  if (!isConnectionHealthy(connection)) {
    return connection.lastError || 'The last connection check failed.'
  }
  const tables = formatCount(connection.tableCount)
  const models = connection.modelCount ?? 0
  return `${tables} tables · ${models} model${models === 1 ? '' : 's'} already reading`
}
</script>
