<template>
  <div
    class="flex items-center justify-center gap-2 rounded-lg border"
    :class="[tileClass, sizeClass]"
    role="img"
    :aria-label="`${meta.label} · ${extension}`"
  >
    <svg
      :class="glyphClass"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <template v-if="meta.glyph === 'image'">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9.5" r="1.5" />
        <path d="M21 16l-5-5-5 5-2-2-6 6" />
      </template>
      <template v-else-if="meta.glyph === 'video'">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M10 9.5l5 2.5-5 2.5z" />
      </template>
      <template v-else>
        <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6M9 17h4" />
      </template>
    </svg>

    <span
      v-if="showExtension"
      class="font-mono text-[10px] font-medium uppercase tracking-[0.4px]"
      >{{ extension }}</span
    >
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { assetTypeMeta, fileExtension } from '@/composables/useEngageContent'

// A typed placeholder tile, deliberately NOT a thumbnail of the file.
//
// The app's CSP is `default-src 'self'` with `img-src 'self'` and no `data:`
// URIs, so an asset hosted on assets.sfere.io cannot be rendered and a broken
// <img> is worse than no image at all. This draws an inline SVG glyph keyed on the asset's type plus
// the file extension, entirely from design tokens — no network, no data URI.
const props = defineProps({
  asset: { type: Object, required: true },
  size: {
    type: String,
    default: 'lg',
    validator: v => ['sm', 'lg'].includes(v)
  },
  showExtension: { type: Boolean, default: true }
})

const meta = computed(() => assetTypeMeta(props.asset.type))
const extension = computed(() => fileExtension(props.asset.name))

// Three token-only treatments, so a grid of mixed types is scannable without
// introducing a colour ramp the design system does not have.
const TILES = {
  image: 'border-brand/30 bg-brand/5 text-brand',
  video: 'border-line2 bg-sidebar text-muted',
  document: 'border-line2 bg-fill text-subtle'
}

const tileClass = computed(() => TILES[meta.value.glyph] ?? TILES.document)

const sizeClass = computed(() =>
  props.size === 'sm' ? 'h-12 w-12 flex-col gap-0.5' : 'h-24 w-full'
)

const glyphClass = computed(() => (props.size === 'sm' ? 'size-5' : 'size-8'))
</script>
