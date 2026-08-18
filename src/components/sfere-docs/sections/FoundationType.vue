<template>
  <DocSection
    id="type"
    eyebrow="Foundations"
    title="Typography"
    description="Three faces with no overlap in what they do. Bricolage Grotesque carries every heading and is the main reason the brand reads as confident rather than as another Inter-on-white SaaS page; Inter does all the work; Geist Mono labels things."
  >
    <NoticeBanner
      tone="warn"
      title="Headings need the Tailwind v4 important suffix"
      message="Tailwind emits utilities into @layer utilities, and Quasar's base stylesheet is unlayered — unlayered CSS beats layered CSS whatever the specificity. So a bare h1–h6 needs text-sfere-h2!, not text-sfere-h2. The type tokens bundle size, leading, tracking and weight into one utility precisely so a single ! covers all four."
    >
      <SfereCode
        filename="the two forms"
        code='&lt;!-- renders at Quasar&apos;s heading scale, not yours --&gt;
&lt;h2 class="text-sfere-h2 font-sfere-display"&gt;Section&lt;/h2&gt;

&lt;!-- correct: suffix, never prefix --&gt;
&lt;h2 class="text-sfere-h2! font-sfere-display!"&gt;Section&lt;/h2&gt;

&lt;!-- better: let the component do it --&gt;
&lt;SfereSectionHeading title="Section" /&gt;'
      />
    </NoticeBanner>

    <DocSpecimen
      title="The three faces"
      usage="Display for headings, sans for everything else, mono for labels and machine output. Mono is never body copy — it is a signal that the text is a name, a key or a number."
    >
      <div class="flex flex-col divide-y divide-sfere-line">
        <div
          v-for="face in faces"
          :key="face.token"
          class="flex flex-col gap-2 py-5 first:pt-0 last:pb-0"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <p class="font-sfere-mono text-sfere-xs text-sfere-fg-muted">{{
              face.token
            }}</p>
            <p class="font-sfere-mono text-[0.6875rem] text-sfere-fg-muted">{{
              face.role
            }}</p>
          </div>
          <p :class="[face.className, 'text-2xl text-sfere-fg']">{{
            face.sample
          }}</p>
          <p :class="[face.className, 'text-sfere-sm text-sfere-fg-muted']">
            ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
          </p>
        </div>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Scale"
      note="rendered as <p> so the specimens show the token's own values"
      usage="Nine steps and no more. If a design needs a size between two of these, it needs one of these."
    >
      <div class="flex flex-col">
        <DocSpecRow
          v-for="step in scale"
          :key="step.token"
          :name="step.token"
          :meta="step.meta"
        >
          <p :class="[step.className, 'text-sfere-fg']">{{ step.sample }}</p>
        </DocSpecRow>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Mono labels"
      usage="The 0.18em eyebrow tracking is the most recognisable typographic move in the brand. It only works because it is reserved — apply it to body text and the effect is gone everywhere."
    >
      <div class="flex flex-col">
        <DocSpecRow name="text-sfere-eyebrow" meta="12px / 0.18em / 500">
          <SfereEyebrow label="Real-time fan data" />
        </DocSpecRow>
        <DocSpecRow name="text-sfere-label" meta="11px / 0.14em / 600">
          <p
            class="font-sfere-mono text-sfere-label uppercase text-sfere-fg-muted"
          >
            By use case
          </p>
        </DocSpecRow>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="A heading in context"
      usage="SfereSectionHeading applies the eyebrow, the responsive size step and the important suffixes in one place. Prefer it over composing the three by hand."
      code='<SfereSectionHeading
  eyebrow="Platform"
  title="From first signal to proven revenue"
  lead="Every event resolved into one consented profile per fan."
/>'
    >
      <SfereSectionHeading
        eyebrow="Platform"
        title="From first signal to proven revenue"
        lead="Every event resolved into one consented profile per fan, activated across channels, and proven with verified reach."
      />
    </DocSpecimen>
  </DocSection>
</template>

<script setup>
import DocSection from '../DocSection.vue'
import DocSpecimen from '../DocSpecimen.vue'
import DocSpecRow from '../DocSpecRow.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SfereCode from '@/components/ui/SfereCode.vue'
import SfereEyebrow from '@/components/ui/SfereEyebrow.vue'
import SfereSectionHeading from '@/components/ui/SfereSectionHeading.vue'

const faces = [
  {
    token: 'font-sfere-display',
    role: 'Bricolage Grotesque Variable',
    className: 'font-sfere-display font-bold tracking-tight',
    sample: 'Know every fan.'
  },
  {
    token: 'font-sfere-sans',
    role: 'Inter',
    className: 'font-sfere-sans',
    sample: 'Every signal, resolved.'
  },
  {
    token: 'font-sfere-mono',
    role: 'Geist Mono',
    className: 'font-sfere-mono',
    sample: 'events.ingested = 1_284_390'
  }
]

const scale = [
  {
    token: 'text-sfere-display',
    meta: '72px / 1.04 / 700',
    className: 'font-sfere-display text-sfere-display',
    sample: 'Know every fan'
  },
  {
    token: 'text-sfere-h1',
    meta: '48px / 1.08 / 700',
    className: 'font-sfere-display text-sfere-h1',
    sample: 'Prove every outcome'
  },
  {
    token: 'text-sfere-h2',
    meta: '36px / 1.11 / 700',
    className: 'font-sfere-display text-sfere-h2',
    sample: 'One platform, every audience'
  },
  {
    token: 'text-sfere-h3',
    meta: '24px / 1.25 / 700',
    className: 'font-sfere-display text-sfere-h3',
    sample: 'Identity stitching'
  },
  {
    token: 'text-sfere-h4',
    meta: '18px / 1.4 / 600',
    className: 'font-sfere-display text-sfere-h4',
    sample: 'Single fan view'
  },
  {
    token: 'text-sfere-lead',
    meta: '18px / 1.6',
    className: 'text-sfere-lead text-sfere-fg-muted',
    sample:
      'The deck that sits under a section heading and does the explaining.'
  },
  {
    token: 'text-sfere-body',
    meta: '16px / 1.6',
    className: 'text-sfere-body',
    sample: 'Body copy. Long-form paragraphs and descriptions.'
  },
  {
    token: 'text-sfere-sm',
    meta: '14px / 1.45',
    className: 'text-sfere-sm',
    sample:
      'The default size for interface text — labels, buttons, table cells.'
  },
  {
    token: 'text-sfere-xs',
    meta: '12px / 1.35',
    className: 'text-sfere-xs',
    sample: 'Captions, hints and metadata.'
  }
]
</script>
