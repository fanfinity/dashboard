<template>
  <DocSection
    id="surface"
    eyebrow="Foundations"
    title="Elevation & surface"
    description="Shadows here are plum-tinted, never neutral black — rgb(53 16 112) at low alpha. That single choice is most of what separates the Sfere surface from a default Tailwind card."
  >
    <DocSpecimen
      title="Shadows"
      usage="Cards do not carry a shadow at rest. Elevation is reserved for things that genuinely float — menus, popovers, a card mid-hover — so a grid stays flat and the page reads as one plane."
    >
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="s in shadows" :key="s.token" class="flex flex-col gap-2">
          <div
            :class="[
              'h-20 rounded-sfere-xl border border-sfere-line bg-sfere-surface',
              s.className
            ]"
          />
          <p class="font-sfere-mono text-sfere-xs text-sfere-fg">{{
            s.token
          }}</p>
          <p class="text-[0.6875rem] leading-snug text-sfere-fg-muted">{{
            s.usage
          }}</p>
        </div>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Ink shadows"
      on-dark
      usage="On a dark canvas a plum tint disappears. These two are near-black and go with tone=ink cards."
    >
      <div class="grid gap-6 sm:grid-cols-2">
        <div v-for="s in inkShadows" :key="s.token" class="flex flex-col gap-2">
          <div
            :class="[
              'h-20 rounded-sfere-xl border border-sfere-hairline bg-sfere-ink-raised',
              s.className
            ]"
          />
          <p class="font-sfere-mono text-sfere-xs text-white/80">{{
            s.token
          }}</p>
          <p class="text-[0.6875rem] leading-snug text-white/50">{{
            s.usage
          }}</p>
        </div>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="sfere-glow-top"
      usage="The purple bloom that marks a light section as a distinct band without a background colour change. Pair with bg-sfere-bg; SfereSection tone=soft does both."
      code='<SfereSection tone="soft">…</SfereSection>'
      bleed
    >
      <div class="sfere-glow-top bg-sfere-bg px-6 py-14 text-center">
        <p
          class="font-sfere-mono text-sfere-label uppercase text-sfere-fg-muted"
        >
          bloom sits at the top edge
        </p>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="sfere-dot-grid"
      usage="A 22px lattice of white dots at 9%, for dark sections. It gives the ink canvas depth without competing with content — if you can see it clearly, it is too strong."
      bleed
    >
      <div class="sfere-dot-grid bg-sfere-ink px-6 py-14 text-center">
        <p class="font-sfere-mono text-sfere-label uppercase text-white/40">
          22px pitch, white at 9%
        </p>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="sfere-gradient-border"
      usage="A 1px border fading from brand purple across the corner. It is a spotlight — one card per view, or it lights nothing."
      code="<CardPanel gradient-border>…</CardPanel>"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <CardPanel gradient-border>
          <p class="text-sfere-sm font-semibold text-sfere-fg">Highlighted</p>
          <p class="mt-1 text-sfere-sm text-sfere-fg-muted">
            Purple fades in from the top-left and is gone by 72%.
          </p>
        </CardPanel>
        <CardPanel>
          <p class="text-sfere-sm font-semibold text-sfere-fg">Default</p>
          <p class="mt-1 text-sfere-sm text-sfere-fg-muted">
            The same card without the treatment, for comparison.
          </p>
        </CardPanel>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Edge masks"
      usage="Bleed content into the background instead of cutting it off. sfere-fade-x for horizontal rails, sfere-fade-b for a cropped screenshot."
      bleed
    >
      <div class="bg-sfere-bg py-8">
        <div class="sfere-fade-x flex gap-3 overflow-hidden px-6">
          <span
            v-for="n in 10"
            :key="n"
            class="grid h-12 w-28 shrink-0 place-items-center rounded-sfere-lg border border-sfere-line bg-sfere-surface font-sfere-mono text-sfere-xs text-sfere-fg-muted"
          >
            logo {{ n }}
          </span>
        </div>
      </div>
    </DocSpecimen>
  </DocSection>
</template>

<script setup>
import DocSection from '../DocSection.vue'
import DocSpecimen from '../DocSpecimen.vue'
import CardPanel from '@/components/ui/CardPanel.vue'

const shadows = [
  {
    token: 'shadow-sfere-btn',
    className: 'shadow-sfere-btn',
    usage: 'Primary button rest state'
  },
  {
    token: 'shadow-sfere-glow',
    className: 'shadow-sfere-glow',
    usage: 'Focused or live control'
  },
  {
    token: 'shadow-sfere-soft',
    className: 'shadow-sfere-soft',
    usage: 'Card on hover'
  },
  {
    token: 'shadow-sfere-card',
    className: 'shadow-sfere-card',
    usage: 'Lifted panel, screenshot frame'
  },
  {
    token: 'shadow-sfere-pop',
    className: 'shadow-sfere-pop',
    usage: 'Menus and popovers'
  }
]

const inkShadows = [
  {
    token: 'shadow-sfere-ink',
    className: 'shadow-sfere-ink',
    usage: 'Card on a dark section'
  },
  {
    token: 'shadow-sfere-ink-deep',
    className: 'shadow-sfere-ink-deep',
    usage: 'Modal or overlay on ink'
  }
]
</script>
