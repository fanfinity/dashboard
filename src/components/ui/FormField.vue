<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="label" :for="forId || undefined" :class="labelClasses">
      {{ label }}
      <span v-if="required" class="text-sfere-danger" aria-hidden="true"
        >*</span
      >
      <span v-if="optional" :class="optionalClasses">optional</span>
    </label>

    <slot />

    <!-- `role="alert"` so a validation message that appears after a failed
         submit is announced rather than silently painted. The id lets the
         control point at it with aria-describedby (see SfereInput's
         `described-by`), which is what associates the two for a screen reader
         re-reading the field later. -->
    <p
      v-if="error"
      :id="errorId"
      role="alert"
      :class="['text-sfere-xs', onDark ? 'text-rose-300' : 'text-sfere-danger']"
    >
      {{ error }}
    </p>
    <p
      v-else-if="hint"
      :id="hintId"
      :class="[
        'text-sfere-xs',
        onDark ? 'text-white/50' : 'text-sfere-fg-muted'
      ]"
    >
      {{ hint }}
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// Label + control + one line of help. The control goes in the slot so this
// works with SfereInput, a native <select>, or a Quasar control, and the error
// message replaces the hint rather than stacking under it — two lines of
// guidance under one field is how forms start to look frightening.
const props = defineProps({
  label: { type: String, default: '' },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
  required: { type: Boolean, default: false },
  // Marking what's optional beats marking what's required when most fields are.
  optional: { type: Boolean, default: false },
  // Pair with the control's `id` so clicking the label focuses it.
  forId: { type: String, default: '' },
  onDark: { type: Boolean, default: false }
})

// Derived from `forId` rather than taken as props: a field already has one
// identifier, and asking callers for three is how two of them drift apart.
const errorId = computed(() =>
  props.forId ? `${props.forId}-error` : undefined
)
const hintId = computed(() => (props.forId ? `${props.forId}-hint` : undefined))

const labelClasses = computed(() => [
  'text-sfere-sm font-medium',
  props.onDark ? 'text-white/85' : 'text-sfere-fg'
])

const optionalClasses = computed(() => [
  'ml-1.5 font-sfere-mono text-sfere-label uppercase',
  props.onDark ? 'text-white/40' : 'text-sfere-fg-muted'
])
</script>
