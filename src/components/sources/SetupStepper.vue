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
           drop to its own line. -->
      <div class="flex min-w-0 shrink-0 items-center gap-2.5">
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
          :class="
            i <= current ? 'text-sfere-fg' : 'text-sfere-fg-muted opacity-60'
          "
          >{{ step.label }}</span
        >
      </div>

      <!-- The connector. `min-w-6` keeps it visible when the labels are long
           and the flex basis collapses. -->
      <span
        v-if="i < steps.length - 1"
        class="mx-3 h-0.5 min-w-6 flex-1 rounded-full transition-colors duration-300"
        :class="i < current ? 'bg-sfere-success' : 'bg-sfere-line'"
        aria-hidden="true"
      ></span>
    </li>
  </ol>
</template>

<script setup>
// [{ key, label }] plus the zero-based index of the step in progress. Steps
// before `current` render as done, the rest as pending — there is no separate
// "done" flag, because a stepper that can show step 3 complete while step 2 is
// not is a stepper describing something that is not a sequence.
const props = defineProps({
  steps: { type: Array, default: () => [] },
  current: { type: Number, default: 0 },
  ariaLabel: { type: String, default: 'Setup progress' }
})

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
