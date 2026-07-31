<template>
  <q-dialog v-model="open">
    <!-- Block flow, capped scrollable body — see AssetDetailsDialog for why a
         `flex flex-col` card cannot be height-capped here. -->
    <q-card style="width: 560px; max-width: 92vw">
      <div
        class="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3.5"
      >
        <span class="min-w-0 truncate text-sm font-semibold text-ink">{{
          catalog?.name ?? 'Catalog'
        }}</span>
        <q-btn v-close-popup flat round dense icon="close" size="sm" />
      </div>

      <q-card-section
        v-if="catalog"
        class="space-y-4 overflow-y-auto"
        style="max-height: 60vh"
      >
        <p v-if="catalog.description" class="text-sm text-muted">{{
          catalog.description
        }}</p>

        <NoticeBanner
          v-if="catalog.lastSyncStatus === 'failed'"
          variant="danger"
          title="The last sync failed"
          :message="
            catalog.lastSyncMessage ||
            'The warehouse rejected the query. Personalisation falls back to the last rows that synced.'
          "
        />

        <NoticeBanner
          v-else-if="connectionUnhealthy"
          variant="warn"
          title="This catalog's connection is unhealthy"
          :message="`${catalog.dwhConnectionName} is reporting a problem, so the next sync will not run.`"
        />

        <DefinitionList :items="facts" :columns="1">
          <template #value-status>
            <StatusBadge
              :enabled="catalog.isEnabled"
              :label="catalog.isEnabled ? 'Enabled' : 'Paused'"
            />
          </template>

          <template #value-last-sync>
            <div class="flex flex-wrap items-center justify-end gap-2">
              <span>{{ formatDateTime(catalog.lastSyncedAt) }}</span>
              <StatusBadge
                :variant="syncMeta.variant"
                :label="syncMeta.label"
              />
            </div>
          </template>

          <template #value-connection>
            <div
              v-if="catalog.dwhConnectionId"
              class="flex flex-wrap items-center justify-end gap-2"
            >
              <span>{{ catalog.dwhConnectionName }}</span>
              <StatusBadge
                :variant="connectionMeta.variant"
                :label="connectionMeta.label"
              />
            </div>
            <span v-else class="text-subtle">—</span>
          </template>
        </DefinitionList>
      </q-card-section>

      <div
        class="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3"
      >
        <button
          v-close-popup
          class="rounded-lg border border-line2 bg-white px-3.5 py-1.5 text-sm font-medium text-muted hover:bg-fill"
        >
          Close
        </button>
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed } from 'vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import {
  catalogSourceLabel,
  connectionStatusMeta,
  formatCount,
  formatDateTime,
  syncStatusMeta
} from '@/composables/useEngageContent'

// Read-out for one catalog: where its rows come from, what shape they are in,
// and when they last arrived. There is no `/catalogs/:id` route in the manifest,
// so this is a dialog rather than a page.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  catalog: { type: Object, default: null },
  // The warehouse connection this catalog reads through, already resolved by
  // the page. `null` for a CSV upload, or when the connection list failed.
  connection: { type: Object, default: null }
})

const emit = defineEmits(['update:modelValue'])

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

const syncMeta = computed(() => syncStatusMeta(props.catalog?.lastSyncStatus))

const connectionMeta = computed(() =>
  connectionStatusMeta(props.connection?.status)
)

const connectionUnhealthy = computed(() => props.connection?.status === 'error')

const facts = computed(() => {
  const c = props.catalog
  if (!c) return []
  const schema = props.connection
    ? [props.connection.database, props.connection.schema]
        .filter(Boolean)
        .join('.')
    : null
  return [
    { label: 'Catalog ID', value: c.id },
    { label: 'Status', value: c.isEnabled },
    { label: 'Source', value: catalogSourceLabel(c.sourceType) },
    { label: 'Connection', value: c.dwhConnectionId },
    { label: 'Schema', value: schema },
    { label: 'Table', value: c.sourceTable },
    { label: 'Primary key', value: c.primaryKeyColumn },
    { label: 'Fields', value: formatCount(c.fieldCount) },
    {
      label: 'Rows',
      value: formatCount(c.itemCount),
      hint: c.itemCount ? '' : 'Nothing has synced into this catalog yet'
    },
    { label: 'Last sync', value: c.lastSyncedAt },
    { label: 'Version', value: c.version ? `v${c.version}` : null },
    { label: 'Created', value: formatDateTime(c.createdAt) },
    { label: 'Updated', value: formatDateTime(c.updatedAt) }
  ]
})
</script>
