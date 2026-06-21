<template>
  <q-page class="p-6">
    <!-- Header -->
    <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl! font-semibold! tracking-[-0.5px]! text-ink"
          >Segments</h1
        >
        <p class="mt-1 text-sm text-muted"
          >Group verified, deduplicated fans into addressable audiences.</p
        >
      </div>
      <button
        class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
      >
        <svg viewBox="0 0 16 16" class="size-4" fill="none">
          <path
            d="M8 3.5v9M3.5 8h9"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
        New Segment
      </button>
    </div>

    <!-- Stat strip -->
    <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div
        v-for="s in stats"
        :key="s.label"
        class="rounded-xl border border-line2 bg-white p-4 shadow-sm"
      >
        <p class="text-sm text-muted">{{ s.label }}</p>
        <p class="mt-2 text-2xl font-semibold tracking-[-0.5px] text-ink">{{
          s.value
        }}</p>
      </div>
    </div>

    <!-- Segments table -->
    <div
      class="overflow-hidden rounded-xl border border-line2 bg-white shadow-sm"
    >
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-line text-left">
            <th
              v-for="h in tableHeads"
              :key="h"
              class="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle"
              :class="h === 'Fans' ? 'text-right' : ''"
              >{{ h }}</th
            >
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in segments"
            :key="row.name"
            class="border-b border-line last:border-0 hover:bg-sidebar"
          >
            <td class="px-5 py-4">
              <p class="font-medium text-ink">{{ row.name }}</p>
              <p class="mt-0.5 text-xs text-muted">{{ row.definition }}</p>
            </td>
            <td class="px-5 py-4 text-right font-medium text-ink">{{
              row.fans
            }}</td>
            <td class="px-5 py-4">
              <div class="flex items-center gap-2">
                <div class="h-2 w-24 rounded-full bg-fill">
                  <div
                    class="h-2 rounded-full bg-brand"
                    :style="{ width: row.index + '%' }"
                  />
                </div>
                <span class="text-xs font-medium text-ink">{{ row.index }}</span>
              </div>
            </td>
            <td class="px-5 py-4">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="src in row.sources"
                  :key="src"
                  class="inline-flex items-center rounded-md border border-line2 bg-fill px-1.5 py-0.5 text-[11px] text-muted"
                  >{{ src }}</span
                >
              </div>
            </td>
            <td class="px-5 py-4 text-subtle">{{ row.updated }}</td>
            <td class="px-5 py-4 text-right">
              <button
                class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-xs font-medium text-brand shadow-sm hover:bg-fill"
                >Push</button
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </q-page>
</template>

<script setup>
const tableHeads = [
  'Segment',
  'Fans',
  'Value index',
  'Sources',
  'Updated',
  ''
]

const stats = [
  { label: 'Total segments', value: '24' },
  { label: 'Addressable fans', value: '842K' },
  { label: 'Avg. match rate', value: '78%' }
]

const segments = [
  {
    name: 'Super Fans',
    definition: 'Engaged 5+ times · last 30 days',
    fans: '102,400',
    index: 100,
    sources: ['WhatsApp', 'Quizzes'],
    updated: '2h ago'
  },
  {
    name: 'Hot Al-Hilal',
    definition: 'Riyadh · Al-Hilal supporters',
    fans: '88,120',
    index: 76,
    sources: ['Polls', 'Tickets'],
    updated: '1d ago'
  },
  {
    name: 'La Liga readers',
    definition: 'Opened La Liga newsletter',
    fans: '64,310',
    index: 58,
    sources: ['Email'],
    updated: '3d ago'
  },
  {
    name: 'Match-day buyers',
    definition: 'Bought a ticket in last 90 days',
    fans: '41,890',
    index: 41,
    sources: ['Tickets', 'CRM'],
    updated: '4d ago'
  },
  {
    name: 'Lapsed fans',
    definition: 'No engagement · 60+ days',
    fans: '156,200',
    index: 22,
    sources: ['CRM'],
    updated: '6d ago'
  }
]
</script>
