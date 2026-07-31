<!--
  Fan Overview — the original demo surface, kept for demos.

  This predates the pipeline rebuild and is intentionally left as it was: the
  figures (age bands, city/gender splits, top segments, campaign table, CPM
  comparison) are hardcoded illustrations, not measured from the workspace. The
  operational dashboard at / is the real one.
-->
<template>
  <q-page class="p-6">
    <!-- Header -->
    <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl! font-semibold! tracking-[-0.5px]! text-ink"
          >Fan Overview</h1
        >
        <p class="mt-1 text-sm text-muted"
          >Koora Break – Saudi Pro League – 2026</p
        >
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="f in filters"
          :key="f"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
        >
          {{ f }}
          <svg viewBox="0 0 16 16" class="size-3.5 text-subtle" fill="none">
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
        >
          <svg viewBox="0 0 16 16" class="size-4" fill="none">
            <path
              d="M8 2v8m0 0L5 7m3 3l3-3M3 13h10"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Export
        </button>
      </div>
    </div>

    <!-- KPI cards -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="kpi in kpis"
        :key="kpi.label"
        class="rounded-xl border border-line2 bg-white p-4 shadow-sm"
      >
        <p class="text-sm text-muted">{{ kpi.label }}</p>
        <div class="mt-2 flex items-baseline gap-2">
          <span class="text-2xl font-semibold tracking-[-0.5px] text-ink">{{
            kpi.value
          }}</span>
          <span v-if="kpi.delta" class="text-xs font-medium text-success"
            >↑ {{ kpi.delta }}</span
          >
        </div>
      </div>
    </div>

    <!-- What this audience is worth -->
    <div class="mt-4 rounded-xl border border-line2 bg-white p-5 shadow-sm">
      <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
        >What this audience is worth</h2
      >
      <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="rounded-xl border border-line bg-fill p-4">
          <p
            class="text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle"
            >Before Fanfinity</p
          >
          <p class="mt-1 text-xs text-muted"
            >Anonymous impressions · IPSOS panel estimate</p
          >
          <p class="mt-3"
            ><span class="text-3xl font-semibold text-ink">$8</span>
            <span class="ml-1 text-sm text-muted">CPM</span></p
          >
        </div>
        <div class="relative rounded-xl border border-brand/30 bg-brand/5 p-4">
          <span
            class="absolute right-4 top-4 rounded-md bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand"
            >4x uplift</span
          >
          <p
            class="text-[11px] font-semibold uppercase tracking-[0.4px] text-brand"
            >With Fanfinity</p
          >
          <p class="mt-1 text-xs text-muted">Verified, deduplicated fans</p>
          <p class="mt-3"
            ><span class="text-3xl font-semibold text-brand">$32</span>
            <span class="ml-1 text-sm text-muted">CPM</span></p
          >
        </div>
      </div>
      <p class="mt-3 text-xs italic text-subtle"
        >Illustrative figures for demo purposes.</p
      >
    </div>

    <!-- Charts row -->
    <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <!-- Reach over time -->
      <div class="rounded-xl border border-line2 bg-white p-5 shadow-sm">
        <h3 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
          >Reach over time</h3
        >
        <p class="mt-0.5 text-xs text-muted">Last 30 days · Illustrative</p>
        <svg viewBox="0 0 320 120" class="mt-4 h-28 w-full" fill="none">
          <polyline
            :points="reachPoints"
            stroke="var(--color-brand)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <div class="mt-2 flex justify-between text-[11px] text-subtle">
          <span>12 May</span><span>26 May</span><span>11 Jun</span>
        </div>
      </div>

      <!-- Demographics -->
      <div class="rounded-xl border border-line2 bg-white p-5 shadow-sm">
        <h3 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
          >Demographics</h3
        >
        <p class="mt-0.5 text-xs text-muted"
          >Age · gender · cities · Illustrative</p
        >
        <div class="mt-4 space-y-2">
          <div
            v-for="row in ageBands"
            :key="row.label"
            class="flex items-center gap-3"
          >
            <span class="w-12 text-xs text-muted">{{ row.label }}</span>
            <div class="h-2 flex-1 rounded-full bg-fill">
              <div
                class="h-2 rounded-full bg-brand"
                :style="{ width: row.pct + '%' }"
              />
            </div>
            <span class="w-8 text-right text-xs font-medium text-ink"
              >{{ row.pct }}%</span
            >
          </div>
        </div>
        <div class="mt-4 border-t border-line pt-3 text-xs text-muted">
          <p
            >M <span class="font-medium text-ink">69%</span> · F
            <span class="font-medium text-ink">31%</span></p
          >
          <p class="mt-1"
            >Riyadh <span class="font-medium text-ink">52%</span> · Jeddah
            <span class="font-medium text-ink">29%</span> · Dammam
            <span class="font-medium text-ink">19%</span></p
          >
        </div>
      </div>

      <!-- Top segments by value -->
      <div class="rounded-xl border border-line2 bg-white p-5 shadow-sm">
        <h3 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
          >Top segments by value</h3
        >
        <p class="mt-0.5 text-xs text-muted">Indexed · Illustrative</p>
        <div class="mt-4 space-y-3">
          <div v-for="row in topSegments" :key="row.label">
            <div class="mb-1 flex items-center justify-between text-xs">
              <span class="text-muted">{{ row.label }}</span>
              <span class="font-medium text-ink">{{ row.value }}</span>
            </div>
            <div class="h-2 rounded-full bg-fill">
              <div
                class="h-2 rounded-full bg-brand"
                :style="{ width: row.value + '%' }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Campaign table -->
    <div
      class="mt-4 overflow-hidden rounded-xl border border-line2 bg-white shadow-sm"
    >
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-line text-left">
            <th
              class="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle"
              >Campaign</th
            >
            <th
              class="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle"
              >Reach</th
            >
            <th
              class="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle"
              >Engagements</th
            >
            <th
              class="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle"
              >CPM</th
            >
            <th
              class="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle"
              >Status</th
            >
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in campaigns"
            :key="row.name"
            class="border-b border-line last:border-0"
          >
            <td class="px-5 py-4 font-medium text-ink">{{ row.name }}</td>
            <td class="px-5 py-4 text-right text-muted">{{ row.reach }}</td>
            <td class="px-5 py-4 text-right text-muted">{{
              row.engagements
            }}</td>
            <td class="px-5 py-4 text-right text-muted">{{ row.cpm }}</td>
            <td class="px-5 py-4 text-right">
              <span
                :class="
                  row.status === 'Live'
                    ? 'border-success-line bg-success-bg text-success'
                    : 'border-line2 bg-fill text-subtle'
                "
                class="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium"
                >{{ row.status }}</span
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </q-page>
</template>

