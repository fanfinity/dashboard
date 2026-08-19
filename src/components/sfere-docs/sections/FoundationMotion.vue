<template>
  <DocSection
    id="motion"
    eyebrow="Foundations"
    title="Motion"
    description="Two curves and four durations. Interface feedback is fast and uses the standard curve; anything that reveals or expands is slower and uses the branded one, which decelerates hard at the end so a panel feels like it settles rather than stops."
  >
    <DocSpecimen
      title="Easing"
      usage="ease-sfere-ui for hovers, focus rings and colour changes. ease-sfere for anything that changes size or position."
    >
      <div class="flex flex-col">
        <DocSpecRow name="ease-sfere-ui" meta="cubic-bezier(.4, 0, .2, 1)">
          <p class="text-sfere-sm text-sfere-fg-muted">
            The standard curve. Symmetric, unremarkable, correct for feedback.
          </p>
        </DocSpecRow>
        <DocSpecRow name="ease-sfere" meta="cubic-bezier(.2, .7, .2, 1)">
          <p class="text-sfere-sm text-sfere-fg-muted">
            The branded curve. Fast out, long settle — reveals, panels,
            progress.
          </p>
        </DocSpecRow>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Durations"
      usage="If you are reaching past 700ms, the thing you are animating probably wants a loading state instead."
    >
      <div class="flex flex-col">
        <DocSpecRow
          v-for="d in durations"
          :key="d.name"
          :name="d.name"
          :meta="d.meta"
        >
          <p class="text-sfere-sm text-sfere-fg-muted">{{ d.usage }}</p>
        </DocSpecRow>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Flow lines"
      on-dark
      usage="A travelling highlight along a hairline — the 'data is moving' cue on pipeline diagrams. One or two per view; a screen of them is a screensaver."
      code='<span class="sfere-flow-line animate-sfere-flow h-px w-full" />'
    >
      <div class="flex flex-col gap-6 py-4">
        <span
          class="sfere-flow-line animate-sfere-flow block h-px w-full bg-white/10"
        />
        <span
          class="sfere-flow-line animate-sfere-flow block h-px w-full bg-white/10"
        />
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Status animations"
      on-dark
      usage="animate-sfere-blink for a live indicator, animate-sfere-breathe for an idle-but-healthy one."
    >
      <div class="flex flex-wrap items-center gap-8">
        <span
          class="inline-flex items-center gap-2 text-sfere-sm text-white/80"
        >
          <span
            class="animate-sfere-blink size-2 rounded-full bg-sfere-success-on-ink"
          />
          animate-sfere-blink
        </span>
        <span
          class="inline-flex items-center gap-2 text-sfere-sm text-white/80"
        >
          <span
            class="animate-sfere-breathe size-2 rounded-full bg-sfere-400"
          />
          animate-sfere-breathe
        </span>
      </div>
    </DocSpecimen>

    <NoticeBanner
      tone="info"
      title="Every animation here is decorative"
      message="The token layer disables all four under prefers-reduced-motion, and the components that transform (SfereToggle, SfereProgress, SfereSkeleton) carry motion-reduce: variants. If you add motion, match that — nothing in this system may be the only way a state is communicated."
    />
  </DocSection>
</template>

<script setup>
import DocSection from '../DocSection.vue'
import DocSpecimen from '../DocSpecimen.vue'
import DocSpecRow from '../DocSpecRow.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'

const durations = [
  {
    name: '150ms',
    meta: 'duration-150',
    usage: 'Colour and opacity — links, nav items, table rows.'
  },
  {
    name: '200ms',
    meta: 'duration-200',
    usage: 'Buttons, cards, toggles. The default for a control.'
  },
  {
    name: '500ms',
    meta: 'duration-500',
    usage: 'Progress bars and anything measuring a real quantity.'
  },
  {
    name: '700ms',
    meta: 'duration-700',
    usage: 'Scroll reveals. The upper bound.'
  }
]
</script>
