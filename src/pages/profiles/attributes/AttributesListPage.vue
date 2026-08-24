<template>
  <q-page class="p-6">
    <PageHeader
      title="Attributes"
      subtitle="Computed fields on a fan profile — each one derived from event data or a warehouse model."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search attributes..." />
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'attributes-trash' })"
        >
          Trash
        </button>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="router.push({ name: 'attributes-new' })"
        >
          New attribute
        </button>
      </template>
    </PageHeader>

    <div
      v-if="!loading && !error && attributes.length"
      class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatCard label="Attributes" :value="formatCount(attributes.length)" />
      <StatCard
        label="Realtime"
        :value="formatCount(counts.realtime)"
        hint="Evaluated as events arrive"
      />
      <StatCard
        label="Warehouse"
        :value="formatCount(counts.warehouse)"
        hint="Evaluated on the model refresh"
      />
      <StatCard
        label="Used in audiences"
        :value="formatCount(counts.used)"
        :hint="`${formatCount(counts.unused)} not referenced yet`"
      />
    </div>

    <TabNav v-model="tab" :tabs="tabs" />

    <DataTable
      :columns="columns"
      :rows="visible"
      :loading="loading"
      :error="error"
      row-key="id"
      @retry="load"
    >
      <template #cell-name="{ row }">
        <div class="flex items-center gap-2">
          <p class="font-medium text-ink">{{ row.name }}</p>
          <StatusBadge
            v-if="row.isManaged"
            tone="brand"
            :label="`Managed by ${row.managedBy}`"
          />
        </div>
        <p class="font-mono text-xs text-subtle">{{ row.id }}</p>
      </template>

      <template #cell-type="{ row }">
        <StatusBadge
          :tone="row.type === 'realtime' ? 'success' : 'neutral'"
          :label="attributeTypeLabel(row.type)"
        />
      </template>

      <template #cell-derivedFrom="{ row }">
        <p class="text-ink">{{ row.derivedFrom }}</p>
        <p class="text-xs text-subtle">{{ row.algorithmText }}</p>
      </template>

      <template #cell-dimensionCount="{ row }">
        <p class="text-ink">{{ dimensionCountLabel(row) }}</p>
        <p class="text-xs text-subtle">{{ row.dimensionNames }}</p>
      </template>

      <template #cell-usedByAudienceCount="{ value }">
        {{ formatCount(value) }}
      </template>

      <!-- The seven columns leave this one narrow enough that "30 Jun 2026"
           breaks across two lines; the date is one token, so it never wraps. -->
      <template #cell-updatedAt="{ value }">
        <span class="whitespace-nowrap">{{ formatDate(value) }}</span>
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end">
          <button
            :disabled="row.isManaged"
            :title="
              row.isManaged
                ? `Maintained by ${row.managedBy}, so it cannot be deleted here.`
                : ''
            "
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill disabled:cursor-not-allowed disabled:opacity-40"
            @click.stop="ask(row)"
          >
            Delete
          </button>
        </div>
      </template>

      <!-- Two different "no rows" cases: nothing defined yet (offer the primary
           CTA) and nothing matching the filters (offer a way back). -->
      <template #empty>
        <EmptyState :title="emptyTitle" :description="emptyDescription">
          <template #cta>
            <button
              v-if="!attributes.length"
              class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
              @click="router.push({ name: 'attributes-new' })"
            >
              Create your first attribute
            </button>
            <button
              v-else
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
              @click="clearFilters"
            >
              Clear filters
            </button>
          </template>
        </EmptyState>
      </template>
    </DataTable>

    <ConfirmDialog
      v-model="confirmDelete"
      title="Move attribute to trash?"
      :message="deleteMessage"
      confirm-label="Move to trash"
      destructive
      @confirm="remove"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import TabNav from '@/components/ui/TabNav.vue'
import DataTable from '@/components/ui/DataTable.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import {
  algorithmLabel,
  attributeSourceLabel,
  attributeTypeLabel,
  formatCount,
  formatDate,
  isManaged,
  useAttributes
} from '@/composables/useAttributes'

const router = useRouter()
const $q = useQuasar()
const {
  attributes,
  loading,
  error,
  load,
  remove: removeAttribute
} = useAttributes()

