<template>
  <DocSection
    id="migration"
    eyebrow="Adoption"
    title="Adopting this in the dashboard"
    description="Nothing on this page is wired into the 54 product screens yet, and that is deliberate. Every token here is namespaced sfere-*, so adding the layer changed no existing pixel — the rename becomes a decision someone makes on purpose rather than a side effect of a stylesheet import."
  >
    <SfereAlert
      tone="info"
      title="This branch adds a system; it does not apply one"
      message="The dashboard still renders in Fanfinity purple (#3800c1) with Plus Jakarta Sans. Both token sets coexist, which is what makes a screen-by-screen migration possible instead of a single irreversible flip."
    />

    <DocSpecimen
      title="Token mapping"
      usage="What each existing Fanfinity token becomes. Where a row says 'no equivalent', the Sfere system solves the same problem differently rather than renaming the value."
      bleed
    >
      <div class="p-6">
        <SfereTable :columns="columns" :rows="mapping">
          <template #cell-from="{ row }">
            <div class="flex items-center gap-2.5">
              <span
                class="size-4 shrink-0 rounded-sfere-sm border border-sfere-line"
                :style="{ background: row.fromHex }"
              />
              <span class="font-sfere-mono text-sfere-xs">{{ row.from }}</span>
            </div>
          </template>

          <template #cell-to="{ row }">
            <div class="flex items-center gap-2.5">
              <span
                v-if="row.toHex"
                class="size-4 shrink-0 rounded-sfere-sm border border-sfere-line"
                :style="{ background: row.toHex }"
              />
              <span class="font-sfere-mono text-sfere-xs">{{ row.to }}</span>
            </div>
          </template>
        </SfereTable>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Two ways to flip"
      usage="Repointing is one file and one commit but moves all 54 screens at once. Migrating screen by screen is slower and reviewable. Pick by how much appetite there is for a single large visual diff."
    >
      <div class="grid gap-4 lg:grid-cols-2">
        <SfereCard>
          <p class="text-sfere-sm font-semibold text-sfere-fg">
            A · Repoint the existing tokens
          </p>
          <p class="mt-2 text-sfere-sm text-sfere-fg-muted">
            Change the values in
            <code class="font-sfere-mono text-sfere-xs">tailwind.css</code>
            to the Sfere ones. Every screen rebrands at once and no component
            markup changes. Fast, and entirely undoable by reverting one file.
          </p>
          <SfereCode
            class="mt-4"
            filename="src/css/tailwind.css"
            code="--color-brand: #854dff;  /* was #3800c1 */
--color-ink:   #0a0a0a;  /* was #030712 */
--font-sans:   'Inter', …;"
          />
        </SfereCard>

        <SfereCard>
          <p class="text-sfere-sm font-semibold text-sfere-fg">
            B · Migrate screen by screen
          </p>
          <p class="mt-2 text-sfere-sm text-sfere-fg-muted">
            Rewrite one page at a time against the
            <code class="font-sfere-mono text-sfere-xs"
              >src/components/sfere/</code
            >
            kit, leaving the rest untouched. Slower, but every step is a small
            reviewable diff and the two systems can sit side by side while it
            happens.
          </p>
          <p class="mt-3 text-sfere-sm text-sfere-fg-muted">
            The screen manifest makes this cheap: implementing a screen means
            rewriting its file in place, never adding a route.
          </p>
        </SfereCard>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="What this branch touched"
      usage="Two of these are frozen files. Both edits are foundation-phase changes made deliberately for this branch, not story work — see docs/agent-workflow.md."
    >
      <SfereTable :columns="fileColumns" :rows="files">
        <template #cell-path="{ value }">
          <span class="font-sfere-mono text-sfere-xs">{{ value }}</span>
        </template>
        <template #cell-frozen="{ value }">
          <SfereBadge
            :tone="value ? 'warn' : 'neutral'"
            :label="value ? 'frozen' : 'new'"
          />
        </template>
      </SfereTable>
    </DocSpecimen>
  </DocSection>
</template>

