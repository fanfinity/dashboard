<template>
  <svg
    :class="sizeClass"
    viewBox="0 0 256 256"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path v-if="glyph.back" :d="glyph.back" opacity="0.2" />
    <path :d="glyph.path" />
  </svg>
</template>

<script setup>
import { computed } from 'vue'
import { SFERE_ICONS, SFERE_ICON_NAMES } from './sfereIcons.js'

// One glyph from the registry in `sfereIcons.js`, sized off the type ramp.
//
// Always `aria-hidden`: an icon is either decorative beside a label, or the
// whole content of a control that carries its own `aria-label` — as
// SfereIconButton does. It never speaks for itself, which is why there is no
// `title` prop to tempt a page into making a tooltip the only carrier of a name.
//
// `focusable="false"` is not redundant with `aria-hidden`: legacy Edge and IE
// put SVGs in the tab order regardless, and a focus stop with nothing to
// announce is worse than no icon at all.
const props = defineProps({
  name: {
    type: String,
    required: true,
    validator: v => SFERE_ICON_NAMES.includes(v)
  },
  size: {
    type: String,
    default: 'md',
    validator: v => ['sm', 'md', 'lg'].includes(v)
  }
})

// A missing name renders nothing rather than throwing — a typo in one page's
// toolbar should not blank the screen. The prop validator warns in dev.
const glyph = computed(() => SFERE_ICONS[props.name] ?? { path: '' })

const SIZES = { sm: 'size-3.5', md: 'size-4', lg: 'size-5' }

const sizeClass = computed(() => ['shrink-0', SIZES[props.size]])
</script>
