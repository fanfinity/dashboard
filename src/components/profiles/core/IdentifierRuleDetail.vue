<template>
  <div class="flex flex-col gap-4">
    <CardPanel>
      <template #header>
        <div class="flex w-full flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-baseline gap-2">
            <span class="text-sm font-semibold text-ink">{{
              rule.displayName
            }}</span>
            <span class="font-mono text-xs text-subtle">{{ rule.name }}</span>
          </div>
          <div class="flex items-center gap-2">
            <StatusBadge :tone="rule.methodVariant" :label="rule.method" />
            <StatusBadge
              v-if="rule.rank === 1"
              tone="brand"
              label="Highest precedence"
            />
          </div>
        </div>
      </template>

      <DefinitionList :items="facts" :columns="2" />
    </CardPanel>

    <div>
      <h2 class="mb-2 text-sm! font-semibold! tracking-[-0.35px]! text-ink"
        >Where this identifier comes from</h2
      >
      <p class="mb-3 max-w-3xl text-xs text-muted"
        >Every rule below can put
        <span class="font-medium text-ink">{{ rule.displayName }}</span> on a
        fan. Two fans that produce the same value through any of them are
        treated as one.</p
      >

      <DataTable
        :columns="columns"
        :rows="rule.rules"
        row-key="id"
        :per-page="10"
        empty-title="No collection rules"
        :empty-description="`Nothing writes a ${rule.displayName} identifier today, so this rule can never fire.`"
      >
        <template #cell-kind="{ value }">
          <StatusBadge
            :tone="value === 'Event stream' ? 'brand' : 'neutral'"
            :label="value"
          />
        </template>

        <template #cell-matchesOn="{ value }">
          <span class="font-mono text-xs text-ink">{{ value }}</span>
        </template>

        <template #cell-from="{ value }">
          <span class="text-ink">{{ value }}</span>
        </template>
      </DataTable>
    </div>
  </div>
</template>

<script setup>
import CardPanel from '@/components/ui/CardPanel.vue'
import DataTable from '@/components/ui/DataTable.vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

// One identifier type, read as a matching rule: what it is, how strong it is,
// and every path by which a value can reach the fan graph.
//
// `rule` and `facts` both come pre-formatted from
// useProfilesIdentityResolution(); this component does no formatting, in line
// with the primitives it wraps.
defineProps({
  rule: { type: Object, required: true },
  facts: { type: Array, default: () => [] }
})

const columns = [
  { key: 'kind', label: 'Rule type', width: '180px' },
  { key: 'matchesOn', label: 'Matches on' },
  { key: 'from', label: 'From' }
]
</script>
