<template>
  <q-footer
    class="border-t border-line2 bg-ink! text-white"
    data-smoke="demo-mode-banner"
  >
    <div
      class="flex h-9 items-center justify-center gap-2 px-3 text-center text-xs font-medium tracking-[-0.2px]"
    >
      <span class="size-1.5 shrink-0 rounded-full bg-sfere-warn" />
      <span>Viewing demo data — nothing here is saved.</span>
      <router-link
        to="/settings"
        class="underline decoration-white/40 underline-offset-2 hover:decoration-white"
      >
        Settings → Data source
      </router-link>
    </div>
  </q-footer>
</template>

<script setup>
// Standing state indicator, not a one-time consent prompt like
// JitsuConsentBanner — it stays up for as long as useDataSource().isMock is
// true, which today is effectively always (no domain has a real backend yet).
// A q-footer rather than a hand-rolled fixed bar: MainLayout's
// view="lHh Lpr lFf" already reserves footer space, so page content gets the
// right bottom padding for free instead of needing z-index/padding bookkeeping
// here.
</script>
