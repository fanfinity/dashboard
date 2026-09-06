<template>
  <div :class="listClasses" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      role="tab"
      :aria-selected="String(modelValue === tab.key)"
      :class="tabClasses(tab.key)"
      @click="emit('update:modelValue', tab.key)"
    >
      {{ tab.label }}
      <span v-if="tab.count !== undefined" :class="countClasses(tab.key)">{{
        tab.count
      }}</span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// Two shapes, one job. `underline` is for switching a page's primary content
// and sits directly on the background; `pill` is for filtering a list and sits
// in a tray. Mixing them on one screen makes both read as the same control.
const props = defineProps({
  modelValue: { type: String, default: '' },
  // [{ key, label, count? }]
  tabs: { type: Array, default: () => [] },
  variant: {
    type: String,
    default: 'underline',
    validator: v => ['underline', 'pill'].includes(v)
  },
  onDark: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const listClasses = computed(() =>
  props.variant === 'pill'
    ? [
        'inline-flex items-center gap-1 rounded-full border p-1',
        props.onDark
          ? 'border-sfere-hairline bg-sfere-wash'
          : 'border-sfere-line bg-sfere-fill'
      ]
    : [
        // `mb-4` is carried over from the tab bar this replaced. Layout in a
        // component is normally wrong, but underline tabs always have content
        // directly beneath them, and 29 screens were written against the gap
        // being here rather than on their own wrapper.
        'flex items-center gap-1 border-b mb-4',
        props.onDark ? 'border-sfere-hairline' : 'border-sfere-line'
      ]
)

function tabClasses(key) {
  const active = props.modelValue === key
  const base = [
    // Important SUFFIX on both type utilities, and both are load-bearing: a tab
    // is a <button>, and Quasar's unlayered `button { font: inherit }` resets
    // font-size, line-height and font-weight past any layered utility, so every
    // tab bar in the app drew at the inherited 400 instead of the 500 declared
    // here. CLAUDE.md collision #9 — SfereButton carries the same fix.
    'inline-flex items-center gap-2 text-sfere-sm! font-medium!',
    'transition duration-150 ease-sfere-ui',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sfere-500/60',
    props.onDark && 'focus-visible:ring-offset-transparent'
  ]

  if (props.variant === 'pill') {
    return [
      ...base,
      'rounded-full px-3.5 py-1.5',
      active
        ? props.onDark
          ? 'bg-white/10 text-white'
          : 'bg-sfere-surface text-sfere-fg shadow-sm'
        : props.onDark
          ? 'text-white/55 hover:text-white'
          : 'text-sfere-fg-muted hover:text-sfere-fg'
    ]
  }

  return [
    ...base,
    // -1px pulls the active underline on top of the list's own border rather
    // than stacking a second line under it.
    'rounded-t-sfere border-b-2 px-3 py-2.5 -mb-px',
    active
      ? props.onDark
        ? 'border-sfere-400 text-white'
        : 'border-sfere-brand-fill text-sfere-brand-text'
      : props.onDark
        ? 'border-transparent text-white/55 hover:text-white'
        : 'border-transparent text-sfere-fg-muted hover:text-sfere-fg'
  ]
}

function countClasses(key) {
  const active = props.modelValue === key
  return [
    'rounded-full px-1.5 py-px font-sfere-mono text-[0.6875rem] tabular-nums',
    active
      ? props.onDark
        ? 'bg-white/15 text-white'
        : 'bg-sfere-50 text-sfere-brand-text'
      : props.onDark
        ? 'bg-white/10 text-white/60'
        : 'bg-sfere-fill text-sfere-fg-muted'
  ]
}
</script>
