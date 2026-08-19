<template>
  <CardPanel
    class="min-w-0 cursor-pointer hover:border-brand/30"
    role="button"
    tabindex="0"
    :aria-label="`Open details for ${asset.name}`"
    @click="emit('open', asset)"
    @keydown.enter.prevent="emit('open', asset)"
    @keydown.space.prevent="emit('open', asset)"
  >
    <AssetThumbnail :asset="asset" />

    <div class="mt-3 min-w-0">
      <p class="truncate text-sm font-medium text-ink" :title="asset.name">{{
        asset.name
      }}</p>
      <p class="mt-0.5 truncate text-xs text-subtle">
        {{ typeLabel }} · {{ formatBytes(asset.sizeBytes) }} ·
        {{ asset.folderName || 'Unfiled' }}
      </p>
    </div>

    <div v-if="asset.tags?.length" class="mt-2.5 flex flex-wrap gap-1">
      <StatusBadge
        v-for="tag in asset.tags"
        :key="tag"
        tone="neutral"
        :label="tag"
      />
    </div>

    <div
      class="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3"
    >
      <p class="min-w-0 truncate text-xs text-subtle">{{ footnote }}</p>

      <button
        v-if="deleted"
        class="shrink-0 rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
        @click.stop="emit('restore', asset)"
      >
        Restore
      </button>
      <button
        v-else
        class="shrink-0 rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill"
        @click.stop="emit('delete', asset)"
      >
        Delete
      </button>
    </div>
  </CardPanel>
</template>

<script setup>
import { computed } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import AssetThumbnail from '@/components/engage/content/AssetThumbnail.vue'
import {
  assetTypeMeta,
  formatBytes,
  formatDate
} from '@/composables/useEngageContent'

// One tile in the asset library grid. The whole card opens the details dialog,
// so the row action carries `@click.stop` — without it, deleting an asset also
// opens the asset it just deleted.
//
// CardPanel has no `min-w-0` of its own, so it is added here: a grid child
// defaults to `min-width: auto` and a long filename would otherwise widen the
// column instead of truncating.
const props = defineProps({
  asset: { type: Object, required: true },
  // Trash tiles swap Delete for Restore and report when they were deleted.
  deleted: { type: Boolean, default: false }
})

const emit = defineEmits(['open', 'delete', 'restore'])

const typeLabel = computed(() => assetTypeMeta(props.asset.type).label)

const footnote = computed(() => {
  if (props.deleted) return `Deleted ${formatDate(props.asset.deletedAt)}`
  const used = Number(props.asset.usedByCount ?? 0)
  if (!used) return 'Not used yet'
  return `Used by ${used} campaign${used === 1 ? '' : 's'}`
})
</script>
