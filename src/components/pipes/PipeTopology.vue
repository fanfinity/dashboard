<template>
  <div class="flex flex-col gap-4">
    <CardPanel v-for="group in groups" :key="group.source.id" :padded="false">
      <template #header>
        <div class="flex min-w-0 items-center gap-2">
          <p class="truncate text-sm font-medium text-ink">{{
            group.source.name
          }}</p>
          <StatusBadge
            :tone="group.source.isEnabled ? 'success' : 'neutral'"
            :label="group.source.isEnabled ? 'Enabled' : 'Paused'"
          />
        </div>
        <!-- Guarded for the same reason the pipe's delivery line below is:
             the diagram endpoint carries no per-source event counter (its
             `events_in_window` is a documented `0` until ClickHouse is wired),
             so an unguarded formatCount would print "Not known events / hr"
             against every source in real mode and a measured-looking figure
             only in Demo. Absent is better than either. -->
        <p
          v-if="group.source.eventCountLastHour != null"
          class="shrink-0 text-xs text-subtle"
          >{{ formatCount(group.source.eventCountLastHour) }} events / hr</p
        >
      </template>

      <div class="flex flex-col gap-2 p-4">
        <button
          v-for="link in group.links"
          :key="link.pipe.id"
          class="flex w-full items-center gap-3 rounded-lg border border-line2 bg-white px-3 py-2.5 text-left hover:bg-fill"
          @click="emit('select', link.pipe)"
        >
          <span class="hidden h-px w-6 shrink-0 bg-line2 sm:block"></span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2">
              <span class="truncate text-sm font-medium text-ink">{{
                link.pipe.name
              }}</span>
              <StatusBadge
                :tone="link.pipe.isEnabled ? 'success' : 'neutral'"
                :label="link.pipe.isEnabled ? 'Enabled' : 'Paused'"
              />
            </span>
            <!-- The pipeline record has no delivery counter, and
                 `formatCount` reads a missing one as 0 — which would report
                 "0 deliveries / hr" about every live pipe as if it were
                 measured. The list view's column is guarded the same way. -->
            <span
              v-if="link.pipe.deliveryCountLastHour != null"
              class="block text-xs text-subtle"
              >{{ formatCount(link.pipe.deliveryCountLastHour) }} deliveries /
              hr</span
            >
          </span>
          <span class="shrink-0 text-subtle">→</span>
          <span class="min-w-0 shrink-0 text-right">
            <span class="block truncate text-sm text-ink">{{
              link.destination.name
            }}</span>
            <span class="block text-xs text-subtle">{{
              link.destination.isEnabled
                ? 'Destination live'
                : 'Destination paused'
            }}</span>
          </span>
        </button>
      </div>
    </CardPanel>

    <CardPanel v-if="idle.length">
      <p class="text-xs font-medium text-subtle">Not connected</p>
      <p class="mt-1 text-xs text-muted"
        >These are configured but no pipe references them, so nothing flows
        through them yet.</p
      >
      <div class="mt-3 flex flex-wrap gap-2">
        <StatusBadge
          v-for="node in idle"
          :key="`${node.kind}-${node.id}`"
          tone="neutral"
          :label="`${node.name} · ${node.kind}`"
        />
      </div>
    </CardPanel>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { formatCount } from '@/composables/usePipes'

// The pipe graph, read left to right: one card per source, one row per pipe
// leaving it, the destination on the right.
//
// `links` is `useDiagram().nodes.links` — pipes whose endpoints already resolved,
// so this component never has to guard against an undefined source or
// destination. It groups rather than draws: a real node/edge canvas would need
// either an SVG layout engine or custom CSS, and this reads the same at a
// glance while staying inside the house primitives and Tailwind utilities.
//
// Sources and destinations with no pipe at all are surfaced in the trailing
// "Not connected" card — a destination nobody sends to is exactly the thing the
// topology view exists to make visible.
const props = defineProps({
  // [{ pipe, source, destination }]
  links: { type: Array, default: () => [] },
  sources: { type: Array, default: () => [] },
  destinations: { type: Array, default: () => [] }
})
const emit = defineEmits(['select'])

const groups = computed(() => {
  const bySource = new Map()
  for (const link of props.links) {
    const existing = bySource.get(link.source.id)
    if (existing) {
      existing.links.push(link)
    } else {
      bySource.set(link.source.id, { source: link.source, links: [link] })
    }
  }
  return [...bySource.values()]
})

const idle = computed(() => {
  const usedSources = new Set(props.links.map(l => l.source.id))
  const usedDestinations = new Set(props.links.map(l => l.destination.id))
  return [
    ...props.sources
      .filter(s => !usedSources.has(s.id))
      .map(s => ({ kind: 'source', id: s.id, name: s.name })),
    ...props.destinations
      .filter(d => !usedDestinations.has(d.id))
      .map(d => ({ kind: 'destination', id: d.id, name: d.name }))
  ]
})
</script>
