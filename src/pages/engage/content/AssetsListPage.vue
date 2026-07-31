<template>
  <q-page class="p-6">
    <PageHeader
      title="Assets"
      subtitle="The images, videos and documents your campaigns embed, grouped into folders."
    >
      <template #actions>
        <ToolbarSearch
          v-model="query"
          placeholder="Search name, folder or tag..."
        />
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="upload"
        >
          Upload asset
        </button>
      </template>
    </PageHeader>

    <NoticeBanner
      class="mb-5"
      variant="info"
      title="Uploads are disabled in this preview"
      message="Nothing you do here is stored: files are not uploaded, and deleting or restoring an asset only changes what this session shows."
    />

    <div
      v-if="!loading && !error && assets.length"
      class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatCard label="Assets" :value="formatCount(assets.length)" />
      <StatCard label="Library size" :value="formatBytes(totalBytes)" />
      <StatCard
        label="Unused"
        :value="formatCount(unusedCount)"
        hint="Not referenced by any campaign"
      />
      <StatCard label="Folders" :value="formatCount(folders.length)" />
    </div>

    <TabNav v-model="tab" :tabs="tabs" />

    <LoadingState v-if="loading" variant="grid" :rows="8" />

    <ErrorState
      v-else-if="error"
      title="Couldn't load the asset library."
      :message="error"
      @retry="load"
    />

    <!-- The trash is secondary to the library: it backs one tab, so its failure
         stays inside that tab and keeps its own retry. -->
    <ErrorState
      v-else-if="inTrash && trashError"
      title="Couldn't load deleted assets."
      :message="trashError"
      @retry="loadTrash"
    />

    <LoadingState
      v-else-if="inTrash && trashLoading"
      variant="grid"
      :rows="4"
    />

    <EmptyState
      v-else-if="!visible.length"
      :title="emptyTitle"
      :description="emptyDescription"
    >
      <template #cta>
        <button
          v-if="filtered"
          class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
          @click="clearFilters"
        >
          Clear filters
        </button>
        <button
          v-else-if="!inTrash"
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="upload"
        >
          Upload your first asset
        </button>
        <button
          v-else
          class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
          @click="tab = 'all'"
        >
          Back to all assets
        </button>
      </template>
    </EmptyState>

    <div
      v-else
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <AssetCard
        v-for="asset in visible"
        :key="asset.id"
        :asset="asset"
        :deleted="inTrash"
        @open="openDetails"
        @delete="askDelete"
        @restore="restore"
      />
    </div>

    <AssetDetailsDialog
      v-model="detailsOpen"
      :asset="selected"
      :usage="selectedUsage"
      :usage-loading="usageLoading"
      :usage-error="usageError"
      @retry-usage="loadUsage"
    />

    <ConfirmDialog
      v-model="confirmDelete"
      title="Move asset to trash?"
      :message="deleteMessage"
      confirm-label="Move to trash"
      destructive
      @confirm="remove"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatCard from '@/components/ui/StatCard.vue'
import TabNav from '@/components/ui/TabNav.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import AssetCard from '@/components/engage/content/AssetCard.vue'
import AssetDetailsDialog from '@/components/engage/content/AssetDetailsDialog.vue'
import {
  formatBytes,
  formatCount,
  useEngageAssets,
  useEngageAssetTrash,
  useEngageAssetUsage,
  useEngageContentToasts
} from '@/composables/useEngageContent'

// A library of files reads as a grid of tiles, not as a table: the type and the
// folder are what people scan for, and both are visual. Catalogs, one screen
// over, are rows of numbers and stay a DataTable.
const { toast } = useEngageContentToasts()

const {
  assets,
  loading,
  error,
  load,
  remove: removeAsset,
  insert: insertAsset
} = useEngageAssets()

const {
  deletedAssets,
  loading: trashLoading,
  error: trashError,
  load: loadTrash,
  remove: removeDeleted,
  insert: insertDeleted
} = useEngageAssetTrash()

const {
  loading: usageLoading,
  error: usageError,
  load: loadUsage,
  usedBy
} = useEngageAssetUsage()

