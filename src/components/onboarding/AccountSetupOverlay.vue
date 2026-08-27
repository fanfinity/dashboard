<template>
  <!-- The bridge between "signed in" and "dashboard". It exists because the
       backend does several real things at that moment — settles the session,
       reads /v1/me, resolves the acting account — and a blank white flash while
       that happens reads as a stall. Showing the work is honest and it is the
       first impression of the product.

       DELIBERATELY NOT A ROUTE. A /setting-up route would need a guard exception,
       would be linkable, and would be a second place the auth redirect has to
       agree with. It is an overlay owned by the page that triggered it, the same
       reasoning MainLayout uses for the persona question. -->
  <div
    class="fixed inset-0 z-[9999] grid place-items-center overflow-hidden bg-sfere-ink"
    role="status"
    aria-live="polite"
    :aria-label="`Setting up your account — ${activeStep?.label ?? 'finishing'}`"
  >
    <!-- Two drifting brand glows. Blurred radial gradients rather than images:
         img-src is 'self' and assetsInlineLimit is 0, so a decorative PNG would
         be a real network request for something purely atmospheric. -->
    <div
      class="setup-glow setup-glow--a pointer-events-none absolute size-[36rem] rounded-full"
      aria-hidden="true"
    ></div>
    <div
      class="setup-glow setup-glow--b pointer-events-none absolute size-[28rem] rounded-full"
      aria-hidden="true"
    ></div>

    <div class="relative flex w-full max-w-lg flex-col items-center px-6">
      <SfereLogo :height="26" on-dark />

      <h1
        class="mt-8 text-center font-sfere-display text-2xl! font-bold! text-white"
      >
        Setting up your account
      </h1>
      <p class="mt-2 max-w-sm text-center text-sm text-white/55">
        A few seconds while we open your workspace and get the pipeline ready.
      </p>

      <!-- The pipeline, drawn as the three things the product is about. Each
           node lights as its stage completes, and a pulse travels the wire
           between them so the diagram reads as flowing rather than static. -->
      <div class="mt-10 flex w-full items-center justify-between gap-2">
        <div
          v-for="(node, i) in NODES"
          :key="node.key"
          class="flex flex-1 items-center gap-2"
        >
          <div class="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div
              class="setup-node grid size-12 place-items-center rounded-sfere-lg border transition duration-500 ease-sfere-ui"
              :class="
                i <= litNodes
                  ? 'border-sfere-400/60 bg-sfere-500/20 text-white shadow-sfere-glow'
                  : 'border-sfere-hairline bg-sfere-wash text-white/30'
              "
            >
              <svg
                viewBox="0 0 24 24"
                class="size-5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path :d="node.icon" />
              </svg>
            </div>
            <p
              class="truncate text-center font-sfere-mono text-sfere-label uppercase transition-colors duration-500"
              :class="i <= litNodes ? 'text-white/70' : 'text-white/25'"
              >{{ node.label }}</p
            >
          </div>

          <!-- The wire. Only rendered between nodes, so the last node has no
               trailing stub pointing at nothing. -->
          <div
            v-if="i < NODES.length - 1"
            class="relative mb-6 h-px flex-1 overflow-hidden bg-sfere-hairline"
            aria-hidden="true"
          >
            <span
              v-if="i < litNodes"
              class="setup-pulse absolute inset-y-0 w-1/3"
            ></span>
          </div>
        </div>
      </div>

      <!-- Progress. A determinate bar, because the duration is known — an
           indeterminate spinner would imply we have no idea how long this is. -->
      <div class="mt-10 w-full">
        <div class="h-1 overflow-hidden rounded-full bg-white/10">
          <div
            class="h-full rounded-full bg-sfere-brand transition-[width] duration-500 ease-sfere-ui"
            :style="{ width: `${pct}%` }"
          ></div>
        </div>

        <ul class="mt-5 flex flex-col gap-2.5">
          <li
            v-for="(step, i) in STEPS"
            :key="step.key"
            class="flex items-center gap-3 text-sm transition-colors duration-300"
            :class="
              i < index
                ? 'text-white/60'
                : i === index
                  ? 'text-white'
                  : 'text-white/25'
            "
          >
            <span class="grid size-5 shrink-0 place-items-center">
              <!-- Done: a tick. Current: a spinner. Ahead: an empty ring. Three
                   distinguishable marks, so the list reads at a glance. -->
              <svg
                v-if="i < index"
                viewBox="0 0 20 20"
                class="size-5 text-sfere-success-on-ink"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M5 10.5l3.5 3.5L15 6" />
              </svg>
              <SfereSpinner v-else-if="i === index" :size="16" />
              <span
                v-else
                class="size-2 rounded-full border border-white/25"
              ></span>
            </span>
            {{ step.label }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SfereLogo from '@/components/ui/SfereLogo.vue'
import SfereSpinner from '@/components/ui/SfereSpinner.vue'

// Fixed at 2.5s, on purpose: this is a courtesy transition, and a sub-second
// flash of four reassuring step labels reads as a glitch rather than as work.
// It used to be a random 1.1-2s, which made the same sign-in feel different
// every time; one duration everyone gets is the calmer trade.
const TOTAL_MS = 2500

const emit = defineEmits(['done'])

const STEPS = [
  { key: 'identity', label: 'Confirming your identity' },
  { key: 'workspace', label: 'Opening your workspace' },
  { key: 'warehouse', label: 'Checking your ClickHouse warehouse' },
  { key: 'dashboard', label: 'Preparing your dashboard' }
]

const NODES = [
  {
    key: 'source',
    label: 'Source',
    icon: 'M4 7h16M4 12h16M4 17h10'
  },
  {
    key: 'pipe',
    label: 'Pipe',
    icon: 'M3 12h4a3 3 0 0 0 3-3V7m4 10v-2a3 3 0 0 1 3-3h4'
  },
  {
    key: 'destination',
    label: 'Destination',
    icon: 'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3m0 0v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7'
  }
]

const index = ref(0)

// One node per step until the nodes run out: three nodes over four steps means
// the pipeline is fully lit for the whole final step, rather than lighting its
// last node in the same instant the overlay disappears.
const litNodes = computed(() => Math.min(NODES.length - 1, index.value))

const pct = computed(() => Math.round(((index.value + 1) / STEPS.length) * 100))

const activeStep = computed(() => STEPS[index.value] ?? null)

// One timer per step plus the finish, all cleared on unmount — a route change
// mid-sequence must not fire `done` at the next screen.
const timers = []

onMounted(() => {
  const per = TOTAL_MS / STEPS.length

  for (let i = 1; i < STEPS.length; i += 1) {
    timers.push(setTimeout(() => (index.value = i), per * i))
  }
  timers.push(setTimeout(() => emit('done'), TOTAL_MS))
})

onBeforeUnmount(() => {
  timers.forEach(clearTimeout)
})
</script>

<style scoped>
/* Atmosphere only. `prefers-reduced-motion` stops all three animations rather
   than slowing them — a drifting background is exactly what that setting is
   asking us not to do — and the layout is identical either way. */
.setup-glow {
  filter: blur(90px);
  opacity: 0.5;
}

.setup-glow--a {
  top: -12rem;
  left: -10rem;
  background: radial-gradient(
    circle,
    var(--color-sfere-600) 0%,
    transparent 70%
  );
  animation: setup-drift-a 14s ease-in-out infinite;
}

.setup-glow--b {
  right: -8rem;
  bottom: -10rem;
  background: radial-gradient(
    circle,
    var(--color-sfere-800) 0%,
    transparent 70%
  );
  animation: setup-drift-b 18s ease-in-out infinite;
}

.setup-pulse {
  background: linear-gradient(
    90deg,
    transparent,
    var(--color-sfere-brand),
    transparent
  );
  animation: setup-travel 1.1s linear infinite;
}

.setup-node {
  animation: setup-settle 0.5s var(--ease-sfere-ui, ease-out) both;
}

@keyframes setup-drift-a {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(3rem, 2rem, 0) scale(1.08);
  }
}

@keyframes setup-drift-b {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1.05);
  }
  50% {
    transform: translate3d(-2.5rem, -1.5rem, 0) scale(1);
  }
}

@keyframes setup-travel {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(300%);
  }
}

@keyframes setup-settle {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .setup-glow,
  .setup-pulse,
  .setup-node {
    animation: none;
  }
}
</style>
