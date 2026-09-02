<template>
  <CardPanel>
    <div class="mb-3 flex items-baseline justify-between gap-2">
      <div>
        <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
          >Fan profiles</h2
        >
        <p class="mt-0.5 text-xs text-muted">{{ description }}</p>
      </div>
      <router-link
        :to="{ name: 'profiles-search' }"
        class="shrink-0 text-xs font-medium text-brand hover:underline"
        >Search profiles</router-link
      >
    </div>

    <dl class="mb-4 grid grid-cols-3 gap-3">
      <div v-for="tile in tiles" :key="tile.label">
        <dt class="text-xs text-subtle">{{ tile.label }}</dt>
        <dd class="mt-0.5 text-lg font-semibold text-ink">{{ tile.value }}</dd>
      </div>
    </dl>

    <p
      class="mb-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle"
      >Recently updated</p
    >
    <ActivityList :items="items" empty-text="No profiles resolved yet." />
  </CardPanel>
</template>

<script setup>
import CardPanel from '@/components/ui/CardPanel.vue'
import ActivityList from '@/components/shell/ActivityList.vue'

// Lifted out of DashboardHomePage so Home can order its blocks per persona; see
// ThroughputPanel for why that is an extraction and not a CSS `order`.
//
// `description` is a prop because this block leads the page for a marketer and
// sits fifth for an engineer, and the sentence that makes sense under a heading
// halfway down the screen ("Resolved fans built from the events above") is a
// forward reference to nothing when the block is first.
defineProps({
  tiles: { type: Array, default: () => [] },
  items: { type: Array, default: () => [] },
  description: {
    type: String,
    default: 'Resolved fans built from the events above.'
  }
})
</script>
