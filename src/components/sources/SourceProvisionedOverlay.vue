<template>
  <!-- "We didn't just save a row — we built you a working pipeline."
       The moment a `web` or `zid` source is created the backend has also
       provisioned its ClickHouse destination and the pipe joining the two, so
       the person who asked for one thing already owns three. This is the beat
       that shows it: the chain drawing itself, once, for about three seconds.

       TELEPORTED TO BODY. `fixed` resolves against the nearest transformed
       ancestor, not the viewport, and step 3 sits inside animated cards — so
       without this the overlay would be clipped into the page.

       IT OPENS ON `found`, NEVER ON "a source was created". Three of the seven
       source templates provision nothing (see `useSourceProvisioning`), and an
       overlay that opened on create would have to wait out that composable's
       retry before discovering it had nothing to say — 1.2s of a celebration
       covering the write key on exactly the sources that have no pipe. Keyed off
       the answer, it can only ever appear when there is something true to show.

       AND IT LEAVES QUICKLY. The write key is what step 3 is for; this stands in
       front of it, so it is short, it is dismissible with a click or Esc, and it
       hands over to `ProvisionedPipePanel` below — which holds the same chain as
       a durable record for anyone who blinked. -->
  <Teleport to="body">
    <Transition name="prov-fade" appear>
      <!-- `role="status" aria-live="polite"`, as on AccountSetupOverlay — not
           `role="dialog"`, which would promise focus management and a modal
           contract that a timed, self-dismissing panel does not have. -->
      <div
        v-if="open"
        class="fixed inset-0 z-[9998] grid place-items-center overflow-hidden bg-sfere-ink/[0.97] p-6 backdrop-blur-md"
        role="status"
        aria-live="polite"
        @click="dismiss"
      >
        <!-- Two drifting brand glows, the same atmosphere the post-sign-in
             overlay uses. Blurred radial gradients rather than images: img-src
             is 'self' and assetsInlineLimit is 0, so a decorative PNG would be a
             real network request for pure atmosphere. -->
        <div
          class="prov-glow prov-glow--a pointer-events-none absolute size-[34rem] rounded-full"
          aria-hidden="true"
        ></div>
        <div
          class="prov-glow prov-glow--b pointer-events-none absolute size-[26rem] rounded-full"
          aria-hidden="true"
        ></div>

        <!-- Vertical rhythm is `gap`, never `mt-*`. Every `<p>` here carries
             Quasar's unlayered `margin-bottom: 16px`, which a layered `mt-8`
             loses to — the spacing would silently flatten to 16px everywhere. -->
        <div
          class="relative flex w-full max-w-3xl flex-col items-center gap-6 text-center sm:gap-8"
        >
          <span
            class="grid size-12 place-items-center rounded-full border border-sfere-400/50 bg-sfere-500/20 text-sfere-success-on-ink sm:size-14"
            :class="{ 'prov-pop': !reduced }"
          >
            <svg
              viewBox="0 0 20 20"
              class="size-7"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M4.5 10.5l3.5 3.5L15.5 6" />
            </svg>
          </span>

          <div class="flex flex-col items-center gap-2">
            <!-- A `<p>`, not a heading. `pnpm smoke:dist` asserts on the first
                 `<h1>` on the screen and that one belongs to PageHeader; a
                 second one here would make an overlay decide what the page is
                 called. Same rule the persona question follows. -->
            <p
              class="font-sfere-display text-2xl! font-bold! text-white sm:text-3xl!"
              >Your pipeline is live</p
            >
            <p class="max-w-md text-sm text-white/60">{{ lede }}</p>
          </div>

          <!-- The three nodes, lighting left to right with a pulse travelling
               the wire between them — the `sfere-flow-line` utility the design
               system ships for exactly this cue, so this is the same motion
               vocabulary as the panel below and the sign-in overlay rather than
               a third one.
               `role="img"` with one label: a screen reader gets the sentence,
               not nine unlabelled boxes to reassemble. -->
          <div
            class="flex w-full flex-col items-stretch gap-2 sm:flex-row"
            role="img"
            :aria-label="diagramLabel"
          >
            <template v-for="(node, i) in nodes" :key="node.key">
              <!-- `min-w-0 flex-1` on the node and `shrink-0` on the wire:
                   Quasar's unlayered `.flex { flex-wrap: wrap }` beats
                   `flex-nowrap`, so without them a long generated pipe name
                   drops the last node onto its own line. -->
              <div
                class="flex min-w-0 flex-1 flex-col items-start gap-1.5 rounded-sfere-xl border px-4 py-3 text-left transition duration-500 ease-sfere-ui sm:py-4"
                :class="[
                  i <= lit
                    ? 'border-sfere-400/60 bg-sfere-500/15 shadow-sfere-glow'
                    : 'border-sfere-hairline bg-sfere-wash',
                  { 'prov-node': !reduced }
                ]"
              >
                <!-- Icon beside the kicker rather than above it. Stacked, the
                     three cards run past the bottom of a phone before the
                     sentence under them is reached. -->
                <div class="flex items-center gap-2">
                  <span
                    class="grid size-8 shrink-0 place-items-center rounded-sfere border transition duration-500"
                    :class="
                      i <= lit
                        ? 'border-sfere-400/50 bg-sfere-500/25 text-white'
                        : 'border-sfere-hairline text-white/30'
                    "
                  >
                    <svg
                      viewBox="0 0 24 24"
                      class="size-4"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path :d="node.icon" />
                    </svg>
                  </span>
                  <!-- Spacing inside the node is the parent's `gap`, not `mt-*`:
                       a `<p>` carries Quasar's unlayered `margin-bottom: 16px`,
                       which a layered `mt-2` on it loses to outright. -->
                  <p
                    class="min-w-0 flex-1 font-sfere-mono text-sfere-label uppercase transition-colors duration-500"
                    :class="i <= lit ? 'text-white/60' : 'text-white/25'"
                    >{{ node.kicker }}</p
                  >
                </div>
                <!-- `line-clamp-2`, not `truncate`: the backend names these
                     formulaically off the source — "{source} → ClickHouse" —
                     so one line clips every real pipe on the one screen meant
                     to show it off. -->
                <p
                  class="line-clamp-2 text-sm font-medium transition-colors duration-500"
                  :class="i <= lit ? 'text-white' : 'text-white/30'"
                  :title="node.label"
                  >{{ node.label }}</p
                >
              </div>

              <!-- The wire, between nodes only, so the last node has no stub
                   pointing at nothing. Three cards will not fit a phone, so the
                   row stacks below `sm` and the wire turns with it — a vertical
                   pulse, no arrow, since the stacking order already says which
                   way it flows.
                   Every switch here is an inverse variant (`max-sm:`), never
                   `x sm:y`: Quasar ships unlayered `.hidden` and `.rotate-90`,
                   so the `sm:` reset would never win and the element would be
                   permanently hidden or permanently turned. -->
              <div
                v-if="i < nodes.length - 1"
                class="flex shrink-0 items-center justify-center gap-1.5 max-sm:h-6 max-sm:w-full sm:w-8 sm:flex-col"
                aria-hidden="true"
              >
                <div
                  class="relative overflow-hidden bg-sfere-hairline max-sm:h-full max-sm:w-px sm:h-px sm:w-full"
                >
                  <span
                    v-if="i < lit"
                    class="sfere-flow-line animate-sfere-flow absolute inset-0 max-sm:hidden"
                  ></span>
                  <span
                    v-if="i < lit"
                    class="sfere-flow-line-y animate-sfere-flow-y absolute inset-0 sm:hidden"
                  ></span>
                </div>
                <span
                  class="text-xs transition-colors duration-500 max-sm:hidden"
                  :class="i < lit ? 'text-white/70' : 'text-white/25'"
                  >→</span
                >
              </div>
            </template>
          </div>

          <!-- No button. This leaves on its own after two seconds, and a
               "Continue" that only does what the timer already does is one more
               thing to read in the two seconds there are. A click anywhere and
               Esc still skip it, for anyone who wants the write key now. -->
          <p class="text-sm text-white/70">{{ summary }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

// Presentational, and deliberately without its own `useSourceProvisioning()`
// call: a second instance would repeat the pipelines + destinations reads the
// create page already made. It renders what it is handed and asserts nothing
// about the source type — a source the backend provisioned nothing for never
// reaches `state: 'found'`, so this never opens for one.
const props = defineProps({
  // 'found' opens it. Every other state — including 'unavailable', where the
  // read failed and we know nothing — leaves it shut; the quiet banner in
  // `ProvisionedPipePanel` owns that case.
  state: { type: String, required: true },
  source: { type: Object, default: null },
  pipe: { type: Object, default: null },
  // Null when the pipe was found but the destinations read failed. Every line
  // naming it is guarded, so the overlay degrades to naming the pipe.
  destination: { type: Object, default: null }
})

// Emitted when it closes, however it closed — the timer, a click or Esc. The
// create page does not listen today (step 3 is already rendered underneath and
// needs no cue), but a caller that wanted to focus something afterwards has the
// hook rather than a timer of its own to keep in sync with TOTAL_MS.
const emit = defineEmits(['close'])

// Two seconds end to end, and it leaves by itself — long enough to watch the
// chain draw, short enough that nobody reaches for a way to close it. Fixed
// rather than random: the same create should feel the same twice, which is the
// lesson AccountSetupOverlay's TOTAL_MS records.
//
// The three nodes light 340ms apart (the last at ~800ms), leaving ~1.2s to read
// the result on. That is a faster cadence than the panel below runs at, because
// the panel has the rest of the session to finish its reveal and this has two
// seconds; the pulse on each wire is still visible between one node and the
// next. Short on purpose — the write key is behind this.
const TOTAL_MS = 2000
const STEP_MS = 340

const open = ref(false)
const lit = ref(-1)
const timers = []
// The reveal runs once. `state` can settle to 'found' and notify again (a late
// destinations read filling in the name), and a second run would reopen the
// overlay over someone already reading step 3.
let started = false

const reduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const nodes = computed(() => [
  {
    key: 'source',
    kicker: 'Source',
    label: props.source?.name ?? 'Your source',
    icon: 'M4 7h16M4 12h16M4 17h10'
  },
  {
    key: 'pipe',
    kicker: 'Pipe',
    label: props.pipe?.name ?? 'Pipe',
    icon: 'M3 12h4a3 3 0 0 0 3-3V7m4 10v-2a3 3 0 0 1 3-3h4'
  },
  {
    key: 'destination',
    kicker: 'Destination',
    // A found pipe always names a real destination id; only the *read* of that
    // record can fail. "Your warehouse" is true of every destination the create
    // call provisions, so it stands in without inventing a name.
    label: props.destination?.name ?? 'Your warehouse',
    icon: 'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3m0 0v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7'
  }
])

const lede = computed(
  () =>
    `Connecting a source is normally three steps. ${props.source?.name ?? 'This source'} needed one — we set up its warehouse and the pipe feeding it while you waited.`
)

const summary = computed(() => {
  if (!props.pipe?.isEnabled)
    return 'The pipe is created but paused. Enable it when you are ready to deliver.'
  return props.destination
    ? `Every event this source receives is delivered to ${props.destination.name}.`
    : 'Every event this source receives is delivered to its warehouse.'
})

const diagramLabel = computed(() => {
  const end = props.destination?.name ?? 'its warehouse'
  return `${props.source?.name ?? 'Your source'} feeds ${props.pipe?.name ?? 'a pipe'}, which delivers to ${end}.`
})

function clearTimers() {
  timers.forEach(clearTimeout)
  timers.length = 0
}

function dismiss() {
  if (!open.value) return
  clearTimers()
  open.value = false
  emit('close')
}

function onKeydown(e) {
  if (e.key === 'Escape') dismiss()
}

// Keyed off `state`, not off mount: the create page mounts this the instant
// step 3 renders, while the lookup is still in flight. `immediate` covers the
// answer already being in by then.
watch(
  () => props.state,
  s => {
    if (s !== 'found' || started) return
    started = true
    open.value = true

    // Reduced motion gets the finished picture and the same dwell, not a
    // sequence — the timer is a courtesy, not motion, so it is kept.
    if (reduced) {
      lit.value = nodes.value.length - 1
    } else {
      for (let i = 0; i < nodes.value.length; i += 1) {
        timers.push(setTimeout(() => (lit.value = i), STEP_MS * i + 120))
      }
    }

    timers.push(setTimeout(dismiss, TOTAL_MS))
  },
  { immediate: true }
)

onMounted(() => window.addEventListener('keydown', onKeydown))

// Cleared on unmount, so leaving step 3 mid-reveal cannot fire `close` at the
// next screen or leave a listener behind.
onBeforeUnmount(() => {
  clearTimers()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.prov-fade-enter-active,
.prov-fade-leave-active {
  transition: opacity 0.35s var(--ease-sfere-ui, ease-out);
}

.prov-fade-enter-from,
.prov-fade-leave-to {
  opacity: 0;
}

/* Atmosphere only — the overlay says the same thing with all of this off, which
   is what `prefers-reduced-motion` is asking for. The node colour transitions
   are Tailwind `transition-colors` and are left alone: a colour crossfade is not
   motion, and killing it would make the reveal snap. */
.prov-glow {
  filter: blur(90px);
  opacity: 0.55;
}

.prov-glow--a {
  top: -10rem;
  left: -8rem;
  background: radial-gradient(
    circle,
    var(--color-sfere-600) 0%,
    transparent 70%
  );
  animation: prov-drift-a 14s ease-in-out infinite;
}

.prov-glow--b {
  right: -7rem;
  bottom: -9rem;
  background: radial-gradient(
    circle,
    var(--color-sfere-800) 0%,
    transparent 70%
  );
  animation: prov-drift-b 18s ease-in-out infinite;
}

.prov-node {
  animation: prov-settle 0.45s var(--ease-sfere-ui, ease-out) both;
}

.prov-pop {
  animation: prov-scale-in 0.5s var(--ease-sfere, ease-out) both;
}

@keyframes prov-drift-a {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(3rem, 2rem, 0) scale(1.08);
  }
}

@keyframes prov-drift-b {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1.05);
  }
  50% {
    transform: translate3d(-2.5rem, -1.5rem, 0) scale(1);
  }
}

@keyframes prov-settle {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes prov-scale-in {
  from {
    opacity: 0;
    transform: scale(0.5);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .prov-glow,
  .prov-node,
  .prov-pop,
  .prov-fade-enter-active,
  .prov-fade-leave-active {
    animation: none;
    transition: none;
  }
}
</style>
