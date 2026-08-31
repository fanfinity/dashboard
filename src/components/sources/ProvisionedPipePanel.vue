<template>
  <!-- "You asked for a source; you already have a working pipeline."
       Creating a `web` or `zid` source provisions its ClickHouse destination and
       the pipe joining the two in the same call, so the person landing on step 3
       has finished all three setup steps without being told. This says so, and
       draws the thing they now own.

       THE RECORD, NOT THE MOMENT. `SourceProvisionedOverlay.vue` plays the same
       chain full-screen for two seconds as it happens; this is what is still there
       afterwards, inline above the install guide, for whoever blinked or tabbed
       away. That split is what lets the overlay stay short — the write key is
       what they came to step 3 for, and nothing may stand in front of it for
       long.
       Rendered only once the pipe has actually been found, so the animation is a
       reveal of something real rather than a progress bar for work nobody
       measured. Its reveal plays behind the overlay and does not replay, so the
       card is already lit by the time the overlay lifts. -->

  <!-- The pipe we could not confirm. A separate, quiet state on purpose: a
       failed pipelines read is not evidence of anything, so it promises nothing
       and points at the screen that knows. -->
  <NoticeBanner
    v-if="state === 'unavailable'"
    tone="info"
    title="Finishing your pipeline"
    message="Your source is created. We also set up its warehouse and the pipe feeding it, but we couldn't confirm that just now — open Pipes in a moment to see it."
  />

  <!-- `role="status" aria-live="polite"`, as on AccountSetupOverlay: this card
       appears asynchronously, after step 3 has already rendered and been
       announced, so without a live region a screen-reader user is never told the
       pipeline exists. Polite rather than assertive — it is good news, not an
       interruption. -->
  <CardPanel
    v-else-if="state === 'found'"
    tone="surface"
    gradient-border
    role="status"
    aria-live="polite"
  >
    <div class="flex flex-col gap-5">
      <!-- Headline. `min-w-0 flex-1` on the text and `shrink-0` on the badge:
           Quasar's unlayered `.flex { flex-wrap: wrap }` beats `flex-nowrap`, so
           without them a long source name drops the badge onto its own line. -->
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span
              class="grid size-6 shrink-0 place-items-center rounded-full bg-sfere-success-soft text-sfere-success"
              :class="settled ? 'pipe-tick' : 'opacity-0'"
            >
              <svg
                viewBox="0 0 20 20"
                class="size-4"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M5 10.5l3.5 3.5L15 6" />
              </svg>
            </span>
            <p class="text-sm font-semibold text-ink"
              >We handled the rest for you</p
            >
          </div>
          <p class="mt-1.5 text-sm text-muted">{{ lede }}</p>
        </div>

        <StatusBadge
          class="shrink-0"
          :tone="pipe.isEnabled ? 'success' : 'neutral'"
          :label="pipe.isEnabled ? 'Live' : 'Paused'"
          dot
        />
      </div>

      <!-- The three nodes, lighting left to right with a pulse travelling the
           wire between them. Same vocabulary as AccountSetupOverlay's pipeline
           and the `sfere-flow-line` utility the design system ships for exactly
           this cue — not a third motion language.
           `role="img"` with one label: a screen reader gets the sentence, not
           nine unlabelled divs it has to reassemble. -->
      <div
        class="flex items-stretch gap-1"
        role="img"
        :aria-label="diagramLabel"
      >
        <template v-for="(node, i) in nodes" :key="node.key">
          <div
            class="pipe-node min-w-0 flex-1 rounded-sfere-lg border px-3 py-2.5 transition duration-500 ease-sfere-ui"
            :class="
              i <= lit
                ? 'border-sfere-300 bg-sfere-50'
                : 'border-sfere-line bg-sfere-fill'
            "
          >
            <p
              class="font-sfere-mono text-sfere-label uppercase transition-colors duration-500"
              :class="i <= lit ? 'text-sfere-brand-text' : 'text-subtle'"
              >{{ node.kicker }}</p
            >
            <!-- `line-clamp-2`, not `truncate`. The backend names these
                 formulaically off the source name — "{source} → ClickHouse" and
                 "{source} — ClickHouse" — so a single line clips every real pipe
                 to "… → ClickHou…" on the one card that is meant to show it off.
                 Two lines fit the generated names; `title` carries the whole
                 string for anything longer, and the sentence below always
                 spells the pipe out in full regardless. -->
            <p
              class="mt-1 line-clamp-2 text-sm font-medium transition-colors duration-500"
              :class="i <= lit ? 'text-ink' : 'text-subtle'"
              :title="node.label"
              >{{ node.label }}</p
            >
            <p class="mt-0.5 truncate text-xs text-muted" :title="node.hint">{{
              node.hint
            }}</p>
          </div>

          <!-- The wire. Between nodes only, so the last node has no stub
               pointing at nothing. `max-sm:rotate-90` rather than
               `rotate-90 sm:rotate-0`: Quasar ships an unlayered `.rotate-90`,
               so the `sm:` reset never wins and the arrow points down at every
               width — the bug PipeFlow.vue carries a comment about. -->
          <div
            v-if="i < nodes.length - 1"
            class="flex w-6 shrink-0 flex-col items-center justify-center gap-1"
            aria-hidden="true"
          >
            <div class="relative h-px w-full overflow-hidden bg-sfere-line">
              <span
                v-if="i < lit"
                class="sfere-flow-line animate-sfere-flow absolute inset-0"
              ></span>
            </div>
            <span
              class="inline-block text-xs transition-colors duration-500 max-sm:rotate-90"
              :class="i < lit ? 'text-sfere-brand-text' : 'text-subtle'"
              >→</span
            >
          </div>
        </template>
      </div>

      <!-- What this means, and where it lives. Two sentences, because "you have
           a pipe" is only useful with "and here is what it does". -->
      <div
        class="rounded-sfere-lg border border-sfere-line bg-sfere-fill px-4 py-3"
      >
        <p class="text-sm text-ink">
          <span class="font-medium">{{ pipe.name }}</span> is
          {{ pipe.isEnabled ? 'live and enabled' : 'created but paused' }}.
          {{ deliveryLine }}
        </p>
        <p class="mt-1 text-xs text-muted">{{ nextLine }}</p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <SfereButton
          variant="secondary"
          size="sm"
          :to="{ name: 'pipes-detail', params: { id: pipe.id } }"
          >View this pipe</SfereButton
        >
        <SfereLinkArrow
          v-if="destination"
          :to="{ name: 'destinations-detail', params: { id: destination.id } }"
          >Open {{ destination.name }}</SfereLinkArrow
        >
      </div>
    </div>
  </CardPanel>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereLinkArrow from '@/components/ui/SfereLinkArrow.vue'

