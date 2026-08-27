<template>
  <!-- THE canonical setup tracker. It lives on the Dashboard and nowhere else:
       Sources, Destinations and Pipes each show a one-line reminder pointing
       back here (SetupReminderStrip), rather than each maintaining their own
       copy of the same three steps — four trackers is four things to keep in
       agreement, and the one that drifts is always the one someone is reading.

       Hidden entirely when the three reads cannot be trusted, and when setup is
       complete and has been for a while. A permanent "you're all set" banner is
       just clutter on the screen someone opens every morning. -->
  <CardPanel v-if="!unavailable" :gradient-border="!complete">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <SfereEyebrow :label="complete ? 'Pipeline live' : 'Getting started'" />
        <h2 class="mt-2 font-sfere-display text-lg! font-semibold! text-ink">
          {{ headline }}
        </h2>
        <p class="mt-1 max-w-xl text-sm text-muted">{{ blurb }}</p>
      </div>

      <div class="flex shrink-0 items-center gap-3">
        <p class="font-sfere-mono text-sfere-label uppercase text-subtle"
          >{{ doneCount }} / {{ total }} done</p
        >
        <button
          v-if="complete"
          class="text-xs font-medium text-subtle hover:text-muted"
          @click="emit('dismiss')"
        >
          Hide
        </button>
      </div>
    </div>

    <ol class="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
      <li
        v-for="(step, i) in steps"
        :key="step.key"
        class="flex flex-col rounded-sfere-lg border p-4 transition duration-200 ease-sfere-ui"
        :class="
          step.done
            ? 'border-sfere-success/35 bg-sfere-success-soft'
            : step.current
              ? 'border-sfere-300 bg-sfere-50 shadow-sfere-soft'
              : 'border-sfere-line bg-sfere-surface'
        "
      >
        <div class="flex items-center gap-2.5">
          <span
            class="grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold"
            :class="
              step.done
                ? 'bg-sfere-success text-white'
                : step.current
                  ? 'bg-sfere-brand-fill text-white'
                  : 'bg-sfere-fill text-sfere-fg-muted'
            "
          >
            <svg
              v-if="step.done"
              viewBox="0 0 20 20"
              class="size-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M5 10.5l3.5 3.5L15 6" />
            </svg>
            <template v-else>{{ i + 1 }}</template>
          </span>

          <p
            class="text-sm font-medium"
            :class="step.done || step.current ? 'text-ink' : 'text-muted'"
            >{{ step.label }}</p
          >
        </div>

        <p class="mt-2 grow text-xs leading-5 text-muted">{{
          step.description
        }}</p>

        <div class="mt-3">
          <!-- Done steps link to the list, not the create form: the useful next
               click on a finished step is "show me what I built". -->
          <SfereLinkArrow v-if="step.done" :to="listRoute(step.key)">{{
            countLabel(step)
          }}</SfereLinkArrow>
          <SfereButton v-else-if="step.current" size="sm" :to="step.to">{{
            step.cta
          }}</SfereButton>
          <p v-else class="text-xs text-subtle">After step {{ i }}</p>
        </div>
      </li>
    </ol>
  </CardPanel>
</template>

<script setup>
import { computed } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereEyebrow from '@/components/ui/SfereEyebrow.vue'
import SfereLinkArrow from '@/components/ui/SfereLinkArrow.vue'

const props = defineProps({
  // From useSetupProgress(). Passed in rather than called here so the Dashboard
  // owns one load cycle and this stays a dumb renderer.
  steps: { type: Array, default: () => [] },
  doneCount: { type: Number, default: 0 },
  total: { type: Number, default: 3 },
  complete: { type: Boolean, default: false },
  unavailable: { type: Boolean, default: false }
})

const emit = defineEmits(['dismiss'])

const LIST_ROUTES = {
  source: { name: 'sources' },
  destination: { name: 'destinations' },
  pipe: { name: 'pipes' }
}

function listRoute(key) {
  return LIST_ROUTES[key] ?? { name: 'dashboard-home' }
}

function countLabel(step) {
  const noun =
    step.key === 'source'
      ? 'source'
      : step.key === 'destination'
        ? 'destination'
        : 'pipe'
  return `${step.count} ${noun}${step.count === 1 ? '' : 's'}`
}

const headline = computed(() => {
  if (props.complete) return 'Your pipeline is live'
  if (props.doneCount === 0) return "Nothing's moving yet"
  return `Almost there — ${props.doneCount} of ${props.total} done`
})

const blurb = computed(() => {
  if (props.complete) {
    return 'Events are being collected, routed and delivered. Everything below is the live picture.'
  }
  const next = props.steps.find(s => s.current)
  if (props.doneCount === 0) {
    return 'Sfere turns raw activity into usable data: a source captures it, a pipe moves it, a destination puts it to work. Connect all three and this screen fills in.'
  }
  return next
    ? `${next.description} That is the last thing standing between you and live data.`
    : ''
})
</script>
