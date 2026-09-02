<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <p class="max-w-xl text-sm text-muted">
        Zid stores that have authorized the Sfere app. Authorizing is the store
        owner's step; creating a source against the store is yours, and one does
        not imply the other.
      </p>
      <SfereButton
        class="shrink-0"
        size="sm"
        variant="secondary"
        :loading="authorizing"
        @click="startAuthorize"
        >Authorize a store</SfereButton
      >
    </div>

    <DataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :error="error"
      :api-missing="apiMissing"
      row-key="storeId"
      @retry="load"
    >
      <template #cell-name="{ row }">
        <p class="font-medium text-ink">{{ row.name }}</p>
        <p class="text-xs text-subtle">
          <code class="font-sfere-mono">{{ row.storeId }}</code>
          <template v-if="row.domain"> · {{ row.domain }}</template>
        </p>
      </template>

      <template #cell-connectedAt="{ value }">
        <span class="whitespace-nowrap text-muted">{{
          formatDateTime(value, NOT_KNOWN)
        }}</span>
      </template>

      <!-- The interesting column. An authorized store with no source means
           someone finished the authorization and nobody built the source — a
           stalled setup that otherwise looks finished from the store's side. -->
      <template #cell-source="{ row }">
        <router-link
          v-if="row.source"
          :to="{ name: 'sources-detail', params: { id: row.source.id } }"
          class="text-brand underline"
          >{{ row.source.name }}</router-link
        >
        <StatusBadge v-else tone="warn" label="No source yet" />
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end">
          <SfereButton
            v-if="!row.source"
            size="sm"
            variant="secondary"
            :to="{ name: 'sources-new' }"
            >Create its source</SfereButton
          >
          <SfereButton
            v-else
            size="sm"
            variant="ghost"
            :to="{ name: 'sources-detail', params: { id: row.source.id } }"
            >Open source</SfereButton
          >
        </div>
      </template>

      <template #empty>
        <EmptyState
          title="No Zid stores have authorized yet"
          description="A store owner authorizes the Sfere app from their Zid dashboard. Once they have, the store appears here and you can create a source against it."
        >
          <template #cta>
            <SfereButton
              size="sm"
              :loading="authorizing"
              @click="startAuthorize"
              >Get the authorization link</SfereButton
            >
          </template>
        </EmptyState>
      </template>
    </DataTable>
  </div>
</template>

<script setup>
import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useZidConnections } from '@/composables/useZidConnections'
import { formatDateTime } from '@/composables/useSources'

// `GET …/zid-connections` and `GET …/zid-authorize`, both live as of backend
// PR #16.
//
// A tab on /sources rather than a screen, for the same reason the connector
// catalog is: authorizing a store is a step in adding a source, not something you
// manage on its own.
const props = defineProps({
  /** The account's sources, so a store can be joined to the one built from it. */
  sources: { type: Array, default: () => [] }
})

const $q = useQuasar()
const { connections, loading, error, apiMissing, load, authorizeUrl } =
  useZidConnections()

const authorizing = ref(false)

const columns = [
  { key: 'name', label: 'Store', sortable: true },
  { key: 'connectedAt', label: 'Authorized', sortable: true },
  { key: 'source', label: 'Source' },
  { key: 'actions', label: '', align: 'right', width: '170px' }
]

// Joined here by `storeId`, because `ZidConnection` carries no source id and
// `Source` carries no connection id — only a matching `store_id`. Same pattern as
// `usePipes`' `joinEnds()`: resolve the label out of a collection the page
// already has rather than inventing a field.
const rows = computed(() =>
  connections.value.map(c => ({
    ...c,
    source: props.sources.find(s => s.storeId === c.storeId) ?? null
  }))
)

/**
 * Opens Zid's own OAuth page.
 *
 * A LINK, never a fetch: `connect-src` names the Sfere API hosts only, so
 * fetching this URL would be blocked — correctly, since the whole point is that
 * the merchant signs in on Zid's domain. `window.open` rather than a router
 * push for the same reason.
 */
async function startAuthorize() {
  authorizing.value = true
  try {
    const res = await authorizeUrl()
    if (!res.ok) {
      $q.notify({
        message: res.apiMissing
          ? 'No authorization link available.'
          : (res.error ?? 'Could not get an authorization link.'),
        caption: res.apiMissing
          ? 'Demo data mode has no live OAuth to start. Switch Settings → Data source to Real API.'
          : undefined,
        color: 'dark',
        position: 'top-right',
        timeout: 6000
      })
      return
    }
    window.open(res.data, '_blank', 'noopener,noreferrer')
  } finally {
    authorizing.value = false
  }
}

onMounted(load)
</script>
