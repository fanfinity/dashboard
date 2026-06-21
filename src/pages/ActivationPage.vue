<template>
  <q-page class="p-6">
    <!-- Header -->
    <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl! font-semibold! tracking-[-0.5px]! text-ink"
          >Activation</h1
        >
        <p class="mt-1 text-sm text-muted"
          >Engagement widgets you can publish to your properties.</p
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
        New Widget
      </button>
    </div>

    <!-- Widget type cards -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <button
        v-for="w in widgets"
        :key="w.title"
        class="flex items-start gap-3 rounded-xl border border-line2 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
      >
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/5 text-brand"
        >
          <svg viewBox="0 0 20 20" class="size-5" fill="none" v-html="w.icon" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink">{{
              w.title
            }}</h3>
            <span
              :class="badgeClass(w.status)"
              class="shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium"
              >{{ w.status }}</span
            >
          </div>
          <p class="mt-1 text-xs text-muted">{{ w.desc }}</p>
        </div>
      </button>
    </div>

    <!-- Live & scheduled -->
    <h2
      class="mb-3 mt-8 text-[11px]! font-semibold! uppercase tracking-[0.4px]! text-subtle"
      >Live &amp; scheduled</h2
    >
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
              :class="['Responses', 'Created'].includes(h) ? 'text-right' : ''"
              >{{ h }}</th
            >
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in live"
            :key="row.name"
            class="border-b border-line last:border-0"
          >
            <td class="px-5 py-4 font-medium text-ink">{{ row.name }}</td>
            <td class="px-5 py-4 text-muted">{{ row.type }}</td>
            <td class="px-5 py-4 text-muted">{{ row.property }}</td>
            <td class="px-5 py-4">
              <span
                :class="badgeClass(row.status)"
                class="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium"
                >{{ row.status }}</span
              >
            </td>
            <td class="px-5 py-4 text-right text-muted">{{ row.responses }}</td>
            <td class="px-5 py-4 text-right text-muted">{{ row.created }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </q-page>
</template>

<script setup>
const tableHeads = [
  'Widget',
  'Type',
  'Property',
  'Status',
  'Responses',
  'Created'
]

const widgets = [
  {
    title: 'Poll',
    desc: 'Ask a question, show live results.',
    status: 'Live',
    icon: '<path d="M4 11h3v5H4zM8.5 6h3v10h-3zM13 8h3v8h-3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
  },
  {
    title: 'Prediction',
    desc: 'Let fans call the match before kickoff.',
    status: 'Scheduled',
    icon: '<path d="M10 3v4m0 0a4 4 0 100 8 4 4 0 000-8zM10 11l2-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    title: 'Quiz',
    desc: 'Score fan knowledge, capture leads.',
    status: 'Completed',
    icon: '<path d="M7.5 7.5a2.5 2.5 0 113.2 2.4c-.7.3-1.2.9-1.2 1.6M9.5 14.5h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    title: 'Crowd meter',
    desc: 'Real-time sentiment from the stands.',
    status: 'Draft',
    icon: '<path d="M3 13a7 7 0 0114 0M10 13l3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    title: 'Image slider',
    desc: 'Before/after reveals and swipe galleries.',
    status: 'Draft',
    icon: '<rect x="3" y="5" width="14" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M10 5v10M6.5 9.5L5 11M13.5 9.5L15 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
  },
  {
    title: 'A/B test',
    desc: 'Split fans across two creative variants.',
    status: 'Draft',
    icon: '<path d="M5 5h4v4H5zM11 11h4v4h-4zM9 7h2a2 2 0 012 2v2" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
  }
]

const live = [
  {
    name: 'Who scores first?',
    type: 'Prediction',
    property: 'Koora Break',
    status: 'Live',
    responses: '12,430',
    created: 'Today'
  },
  {
    name: 'Name the GOAT',
    type: 'Quiz',
    property: 'SPL Weekly',
    status: 'Scheduled',
    responses: '—',
    created: '2d ago'
  },
  {
    name: 'Man of the match',
    type: 'Poll',
    property: 'Koora Break',
    status: 'Live',
    responses: '8,902',
    created: '5d ago'
  }
]

const STATUS = {
  Live: 'border-success-line bg-success-bg text-success',
  Scheduled: 'border-amber-200 bg-amber-50 text-amber-600',
  Completed: 'border-brand/20 bg-brand/5 text-brand',
  Draft: 'border-line2 bg-fill text-subtle'
}
function badgeClass(status) {
  return STATUS[status] || STATUS.Draft
}
</script>
