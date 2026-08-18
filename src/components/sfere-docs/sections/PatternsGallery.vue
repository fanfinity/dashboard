<template>
  <DocSection
    id="patterns"
    eyebrow="Patterns"
    title="Composition"
    description="Tokens and components are only half a design system; the other half is knowing how they stack. These are the three arrangements sfere.io repeats, rendered here at full width so the rhythm is visible rather than described."
  >
    <DocSpecimen
      title="Hero band"
      note="SfereSection tone=ink"
      usage="Dark, once, at the top. Eyebrow, one display-size heading, one deck, two actions, a row of trust pills — and nothing else. Everything competing for the same attention is what makes most heroes fail."
      bleed
    >
      <SfereSection tone="ink" class="rounded-none">
        <div class="max-w-3xl">
          <SfereEyebrow label="The real-time fan data platform" on-dark dot />

          <h2
            class="mt-5 font-sfere-display! text-sfere-h2! text-white sm:text-sfere-h1! lg:text-sfere-display!"
          >
            Know every fan. Prove every outcome.
          </h2>

          <p class="mt-6 max-w-xl text-sfere-lead text-white/70">
            Every signal resolved into one consented profile per fan, activated
            across channels, and proven with verified reach.
          </p>

          <div class="mt-9 flex flex-wrap items-center gap-3">
            <SfereButton variant="white" size="lg">Book a demo</SfereButton>
            <SfereButton variant="outlineLight" size="lg"
              >Read the docs</SfereButton
            >
          </div>

          <div class="mt-10 flex flex-wrap items-center gap-2.5">
            <SferePill label="Hosted in-region" on-dark />
            <SferePill label="PDPL aligned" on-dark />
            <SferePill label="Any cloud, any on-prem" on-dark />
          </div>
        </div>
      </SfereSection>
    </DocSpecimen>

    <DocSpecimen
      title="Proof band"
      note="SfereSection tone=soft size=sm"
      usage="A short light section directly under the hero. Four numbers, bare so they sit on the background rather than in boxes — a row of four bordered cards reads as navigation, not as evidence."
      bleed
    >
      <SfereSection tone="soft" size="sm" class="rounded-none">
        <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard bare label="Events / hour" value="1.28M" delta="4.2%" />
          <StatCard
            bare
            label="Resolved profiles"
            value="812,405"
            delta="1.1%"
          />
          <StatCard
            bare
            label="Match rate"
            value="94.6%"
            hint="rarity-weighted"
          />
          <StatCard
            bare
            label="Median latency"
            value="240ms"
            delta="12%"
            direction="down"
          />
        </div>
      </SfereSection>
    </DocSpecimen>

    <DocSpecimen
      title="Feature grid"
      note="SfereSection tone=light"
      usage="Centred heading, then three or six cards. One card carries the gradient border; the rest stay plain, which is the only reason the highlighted one reads as highlighted."
      bleed
    >
      <SfereSection tone="light" class="rounded-none">
        <SfereSectionHeading
          align="center"
          eyebrow="Platform"
          title="From first signal to proven revenue"
          lead="Four capabilities, one pipeline. Nothing leaves your region on the way through."
        />

        <div class="mt-12 grid gap-4 md:grid-cols-3">
          <SfereFeatureCard
            v-for="(f, i) in features"
            :key="f.title"
            :title="f.title"
            :description="f.description"
            link-label="How it works"
            to="/design-system"
            :highlighted="i === 1"
          />
        </div>
      </SfereSection>
    </DocSpecimen>

    <DocSpecimen
      title="Closing call to action"
      note="SfereSection tone=ink with sfere-dot-grid"
      usage="The bookend to the hero. Same canvas, half the height, one action — repeating the hero's full weight at the bottom of a page makes the whole thing feel like it restarted."
      bleed
    >
      <SfereSection tone="ink" size="sm" class="rounded-none">
        <div class="flex flex-col items-center gap-7 text-center">
          <SfereLogo :height="30" on-dark />
          <h2
            class="max-w-xl font-sfere-display! text-sfere-h3! text-white sm:text-sfere-h2!"
          >
            Salem is in your crowd tonight.
          </h2>
          <p class="max-w-lg text-sfere-body text-white/60">
            You already have the signals. Sfere turns them into someone you can
            recognise, reach and report on.
          </p>
          <SfereButton variant="white" size="lg">Book a demo</SfereButton>
        </div>
      </SfereSection>
    </DocSpecimen>
  </DocSection>
</template>

<script setup>
import DocSection from '../DocSection.vue'
import DocSpecimen from '../DocSpecimen.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereEyebrow from '@/components/ui/SfereEyebrow.vue'
import SfereFeatureCard from '@/components/ui/SfereFeatureCard.vue'
import SfereLogo from '@/components/ui/SfereLogo.vue'
import SferePill from '@/components/ui/SferePill.vue'
import SfereSection from '@/components/ui/SfereSection.vue'
import SfereSectionHeading from '@/components/ui/SfereSectionHeading.vue'
import StatCard from '@/components/ui/StatCard.vue'

const features = [
  {
    title: 'Event collection',
    description:
      'Capture every signal from web, app and stadium in one schema, with consent recorded at the point of capture.'
  },
  {
    title: 'Identity stitching',
    description:
      'Rarity-weighted matching folds devices, tickets and accounts into one profile per fan.'
  },
  {
    title: 'Activation',
    description:
      'Push resolved audiences back into messaging, ad platforms and the sponsor portal.'
  }
]
</script>
