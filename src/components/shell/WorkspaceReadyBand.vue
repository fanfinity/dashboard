<template>
  <!-- "You have an account and no source yet" — the one thing worth saying at
       the top of a Dashboard that has nothing to show.

       WHY IT IS NOT `SetupResumeBand`. That band answers "you left the arrival
       part-way", is keyed on the onboarding record, and its button re-opens the
       beats where they were parked. This one is keyed on the ACCOUNT — no
       source, whatever anybody did or did not do during sign-up — and its button
       goes to the create flow. Somebody who finished the arrival by skipping at
       the welcome, or who deleted their only source a month later, gets this
       one; the two are mutually exclusive on the page and neither is
       dismissible, because both describe a state that ends by itself the moment
       a source exists.

       WHY IT IS NOT A `NoticeBanner` EITHER: that primitive reports a problem
       and carries no action. Nothing here is wrong — the workspace is working,
       it is simply empty — so this reads as the first step of a sequence, which
       is what the numeral says. -->
  <div
    class="sfere-flush mb-4 flex flex-nowrap! items-start justify-between gap-4 rounded-sfere-xl border border-sfere-200 bg-sfere-50 p-4"
  >
    <div class="flex min-w-0 flex-1 flex-nowrap! items-start gap-3">
      <!-- `1`, and `aria-hidden` because the sentence beside it already says
           this is where to start. `items-start` and never `items-center`:
           `sfere.css` ships an unlayered `[class~='items-center'] > p` rule
           because centring a row centres each child's MARGIN box, which drops a
           paragraph beside a chip eight pixels low. -->
      <span
        class="grid size-[1.875rem] shrink-0 place-items-center rounded-sfere-lg bg-sfere-100 text-sfere-sm font-bold text-sfere-brand-text"
        aria-hidden="true"
        >1</span
      >

      <div class="sfere-flush grid min-w-0 flex-1 gap-1">
        <p class="text-sfere-sm font-semibold text-sfere-fg"
          >Your workspace is ready. Connect your first source when you’re
          ready.</p
        >
        <p class="text-pretty text-sfere-xs text-sfere-fg-muted">{{ body }}</p>
      </div>
    </div>

    <!-- `shrink-0` because the row is a Quasar-wrapping flex: without it a long
         title pushes the button onto a second line rather than squeezing the
         text (collision #4, and `min-w-0 flex-1` on the copy is the other half
         of the same fix). -->
    <SfereButton class="shrink-0" size="sm" :to="{ name: 'sources-new' }"
      >Connect a source</SfereButton
    >
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SfereButton from '@/components/ui/SfereButton.vue'

const props = defineProps({
  // True when the account already holds a ClickHouse destination — which
  // registration provisions, so it is the normal case. READ OFF THE RECORD by
  // the page rather than assumed here: the sentence below is the one place on
  // this screen that describes the warehouse, and the Dashboard aggregate is
  // what knows whether there is one.
  hasWarehouse: { type: Boolean, default: false }
})

// THE PROTOTYPE'S "INCLUDED WITH YOUR ACCOUNT" IS NOT REPEATED, for the reason
// `destinationProvisioning.js` gives at length: nothing on this payload measures
// billing, so "included" is a claim the screen cannot read. "Sfere covers its
// cost" survives as editorial — it is a statement about the product rather than
// a reading of a row — and it is the same sentence the Destinations hero
// carries.
const body = computed(() =>
  props.hasWarehouse
    ? 'Your Sfere Data Warehouse is already provisioned and powered by ClickHouse. Connect a source and Sfere builds the pipe into it in the same step.'
    : 'Nothing is connected yet. Sfere provisions your storage and the pipe into it in the same step, and covers the cost.'
)
</script>
