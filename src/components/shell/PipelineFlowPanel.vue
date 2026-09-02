<template>
  <CardPanel :padded="false">
    <template #header>
      <div>
        <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
          >Pipeline health</h2
        >
        <p class="mt-0.5 text-xs text-muted"
          >Sources feed pipes, pipes deliver to destinations. Volumes are the
          last hour.</p
        >
      </div>
      <div class="flex items-center gap-3 text-[11px] text-subtle">
        <span
          v-for="key in LEGEND"
          :key="key.tone"
          class="flex items-center gap-1.5"
        >
          <span class="size-1.5 rounded-full" :class="DOT[key.tone]" />
          {{ key.label }}
        </span>
      </div>
    </template>

    <div class="grid grid-cols-1 lg:grid-cols-3">
      <section
        v-for="(column, index) in columns"
        :key="column.title"
        class="border-line p-5"
        :class="index > 0 ? 'border-t lg:border-t-0 lg:border-l' : ''"
      >
        <header class="mb-3 flex items-baseline justify-between gap-2">
          <div class="flex items-center gap-1.5">
            <svg
              v-if="index > 0"
              viewBox="0 0 16 16"
              class="hidden size-3.5 shrink-0 text-subtle lg:block"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 3l5 5-5 5"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <!-- Important suffixes are required: Quasar styles bare h1-h6 with its
                 own font-size/weight/line-height, which otherwise wins and renders
                 these section labels at heading scale. -->
            <h3
              class="text-[11px]! font-semibold! uppercase leading-4! tracking-[0.4px]! text-subtle"
              >{{ column.title }}</h3
            >
          </div>
          <router-link
            :to="{ name: column.routeName }"
            class="text-xs font-medium text-brand hover:underline"
            >View all</router-link
          >
        </header>

        <p class="mb-3 text-sm text-muted">
          <span class="font-semibold text-ink">{{ column.flowing }}</span>
          of {{ column.total }} moving data
          <span v-if="column.enabled < column.total" class="text-subtle"
            >· {{ column.total - column.enabled }} paused</span
          >
        </p>

        <ul class="flex flex-col">
          <li
            v-for="item in column.items"
            :key="item.id"
            class="flex items-center justify-between gap-3 border-t border-line py-2 first:border-t-0"
          >
            <span class="flex min-w-0 items-center gap-2">
              <span
                class="size-1.5 shrink-0 rounded-full"
                :class="DOT[item.tone]"
              />
              <span class="min-w-0">
                <span class="block truncate text-sm text-ink">{{
                  item.name
                }}</span>
                <span class="block truncate text-[11px] text-subtle">{{
                  item.meta
                }}</span>
              </span>
            </span>
            <span
              class="shrink-0 text-xs tabular-nums"
              :class="item.volume > 0 ? 'font-medium text-ink' : 'text-subtle'"
              >{{ formatNumber(item.volume) }}</span
            >
          </li>
        </ul>

        <!-- EmptyState's default `card` variant is a full bordered surface, and
             nesting one inside a column of an already-bordered CardPanel reads
             as a card-in-a-card — hence `inline`, which is the same compact
             hint but keeps data-smoke="empty". -->
        <EmptyState
          v-if="!column.items.length"
          variant="inline"
          :title="EMPTY_HINT[column.routeName]"
        />
      </section>
    </div>
  </CardPanel>
</template>

<script setup>
import { NOT_KNOWN } from '@/lib/emptyValue'
import CardPanel from '@/components/ui/CardPanel.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { formatNumber } from '@/composables/useDashboardHome'

// Three tones, deliberately: green is the only "good", amber is the case worth
// acting on (switched on but nothing arriving), grey is intentionally off.
const DOT = {
  flowing: 'bg-success',
  idle: 'bg-amber-500',
  off: 'bg-line2'
}

const LEGEND = [
  { tone: 'flowing', label: 'Moving' },
  { tone: 'idle', label: 'Idle' },
  { tone: 'off', label: 'Paused' }
]

const EMPTY_HINT = {
  sources: 'Connect a source to start collecting fan signals.',
  pipes: 'A pipe routes one source into one destination.',
  destinations: 'Add a destination to activate this data.'
}

defineProps({
  columns: { type: Array, default: () => [] }
})
</script>
