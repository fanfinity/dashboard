<template>
  <q-page class="p-6">
    <!-- Header -->
    <div class="mb-5">
      <h1 class="text-2xl! font-semibold! tracking-[-0.5px]! text-ink"
        >Integrations</h1
      >
      <p class="mt-1 text-sm text-muted"
        >Push verified segments to ad platforms.</p
      >
    </div>

    <!-- Platform cards -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="p in platforms"
        :key="p.name"
        class="rounded-xl border border-line2 bg-white p-4 shadow-sm"
        :class="p.connected ? 'border-brand/30' : ''"
      >
        <div class="flex items-center gap-2.5">
          <img :src="p.icon" :alt="p.name" class="size-8 shrink-0" />
          <span class="text-sm font-semibold text-ink">{{ p.name }}</span>
        </div>
        <button
          class="mt-4 h-9 w-full rounded-lg text-sm font-medium"
          :class="
            p.connected
              ? 'bg-brand text-white hover:opacity-90'
              : 'border border-line2 bg-white text-ink hover:bg-fill'
          "
        >
          {{ p.connected ? `Connected · synced ${p.synced}` : 'Connect' }}
        </button>
      </div>
    </div>

    <!-- Push a segment -->
    <div class="mt-6 rounded-xl border border-line2 bg-white p-5 shadow-sm">
      <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
        >Push a segment</h2
      >

      <div
        class="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
      >
        <!-- Select segment -->
        <div class="w-full max-w-xs">
          <label class="mb-1.5 block text-xs font-medium text-muted"
            >Select segment</label
          >
          <button
            class="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          >
            <span class="truncate">Hot Al-Hilal · Riyadh — 88,120 fans</span>
            <svg
              viewBox="0 0 16 16"
              class="size-3.5 shrink-0 text-subtle"
              fill="none"
            >
              <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>

        <!-- Destinations -->
        <div class="flex-1">
          <label class="mb-1.5 block text-xs font-medium text-muted"
            >Destinations</label
          >
          <div class="flex flex-wrap gap-2">
            <span
              v-for="p in platforms"
              :key="p.name"
              class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm"
              :class="
                p.connected
                  ? 'border-brand/40 bg-brand/5 text-brand'
                  : 'cursor-not-allowed border-line2 bg-fill text-subtle opacity-60'
              "
            >
              <img
                :src="p.icon"
                :alt="p.name"
                class="size-4 shrink-0"
                :class="p.connected ? '' : 'grayscale'"
              />
              {{ p.name }}
            </span>
          </div>
        </div>

        <!-- Action -->
        <div class="flex flex-col items-end gap-2">
          <p class="text-xs text-muted"
            >Estimated match rate
            <span class="font-semibold text-ink">78%</span></p
          >
          <button
            class="h-9 rounded-lg bg-brand px-4 text-sm font-medium text-white shadow-sm hover:opacity-90"
            >Push audience</button
          >
        </div>
      </div>

      <p class="mt-4 text-xs text-subtle"
        >Unconnected networks are disabled — connect them above to enable as
        destinations.</p
      >
    </div>
  </q-page>
</template>

<script setup>
import icSnapchat from '@/assets/dashboard/brand-snapchat.svg'
import icGoogle from '@/assets/dashboard/brand-google.svg'
import icMeta from '@/assets/dashboard/brand-meta.svg'
import icTiktok from '@/assets/dashboard/brand-tiktok.svg'

const platforms = [
  { name: 'Snapchat', icon: icSnapchat, connected: true, synced: '1h ago' },
  { name: 'Google Ads', icon: icGoogle, connected: false },
  { name: 'Meta', icon: icMeta, connected: false },
  { name: 'TikTok', icon: icTiktok, connected: false }
]
</script>
