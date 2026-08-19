<template>
  <DocSection
    id="screens"
    eyebrow="Components"
    title="Screen primitives"
    description="The components every one of the 54 screens is actually built from: a page header, a list, a form group, a read-out, a picker, a search box, a confirmation and the two states a screen shows when it is loading or broken. These carry the filenames of the primitives they replaced, which is what let the whole app pick up Sfere without rewriting 571 imports."
  >
    <DocSpecimen
      title="PageHeader"
      usage="The top of every screen, and the only component that renders the <h1> the smoke gate looks for. SfereSectionHeading cannot stand in — it renders an <h2> whatever its level prop says. The subtitle is the purpose line, and it is owed on every page."
      code='<PageHeader
  eyebrow="Collect"
  title="Sources"
  subtitle="Every place fan data arrives from…"
>
  <template #actions>…</template>
</PageHeader>'
    >
      <PageHeader
        eyebrow="Collect"
        title="Sources"
        subtitle="Every place fan data arrives from, and whether it is still arriving."
      >
        <template #actions>
          <ToolbarSearch v-model="search" placeholder="Search sources…" />
          <SfereButton size="sm">Connect a source</SfereButton>
        </template>
      </PageHeader>
    </DocSpecimen>

    <DocSpecimen
      title="DataTable"
      note="sortable columns · paging · four states"
      usage="The list screen as one component. SfereTable stays presentation-only; this owns the four states a real list has and composes on SfereTable's head-<key> and footer slots rather than growing a second <table>. Hand it the whole rows array — sorting and paging are internal, filtering stays with the page."
      code='<DataTable
  :columns="columns"
  :rows="rows"
  :loading="loading"
  :error="error"
  clickable-rows
  empty-title="No sources yet"
  empty-cta-label="Connect a source"
  :empty-cta-to="{ name: &apos;sources-new&apos; }"
>
  <template #toolbar>…</template>
  <template #cell-status="{ value }">…</template>
</DataTable>'
      bleed
    >
      <div class="flex flex-col gap-4 p-6">
        <TabNav v-model="tableState" :tabs="STATES" variant="pill" />

        <DataTable
          :columns="columns"
          :rows="tableRows"
          :loading="tableState === 'loading'"
          :error="
            tableState === 'error' ? 'Request timed out after 30s.' : null
          "
          :per-page="3"
          clickable-rows
          empty-title="No sources yet"
          empty-description="A source is any place fan data arrives from — the club shop, the app, a stadium turnstile."
          empty-cta-label="Connect a source"
          empty-cta-to="/design-system"
        >
          <template #toolbar>
            <ToolbarSearch v-model="search" placeholder="Filter rows…" />
          </template>

          <template #cell-status="{ value }">
            <StatusBadge :tone="STATUS_TONE[value]" :label="value" dot />
          </template>

          <template #cell-events="{ value }">
            <span class="font-sfere-mono tabular-nums">{{ value }}</span>
          </template>
        </DataTable>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="ErrorState · LoadingState"
      usage="ErrorState is the single carve-out to the kit's no-data-smoke rule: its data-smoke='error' is the one selector the smoke gate reads. Never hand-roll an error card instead — a bespoke one leaves the only behavioural gate in the repo with nothing to assert on."
      code='<ErrorState :message="error" @retry="load" />
<LoadingState variant="grid" :rows="4" />'
    >
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="flex flex-col gap-2">
          <p
            class="font-sfere-mono text-sfere-label uppercase text-sfere-fg-muted"
            >Failed</p
          >
          <ErrorState message="Could not reach the events API." />
        </div>

        <div class="flex flex-col gap-2">
          <p
            class="font-sfere-mono text-sfere-label uppercase text-sfere-fg-muted"
            >Loading — variant="form"</p
          >
          <LoadingState variant="form" :rows="3" />
        </div>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="FormSection · DefinitionList"
      usage="A long form read as one wall of controls is why FormSection exists — the group heading is what tells someone which half they still have to fill in. DefinitionList is the mirror image: the same information once it is settled and only being read."
      code='<FormSection title="Connection" description="Where we send it.">
  <FormField label="Endpoint" for-id="endpoint">…</FormField>
</FormSection>

<DefinitionList :items="items" :columns="2">
  <template #value-status>…</template>
</DefinitionList>'
    >
      <div class="grid gap-6 lg:grid-cols-2">
        <FormSection
          title="Connection"
          description="Where the events go once this pipe has transformed them."
        >
          <FormField label="Name" for-id="ds-pipe-name" required>
            <SfereInput
              id="ds-pipe-name"
              v-model="pipeName"
              placeholder="e.g. Club shop → Event Inspector"
            />
          </FormField>

          <FormField
            label="Endpoint"
            for-id="ds-pipe-endpoint"
            hint="Reference a stored secret as secrets.KEY_NAME."
          >
            <SfereInput
              id="ds-pipe-endpoint"
              v-model="pipeEndpoint"
              placeholder="https://…"
            />
          </FormField>
        </FormSection>

        <CardPanel>
          <DefinitionList :items="details" :columns="1">
            <template #value-status="{ value }">
              <StatusBadge tone="success" :label="value" dot />
            </template>
          </DefinitionList>
        </CardPanel>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="SelectableCard"
      usage="A picker card that is a real control. CardPanel and SfereFeatureCard are plain divs, so neither can be the thing you tab to and press Enter on — this is that thing. The focus treatment is an outline because the ring is already spent on the selected state."
      code='<SelectableCard
  :selected="picked === t.id"
  @select="picked = t.id"
