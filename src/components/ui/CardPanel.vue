<template>
  <div class="rounded-xl border border-line2 bg-white shadow-sm">
    <div
      v-if="$slots.header"
      class="flex items-center justify-between border-b border-line px-5 py-3.5"
    >
      <slot name="header" />
    </div>
    <div :class="padded ? 'p-5' : ''">
      <slot />
    </div>
    <div
      v-if="$slots.footer"
      class="flex items-center justify-between border-t border-line px-5 py-3"
    >
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
// Generic white surface. The shell classes are the ones every existing card in
// the app already uses (DashboardHomePage KPI cards, ConnectorsPage error card,
// ContactsPage table wrapper); the header/footer rules match
// SegmentBuilderDialog's header and ContactsPage's pagination footer.
// Pass `:padded="false"` when the slot content brings its own padding — e.g. a
// full-bleed table.
defineProps({
  padded: { type: Boolean, default: true }
})
</script>
