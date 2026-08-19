<template>
  <DocSection
    id="data"
    eyebrow="Components"
    title="Surfaces & data"
    description="Cards, tables and stats. All three are presentation only — no fetching, no sorting, no formatting. The page owns the data and hands down strings; that split is what keeps a component reusable across a marketing page and a dashboard."
  >
    <DocSpecimen
      title="CardPanel"
      usage="Three tones. surface is the default; soft recedes a supporting card; ink belongs inside a dark section and nowhere else."
      code="<CardPanel>
  <template #header>…</template>
  …
  <template #footer>…</template>
</CardPanel>"
    >
      <div class="grid gap-4 lg:grid-cols-3">
        <CardPanel>
          <template #header>
            <span class="text-sfere-sm font-semibold text-sfere-fg"
              >Header slot</span
            >
            <StatusBadge tone="success" label="Live" dot />
          </template>
          <p class="text-sfere-sm text-sfere-fg-muted">
            The default surface. No shadow at rest, so a grid of these reads as
            one plane.
          </p>
          <template #footer>
            <span class="font-sfere-mono text-sfere-xs text-sfere-fg-muted"
              >tone="surface"</span
            >
            <SfereLinkArrow label="Open" to="/design-system" />
          </template>
        </CardPanel>

        <CardPanel tone="soft">
          <p class="text-sfere-sm font-semibold text-sfere-fg">Soft</p>
          <p class="mt-1 text-sfere-sm text-sfere-fg-muted">
            Same border, filled background. For a card that supports the one
            next to it.
          </p>
        </CardPanel>

        <CardPanel interactive>
          <p class="text-sfere-sm font-semibold text-sfere-fg">Interactive</p>
          <p class="mt-1 text-sfere-sm text-sfere-fg-muted">
            Lifts and warms its border on hover. Only for cards that are
            themselves links.
          </p>
        </CardPanel>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="SfereFeatureCard"
      usage="The repeating unit of every 'what this does' grid. Composed from CardPanel, SfereIconChip and SfereLinkArrow, so a change to the card reaches every grid at once."
      code='<SfereFeatureCard
  title="Identity stitching"
  description="Match identifiers across devices…"
  link-label="How it works"
  href="#"
/>'
    >
      <div class="grid gap-4 md:grid-cols-3">
        <SfereFeatureCard
          v-for="(f, i) in features"
          :key="f.title"
          :title="f.title"
          :description="f.description"
          link-label="How it works"
          to="/design-system"
          :highlighted="i === 0"
        >
          <template #icon>
            <svg class="size-5" viewBox="0 0 256 256" fill="currentColor">
              <path
                v-for="(p, n) in f.paths"
                :key="n"
                :d="p.d"
                :opacity="p.opacity"
              />
            </svg>
          </template>
        </SfereFeatureCard>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="StatCard"
      usage="delta is a trend and always draws an arrow in a trend colour. Anything that is not a trend — '37 errors', '1.65× fan-out' — goes in hint, or it earns a red down-arrow it did not deserve."
      code='<StatCard label="Events / hour" value="1.28M" delta="4.2%" />
<StatCard label="Error rate" value="0.31%" hint="37 errors" />'
    >
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Events / hour" value="1.28M" delta="4.2%" />
        <StatCard
          label="Resolved profiles"
          value="812,405"
          delta="1.1%"
          direction="down"
        />
        <StatCard
          label="Match rate"
          value="94.6%"
          delta="0.0%"
          direction="flat"
        />
        <StatCard label="Error rate" value="0.31%" hint="37 errors this hour" />
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="SfereTable"
      usage="A real <table>, because sorting, screen readers and find-in-page all depend on it. Column headers are mono micro-labels — that is what stops a dense table reading as a wall of same-sized text."
      code='<SfereTable :columns="columns" :rows="rows">
  <template #cell-status="{ value }">
    <StatusBadge :tone="value" :label="value" dot />
  </template>
