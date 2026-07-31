<template>
  <!-- Grid: the connector-catalog skeleton, verbatim. -->
  <div
    v-if="variant === 'grid'"
    class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  >
    <q-skeleton v-for="n in rows" :key="n" height="74px" class="rounded-xl!" />
  </div>

  <!-- Form: label bar + control bar per field. -->
  <div v-else-if="variant === 'form'" class="flex flex-col gap-4">
    <div v-for="n in rows" :key="n" class="flex flex-col gap-1.5">
      <q-skeleton height="12px" width="96px" class="rounded-md!" />
      <q-skeleton height="36px" class="rounded-lg!" />
    </div>
  </div>

  <!-- Table: stacked full-width row bars. -->
  <div v-else class="flex flex-col gap-2">
    <q-skeleton v-for="n in rows" :key="n" height="44px" class="rounded-lg!" />
  </div>
</template>

<script setup>
// Skeleton placeholder for the three page shapes we actually build. `grid` is
// lifted verbatim from ConnectorsPage; `table` and `form` are composed from the
// same q-skeleton + rounded-* important-suffix idiom at the heights the real
// controls use (44px table row = px-5 py-3.5, 36px field = h-9).
defineProps({
  variant: {
    type: String,
    default: 'table',
    validator: v => ['table', 'grid', 'form'].includes(v)
  },
  rows: { type: Number, default: 6 }
})
</script>
