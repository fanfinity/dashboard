<template>
  <q-page class="p-6">
    <PageHeader
      title="Email campaigns"
      subtitle="Every email Engage sends, who it went to, and how it landed."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search campaigns..." />
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'channels-settings' })"
        >
          Channel settings
        </button>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="notifyLocal('Campaign authoring needs the Engage backend')"
        >
          New campaign
        </button>
      </template>
    </PageHeader>

    <div
      v-if="!loading && !error && emailCampaigns.length"
      class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatCard
        v-for="kpi in kpis"
        :key="kpi.label"
        :label="kpi.label"
        :value="kpi.value"
        :hint="kpi.hint"
      />
    </div>

    <TabNav v-model="tab" :tabs="tabs" />

    <DataTable
      :columns="columns"
      :rows="visible"
      :loading="loading"
      :error="error"
      row-key="id"
      clickable-rows
      @retry="load"
      @row-click="select"
    >
      <template #cell-name="{ row }">
        <p class="font-medium text-ink">{{ row.name }}</p>
        <p class="text-xs text-subtle">{{ row.subject ?? 'No subject set' }}</p>
      </template>

      <template #cell-audienceName="{ row }">
        <p class="text-ink">{{ row.audienceName }}</p>
        <p class="text-xs text-subtle">{{ row.journeyName }}</p>
      </template>

      <template #cell-status="{ value }">
        <StatusBadge
          :tone="campaignStatus(value).variant"
          :label="campaignStatus(value).label"
        />
      </template>

      <template #cell-sentCount="{ value }">{{ formatCount(value) }}</template>

      <template #cell-openRate="{ value }">{{ formatPercent(value) }}</template>

      <template #cell-clickRate="{ value }">{{
        formatPercent(value)
      }}</template>

      <template #cell-lastSentAt="{ value }">{{ formatDate(value) }}</template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <button
            v-if="row.status !== 'completed'"
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click.stop="askToggle(row)"
          >
            {{ row.status === 'sending' ? 'Pause' : 'Resume' }}
          </button>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-muted hover:bg-fill"
            @click.stop="sendTest(row)"
          >
            Send test
          </button>
        </div>
      </template>

      <!-- Two different "no rows" cases: nothing built yet (offer the primary
           CTA) and nothing matching the filters (offer a way back). -->
      <template #empty>
        <EmptyState :title="emptyTitle" :description="emptyDescription">
          <template #cta>
            <button
              v-if="!emailCampaigns.length"
              class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
              @click="
                notifyLocal('Campaign authoring needs the Engage backend')
              "
            >
              Build your first email
            </button>
            <button
              v-else
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
              @click="clearFilters"
            >
              Clear filters
            </button>
          </template>
        </EmptyState>
      </template>
    </DataTable>

    <CampaignDetailPanel
      v-if="selected"
      class="mt-5"
      :campaign="selected"
      :assets="assets"
      :assets-loading="assetsLoading"
      :assets-error="assetsError"
      @close="selectedId = ''"
      @retry-assets="loadAssets"
    />
    <ConfirmDialog
      v-model="confirmToggle"
      :title="toggleTitle"
      :message="toggleMessage"
      :confirm-label="toggleConfirmLabel"
      @confirm="toggle"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import TabNav from '@/components/ui/TabNav.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DataTable from '@/components/ui/DataTable.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import CampaignDetailPanel from '@/components/engage/channels/CampaignDetailPanel.vue'
import { useMockResource } from '@/composables/useMockResource'
import {
  campaignStatus,
  useEngageChannelsCampaigns
} from '@/composables/useEngageChannels'
import {
  formatCount,
  formatDate,
  formatPercent,
  rate
} from '@/composables/useEngageChannelsFormat'

const router = useRouter()
const $q = useQuasar()

// Campaigns are the PRIMARY resource: without them there is no screen, so
// theirs is the only failure that escalates to a page-level ErrorState.
const { emailCampaigns, loading, error, load, setStatus } =
  useEngageChannelsCampaigns()

// The asset catalog is SECONDARY — it only names the creative attached to the
// selected campaign, so it fails inside the detail panel and retries there.
const {
  data: assets,
  loading: assetsLoading,
  error: assetsError,
  load: loadAssets
} = useMockResource('assets')

const query = ref('')
const tab = ref('all')
const selectedId = ref('')

const columns = [
  { key: 'name', label: 'Campaign', sortable: true },
  { key: 'audienceName', label: 'Audience', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'sentCount', label: 'Sent', sortable: true, align: 'right' },
  { key: 'openRate', label: 'Open rate', sortable: true, align: 'right' },
  { key: 'clickRate', label: 'Click rate', sortable: true, align: 'right' },
  { key: 'lastSentAt', label: 'Last sent', sortable: true, align: 'right' },
  { key: 'actions', label: '', align: 'right', width: '210px' }
]

// Each tab is a predicate over a campaign; 'all' has none.
const TAB_PREDICATES = {
  sending: c => c.status === 'sending',
  paused: c => c.status === 'paused',
  draft: c => c.status === 'draft',
  completed: c => c.status === 'completed'
}

