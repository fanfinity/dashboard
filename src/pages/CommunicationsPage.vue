<template>
  <q-page class="p-6">
    <!-- Header -->
    <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl! font-semibold! tracking-[-0.5px]! text-ink"
          >Communication</h1
        >
        <p class="mt-1 text-sm text-muted"
          >Reach your segments across WhatsApp, Email and SMS.</p
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
        New Journey
      </button>
    </div>

    <!-- Channel summary cards -->
    <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div
        v-for="c in channelStats"
        :key="c.name"
        class="flex items-center gap-3 rounded-xl border border-line2 bg-white p-4 shadow-sm"
      >
        <span
          class="flex size-9 items-center justify-center rounded-lg"
          :class="c.dotBg"
        >
          <span class="size-2.5 rounded-full" :class="c.dot" />
        </span>
        <div>
          <p class="text-sm font-semibold text-ink">{{ c.name }}</p>
          <p class="text-xs text-muted"
            >{{ c.sent }} sent · {{ c.rate }} delivered</p
          >
        </div>
      </div>
    </div>

    <!-- Journeys table -->
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
              :class="
                ['Sent', 'Delivered', 'Updated'].includes(h) ? 'text-right' : ''
              "
              >{{ h }}</th
            >
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in journeys"
            :key="row.name + row.segment"
            class="border-b border-line last:border-0 hover:bg-sidebar"
          >
            <td class="px-5 py-4 font-medium text-ink">{{ row.name }}</td>
            <td class="px-5 py-4">
              <span
                class="inline-flex items-center rounded-md border border-line2 bg-fill px-2 py-0.5 text-xs text-muted"
                >{{ row.segment }}</span
              >
            </td>
            <td class="px-5 py-4">
              <span class="inline-flex items-center gap-2 text-muted">
                <span
                  class="size-2 rounded-full"
                  :class="channelDot(row.channel)"
                />
                {{ row.channel }}
              </span>
            </td>
            <td class="px-5 py-4">
              <span
                :class="badgeClass(row.status)"
                class="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium"
                >{{ row.status }}</span
              >
            </td>
            <td class="px-5 py-4 text-right text-muted">{{ row.sent }}</td>
            <td class="px-5 py-4 text-right text-muted">{{ row.delivered }}</td>
            <td class="px-5 py-4 text-right text-subtle">{{ row.updated }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </q-page>
</template>

<script setup>
const tableHeads = [
  'Journey',
  'Segment',
  'Channel',
  'Status',
  'Sent',
  'Delivered',
  'Updated'
]

const channelStats = [
  {
    name: 'WhatsApp',
    sent: '142K',
    rate: '98%',
    dot: 'bg-success',
    dotBg: 'bg-success-bg'
  },
  {
    name: 'Email',
    sent: '88K',
    rate: '94%',
    dot: 'bg-brand',
    dotBg: 'bg-brand/5'
  },
  {
    name: 'SMS',
    sent: '31K',
    rate: '99%',
    dot: 'bg-amber-500',
    dotBg: 'bg-amber-50'
  }
]

const journeys = [
  {
    name: 'Match Day Reminder',
    segment: 'VIP Fan',
    channel: 'WhatsApp',
    status: 'Live',
    sent: '38,011',
    delivered: '97%',
    updated: '1d ago'
  },
  {
    name: 'Ticket Pre-sale',
    segment: 'Travel Fan',
    channel: 'WhatsApp',
    status: 'Live',
    sent: '22,180',
    delivered: '98%',
    updated: '3d ago'
  },
  {
    name: 'Welcome Series',
    segment: 'Loyal Fan',
    channel: 'Email',
    status: 'Live',
    sent: '12,277',
    delivered: '95%',
    updated: '4d ago'
  },
  {
    name: 'Re-engage Lapsed',
    segment: 'Hot Streak',
    channel: 'SMS',
    status: 'Paused',
    sent: '6,420',
    delivered: '99%',
    updated: '6d ago'
  },
  {
    name: 'Half-time Offer',
    segment: 'Repeat Fan',
    channel: 'WhatsApp',
    status: 'Draft',
    sent: '—',
    delivered: '—',
    updated: '8d ago'
  },
  {
    name: 'Newsletter Digest',
    segment: 'Regular Fan',
    channel: 'Email',
    status: 'Scheduled',
    sent: '—',
    delivered: '—',
    updated: '10d ago'
  }
]

const CHANNEL_DOT = {
  WhatsApp: 'bg-success',
  Email: 'bg-brand',
  SMS: 'bg-amber-500'
}
function channelDot(channel) {
  return CHANNEL_DOT[channel] || 'bg-subtle'
}

const STATUS = {
  Live: 'border-success-line bg-success-bg text-success',
  Scheduled: 'border-amber-200 bg-amber-50 text-amber-600',
  Paused: 'border-brand/20 bg-brand/5 text-brand',
  Draft: 'border-line2 bg-fill text-subtle'
}
function badgeClass(status) {
  return STATUS[status] || STATUS.Draft
}
</script>
