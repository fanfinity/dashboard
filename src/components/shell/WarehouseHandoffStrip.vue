<template>
  <!-- The analyst persona's one addition to Home: where the data goes once it
       has arrived. Everything else on this screen answers "is it flowing?" and
       nothing answered "how do I get it into my BI tool?", which is half of what
       that reader signed in for — and Warehouse connections was two clicks down
       a collapsed nav group.

       DELIBERATELY A STRIP AND NOT A CARD, and it carries no numbers. Home's
       aggregate (GET …/dashboard) returns nothing about warehouse connections,
       so a card with a count on it would either print a measurement nobody took
       or need a fourth read for one figure. A signpost states no facts it cannot
       back, which is the same reasoning as SetupReminderStrip's. Modelled on
       that component's markup so the two read as the same kind of object. -->
  <div
    class="flex flex-wrap items-center justify-between gap-3 rounded-sfere-lg border border-sfere-200 bg-sfere-50 px-4 py-3"
  >
    <p class="min-w-0 flex-1 text-sm text-sfere-brand-text">
      <span class="font-semibold">Getting the numbers out.</span>
      A warehouse connection is how Sfere hands this data to your BI tool.
      Scheduled syncs and warehouse models are not built yet.
    </p>
    <SfereLinkArrow :to="{ name: 'dwh-connections' }"
      >Warehouse connections</SfereLinkArrow
    >
  </div>
</template>

<script setup>
import SfereLinkArrow from '@/components/ui/SfereLinkArrow.vue'

// The second sentence is the honest half and is not padding: `dwh-syncs` and
// `warehouse-models` are switched off in src/config/features.js, so pointing an
// analyst at either would land them on ComingSoonPanel. Naming them as not-yet
// beats letting them find out by clicking, and beats a link to a Soon row that
// the sidebar already pills.
</script>
