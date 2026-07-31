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
      <span class="inline-block rotate-90 text-subtle sm:rotate-0">→</span>
    </div>

    <div
      class="flex-1 rounded-lg border px-4 py-3"
      :class="
        transform
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
        :class="transform ? 'text-brand' : 'text-subtle'"
        >{{ transform ? 'Custom function' : 'Pass-through' }}</p
      >
      <p class="truncate text-xs text-muted">{{
        transform
          ? 'Runs on every event before delivery'
          : 'Events are delivered unchanged'
      }}</p>
    </div>

    <div class="flex shrink-0 items-center justify-center px-1">
      <span class="inline-block rotate-90 text-subtle sm:rotate-0">→</span>
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
// The one-line story of a pipe: source → transformation → destination.
//
// Shared by the detail screen (where all three are known) and the create form
// (where the two ends fill in as the user picks them), which is why an empty
// label is a supported state rather than a bug — it renders the dashed
// "not selected yet" node instead of an empty box.
//
// Presentational only: no router, no fetching. The colour vocabulary is the
// house one — `bg-sidebar` nodes, `brand` for the active transform.
defineProps({
  sourceLabel: { type: String, default: '' },
  sourceHint: { type: String, default: '' },
  destinationLabel: { type: String, default: '' },
  destinationHint: { type: String, default: '' },
  transform: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Not selected' }
})
</script>
