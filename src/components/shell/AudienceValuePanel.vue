<template>
  <CardPanel>
    <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
      >What this audience is worth</h2
    >
    <p class="mt-0.5 text-xs text-muted"
      >Why the pipeline exists: resolved, consented fans price differently from
      anonymous impressions.</p
    >

    <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      <div class="rounded-xl border border-line bg-fill p-4">
        <p
          class="text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle"
          >Before Fanfinity</p
        >
        <p class="mt-1 text-xs text-muted"
          >Anonymous impressions · panel estimate</p
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
      >Illustrative figures for demo purposes — not measured from this
      workspace.</p
    >
  </CardPanel>
</template>

<script setup>
import CardPanel from '@/components/ui/CardPanel.vue'

// Kept from the previous Fanfinity overview screen. It is the one place in the
// app that states the commercial thesis behind the CDP, and it is explicitly
// labelled illustrative — the company rule is that made-up numbers are allowed
// only when they are tiered honestly. Everything else on this page is derived
// from mock payloads, so this block is deliberately the last thing on it.
</script>
