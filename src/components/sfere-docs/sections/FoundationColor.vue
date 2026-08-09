<template>
  <DocSection
    id="colour"
    eyebrow="Foundations"
    title="Colour"
    description="One saturated purple against a strictly neutral ramp. The neutrals are deliberately colourless — that restraint is what lets a single brand accent carry the whole interface without anything competing with it."
  >
    <DocSpecimen
      title="Brand ramp"
      note="click any swatch to copy its token"
      usage="500 is the identity colour. 600 fills primary buttons and 700 is both their hover state and every piece of brand-coloured text — that split is inherited from sfere.io, not an accident."
    >
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <DocSwatch v-for="s in brand" :key="s.token" v-bind="s" />
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Semantic brand aliases"
      usage="Reach for these in components. Drop to the numeric ramp only when you genuinely mean 'one step lighter' — a component that hard-codes sfere-600 will not follow a future brand tweak."
    >
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DocSwatch v-for="s in aliases" :key="s.token" v-bind="s" />
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Light surfaces"
      usage="The page background is the only tinted neutral — a barely-cool off-white that keeps large flat areas from looking like unstyled HTML. Cards sit on pure white above it."
    >
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <DocSwatch v-for="s in light" :key="s.token" v-bind="s" />
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Ink surfaces"
      on-dark
      usage="Dark is a section treatment, not a theme. Use it to punctuate a long page — hero, one mid-page band, footer — and switch the content inside to its on-dark variants."
    >
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <DocSwatch v-for="s in ink" :key="s.token" v-bind="s" />
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Status"
      usage="An extension, not a lift: sfere.io only ever needed one status colour. These are picked to sit correctly against the neutral ramp. Do not introduce a fifth."
    >
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <DocSwatch v-for="s in status" :key="s.token" v-bind="s" />
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Contrast"
      usage="Two rules cover almost every case: brand purple is a background colour for white text, or a text colour on white — never brand text on a brand fill."
    >
      <div class="flex flex-col gap-3">
        <div
          v-for="pair in contrast"
          :key="pair.label"
          class="flex flex-wrap items-center justify-between gap-3 rounded-sfere-lg border border-sfere-line bg-sfere-surface px-4 py-3"
        >
          <span
            :class="[
              'rounded-sfere px-3 py-1.5 text-sfere-sm font-medium',
              pair.demo
            ]"
          >
            {{ pair.label }}
          </span>
          <span class="font-sfere-mono text-sfere-xs text-sfere-fg-muted">{{
            pair.note
          }}</span>
        </div>
      </div>
    </DocSpecimen>
  </DocSection>
</template>

<script setup>
import DocSection from '../DocSection.vue'
import DocSpecimen from '../DocSpecimen.vue'
import DocSwatch from '../DocSwatch.vue'

// Every `swatchClass` is a complete literal so Tailwind's source scan finds it.
const brand = [
  {
    token: 'sfere-50',
    value: '#F5F0FF',
    usage: 'Badge fill',
    swatchClass: 'bg-sfere-50'
  },
  {
    token: 'sfere-100',
    value: '#EDE5FF',
    usage: 'Avatar fill',
    swatchClass: 'bg-sfere-100'
  },
  {
    token: 'sfere-200',
    value: '#DCCFFF',
    usage: 'Alert border',
    swatchClass: 'bg-sfere-200'
  },
  {
    token: 'sfere-300',
    value: '#C4AAFF',
    usage: 'Hover border, on-ink text',
    swatchClass: 'bg-sfere-300'
  },
  {
    token: 'sfere-400',
    value: '#AA80FF',
    usage: 'Focus border, flow lines',
    swatchClass: 'bg-sfere-400'
  },
  {
    token: 'sfere-500',
    value: '#9969FF',
    usage: 'Identity, logo, focus ring',
    swatchClass: 'bg-sfere-500'
  },
  {
    token: 'sfere-600',
    value: '#854DFF',
    usage: 'Primary button fill',
    swatchClass: 'bg-sfere-600'
  },
  {
    token: 'sfere-700',
    value: '#7C4DFF',
    usage: 'Brand text, links, hover fill',
    swatchClass: 'bg-sfere-700'
  },
  {
    token: 'sfere-800',
    value: '#582EB7',
    usage: 'Derived — text on tint',
    swatchClass: 'bg-sfere-800'
  },
  {
    token: 'sfere-900',
    value: '#351070',
    usage: 'Plum: on-white-button text',
    swatchClass: 'bg-sfere-900'
  }
]

