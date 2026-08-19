<template>
  <q-page class="p-6">
    <PageHeader
      title="Operator work log"
      subtitle="Everything the Engage operator did, everything it proposed, and who decided."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search the log..." />
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'engage-settings' })"
        >
          Engage settings
        </button>
      </template>
    </PageHeader>

    <div
      v-if="!loading && !error && entries.length"
      class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3"
    >
      <StatCard
        v-for="kpi in kpis"
        :key="kpi.label"
        :label="kpi.label"
        :value="kpi.value"
        :hint="kpi.hint"
      />
    </div>

    <NoticeBanner
      v-if="!loading && !error && pendingCount"
      class="mb-5"
      tone="warn"
      title="Proposals are waiting on a decision"
      :message="`${pendingCount} ${
        pendingCount === 1 ? 'proposal is' : 'proposals are'
      } held until someone approves or rejects ${
        pendingCount === 1 ? 'it' : 'them'
      }.`"
    />

    <TabNav v-model="tab" :tabs="tabs" />

    <LoadingState v-if="loading" variant="table" :rows="4" />

    <ErrorState
      v-else-if="error"
      title="Couldn't load the work log."
      :message="error"
      @retry="load"
    />

    <!-- Two different "no entries" cases: an operator that has never run
         (point at its settings) and a filter that matched nothing. -->
    <template v-else-if="!visible.length">
      <EmptyState
        v-if="entries.length"
        title="No entries match your filters"
        description="Try a different search term, or switch back to the All tab."
      >
        <template #cta>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click="clearFilters"
          >
            Clear filters
          </button>
        </template>
      </EmptyState>

      <EmptyState
        v-else
        title="The operator has not done anything yet"
        description="Once it is switched on, every proposal and every applied change is recorded here."
      >
        <template #cta>
          <button
            class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
            @click="router.push({ name: 'engage-settings' })"
          >
            Configure the operator
          </button>
        </template>
      </EmptyState>
    </template>

    <!-- A log is read by time, so it is grouped by day rather than paged into a
         table: the date is the thing you scan for. -->
    <div v-else class="flex flex-col gap-6">
      <section v-for="group in groups" :key="group.key">
        <h2
          class="mb-3 text-[11px]! font-semibold! uppercase leading-4! tracking-[0.4px]! text-subtle"
          >{{ group.label }}</h2
        >
        <div class="flex flex-col gap-3">
          <WorkLogEntryCard
            v-for="entry in group.entries"
            :key="entry.id"
            :entry="entry"
            @approve="approveEntry"
            @reject="askReject"
          />
        </div>
      </section>
    </div>

    <ConfirmDialog
      v-model="confirmReject"
      title="Reject this proposal?"
      :message="rejectMessage"
      confirm-label="Reject proposal"
      destructive
      @confirm="rejectEntry"
    >
      <label for="reject-reason" class="text-xs font-medium text-subtle"
        >Reason (optional)</label
      >
      <textarea
        id="reject-reason"
        v-model="rejectReason"
        rows="3"
        placeholder="Why is this not going ahead?"
        class="rounded-lg border border-line2 bg-white px-2.5 py-2 text-sm text-ink outline-none placeholder:text-subtle"
      ></textarea>
    </ConfirmDialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import TabNav from '@/components/ui/TabNav.vue'
import StatCard from '@/components/ui/StatCard.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import WorkLogEntryCard from '@/components/engage/channels/WorkLogEntryCard.vue'
import { useEngageChannelsWorkLog } from '@/composables/useEngageChannels'
import {
  dayKey,
  formatCount,
  formatDate
} from '@/composables/useEngageChannelsFormat'

// Who a locally-made decision is attributed to. There is no backend to record
// the real reviewer, and inventing a name would put a fiction in an audit
// trail, which is the one place a fiction is least welcome.
const LOCAL_REVIEWER = 'You (local preview)'

const router = useRouter()
const $q = useQuasar()

const { entries, loading, error, load, approve, reject } =
  useEngageChannelsWorkLog()

const query = ref('')
const tab = ref('all')
const confirmReject = ref(false)
const rejectReason = ref('')
const target = ref(null)

// Each tab is a predicate over an entry; 'all' has none.
const TAB_PREDICATES = {
  pending: e => e.status === 'pending',
  proposal: e => e.kind === 'proposal',
  action: e => e.kind === 'action'
}

const pendingCount = computed(
  () => entries.value.filter(TAB_PREDICATES.pending).length
)

const tabs = computed(() => [
  { key: 'all', label: 'All', count: entries.value.length },
  { key: 'pending', label: 'Awaiting approval', count: pendingCount.value },
  {
    key: 'proposal',
    label: 'Proposals',
    count: entries.value.filter(TAB_PREDICATES.proposal).length
  },
  {
    key: 'action',
    label: 'Actions',
    count: entries.value.filter(TAB_PREDICATES.action).length
  }
])

const kpis = computed(() => {
  const applied = entries.value.filter(
    e => e.status === 'approved' || e.status === 'completed'
  )
  const rejected = entries.value.filter(e => e.status === 'rejected')
  const byOperator = entries.value.filter(e => e.actor === 'operator')
  return [
    {
      label: 'Awaiting approval',
      value: formatCount(pendingCount.value),
      hint: 'Held until someone decides'
    },
    {
      label: 'Applied',
      value: formatCount(applied.length),
      hint: `${formatCount(byOperator.length)} of ${formatCount(
        entries.value.length
      )} entries came from the operator`
    },
    {
      label: 'Rejected',
      value: formatCount(rejected.length),
      hint: 'Proposals a reviewer turned down'
    }
  ]
})

const SEARCH_FIELDS = [
  'title',
  'summary',
  'entityName',
  'entityId',
  'actorName'
]

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  const predicate = TAB_PREDICATES[tab.value]
  return entries.value
    .filter(e => {
      if (predicate && !predicate(e)) return false
      if (!q) return true
      return SEARCH_FIELDS.some(f =>
        String(e[f] ?? '')
          .toLowerCase()
          .includes(q)
      )
    })
    .slice()
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
})

// Newest day first, entries already sorted newest first inside it.
const groups = computed(() => {
  const out = []
  for (const entry of visible.value) {
    const key = dayKey(entry.occurredAt)
    const last = out.at(-1)
    if (last && last.key === key) last.entries.push(entry)
    else
      out.push({ key, label: formatDate(entry.occurredAt), entries: [entry] })
  }
  return out
})

const rejectMessage = computed(() =>
  target.value
    ? `“${target.value.title}” will not be applied. The proposal stays in the log with the rejection recorded against it.`
    : ''
)

function clearFilters() {
  query.value = ''
  tab.value = 'all'
}

// Nothing here persists — say so in the toast rather than implying a save.
function notifyLocal(message) {
  $q.notify({
    message,
    caption: 'Local preview only — no backend is connected yet.',
    color: 'dark',
    position: 'bottom',
    timeout: 2500
  })
}

function approveEntry(entry) {
  approve(entry.id, LOCAL_REVIEWER)
  notifyLocal(`Approved “${entry.title}”`)
}

function askReject(entry) {
  target.value = entry
  rejectReason.value = ''
  confirmReject.value = true
}

function rejectEntry() {
  const entry = target.value
  if (!entry) return
  reject(entry.id, LOCAL_REVIEWER, rejectReason.value)
  notifyLocal(`Rejected “${entry.title}”`)
  target.value = null
}

onMounted(load)
</script>