// Presentational. It renders the pipe and destination it is handed and asserts
// nothing about the source type — `useSourceProvisioning()` does the finding, and
// a source the backend provisioned nothing for (an SDK/HTTP `event_stream`, or a
// `cloud_app` like Shopify) reaches `state: 'none'` and this renders nothing at
// all. See that composable for the measured per-type matrix.
const props = defineProps({
  // 'found' | 'unavailable' | anything else renders nothing. Passing the whole
  // state rather than a boolean is what keeps "no pipe exists" and "we could not
  // check" distinguishable at the point they are rendered.
  state: { type: String, required: true },
  source: { type: Object, required: true },
  pipe: { type: Object, default: null },
  // Null when the destinations read failed but the pipe was found. Every line
  // below that names it is guarded, so the panel degrades to naming the pipe.
  destination: { type: Object, default: null }
})

// Node reveal: 520ms apart, so the wire's pulse is visible between each pair
// rather than three boxes appearing at once. Starts at -1 (nothing lit) so the
// first node has something to transition from.
const STEP_MS = 520

const lit = ref(-1)
const settled = ref(false)
const timers = []
// The reveal runs once. `state` can settle to 'found' and then re-notify (a
// destinations read filling in late), and a second run would restart the
// animation under someone already reading the card.
let started = false