const aliases = [
  {
    token: 'sfere-brand',
    value: '= 500',
    usage: 'Identity and focus',
    swatchClass: 'bg-sfere-brand'
  },
  {
    token: 'sfere-brand-fill',
    value: '= 600',
    usage: 'Primary button background',
    swatchClass: 'bg-sfere-brand-fill'
  },
  {
    token: 'sfere-brand-text',
    value: '= 700',
    usage: 'Brand text and hover fill',
    swatchClass: 'bg-sfere-brand-text'
  },
  {
    token: 'sfere-plum',
    value: '= 900',
    usage: 'Text on white-on-ink buttons',
    swatchClass: 'bg-sfere-plum'
  }
]

const light = [
  {
    token: 'sfere-bg',
    value: '≈ #F7F8FA',
    usage: 'Page canvas',
    swatchClass: 'bg-sfere-bg'
  },
  {
    token: 'sfere-surface',
    value: '#FFFFFF',
    usage: 'Cards, panels',
    swatchClass: 'bg-sfere-surface'
  },
  {
    token: 'sfere-fill',
    value: '≈ #F5F5F5',
    usage: 'Hover, inset rows',
    swatchClass: 'bg-sfere-fill'
  },
  {
    token: 'sfere-line',
    value: '≈ #E5E5E5',
    usage: 'Hairlines',
    swatchClass: 'bg-sfere-line'
  },
  {
    token: 'sfere-fg-muted',
    value: '≈ #737373',
    usage: 'Secondary text',
    swatchClass: 'bg-sfere-fg-muted'
  },
  {
    token: 'sfere-fg',
    value: '≈ #0A0A0A',
    usage: 'Primary text',
    swatchClass: 'bg-sfere-fg'
  }
]

const ink = [
  {
    token: 'sfere-ink',
    value: '#0B0712',
    usage: 'Dark section canvas',
    swatchClass: 'bg-sfere-ink'
  },
  {
    token: 'sfere-ink-raised',
    value: '#17151D',
    usage: 'Cards on that canvas',
    swatchClass: 'bg-sfere-ink-raised'
  },
  {
    token: 'sfere-ink-wordmark',
    value: '#1A1430',
    usage: 'Logotype ink on light',
    swatchClass: 'bg-sfere-ink-wordmark'
  }
]

const status = [
  {
    token: 'sfere-success',
    value: '#059669',
    usage: 'Healthy, delivered',
    swatchClass: 'bg-sfere-success'
  },
  {
    token: 'sfere-success-soft',
    value: '#ECFDF5',
    usage: 'Success fill',
    swatchClass: 'bg-sfere-success-soft'
  },
  {
    token: 'sfere-warn',
    value: '#D97706',
    usage: 'Degraded, throttled',
    swatchClass: 'bg-sfere-warn'
  },
  {
    token: 'sfere-warn-soft',
    value: '#FFFBEB',
    usage: 'Warning fill',
    swatchClass: 'bg-sfere-warn-soft'
  },
  {
    token: 'sfere-danger',
    value: '#E11D48',
    usage: 'Failed, destructive',
    swatchClass: 'bg-sfere-danger'
  },
  {
    token: 'sfere-danger-soft',
    value: '#FFF1F2',
    usage: 'Danger fill',
    swatchClass: 'bg-sfere-danger-soft'
  }
]

const contrast = [
  {
    label: 'White on sfere-600',
    demo: 'bg-sfere-brand-fill text-white',
    note: 'primary button — passes AA'
  },
  {
    label: 'sfere-700 on white',
    demo: 'bg-white text-sfere-brand-text ring-1 ring-sfere-line',
    note: 'links and brand text — passes AA'
  },
  {
    label: 'sfere-800 on sfere-50',
    demo: 'bg-sfere-50 text-sfere-800',
    note: 'text on a brand tint — use 800, not 500'
  },
  {
    label: 'sfere-300 on ink',
    demo: 'bg-sfere-ink text-sfere-300',
    note: 'eyebrows and links on dark sections'
  }
]
</script>
