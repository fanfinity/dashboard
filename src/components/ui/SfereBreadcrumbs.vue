<template>
  <nav :aria-label="ariaLabel">
    <ol class="flex flex-wrap items-center gap-1.5">
      <li
        v-for="(item, i) in items"
        :key="item.label"
        class="flex items-center gap-1.5"
      >
        <component
          :is="linkTag(item, i)"
          v-bind="linkAttrs(item, i)"
          :aria-current="i === items.length - 1 ? 'page' : undefined"
          :class="itemClasses(i)"
        >
          {{ item.label }}
        </component>

        <svg
          v-if="i < items.length - 1"
          :class="[
            'size-3 shrink-0 -rotate-90',
            onDark ? 'text-white/30' : 'text-sfere-line'
          ]"
          viewBox="0 0 256 256"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="m213.66 101.66l-80 80a8 8 0 0 1-11.32 0l-80-80a8 8 0 0 1 11.32-11.32L128 164.69l74.34-74.35a8 8 0 0 1 11.32 11.32"
          />
        </svg>
      </li>
    </ol>
  </nav>
</template>

<script setup>
// An <ol> inside a labelled <nav>, with aria-current="page" on the last crumb —
// that combination is what lets a screen reader announce depth, and it is the
// only reason to use this over a row of links.
//
// The final crumb is never a link: it points at the page you are already on.
const props = defineProps({
  // [{ label, to?, href? }]
  items: { type: Array, default: () => [] },
  ariaLabel: { type: String, default: 'Breadcrumb' },
  onDark: { type: Boolean, default: false }
})

function isLast(i) {
  return i === props.items.length - 1
}

function linkTag(item, i) {
  if (isLast(i)) return 'span'
  if (item.to) return 'router-link'
  if (item.href) return 'a'
  return 'span'
}

function linkAttrs(item, i) {
  if (isLast(i)) return {}
  if (item.to) return { to: item.to }
  if (item.href) return { href: item.href }
  return {}
}

function itemClasses(i) {
  if (isLast(i)) {
    return [
      'text-sfere-sm font-medium',
      props.onDark ? 'text-white' : 'text-sfere-fg'
    ]
  }
  return [
    'rounded-sfere text-sfere-sm transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sfere-500/60',
    props.onDark
      ? 'text-white/55 hover:text-white'
      : 'text-sfere-fg-muted hover:text-sfere-brand-text'
  ]
}
</script>
