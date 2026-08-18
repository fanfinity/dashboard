<template>
  <q-dialog v-model="open">
    <!-- Deliberately NOT a flex column, unlike ConfirmDialog. Quasar's own
         `.flex` rule sets `flex-wrap: wrap` and is unlayered, so it beats every
         Tailwind flex utility (which live in a cascade layer) — a height-capped
         `flex flex-col` card wraps its overflow into a second column beside the
         first instead of scrolling. Plain block flow plus a capped, scrollable
         body is the shape that survives a long fact list. -->
    <q-card style="width: 560px; max-width: 92vw">
      <div
        class="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3.5"
      >
        <span class="min-w-0 truncate text-sm font-semibold text-ink">{{
          asset?.name ?? 'Asset'
        }}</span>
        <q-btn v-close-popup flat round dense icon="close" size="sm" />
      </div>

      <q-card-section
        v-if="asset"
        class="space-y-4 overflow-y-auto"
        style="max-height: 60vh"
      >
        <div class="flex items-center gap-3">
          <AssetThumbnail :asset="asset" size="sm" />
          <div class="min-w-0">
            <StatusBadge tone="neutral" :label="typeLabel" />
            <p class="mt-1.5 truncate text-xs text-subtle">{{ asset.url }}</p>
          </div>
        </div>

        <NoticeBanner
          tone="info"
          message="Remote files are not fetched in this preview, so the tile above is a typed placeholder rather than the real image."
        />

        <DefinitionList :items="facts" :columns="1">
          <template #value-tags>
            <div
              v-if="asset.tags?.length"
              class="flex flex-wrap justify-end gap-1"
            >
              <StatusBadge
                v-for="tag in asset.tags"
                :key="tag"
                tone="neutral"
                :label="tag"
              />
            </div>
            <span v-else class="text-subtle">—</span>
          </template>
        </DefinitionList>

        <div>
          <h3 class="mb-2 text-sm! font-semibold! tracking-[-0.35px]! text-ink"
            >Used by</h3
          >

          <LoadingState v-if="usageLoading" variant="table" :rows="2" />

          <!-- Campaign usage is secondary to the asset itself: it fails inside
               this panel, with its own retry, and the rest stays readable. -->
          <ErrorState
            v-else-if="usageError"
            title="Couldn't load the campaigns using this asset."
            :message="usageError"
            @retry="emit('retry-usage')"
          />

          <EmptyState
            v-else-if="!usage.length"
            variant="inline"
            title="No campaign uses this asset yet."
          />

          <ul v-else class="flex flex-col divide-y divide-line">
            <li
              v-for="campaign in usage"
              :key="campaign.id"
              class="flex items-center justify-between gap-3 py-2"
            >
              <div class="min-w-0">
                <p class="truncate text-sm text-ink">{{ campaign.name }}</p>
                <p class="truncate text-xs text-subtle">{{
                  campaign.journeyName || campaign.audienceName || campaign.id
                }}</p>
              </div>
              <StatusBadge tone="neutral" :label="campaign.channel" />
            </li>
          </ul>
        </div>
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
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import AssetThumbnail from '@/components/engage/content/AssetThumbnail.vue'
import {
  assetTypeMeta,
  formatBytes,
  formatDateTime,
  formatDimensions
} from '@/composables/useEngageContent'

// Read-out for one asset. There is no `/assets/:id` route in the manifest, so
// the library's detail view is a dialog rather than a page.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  asset: { type: Object, default: null },
  // Campaigns referencing this asset, loaded by the page as a secondary
  // resource so its failure never escalates past this panel.
  usage: { type: Array, default: () => [] },
  usageLoading: { type: Boolean, default: false },
  usageError: { type: String, default: null }
})

const emit = defineEmits(['update:modelValue', 'retry-usage'])

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

const typeLabel = computed(() =>
  props.asset ? assetTypeMeta(props.asset.type).label : ''
)

const facts = computed(() => {
  const a = props.asset
  if (!a) return []
  return [
    { label: 'Folder', value: a.folderName || 'Unfiled' },
    { label: 'Format', value: a.mimeType },
    { label: 'Dimensions', value: formatDimensions(a.width, a.height) },
    { label: 'Size', value: formatBytes(a.sizeBytes) },
    { label: 'Tags', value: (a.tags ?? []).join(', ') },
    { label: 'Version', value: a.version ? `v${a.version}` : null },
    { label: 'Uploaded by', value: a.uploadedByName },
    { label: 'Added', value: formatDateTime(a.createdAt) },
    { label: 'Updated', value: formatDateTime(a.updatedAt) }
  ]
})
</script>
