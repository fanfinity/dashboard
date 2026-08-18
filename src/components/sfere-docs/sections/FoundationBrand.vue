<template>
  <DocSection
    id="brand"
    eyebrow="Foundations"
    title="Brand"
    description="Nine nodes converging on one sphere: scattered signals resolved into a single profile. The mark is the product's thesis, which is why the arrangement is fixed and only the wordmark ink changes."
  >
    <DocSpecimen
      title="Lockup — light surfaces"
      note="public/brand/sfere-logo.svg"
      usage="The default. Wordmark in plum ink (#1A1430) on white or the page background."
      code='<SfereLogo :height="32" />'
    >
      <div class="flex items-center gap-10">
        <SfereLogo :height="32" />
        <SfereLogo :height="22" />
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Lockup — ink surfaces"
      note="public/brand/sfere-logo-on-dark.svg"
      on-dark
      usage="Set on-dark whenever the logo sits on a SfereSection tone=ink. The wordmark flips to white; the sphere does not change."
      code='<SfereLogo :height="32" on-dark />'
    >
      <div class="flex items-center gap-10">
        <SfereLogo :height="32" on-dark />
        <SfereLogo :height="22" on-dark />
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Mark"
      note="public/brand/sfere-mark.svg"
      usage="Favicons, avatars, app icons and anywhere narrower than about 120px, where the wordmark stops being legible."
      code='<SfereLogo variant="mark" :height="40" />'
    >
      <div class="flex items-end gap-8">
        <SfereLogo variant="mark" :height="40" />
        <SfereLogo variant="mark" :height="28" />
        <SfereLogo variant="mark" :height="18" />
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Clear space and minimum size"
      usage="Keep clear space equal to the sphere's diameter on every side. Never set the lockup below 18px tall — the wordmark's counters close up."
    >
      <div class="inline-flex flex-col gap-3">
        <div
          class="relative inline-flex border border-dashed border-sfere-300 p-[15px]"
        >
          <SfereLogo :height="30" />
        </div>
        <p class="font-sfere-mono text-sfere-xs text-sfere-fg-muted">
          dashed edge = minimum clear space
        </p>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Misuse"
      usage="Four ways to break the identity. All four are things a well-meaning deck template will do for you."
      bleed
    >
      <ul class="grid gap-px bg-sfere-line sm:grid-cols-2">
        <li
          v-for="rule in misuse"
          :key="rule.title"
          class="bg-sfere-surface p-5"
        >
          <div class="flex items-start gap-3">
            <span
              class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-sfere-danger-soft text-sfere-danger"
              aria-hidden="true"
            >
              <svg class="size-3" viewBox="0 0 256 256" fill="currentColor">
                <path
                  d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128L50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"
                />
              </svg>
            </span>
            <div>
              <p class="text-sfere-sm font-semibold text-sfere-fg">{{
                rule.title
              }}</p>
              <p class="mt-1 text-sfere-sm text-sfere-fg-muted">{{
                rule.why
              }}</p>
            </div>
          </div>
        </li>
      </ul>
    </DocSpecimen>
  </DocSection>
</template>

<script setup>
import DocSection from '../DocSection.vue'
import DocSpecimen from '../DocSpecimen.vue'
import SfereLogo from '@/components/ui/SfereLogo.vue'

const misuse = [
  {
    title: 'Do not recolour the sphere',
    why: 'The purple is the identity. It already reads on both light and ink, so there is no case a recolour solves.'
  },
  {
    title: 'Do not stretch or rotate',
    why: 'The node spacing encodes the convergence. Non-uniform scaling destroys it and looks like a rendering fault.'
  },
  {
    title: 'Do not put the light lockup on a light surface',
    why: 'The white wordmark disappears. Switching to on-dark is one prop; checking is cheaper than shipping an invisible logo.'
  },
  {
    title: 'Do not add effects',
    why: 'No drop shadow, outline, gradient fill or container. Elevation belongs to surfaces, never to the mark.'
  }
]
</script>