const tabs = computed(() => [
  { key: 'all', label: 'All', count: emailCampaigns.value.length },
  {
    key: 'sending',
    label: 'Sending',
    count: emailCampaigns.value.filter(TAB_PREDICATES.sending).length
  },
  {
    key: 'paused',
    label: 'Paused',
    count: emailCampaigns.value.filter(TAB_PREDICATES.paused).length
  },
  {
    key: 'draft',
    label: 'Drafts',
    count: emailCampaigns.value.filter(TAB_PREDICATES.draft).length
  },
  {
    key: 'completed',
    label: 'Completed',
    count: emailCampaigns.value.filter(TAB_PREDICATES.completed).length
  }
])

const SEARCH_FIELDS = [
  'name',
  'subject',
  'audienceName',
  'journeyName',
  'fromAddress'
]

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  const predicate = TAB_PREDICATES[tab.value]
  return emailCampaigns.value.filter(c => {
    if (predicate && !predicate(c)) return false
    if (!q) return true
    return SEARCH_FIELDS.some(f =>
      String(c[f] ?? '')
        .toLowerCase()
        .includes(q)
    )
  })
})

// Totals are summed across every email campaign, not the filtered view: a KPI
// row that moves when you type in the search box is a KPI row nobody trusts.
const totals = computed(() =>
  emailCampaigns.value.reduce(
    (acc, c) => ({
      sent: acc.sent + (c.sentCount ?? 0),
      delivered: acc.delivered + (c.deliveredCount ?? 0),
      opened: acc.opened + (c.openCount ?? 0),
      clicked: acc.clicked + (c.clickCount ?? 0),
      bounced: acc.bounced + (c.bounceCount ?? 0),
      unsubscribed: acc.unsubscribed + (c.unsubscribeCount ?? 0)
    }),
    {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0
    }
  )
)

const kpis = computed(() => {
  const t = totals.value
  return [
    {
      label: 'Emails sent',
      value: formatCount(t.sent),
      hint: `${formatCount(t.delivered)} delivered, ${formatCount(t.bounced)} bounced`
    },
    {
      label: 'Delivery rate',
      value: formatPercent(rate(t.delivered, t.sent)),
      hint: 'Accepted by the receiving server'
    },
    {
      label: 'Open rate',
      value: formatPercent(rate(t.opened, t.delivered)),
      hint: `${formatCount(t.opened)} opens of delivered mail`
    },
    {
      label: 'Click rate',
      value: formatPercent(rate(t.clicked, t.delivered)),
      hint: `${formatCount(t.unsubscribed)} unsubscribed`
    }
  ]
})

// Held by id, not by object: the row list is rebuilt on every mutation, so a
// stored row would go stale the moment a campaign is paused.
const selected = computed(
  () => emailCampaigns.value.find(c => c.id === selectedId.value) ?? null
)

const emptyTitle = computed(() =>
  emailCampaigns.value.length
    ? 'No campaigns match your filters'
    : 'No email campaigns yet'
)

const emptyDescription = computed(() =>
  emailCampaigns.value.length
    ? 'Try a different search term, or switch back to the All tab.'
    : 'Build an email, point it at an audience, and it appears here once it sends.'
)

function clearFilters() {
  query.value = ''
  tab.value = 'all'
}

function select(row) {
  selectedId.value = selectedId.value === row.id ? '' : row.id
}

// Nothing here persists — say so in the toast rather than implying a save.
function notifyLocal(message) {
  $q.notify({
    message,
    caption: 'Local preview only — no backend is connected yet.',
    color: 'dark',
    timeout: 2500
  })
}

const confirmToggle = ref(false)
const toggleTarget = ref(null)

// Pausing asks first, the same as it does on every other list screen and on the
// detail screens: a row action carries no sentence of its own, so the dialog is
// where the consequence is written and where the record gets named. Not
// `destructive` — pausing is reversible. Its own ref rather than sharing the
// delete flow's `target`, and the row is left in place after the confirm so the
// message does not blank out while the dialog fades.
function askToggle(row) {
  toggleTarget.value = row
  confirmToggle.value = true
}

const toggleTitle = computed(() =>
  toggleTarget.value?.status === 'sending'
    ? 'Pause this campaign?'
    : 'Resume this campaign?'
)

const toggleConfirmLabel = computed(() =>
  toggleTarget.value?.status === 'sending'
    ? 'Pause campaign'
    : 'Resume campaign'
)

const toggleMessage = computed(() => {
  const row = toggleTarget.value
  if (!row) return ''
  return row.status === 'sending'
    ? `“${row.name}” stops sending to ${row.audienceName} straight away. Mail already sent is not recalled.`
    : `“${row.name}” starts sending to ${row.audienceName} again straight away.`
})

function toggle() {
  const row = toggleTarget.value
  if (!row) return
  const next = row.status === 'sending' ? 'paused' : 'sending'
  setStatus(row.id, next)
  notifyLocal(`${row.name} ${next === 'paused' ? 'paused' : 'resumed'}`)
}

function sendTest(row) {
  notifyLocal(`Test send for “${row.name}” needs a connected transport`)
}

onMounted(() => {
  load()
  loadAssets()
})
</script>
