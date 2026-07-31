<template>
  <div class="flex flex-col gap-4">
    <CardPanel>
      <template #header>
        <div class="flex w-full flex-wrap items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand"
              >{{ profile.initials }}</span
            >
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-ink">{{
                profile.displayName
              }}</p>
              <p class="truncate text-xs text-subtle">{{
                profile.primaryEmail || profile.id
              }}</p>
            </div>
          </div>
          <StatusBadge
            :variant="profile.isAnonymous ? 'neutral' : 'success'"
            :label="profile.isAnonymous ? 'Anonymous' : 'Identified'"
          />
        </div>
      </template>

      <DefinitionList :items="profile.facts" :columns="2" />
    </CardPanel>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        v-for="stat in profile.stats"
        :key="stat.label"
        :label="stat.label"
        :value="stat.value"
        :hint="stat.hint"
      />
    </div>

    <!-- The lookups are secondary: labels, attribute definitions and audience
         names. Losing them degrades these tabs, not the whole screen, so the
         retry lives here rather than at page level. -->
    <ErrorState
      v-if="lookupsError"
      title="Couldn't load the attribute and audience catalogue."
      :message="lookupsError"
      @retry="emit('retry-lookups')"
    />

    <div>
      <TabNav v-model="tab" :tabs="tabs" />

      <CardPanel v-if="tab === 'attributes'">
        <EmptyState
          v-if="!profile.attributeRows.length"
          variant="inline"
          title="No attributes are defined yet"
          description="Attributes are what a profile carries beyond its identifiers."
        />
        <DefinitionList v-else :items="profile.attributeRows" :columns="2" />
      </CardPanel>

      <DataTable
        v-else-if="tab === 'identifiers'"
        :columns="identifierColumns"
        :rows="profile.identifierRows"
        row-key="id"
        :per-page="10"
        empty-title="No identifiers"
        empty-description="This fan has no identifier on the graph, which should not be possible — check the source that created it."
      >
        <template #cell-typeLabel="{ row }">
          <p class="font-medium text-ink">{{ row.typeLabel }}</p>
          <p class="font-mono text-xs text-subtle">{{ row.typeName }}</p>
        </template>

        <template #cell-value="{ row }">
          <div class="flex flex-wrap items-center gap-2">
            <span class="break-all font-mono text-xs text-ink">{{
              row.value
            }}</span>
            <StatusBadge v-if="row.isMatch" variant="brand" label="Matched" />
          </div>
        </template>

        <template #cell-role="{ value }">
          <StatusBadge
            :variant="value === 'Anchor' ? 'success' : 'neutral'"
            :label="value"
          />
        </template>
      </DataTable>

      <DataTable
        v-else-if="tab === 'audiences'"
        :columns="audienceColumns"
        :rows="profile.audienceRows"
        row-key="id"
        :per-page="10"
        empty-title="Not in any audience"
        empty-description="No audience condition matches this fan yet. Audiences re-evaluate on every profile refresh."
      >
        <template #cell-name="{ row }">
          <p class="font-medium text-ink">{{ row.name }}</p>
          <p class="text-xs text-subtle">{{ row.description }}</p>
        </template>

        <template #cell-type="{ value }">
          <StatusBadge
            :variant="value === 'Real-time' ? 'brand' : 'neutral'"
            :label="value"
          />
        </template>
      </DataTable>

      <DataTable
        v-else
        :columns="eventColumns"
        :rows="profile.eventRows"
        row-key="id"
        :per-page="10"
        empty-title="No recent events"
        empty-description="Nothing from this fan in the live activity window. Their profile is still built from everything collected before it."
      >
        <template #cell-eventName="{ value }">
          <span class="font-mono text-xs text-ink">{{ value }}</span>
        </template>
      </DataTable>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import DataTable from '@/components/ui/DataTable.vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TabNav from '@/components/ui/TabNav.vue'

// The read-out for one resolved fan: who the platform thinks they are, which
// identifiers were stitched into them, what they carry, and where they are
// activated. `profile` arrives fully formatted from useProfilesSearch().
const props = defineProps({
  profile: { type: Object, required: true },
  lookupsError: { type: String, default: null }
})

const emit = defineEmits(['retry-lookups'])

const tab = ref('attributes')

// Switching to a different fan mid-read should not leave the panel on a tab
// that made sense for the previous one.
watch(
  () => props.profile.id,
  () => {
    tab.value = 'attributes'
  }
)

const tabs = computed(() => [
  { key: 'attributes', label: 'Attributes' },
  {
    key: 'identifiers',
    label: 'Identifiers',
    count: props.profile.identifierRows.length
  },
  {
    key: 'audiences',
    label: 'Audiences',
    count: props.profile.audienceRows.length
  },
  {
    key: 'activity',
    label: 'Recent activity',
    count: props.profile.eventRows.length
  }
])

const identifierColumns = [
  { key: 'typeLabel', label: 'Identifier type', width: '220px' },
  { key: 'value', label: 'Value' },
  { key: 'role', label: 'Role', width: '120px' },
  { key: 'firstSeen', label: 'First seen', align: 'right', width: '220px' }
]

const audienceColumns = [
  { key: 'name', label: 'Audience' },
  { key: 'type', label: 'Type', width: '140px' },
  { key: 'size', label: 'Total fans', align: 'right', width: '140px' }
]

const eventColumns = [
  { key: 'eventName', label: 'Event', width: '220px' },
  { key: 'sourceName', label: 'Source' },
  { key: 'occurredAt', label: 'When', align: 'right', width: '240px' }
]
</script>