</SfereTable>'
      bleed
    >
      <div class="p-6">
        <SfereTable :columns="columns" :rows="rows">
          <template #cell-source="{ row }">
            <div class="flex items-center gap-2.5">
              <SfereAvatar :name="row.source" size="xs" />
              <div>
                <p class="font-medium text-sfere-fg">{{ row.source }}</p>
                <p class="font-sfere-mono text-[0.6875rem] text-sfere-fg-muted">
                  {{ row.id }}
                </p>
              </div>
            </div>
          </template>

          <template #cell-status="{ value }">
            <StatusBadge :tone="STATUS_TONE[value]" :label="value" dot />
          </template>

          <template #cell-events="{ value }">
            <span class="font-sfere-mono tabular-nums">{{ value }}</span>
          </template>
        </SfereTable>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="SfereCode"
      usage="Always on ink, never on the light surface. The contrast is what marks it as machine output without needing a label — and the pre scrolls inside its own box so a long line never widens the page."
    >
      <SfereCode
        filename="POST /v1/events"
        code='{
  "type": "track",
  "event": "ticket_scanned",
  "userId": "fan_8Xk92",
  "properties": { "gate": "N3", "seat": "114-B" }
}'
      />
    </DocSpecimen>
  </DocSection>
</template>

<script setup>
import DocSection from '../DocSection.vue'
import DocSpecimen from '../DocSpecimen.vue'
import SfereAvatar from '@/components/ui/SfereAvatar.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import SfereCode from '@/components/ui/SfereCode.vue'
import SfereFeatureCard from '@/components/ui/SfereFeatureCard.vue'
import SfereLinkArrow from '@/components/ui/SfereLinkArrow.vue'
import StatCard from '@/components/ui/StatCard.vue'
import SfereTable from '@/components/ui/SfereTable.vue'

// Phosphor duotone glyphs, kept as path data rather than markup strings so the
// template can render them with v-for — no v-html, nothing for a reviewer to
// have to trust.
const features = [
  {
    title: 'Event collection',
    description:
      'Capture every signal from web, app and stadium, in one schema.',
    paths: [
      { d: 'M240 104L56 168V40Z', opacity: '0.2' },
      {
        d: 'M242.63 96.44l-184-64A8 8 0 0 0 48 40v176a8 8 0 0 0 16 0v-42.31l178.63-62.13a8 8 0 0 0 0-15.12M64 156.75V51.25L215.65 104Z'
      }
    ]
  },
  {
    title: 'Identity stitching',
    description: 'Match identifiers across devices into one profile per fan.',
    paths: [
      {
        d: 'M224 64v64a64 64 0 0 1-64 64H32v-64a64 64 0 0 1 64-64Z',
        opacity: '0.2'
      },
      {
        d: 'M24 128a72.08 72.08 0 0 1 72-72h108.69l-10.35-10.34a8 8 0 0 1 11.32-11.32l24 24a8 8 0 0 1 0 11.32l-24 24a8 8 0 0 1-11.32-11.32L204.69 72H96a56.06 56.06 0 0 0-56 56a8 8 0 0 1-16 0'
      }
    ]
  },
  {
    title: 'Reverse ETL',
    description: 'Push resolved audiences back into the tools your teams use.',
    paths: [
      {
        d: 'm200 152l-40 40l-64-16l-56-40l32.68-65.37L128 56l55.32 14.63l.28 1.37H144l-45.66 44.29a8 8 0 0 0 1.38 12.42C117.23 139.9 141 139.13 160 120Z',
        opacity: '0.2'
      },
      {
        d: 'M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24m0 192a88 88 0 1 1 88-88a88.1 88.1 0 0 1-88 88'
      }
    ]
  }
]

const columns = [
  { key: 'source', label: 'Source' },
  { key: 'status', label: 'Status' },
  { key: 'events', label: 'Events / hr', align: 'right' },
  { key: 'region', label: 'Region', align: 'right' }
]

const STATUS_TONE = {
  Delivering: 'success',
  Throttled: 'warn',
  Failed: 'danger',
  Paused: 'neutral'
}

// Pre-formatted, en-GB, exactly as the composables in this repo hand data down.
const rows = [
  {
    id: 'src_9df21',
    source: 'Stadium turnstiles',
    status: 'Delivering',
    events: '412,880',
    region: 'me-central-1'
  },
  {
    id: 'src_1ab77',
    source: 'Fan app',
    status: 'Delivering',
    events: '298,140',
    region: 'me-central-1'
  },
  {
    id: 'src_4c019',
    source: 'Web storefront',
    status: 'Throttled',
    events: '96,220',
    region: 'eu-west-1'
  },
  {
    id: 'src_7e553',
    source: 'Loyalty backfill',
    status: 'Paused',
    events: '0',
    region: 'eu-west-1'
  },
  {
    id: 'src_2f884',
    source: 'Legacy CRM export',
    status: 'Failed',
    events: '0',
    region: 'us-east-1'
  }
]
</script>