const query = ref('')
const tab = ref('all')
const confirmDelete = ref(false)
const target = ref(null)

const columns = [
  { key: 'name', label: 'Attribute', sortable: true },
  { key: 'type', label: 'Kind', sortable: true },
  { key: 'derivedFrom', label: 'Derived from', sortable: true },
  { key: 'dimensionCount', label: 'Dimensions', sortable: true },
  {
    key: 'usedByAudienceCount',
    label: 'Audiences',
    sortable: true,
    align: 'right'
  },
  { key: 'updatedAt', label: 'Updated', sortable: true },
  { key: 'actions', label: '', align: 'right', width: '120px' }
]

// The table sorts on `row[key]`, so anything a column shows has to exist as a
// field on the row. Derived text is computed once here, not in a cell slot.
const rows = computed(() =>
  attributes.value.map(a => ({
    ...a,
    isManaged: isManaged(a),
    derivedFrom: attributeSourceLabel(a),
    algorithmText: a.algorithm
      ? algorithmLabel(a.algorithm)
      : 'Maintained automatically',
    dimensionCount: a.dimensions?.length ?? 0,
    dimensionNames: (a.dimensions ?? []).map(d => d.name).join(', ')
  }))
)

const TAB_PREDICATES = {
  realtime: a => a.type === 'realtime',
  warehouse: a => a.type === 'warehouse',
  managed: a => a.isManaged
}

const tabs = computed(() => [
  { key: 'all', label: 'All', count: rows.value.length },
  {
    key: 'realtime',
    label: 'Realtime',
    count: rows.value.filter(TAB_PREDICATES.realtime).length
  },
  {
    key: 'warehouse',
    label: 'Warehouse',
    count: rows.value.filter(TAB_PREDICATES.warehouse).length
  },
  {
    key: 'managed',
    label: 'Managed',
    count: rows.value.filter(TAB_PREDICATES.managed).length
  }
])

const SEARCH_FIELDS = ['name', 'id', 'derivedFrom', 'dimensionNames']

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  const predicate = TAB_PREDICATES[tab.value]
  return rows.value.filter(a => {
    if (predicate && !predicate(a)) return false
    if (!q) return true
    return SEARCH_FIELDS.some(f =>
      String(a[f] ?? '')
        .toLowerCase()
        .includes(q)
    )
  })
})

const counts = computed(() => {
  const used = attributes.value.filter(a => a.usedByAudienceCount > 0).length
  return {
    realtime: attributes.value.filter(a => a.type === 'realtime').length,
    warehouse: attributes.value.filter(a => a.type === 'warehouse').length,
    used,
    unused: attributes.value.length - used
  }
})

function dimensionCountLabel(row) {
  const n = row.dimensionCount
  return `${n} ${n === 1 ? 'dimension' : 'dimensions'}`
}

const emptyTitle = computed(() =>
  attributes.value.length
    ? 'No attributes match your filters'
    : 'No attributes yet'
)

const emptyDescription = computed(() =>
  attributes.value.length
    ? 'Try a different search term, or switch back to the All tab.'
    : 'Attributes turn raw fan activity into something an audience can filter on — a lifetime spend, a favourite competition, a last-seen city.'
)

function clearFilters() {
  query.value = ''
  tab.value = 'all'
}

// Nothing here persists — say so in the toast rather than implying a save.
function notifyLocal(message) {
  $q.notify({
    message,
    caption: 'Local preview only — no backend is connected yet.',
    color: 'dark',
    timeout: 2500
  })
}

function ask(row) {
  target.value = row
  confirmDelete.value = true
}

// An attribute an audience filters on is not a safe delete, so the confirm
// dialog says what will break rather than asking a generic "are you sure".
const deleteMessage = computed(() => {
  const row = target.value
  if (!row) return ''
  const n = row.usedByAudienceCount
  const consequence = n
    ? `${n} audience${n === 1 ? '' : 's'} filter on it and will stop matching.`
    : 'No audience references it today.'
  return `“${row.name}” stops being computed and moves to the trash, where it can be restored for 30 days. ${consequence}`
})

function remove() {
  const row = target.value
  if (!row) return
  removeAttribute(row.id)
  notifyLocal(`${row.name} moved to trash`)
  target.value = null
}

onMounted(load)
</script>
