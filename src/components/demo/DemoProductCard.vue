<template>
  <SelectableCard :selected="selected" @select="emit('select')">
    <div class="flex w-full items-start justify-between gap-3">
      <span
        class="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand/5 text-brand"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-6"
          aria-hidden="true"
        >
          <path v-for="(d, i) in art" :key="i" :d="d" />
        </svg>
      </span>
      <StatusBadge v-if="selected" tone="brand" label="Selected" />
    </div>

    <p class="mt-3 text-sm font-medium text-ink">{{ product.name }}</p>
    <p class="mt-1 text-xs leading-5 text-muted">{{ product.description }}</p>

    <div class="mt-3 flex w-full items-center justify-between gap-2">
      <span class="text-sm font-medium text-ink">{{ price }}</span>
      <span class="font-mono text-[11px] text-subtle">{{ product.sku }}</span>
    </div>
  </SelectableCard>
</template>

<script setup>
import { computed } from 'vue'
import SelectableCard from '@/components/ui/SelectableCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { formatPrice } from '@/composables/useDemoStorefront'

// One product tile in the demo storefront. SelectableCard already is a real
// focusable <button> carrying aria-pressed, so this only fills its slot.
//
// The artwork is inline SVG paths rather than an image: the app's CSP is
// `default-src 'self'` and `assetsInlineLimit` is 0, so a remote picture is
// blocked and a data: URI is blocked too. Line drawings in the brand token are
// enough to tell four products apart.
const props = defineProps({
  product: { type: Object, required: true },
  selected: { type: Boolean, default: false }
})
const emit = defineEmits(['select'])

const ART = {
  jersey: ['M9 3 4.5 5.2V10H7v11h10V10h2.5V5.2L15 3', 'M9 3a3 3 0 0 0 6 0'],
  ticket: [
    'M3 8.5A1.5 1.5 0 0 1 4.5 7h15A1.5 1.5 0 0 1 21 8.5v1.7a2 2 0 0 0 0 3.6v1.7a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5v-1.7a2 2 0 0 0 0-3.6Z',
    'M14 7v10'
  ],
  scarf: ['M8 3h3v13l-1.5 5L8 16Z', 'M13 3h3v13l-1.5 5L13 16Z', 'M8 7h8'],
  pass: ['M3 6h18v12H3z', 'M3 10h18', 'M7 14h4', 'M16 14h1']
}

const art = computed(() => ART[props.product.art] ?? ART.pass)
const price = computed(() => formatPrice(props.product.price))
</script>
