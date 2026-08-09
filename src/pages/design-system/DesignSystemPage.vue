<template>
  <div
    class="min-h-screen bg-sfere-bg font-sfere-sans text-sfere-fg antialiased"
  >
    <!-- The router runs in hash mode, so a real `href="#id"` would replace the
         route rather than scroll. Every in-page jump on this page goes through
         goTo() instead. -->
    <a
      href="#ds-content"
      class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sfere focus:bg-sfere-brand-fill focus:px-4 focus:py-2 focus:text-sfere-sm focus:text-white"
      @click.prevent="goTo('ds-content')"
    >
      Skip to content
    </a>

    <header
      class="sticky top-0 z-40 border-b border-sfere-line bg-sfere-surface/85 backdrop-blur"
    >
      <div
        class="mx-auto flex h-16 max-w-sfere-page items-center justify-between gap-4 px-5 sm:px-6 lg:px-8"
      >
        <div class="flex min-w-0 items-center gap-3">
          <SfereLogo :height="26" />
          <!-- max-sm:hidden, not `hidden sm:inline`: Quasar ships an unlayered
               `.hidden { display: none !important }`, so the bare `hidden`
               class can never be turned back on by a responsive variant. -->
          <span
            class="font-sfere-mono text-sfere-label uppercase text-sfere-fg-muted max-sm:hidden"
          >
            Design system
          </span>
        </div>

        <div class="flex items-center gap-2">
          <SfereBadge tone="neutral" :label="`v${VERSION}`" />
          <SfereButton variant="secondary" size="sm" to="/">
            Back to dashboard
          </SfereButton>
        </div>
      </div>
    </header>

    <div
      class="mx-auto flex max-w-sfere-page gap-12 px-5 py-12 sm:px-6 lg:px-8 lg:py-16"
    >
      <!-- Table of contents. Hidden below lg: at that width the sections are
           short enough to scroll, and a horizontal chip rail would compete
           with the specimens it is meant to introduce. -->
      <aside class="w-52 shrink-0 max-lg:hidden">
        <nav class="sticky top-28" aria-label="Design system sections">
          <p
            class="mb-3 font-sfere-mono text-sfere-label uppercase text-sfere-fg-muted"
          >
            Contents
          </p>
          <ul class="flex flex-col gap-0.5 border-l border-sfere-line">
            <li v-for="item in NAV" :key="item.id">
              <button
                type="button"
                :class="linkClasses(item.id)"
                :aria-current="active === item.id ? 'true' : undefined"
                @click="goTo(item.id)"
              >
                {{ item.label }}
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      <main id="ds-content" class="min-w-0 flex-1">
        <div class="mb-14">
          <SfereEyebrow label="Design system" dot />
          <h1
            class="mt-4 font-sfere-display! text-sfere-h2! text-sfere-fg sm:text-sfere-h1!"
          >
            The Sfere design system
          </h1>
          <p class="mt-5 max-w-2xl text-sfere-lead text-sfere-fg-muted">
            Every value on this page was measured off the live marketing site
            rather than eyeballed, so the product and
            <a
              href="https://sfere.io"
              class="font-medium text-sfere-brand-text hover:underline"
              >sfere.io</a
            >
            can converge on one vocabulary instead of drifting into two.
          </p>

          <div class="mt-8 grid gap-4 sm:grid-cols-3">
            <SfereStat
              bare
              label="Design tokens"
              value="71"
              hint="colour, type, shape, motion"
            />
            <SfereStat
              bare
              label="Components"
              value="30"
              hint="src/components/sfere/"
            />
            <SfereStat
              bare
              label="Screens on the tokens"
              value="54"
              hint="every route in the manifest"
            />
          </div>
        </div>

        <div class="flex flex-col gap-16">
          <FoundationBrand />
          <FoundationColor />
          <FoundationType />
          <FoundationLayout />
          <FoundationSurface />
          <FoundationMotion />
          <ComponentsActions />
          <ComponentsForms />
          <ComponentsData />
          <ComponentsFeedback />
          <PatternsGallery />
        </div>

        <footer class="mt-20 border-t border-sfere-line pt-8">
          <p class="text-sfere-sm text-sfere-fg-muted">
            Tokens live in
            <code class="font-sfere-mono text-sfere-xs text-sfere-fg"
              >src/css/sfere.css</code
            >, components in
            <code class="font-sfere-mono text-sfere-xs text-sfere-fg"
              >src/components/sfere/</code
            >, and the written spec in
            <code class="font-sfere-mono text-sfere-xs text-sfere-fg"
              >docs/sfere-design-system.md</code
            >.
          </p>
        </footer>
      </main>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import SfereBadge from '@/components/sfere/SfereBadge.vue'