>…</SelectableCard>'
    >
      <div class="grid gap-4 sm:grid-cols-3">
        <SelectableCard
          v-for="t in templates"
          :key="t.id"
          :selected="picked === t.id"
          :disabled="t.disabled"
          @select="picked = t.id"
        >
          <SfereIconChip size="sm" class="mb-3">
            <svg class="size-5" viewBox="0 0 256 256" fill="currentColor">
              <path d="M240 104L56 168V40Z" opacity="0.2" />
              <path
                d="M242.63 96.44l-184-64A8 8 0 0 0 48 40v176a8 8 0 0 0 16 0v-42.31l178.63-62.13a8 8 0 0 0 0-15.12M64 156.75V51.25L215.65 104Z"
              />
            </svg>
          </SfereIconChip>
          <p class="text-sfere-sm font-semibold">{{ t.name }}</p>
          <p class="mt-1 text-sfere-sm text-sfere-fg-muted">{{ t.blurb }}</p>
        </SelectableCard>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="ConfirmDialog"
      note="the kit's one Quasar dependency"
      usage="Everything a modal owes the user is invisible — focus trap, Escape, scroll lock, backdrop, teleport out of an overflow-hidden ancestor. q-dialog has all five, so only the shell is borrowed; the card, buttons and type are all Sfere. Set destructive only for something that destroys data, or people learn to ignore red buttons."
      code='<ConfirmDialog
  v-model="confirming"
  destructive
  title="Delete this source?"
  message="Events already collected are kept…"
  confirm-label="Delete source"
  @confirm="remove"
/>'
    >
      <div class="flex flex-wrap items-center gap-3">
        <SfereButton variant="danger" size="sm" @click="confirming = true">
          Delete source
        </SfereButton>
        <p class="text-sfere-sm text-sfere-fg-muted">
          {{
            deleted
              ? 'Confirmed — the dialog closed itself.'
              : 'Opens a real dialog; Escape and the backdrop both dismiss it.'
          }}
        </p>
      </div>

      <ConfirmDialog
        v-model="confirming"
        destructive
        title="Delete this source?"
        message="Events already collected are kept. Nothing new will arrive from it."
        confirm-label="Delete source"
        @confirm="deleted = true"
      />
    </DocSpecimen>
  </DocSection>
</template>

<script setup>
import { computed, ref } from 'vue'
import DocSection from '../DocSection.vue'
import DocSpecimen from '../DocSpecimen.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DataTable from '@/components/ui/DataTable.vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import FormField from '@/components/ui/FormField.vue'
import FormSection from '@/components/ui/FormSection.vue'
import SfereIconChip from '@/components/ui/SfereIconChip.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import SelectableCard from '@/components/ui/SelectableCard.vue'
import TabNav from '@/components/ui/TabNav.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'

// The specimens below are deliberately live rather than static: the table really
// sorts and pages, the picker really selects, the dialog really opens. A
// screenshot of a data table tells you nothing about what it does when the rows
// run out.

const search = ref('')
const picked = ref('web')
const pipeName = ref('')
const pipeEndpoint = ref('')
const confirming = ref(false)
const deleted = ref(false)

// The four states a list can be in, switchable so all of them are reviewable
// without editing the file.
const STATES = [
  { key: 'rows', label: 'Populated' },
  { key: 'loading', label: 'Loading' },
  { key: 'empty', label: 'Empty' },
  { key: 'error', label: 'Failed' }
]
const tableState = ref('rows')

const columns = [
  { key: 'source', label: 'Source', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'events', label: 'Events / hr', align: 'right', sortable: true },
  { key: 'region', label: 'Region', align: 'right' }
]

const STATUS_TONE = {
  Delivering: 'success',
  Throttled: 'warn',
  Failed: 'danger',
  Paused: 'neutral'
}

// Pre-formatted, en-GB, exactly as the composables in this repo hand data down.
const ALL_ROWS = [
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

const tableRows = computed(() => (tableState.value === 'rows' ? ALL_ROWS : []))

const details = [
  { label: 'Source ID', value: 'src_9df21' },
  { label: 'Status', value: 'Delivering' },
  { label: 'Region', value: 'me-central-1' },
  { label: 'Last event', value: '2 minutes ago', hint: 'Polled every 30s.' },
  { label: 'Owner', value: '' }
]

const templates = [
  { id: 'web', name: 'Web SDK', blurb: 'One script tag on the club store.' },
  { id: 'mobile', name: 'Mobile SDK', blurb: 'iOS and Android fan app.' },
  {
    id: 's3',
    name: 'S3 import',
    blurb: 'Not available on this plan.',
    disabled: true
  }
]
</script>