const query = ref('')
const tab = ref('all')
const selected = ref(null)
const detailsOpen = ref(false)
const confirmDelete = ref(false)
const target = ref(null)

const TRASH_TAB = 'trash'
const inTrash = computed(() => tab.value === TRASH_TAB)

// Folders come out of the data rather than a fixed list: the library is what
// decides which folders exist, and an empty folder has no assets to name it.
const folders = computed(() => {
  const byId = new Map()
  for (const asset of assets.value) {
    const id = asset.folderId ?? 'unfiled'
    if (!byId.has(id)) {
      byId.set(id, { id, name: asset.folderName || 'Unfiled', count: 0 })
    }
    byId.get(id).count += 1
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
})

const tabs = computed(() => [
  { key: 'all', label: 'All', count: assets.value.length },
  ...folders.value.map(f => ({ key: f.id, label: f.name, count: f.count })),
  {
    key: TRASH_TAB,
    label: 'Trash',
    count: deletedAssets.value.length
  }
])

const totalBytes = computed(() =>
  assets.value.reduce((sum, a) => sum + Number(a.sizeBytes ?? 0), 0)
)

const unusedCount = computed(
  () => assets.value.filter(a => !Number(a.usedByCount ?? 0)).length
)

// Search covers everything visible on a tile — filename, folder, type and tags
// — so "brand" finds the folder and the tag alike.
function matches(asset) {
  const q = query.value.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    asset.name,
    asset.folderName,
    asset.type,
    ...(asset.tags ?? [])
  ]
  return haystack.some(v =>
    String(v ?? '')
      .toLowerCase()
      .includes(q)
  )
}

const source = computed(() =>
  inTrash.value ? deletedAssets.value : assets.value
)

const visible = computed(() =>
  source.value.filter(asset => {
    if (!matches(asset)) return false
    if (tab.value === 'all' || inTrash.value) return true
    return (asset.folderId ?? 'unfiled') === tab.value
  })
)

// "No hits" and "nothing here at all" need different copy and different CTAs,
// so the two cases are kept apart rather than collapsed into one message.
const filtered = computed(
  () => Boolean(query.value.trim()) || (!inTrash.value && tab.value !== 'all')
)

const emptyTitle = computed(() => {
  if (filtered.value) return 'No assets match your filters'
  return inTrash.value ? 'Trash is empty' : 'No assets yet'
})

const emptyDescription = computed(() => {
  if (filtered.value) {
    return 'Try a different search term, or switch back to the All tab.'
  }
  return inTrash.value
    ? 'Deleted assets stay here for 30 days before they are purged.'
    : 'Upload an image, a video or a document and campaigns can embed it.'
})

function clearFilters() {
  query.value = ''
  if (!inTrash.value) tab.value = 'all'
}

const selectedUsage = computed(() =>
  selected.value ? usedBy(selected.value.id) : []
)

function openDetails(asset) {
  selected.value = asset
  detailsOpen.value = true
}

function upload() {
  toast('Uploading is not wired up in this preview — no file was stored.')
}

function askDelete(asset) {
  target.value = asset
  confirmDelete.value = true
}

const deleteMessage = computed(() =>
  target.value
    ? `“${target.value.name}” stops being available to campaigns and moves to the trash, where it can be restored for 30 days.`
    : ''
)

function remove() {
  const asset = target.value
  if (!asset) return
  removeAsset(asset.id)
  insertDeleted({ ...asset, deletedAt: new Date().toISOString() })
  toast(`“${asset.name}” moved to trash`)
  target.value = null
}

function restore(asset) {
  removeDeleted(asset.id)
  // A restored asset is a live asset again — the deletion bookkeeping goes with
  // it, or the tile would keep reporting when it was deleted.
  const restored = { ...asset }
  delete restored.deletedAt
  delete restored.deletedBy
  delete restored.deletedByName
  insertAsset(restored)
  toast(`“${asset.name}” restored to ${asset.folderName || 'the library'}`)
}

onMounted(() => {
  load()
  loadTrash()
  loadUsage()
})
</script>
