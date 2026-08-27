<template>
  <div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-stretch">
    <div
      class="flex-1 rounded-lg border border-line2 bg-sidebar px-4 py-3"
      :class="sourceLabel ? '' : 'border-dashed'"
    >
      <p
        class="text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle"
        >Source</p
      >
      <p
        class="mt-1 truncate text-sm font-medium"
        :class="sourceLabel ? 'text-ink' : 'text-subtle'"
        >{{ sourceLabel || placeholder }}</p
      >
      <p v-if="sourceHint" class="truncate text-xs text-muted">{{
        sourceHint
      }}</p>
    </div>

    <div class="flex shrink-0 items-center justify-center px-1">
      <!-- `max-sm:rotate-90`, not `rotate-90 sm:rotate-0`. Quasar ships an
           unlayered `.rotate-90 { transform: rotate(90deg) }`, so the `sm:`
           reset never won and the arrow pointed DOWN between three
           side-by-side boxes at every width. Same shape of bug as a bare
           `hidden` — use the inverse variant, which names a class Quasar does
           not define. -->
      <span class="inline-block text-subtle max-sm:rotate-90">→</span>
    </div>

    <div
      class="flex-1 rounded-lg border px-4 py-3"
      :class="
        transform && transformKnown
          ? 'border-brand/30 bg-brand/5'
          : 'border-dashed border-line2 bg-sidebar'
      "
    >
      <p
        class="text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle"
        >Transformation</p
      >
      <p
        class="mt-1 truncate text-sm font-medium"
        :class="transform && transformKnown ? 'text-brand' : 'text-subtle'"
        >{{ transformText.label }}</p
      >
      <p class="truncate text-xs text-muted">{{ transformText.hint }}</p>
    </div>

    <div class="flex shrink-0 items-center justify-center px-1">
      <!-- `max-sm:rotate-90`, not `rotate-90 sm:rotate-0`. Quasar ships an
           unlayered `.rotate-90 { transform: rotate(90deg) }`, so the `sm:`
           reset never won and the arrow pointed DOWN between three
           side-by-side boxes at every width. Same shape of bug as a bare
           `hidden` — use the inverse variant, which names a class Quasar does
           not define. -->
      <span class="inline-block text-subtle max-sm:rotate-90">→</span>
    </div>

    <div
      class="flex-1 rounded-lg border border-line2 bg-sidebar px-4 py-3"
      :class="destinationLabel ? '' : 'border-dashed'"
    >
      <p
        class="text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle"
        >Destination</p
      >
      <p
        class="mt-1 truncate text-sm font-medium"
        :class="destinationLabel ? 'text-ink' : 'text-subtle'"
        >{{ destinationLabel || placeholder }}</p
      >
      <p v-if="destinationHint" class="truncate text-xs text-muted">{{
        destinationHint
      }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// The one-line story of a pipe: source → transformation → destination.
//
// Shared by the detail screen (where all three are known) and the create form
// (where the two ends fill in as the user picks them), which is why an empty
// label is a supported state rather than a bug — it renders the dashed
// "not selected yet" node instead of an empty box.
//
// Presentational only: no router, no fetching. The colour vocabulary is the
// house one — `bg-sidebar` nodes, `brand` for the active transform.
const props = defineProps({
  sourceLabel: { type: String, default: '' },
  sourceHint: { type: String, default: '' },
  destinationLabel: { type: String, default: '' },
  destinationHint: { type: String, default: '' },
  transform: { type: Boolean, default: false },
  // The transformation node is tri-state, unlike the two ends, which say
  // "unknown" by rendering their dashed empty label. `false` means a real
  // pass-through pipe; this says whether we asked at all. The backend's
  // pipeline record carries no such field, so the detail screen sets it false
  // and the create form — where the value is the user's own checkbox — leaves
  // the default. Without it, an unasked pipe advertised "Pass-through · Events
  // are delivered unchanged" as a fact.
  transformKnown: { type: Boolean, default: true },
  placeholder: { type: String, default: 'Not selected' }
})

const transformText = computed(() => {
  if (!props.transformKnown)
    return { label: 'Not known', hint: 'See the pipe\u2019s functions' }
  return props.transform
    ? { label: 'Custom function', hint: 'Runs on every event before delivery' }
    : { label: 'Pass-through', hint: 'Events are delivered unchanged' }
})
</script>
