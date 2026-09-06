<template>
  <!-- Touchpoints, then a wire, then the Sfere mark, then a wire, then the
       outcome. One picture of the whole product, on the one screen where the
       reader has no account to look at yet.

       A CONTAINER QUERY, NOT `lg:`. The sidebar is not on screen here, so the
       viewport and the content width happen to agree today — but this component
       is 5 columns wide and the arrival is centred inside a page that has a
       max-width, so the question it needs answered is "how wide am I?", not "how
       wide is the window". Collision #6 in CLAUDE.md is the general form.

       `@container` and the element reading the query must be two different
       nodes: a container query is answered by a container's descendants, never
       by the container itself. -->
  <div class="@container">
    <div
      class="grid gap-6 rounded-sfere-xl border border-sfere-line bg-sfere-surface px-6 py-6 @min-[46rem]:grid-cols-[9.375rem_1fr_11.25rem_1fr_11.875rem] @min-[46rem]:items-center @min-[46rem]:gap-0 @min-[46rem]:px-[2.125rem] @min-[46rem]:py-7"
      aria-hidden="true"
    >
      <!-- WHY `aria-hidden`: every word in here is said again in the copy above
           and below it — the three touchpoints are the four cards on the next
           beat, and "Capture, Connect, Deliver" is the numbered list. A screen
           reader walking a decorative diagram would hear the same page twice.

           Stacked on a narrow container rather than reflowed: three columns of
           14px pills at 380px is unreadable, and the wires between them carry
           no information a vertical list loses. -->

      <!-- The touchpoints. `grid gap-*`, never `flex flex-col`: Quasar's
           unlayered `.flex` is `display:flex; flex-wrap:wrap`, so a flex column
           under any height constraint wraps into a second column instead of
           scrolling (collision #4). Grid has no Quasar counterpart. -->
      <div class="grid gap-1.5">
        <div
          v-for="point in flow.touchpoints"
          :key="point.key"
          class="flex min-w-0 flex-nowrap! items-center gap-2 rounded-sfere border border-sfere-line bg-sfere-surface px-2 py-1.5 text-sfere-xs text-sfere-fg-muted"
        >
          <FlowNodeIcon
            kind="source"
            :subtype="point.mark"
            :size="14"
            class="shrink-0 text-sfere-brand-text"
          />
          <span class="min-w-0 truncate">{{ point.label }}</span>
        </div>
      </div>

      <OnboardingFlowWire />

      <!-- The hub. The full lockup rather than the `mark` cut, which is what
           the prototype puts here and the right call: the mark alone is an
           abstract cluster of dots, and this is the one place in the picture
           that has to be read as "Sfere" by somebody who has been using the
           product for ninety seconds.

           `h-6` DOES THE SIZING, not the `height` prop. That prop is inert
           app-wide — Tailwind preflight ships `img, video { height: auto }` in
           `@layer base` and the component only sets a `height` attribute, which
           any author rule beats. It stays for the intrinsic ratio it puts on the
           element. -->
      <div class="sfere-flush grid justify-items-center gap-2.5">
        <SfereLogo :height="24" class="h-6" />
        <!-- Plain muted text with a hairline separator, NOT three pills. The
             prototype drew pills first and overrode them away two revisions
             later, and the final reading is the right one: three chips beside
             the wordmark compete with the touchpoint pills on the left, and
             these are not things you can click. -->
        <p
          class="flex flex-wrap items-center justify-center gap-[0.4375rem] whitespace-nowrap text-center text-sfere-xs text-sfere-fg-muted"
        >
          <template v-for="(word, i) in flow.capabilities" :key="word">
            <span v-if="i > 0" class="text-sfere-fg-muted/50">•</span>
            <span>{{ word }}</span>
          </template>
        </p>
      </div>

      <OnboardingFlowWire />

      <!-- The outcome. A card rather than a third bare column, because it is the
           end of the sentence the two wires are drawing and needs to look like
           somewhere the movement arrives. -->
      <div
        class="sfere-flush grid gap-1 rounded-sfere-lg border border-sfere-200 bg-sfere-50 px-3.5 py-3"
      >
        <p
          class="font-sfere-mono text-sfere-eyebrow uppercase text-sfere-700"
          >{{ flow.result.kicker }}</p
        >
        <p class="text-sfere-sm font-semibold text-sfere-fg">{{
          flow.result.title
        }}</p>
        <p class="text-sfere-xs text-sfere-fg-muted">{{ flow.result.body }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import SfereLogo from '@/components/ui/SfereLogo.vue'
import FlowNodeIcon from '@/components/flow/FlowNodeIcon.vue'
import OnboardingFlowWire from '@/components/onboarding/OnboardingFlowWire.vue'
import { FIRST_RUN_FLOW } from '@/config/firstRun'

// The picture on the welcome beat: three touchpoints, the Sfere mark, and what
// comes out the other side.
//
// IT IS NOT A `FlowTopology`, AND THAT IS DELIBERATE rather than an oversight of
// the "one diagram implementation" rule in CLAUDE.md. That family exists so the
// Dashboard, the Pipes visual view and the route previews all draw the SAME
// THING — real records, wires measured off real bounding boxes, a per-node
// status out of `flowStatus.js`. Every one of those inputs is missing here: this
// runs before the account has a single source, so there are no records to
// measure, no ids to link to, and a status would be a claim about nothing. What
// it shares with them — the travelling dot, the reduced-motion rule, the marks —
// it shares by using the same tokens and the same `FlowNodeIcon`, which is where
// the duplication would actually have hurt.
const flow = FIRST_RUN_FLOW
</script>