<script setup>
const filters = ['Last 30 days', 'Property: All', 'Campaign: All']

const kpis = [
  { label: 'Verified unique reach', value: '1.24M' },
  { label: 'Verified fans', value: '842K' },
  { label: 'Engagements', value: '3.1M' },
  { label: 'Avg. CPM', value: '$32', delta: '4%' }
]

// Illustrative upward trend, plotted into a 320×120 viewBox.
const reachSeries = [22, 30, 26, 38, 34, 48, 44, 60, 56, 72, 80, 96]
const reachPoints = reachSeries
  .map((v, i) => {
    const x = (i / (reachSeries.length - 1)) * 320
    const y = 120 - (v / 100) * 110 - 5
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  .join(' ')

const ageBands = [
  { label: '18–24', pct: 34 },
  { label: '25–34', pct: 41 },
  { label: '35–44', pct: 17 },
  { label: '45+', pct: 8 }
]

const topSegments = [
  { label: 'Super Fans', value: 100 },
  { label: 'Hot Al-Hilal', value: 76 },
  { label: 'La Liga readers', value: 58 },
  { label: 'Match-day buyers', value: 41 }
]

const campaigns = [
  {
    name: 'Ramadan 2026',
    reach: '612K',
    engagements: '1.4M',
    cpm: '$34',
    status: 'Live'
  },
  {
    name: 'SPL Matchweek 22',
    reach: '410K',
    engagements: '920K',
    cpm: '$30',
    status: 'Ended'
  }
]
</script>