import SfereButton from '@/components/sfere/SfereButton.vue'
import SfereEyebrow from '@/components/sfere/SfereEyebrow.vue'
import SfereLogo from '@/components/sfere/SfereLogo.vue'
import SfereStat from '@/components/sfere/SfereStat.vue'
import FoundationBrand from '@/components/sfere-docs/sections/FoundationBrand.vue'
import FoundationColor from '@/components/sfere-docs/sections/FoundationColor.vue'
import FoundationType from '@/components/sfere-docs/sections/FoundationType.vue'
import FoundationLayout from '@/components/sfere-docs/sections/FoundationLayout.vue'
import FoundationSurface from '@/components/sfere-docs/sections/FoundationSurface.vue'
import FoundationMotion from '@/components/sfere-docs/sections/FoundationMotion.vue'
import ComponentsActions from '@/components/sfere-docs/sections/ComponentsActions.vue'
import ComponentsForms from '@/components/sfere-docs/sections/ComponentsForms.vue'
import ComponentsData from '@/components/sfere-docs/sections/ComponentsData.vue'
import ComponentsFeedback from '@/components/sfere-docs/sections/ComponentsFeedback.vue'
import PatternsGallery from '@/components/sfere-docs/sections/PatternsGallery.vue'

// Bump when the token layer or a component's public props change. It is shown
// in the header so a screenshot in a ticket says which version it came from.
const VERSION = '1.0.0'

// Ids must match the DocSection ids the section components render.
const NAV = [
  { id: 'brand', label: 'Brand' },
  { id: 'colour', label: 'Colour' },
  { id: 'type', label: 'Typography' },
  { id: 'layout', label: 'Layout & shape' },
  { id: 'surface', label: 'Elevation' },
  { id: 'motion', label: 'Motion' },
  { id: 'actions', label: 'Actions' },
  { id: 'forms', label: 'Forms' },
  { id: 'data', label: 'Surfaces & data' },
  { id: 'feedback', label: 'Navigation & feedback' },
  { id: 'patterns', label: 'Composition' }
]

const active = ref(NAV[0].id)

// Scroll spy. The top rootMargin clears the sticky header; the -70% bottom
// margin means a section only claims the highlight once it reaches the upper
// third of the viewport, which stops the marker flickering between two
// headings while a long section scrolls past.
let observer = null
let previousTitle = ''

onMounted(() => {
  // The app has no meta plugin, so route meta.title is never applied to the
  // document. Set it here and put it back on the way out, so a tab opened on
  // this page is distinguishable from a tab on the app itself.
  previousTitle = document.title
  document.title = 'Sfere design system'

  if (typeof IntersectionObserver === 'undefined') return

  observer = new IntersectionObserver(
    entries => {
      const visible = entries.filter(e => e.isIntersecting)
      if (visible.length) active.value = visible[0].target.id
    },
    { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
  )

  NAV.forEach(item => {
    const el = document.getElementById(item.id)
    if (el) observer.observe(el)
  })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  if (previousTitle) document.title = previousTitle
})

// Scroll rather than navigate: with createWebHashHistory the whole route lives
// after the first `#`, so an `href="#colour"` would drop /design-system and
// land on a 404. Honours prefers-reduced-motion, and moves focus so the jump
// works for keyboard and screen-reader users too, not just visually.
function goTo(id) {
  const el = document.getElementById(id)
  if (!el) return

  const reduced = window.matchMedia?.(
    '(prefers-reduced-motion: reduce)'
  ).matches
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })

  el.setAttribute('tabindex', '-1')
  el.focus({ preventScroll: true })
  active.value = id
}

function linkClasses(id) {
  return [
    'block w-full border-l-2 py-1.5 pl-3 text-left text-sfere-sm transition-colors duration-150 -ml-px',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sfere-500/60',
    active.value === id
      ? 'border-sfere-brand-fill font-medium text-sfere-brand-text'
      : 'border-transparent text-sfere-fg-muted hover:text-sfere-fg'
  ]
}
</script>