// `clickhouse_database` is the one field that proves the warehouse is really
// provisioned rather than merely recorded, so it is worth showing when present.
// The schema says it is null while provisioning is pending — hence the fallback
// rather than a template literal that would print `vundefined`-style nonsense.
const warehouseHint = computed(() =>
  props.destination?.clickhouseDatabase
    ? `Database ${props.destination.clickhouseDatabase}`
    : 'We created this'
)

const nodes = computed(() => [
  {
    key: 'source',
    kicker: 'Source',
    label: props.source.name,
    hint: 'You created this'
  },
  {
    key: 'pipe',
    kicker: 'Pipe',
    label: props.pipe?.name ?? 'Pipe',
    hint: 'We created this'
  },
  {
    key: 'destination',
    kicker: 'Destination',
    // A found pipe always names a real destination id; only the *read* of that
    // record can fail. "Your warehouse" is true of every destination the create
    // call provisions, so it stands in without inventing a name.
    label: props.destination?.name ?? 'Your warehouse',
    hint: warehouseHint.value
  }
])

const lede = computed(
  () =>
    `Connecting a source is normally three steps. ${props.source.name} needed one — we provisioned its warehouse and the pipe feeding it while you waited.`
)

const deliveryLine = computed(() => {
  if (!props.pipe?.isEnabled) return 'Enable it when you are ready to deliver.'
  return props.destination
    ? `Every event this source receives is delivered to ${props.destination.name}.`
    : 'Every event this source receives is delivered to its warehouse.'
})

const nextLine = computed(() =>
  props.pipe?.isEnabled
    ? 'Nothing else to set up here. Install the snippet below and the events will start landing on their own.'
    : 'Install the snippet below, then enable the pipe to start delivering.'
)

const diagramLabel = computed(() => {
  const end = props.destination?.name ?? 'its warehouse'
  return `${props.source.name} feeds ${props.pipe?.name ?? 'a pipe'}, which delivers to ${end}.`
})

// Keyed off `state`, NOT off mount. The component is mounted as soon as step 3
// renders, while the pipe is still being looked up — starting the reveal there
// would run it out against a panel showing nothing, and the card would then
// appear with all three nodes already lit and no reveal left to watch.
// `immediate` covers the answer already being in.
watch(
  () => props.state,
  s => {
    if (s !== 'found' || started) return
    started = true

    // One timer per node plus the tick. Cleared on unmount, so leaving step 3
    // mid-reveal cannot light a node on the next screen.
    for (let i = 0; i < nodes.value.length; i += 1) {
      timers.push(setTimeout(() => (lit.value = i), STEP_MS * (i + 1)))
    }
    timers.push(
      setTimeout(
        () => (settled.value = true),
        STEP_MS * (nodes.value.length + 1)
      )
    )
  },
  { immediate: true }
)

onBeforeUnmount(() => timers.forEach(clearTimeout))
</script>

<style scoped>
/* Decorative only — the panel says the same thing with these off, which is what
   `prefers-reduced-motion` is asking for. The node/wire colour transitions are
   Tailwind `transition-colors` and are left alone: a colour crossfade is not
   motion, and killing it would make the reveal snap. */
.pipe-node {
  animation: pipe-settle 0.42s var(--ease-sfere-ui, ease-out) both;
}

.pipe-tick {
  animation: pipe-pop 0.36s var(--ease-sfere, ease-out) both;
}

@keyframes pipe-settle {
  from {
    opacity: 0.4;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pipe-pop {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pipe-node,
  .pipe-tick {
    animation: none;
  }
}
</style>
