<template>
  <!-- Where you are in a multi-screen setup. Deliberately NOT in
       src/components/ui/: the kit is what every screen imports, and a stepper is
       chrome for one flow. Promote it the day a second flow wants one — until
       then a 39-component kit that documents itself beats a 40th component with
       one caller. -->
  <ol class="flex items-center" :aria-label="ariaLabel">
    <li
      v-for="(step, i) in steps"
      :key="step.key"
      class="flex min-w-0 items-center"
      :class="i < steps.length - 1 && 'flex-1'"
      :aria-current="i === current ? 'step' : undefined"
    >
      <!-- `shrink-0` rather than `flex-1`: the connector beside this is what
           should absorb the slack, and Quasar's unlayered
           `.flex { flex-wrap: wrap }` means an over-wide group would otherwise
           drop to its own line.
           A COMPLETED STEP IS A BUTTON, the rest are plain text. This is where
           the "Change" affordance lives now that step 2's grey "Setting up X"
           banner is gone: the way back to the picker is the rung you came from,
           which is where a reader already looks to ask "how do I go back?".
           `navigableSteps` is empty by default so a second caller has to opt
           in — a stepper whose rungs are silently clickable is a stepper
           promising navigation it may not be able to honour. -->
      <component
        :is="isNavigable(i) ? 'button' : 'div'"
        :type="isNavigable(i) ? 'button' : undefined"
        class="group flex min-w-0 shrink-0 items-center gap-2.5 rounded-sfere text-left"
        :class="
          isNavigable(i) &&
          'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sfere-brand'
        "
        @click="isNavigable(i) && emit('navigate', i)"
      >
        <span
          class="grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold transition duration-200 ease-sfere-ui"
          :class="markClasses(i)"
        >
          <svg
            v-if="i < current"
            viewBox="0 0 20 20"
            class="size-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M5 10.5l3.5 3.5L15 6" />
          </svg>
          <template v-else>{{ i + 1 }}</template>
        </span>

        <span
          class="truncate text-sm font-medium transition-colors duration-200"
          :class="[
            i <= current ? 'text-sfere-fg' : 'text-sfere-fg-muted opacity-60',
            isNavigable(i) &&
              'underline decoration-transparent underline-offset-4 group-hover:decoration-sfere-brand'
          ]"
          >{{ step.label }}</span
        >
      </component>

      <!-- The connector, and the one piece of motion in this component.
           `min-w-6` keeps it visible when the labels are long and the flex basis
           collapses.
           The track is the unfilled rail; the child fills it left-to-right when
           the step behind it completes, and a dot rides the head of that fill.
           WIDTH ON AN ABSOLUTELY-POSITIONED CHILD, not on the track: the track's
           own width is the flex slack, so animating that would relayout the
           whole row every frame. The child is out of flow, so its width change
           costs nothing above it. (`scaleX` would be cheaper still, but it
           squashes the dot parented to its right edge, and un-squashing a dot
           against a live scale factor is more machinery than this earns.) -->
      <span
        v-if="i < steps.length - 1"
        class="relative mx-3 h-0.5 min-w-6 flex-1 rounded-full bg-sfere-line"
        aria-hidden="true"
      >
        <span
          class="absolute inset-y-0 left-0 rounded-full bg-sfere-success"
          :class="
            animate &&
            'transition-[width] duration-300 ease-sfere-ui motion-reduce:transition-none'
          "
          :style="{ width: i < current ? '100%' : '0%' }"
        >
          <!-- Keyed on `current` so it remounts and replays on each advance —
               a CSS animation does not restart on a class change alone.
               Rendered only on the connector that is filling right now, and only
               after mount: someone landing on step 2 from a restored draft
               should see the line already full, not watch it arrive as though
               they had just clicked. -->
          <span
            v-if="animate && i === current - 1"
            :key="current"
            class="step-dot absolute top-1/2 right-0 size-2 rounded-full bg-sfere-success ring-2 ring-sfere-success/25"
          ></span>
        </span>
      </span>
    </li>
  </ol>
</template>

<script setup>
import { onMounted, ref } from 'vue'

// [{ key, label }] plus the zero-based index of the step in progress. Steps
// before `current` render as done, the rest as pending — there is no separate
// "done" flag, because a stepper that can show step 3 complete while step 2 is
// not is a stepper describing something that is not a sequence.
const props = defineProps({
  steps: { type: Array, default: () => [] },
  current: { type: Number, default: 0 },
  ariaLabel: { type: String, default: 'Setup progress' },
  // Which completed rungs may be clicked to go back. `[]` (the default) keeps
  // the old inert stepper. A list rather than a boolean because "you can return
  // to step 1" and "you can return to step 2" are different claims — the source
  // create flow can offer the first and must never offer the second, since
  // step 3 exists only because a row was already written to the backend.
  navigableSteps: { type: Array, default: () => [] }
})

const emit = defineEmits(['navigate'])

// FIRST PAINT IS THE STATIC STATE. Strictly the transition would not fire on
// mount anyway (there is no prior computed width to animate from), but the dot
// is an `animation` with `both` fill-mode and that WOULD play on insertion. One
// flag covers both, and makes the intent legible rather than depending on a
// subtlety of how transitions start.
const animate = ref(false)
onMounted(() => {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      animate.value = true
    })
  )
})

function isNavigable(i) {
  return i < props.current && props.navigableSteps.includes(i)
}

function markClasses(i) {
  if (i < props.current) {
    return 'border-sfere-success bg-sfere-success text-white'
  }
  if (i === props.current) {
    return 'border-sfere-brand-fill bg-sfere-brand-fill text-white shadow-sfere-btn'
  }
  return 'border-sfere-line bg-sfere-surface text-sfere-fg-muted'
}
</script>

<style scoped>
/* The travelling head of the fill. It only ever moves on its own axis and
   fades — `transform` and `opacity`, nothing that touches layout — and it is
   sized to outrun the 300ms width transition slightly so it reads as leading
   the line rather than being dragged by it. */
.step-dot {
  animation: step-dot-ride 340ms var(--ease-sfere-ui, ease-out) both;
}

@keyframes step-dot-ride {
  0% {
    opacity: 0;
    transform: translate(50%, -50%) scale(0.4);
  }
  25% {
    opacity: 1;
    transform: translate(50%, -50%) scale(1);
  }
  70% {
    opacity: 1;
    transform: translate(50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(50%, -50%) scale(0.4);
  }
}

/* Not optional, and not merely "less motion": the end state is the whole
   message, so with this on the line is simply full and the dot never exists.
   Written as a media query rather than a JS `matchMedia` read so it answers a
   preference changed mid-session, which a value captured at setup cannot. */
@media (prefers-reduced-motion: reduce) {
  .step-dot {
    display: none;
  }
}
</style>
