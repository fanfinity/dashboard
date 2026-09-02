<template>
  <q-item
    clickable
    :aria-pressed="String(selected)"
    class="min-h-0! rounded-xl! p-4! flex items-start gap-3 border bg-white shadow-sm hover:shadow-md transition-shadow"
    :class="rootClasses"
    @click="onClick"
  >
    <!-- Logo -->
    <div
      class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-fill"
    >
      <img
        v-if="logo && !logoFailed"
        :src="logo"
        :alt="connector.name"
        class="size-6 object-contain"
        @error="logoFailed = true"
      />
      <img v-else :src="icSources" alt="" class="size-5 opacity-60" />
    </div>

    <!-- Text -->
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <h3
          class="truncate text-sm! font-semibold! tracking-[-0.35px]! text-ink"
        >
          {{ connector.name }}
        </h3>
        <!-- Only the fixture carries a licence; the wire `Connector` has no
             such field, so the chip is absent in real mode rather than blank. -->
        <span
          v-if="connector.license"
          class="shrink-0 rounded bg-fill px-1.5 py-0.5 text-[10px] font-medium text-subtle"
        >
          {{ connector.license }}
        </span>
        <!-- `beta` and `coming_soon` are real catalog states. A `coming_soon`
             card is shown and not selectable — the catalog is also a roadmap,
             and hiding the row would answer "does this exist?" with silence. -->
        <StatusBadge
          v-if="connector.statusLabel"
          :tone="connector.status === 'beta' ? 'warn' : 'neutral'"
          :label="connector.statusLabel"
        />
      </div>
      <p class="mt-0.5 truncate text-xs text-muted">{{
        connector.packageId
      }}</p>
      <p
        v-if="connector.description"
        class="mt-1 line-clamp-2 text-xs text-subtle"
        >{{ connector.description }}</p
      >
      <!-- Stated on the card rather than discovered inside the form: an OAuth
           connector cannot be configured from credentials alone, and finding
           that out after filling three fields in is the worse order. -->
      <p v-if="connector.requiresOauth" class="mt-1 text-xs text-brand"
        >Needs authorisation first</p
      >
    </div>
  </q-item>
</template>

<script setup>
import { computed, ref } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import icSources from '@/assets/dashboard/ic-sources.svg'

// `connector` is the normalised record from `useConnectorCatalog`'s two
// adapters, not a raw payload from either side — see `adaptConnector()` there.
//
// `iconUrl` is only ever set by the fixture and is allowed to be null. The live
// `Connector` carries `icon` as a SLUG (`"zid"`, `"firebase"`), which the
// adapter keeps as `iconSlug` and never promotes to a URL: under
// `img-src 'self'` a request built from it is blocked, and there is no
// per-connector asset in this bundle to point it at. Either way the bundled
// glyph is the fallback, so a missing image degrades to what it always did.
const props = defineProps({
  connector: { type: Object, required: true },
  // Marked while its connect form is open below the grid, so it is obvious which
  // of two dozen cards the form belongs to. `border-*!` carries the important
  // suffix because the base class list already sets a border colour on the same
  // element and Quasar's q-item styling is unlayered.
  selected: { type: Boolean, default: false }
})

const emit = defineEmits(['select'])

const logoFailed = ref(false)
const logo = props.connector.iconUrl || null

// A `coming_soon` catalog entry is shown and not pickable. Quasar's unlayered
// `[disabled] { opacity: .6; cursor: not-allowed }` owns the disabled look, so
// the dimming is done with a colour Quasar does not set rather than with the
// `disabled:` utilities that are dead classes in this repo.
const rootClasses = computed(() => [
  props.selected
    ? 'border-sfere-400! ring-2 ring-sfere-500/25'
    : 'border-line2',
  props.connector.selectable === false ? 'bg-fill! text-subtle' : ''
])

function onClick() {
  if (props.connector.selectable === false) return
  emit('select', props.connector)
}
</script>