<script setup>
import DocSection from '../DocSection.vue'
import DocSpecimen from '../DocSpecimen.vue'
import SfereAlert from '@/components/sfere/SfereAlert.vue'
import SfereBadge from '@/components/sfere/SfereBadge.vue'
import SfereCard from '@/components/sfere/SfereCard.vue'
import SfereCode from '@/components/sfere/SfereCode.vue'
import SfereTable from '@/components/sfere/SfereTable.vue'

const columns = [
  { key: 'from', label: 'Fanfinity', width: '30%' },
  { key: 'to', label: 'Sfere', width: '30%' },
  { key: 'note', label: 'Note' }
]

const mapping = [
  {
    from: '--color-brand',
    fromHex: '#3800c1',
    to: '--color-sfere-brand-fill',
    toHex: '#854dff',
    note: 'Lighter and more saturated. Contrast against white still passes AA.'
  },
  {
    from: '--color-ink',
    fromHex: '#030712',
    to: '--color-sfere-fg',
    toHex: '#0a0a0a',
    note: 'Loses the blue cast — Sfere neutrals are strictly colourless.'
  },
  {
    from: '--color-muted',
    fromHex: '#4a5565',
    to: '--color-sfere-fg-muted',
    toHex: '#737373',
    note: 'Sfere has one secondary text colour, not two.'
  },
  {
    from: '--color-subtle',
    fromHex: '#6a7282',
    to: '--color-sfere-fg-muted',
    toHex: '#737373',
    note: 'Merged. Placeholders and hints share the muted value.'
  },
  {
    from: '--color-sidebar',
    fromHex: '#f9fafb',
    to: '--color-sfere-bg',
    toHex: '#f7f8fa',
    note: 'Becomes the page canvas rather than a sidebar-only fill.'
  },
  {
    from: '--color-fill',
    fromHex: '#f3f4f6',
    to: '--color-sfere-fill',
    toHex: '#f5f5f5',
    note: 'Same job: chip backgrounds and row hover.'
  },
  {
    from: '--color-line / --color-line2',
    fromHex: '#e7e9ed',
    to: '--color-sfere-line',
    toHex: '#e5e5e5',
    note: 'Merged. One hairline colour for dividers and control borders.'
  },
  {
    from: '--color-success',
    fromHex: '#029855',
    to: '--color-sfere-success',
    toHex: '#059669',
    note: 'Plus -soft and -on-ink variants the old set did not have.'
  },
  {
    from: '--font-sans (Plus Jakarta Sans)',
    fromHex: 'transparent',
    to: '--font-sfere-sans (Inter)',
    toHex: '',
    note: 'And a new display face — Bricolage Grotesque — for headings only.'
  },
  {
    from: '— no equivalent —',
    fromHex: 'transparent',
    to: '--color-sfere-ink',
    toHex: '#0b0712',
    note: 'The dark section treatment. Nothing in the current dashboard uses one.'
  }
]

const fileColumns = [
  { key: 'path', label: 'Path' },
  { key: 'frozen', label: 'Status', align: 'center', width: '110px' },
  { key: 'why', label: 'Why' }
]

const files = [
  {
    path: 'src/css/sfere.css',
    frozen: false,
    why: 'The token layer. Additive; redefines nothing.'
  },
  {
    path: 'src/components/sfere/',
    frozen: false,
    why: '30 components. Separate folder from components/ui/, which stays untouched.'
  },
  {
    path: 'src/components/sfere-docs/',
    frozen: false,
    why: 'This page only. Not part of the shipped kit.'
  },
  {
    path: 'public/brand/',
    frozen: false,
    why: 'Logo lockups and mark, as real files — the CSP blocks data: URIs.'
  },
  {
    path: 'src/css/tailwind.css',
    frozen: false,
    why: 'One @import line. quasar.config.js is frozen, so the stylesheet is pulled in here.'
  },
  {
    path: 'src/router/routes.js',
    frozen: true,
    why: 'One top-level route, outside MainLayout and outside the auth guard.'
  },
  {
    path: 'package.json',
    frozen: true,
    why: 'Three @fontsource packages. The CSP blocks the Google Fonts CDN.'
  }
]
</script>
