<template>
  <q-page class="p-6">
    <!-- One content cap, the same one SourcesListPage and the other fifteen
         list screens carry. /trash is where you arrive FROM those screens, so
         without it the right edge steps outward on the way in. -->
    <div class="mx-auto w-full max-w-[1400px]">
      <PageHeader title="Trash" :subtitle="SUBTITLE">
        <template #actions>
          <ToolbarSearch v-model="query" placeholder="Search trash..." />
          <!-- Emptying is offered only where there is something to empty. A pipe
               is not deleted on this screen's model — it is waiting — so the
               Pipes tab has no list to purge and the control disappears rather
               than sitting there disabled with no explanation. -->
          <SfereButton
            v-if="tab !== 'pipes'"
            variant="danger"
            size="sm"
            :disabled="!currentRows.length || apiMissing"
            @click="confirmEmpty = true"
          >
            Empty trash
          </SfereButton>
        </template>
      </PageHeader>

      <TabNav v-model="tab" :tabs="tabs" />

      <!-- One banner, and it belongs to the tab you are on. Sources and
           Destinations share a sentence about restoring; Pipes needs a different
           one about reconnecting, and stacking both would put a paragraph about
           deleted records above a tab whose whole point is that nothing here was
           deleted. Both are claims about what the backend does NOT do — DELETE on
           a source is a hard 204 with no soft delete and no restore call, and
           there is no reconnect endpoint at all — in the grammar the Sources
           delete confirm already uses. -->
      <NoticeBanner
        :tone="notice.tone"
        :title="notice.title"
        :message="notice.message"
        class="mb-4"
      />

      <!-- ---------------------------------------------------------------- -->
      <!-- Sources                                                           -->
      <DataTable
        v-if="tab === 'sources'"
        :columns="sourceColumns"
        :rows="visibleSources"
        :loading="loading"
        :error="error"
        :api-missing="apiMissing"
        row-key="id"
        :empty-title="emptyTitle(sources.length, 'Trash is empty')"
        :empty-description="
          emptyDescription(sources.length, 'No source has been deleted.')
        "
        @retry="load"
      >
        <!-- `sfere-flush` on the wrapper, not `mt-*` on the second line: Quasar
             ships an unlayered `p { margin: 0 0 16px }`, so a two-line cell puts
             sixteen pixels between a name and its slug and no layered utility can
             take them back (CLAUDE.md collision #5). The opt-in class is what the
             token layer offers for a parent that owns its own spacing. -->
        <template #cell-name="{ row }">
          <div class="sfere-flush">
            <p class="font-medium text-ink">{{ row.name }}</p>
            <p class="text-xs text-subtle">{{ row.slug }}</p>
          </div>
        </template>

        <template #cell-sourceType="{ value }">
          <StatusBadge tone="neutral" :label="sourceTypeLabel(value)" />
        </template>

        <template #cell-deletedAt="{ value }">
          {{ formatDateTime(value, NOT_KNOWN) }}
        </template>

        <template #cell-deletedByName="{ value }">
          {{ value || NOT_KNOWN }}
        </template>

        <template #cell-actions="{ row }">
          <!-- `flex-nowrap!` with the important SUFFIX: Quasar's unlayered
               `.flex` is `display:flex; flex-wrap:wrap`, so these two buttons
               drop onto two lines the moment the cell is narrower than they
               are — and a layered `flex-nowrap` loses to it (CLAUDE.md
               collision #4). `whitespace-nowrap` is the other half: kept on one
               line, a squeezed "Delete forever" would otherwise break inside
               the pill. -->
          <div class="flex flex-nowrap! items-center justify-end gap-2">
            <SfereButton
              variant="secondary"
              size="sm"
              class="whitespace-nowrap"
              @click="onRestore('sources', row)"
              >Restore</SfereButton
            >
            <SfereButton
              variant="danger"
              size="sm"
              class="whitespace-nowrap"
              @click="askPurge('sources', row)"
              >Delete forever</SfereButton
            >
          </div>
        </template>
      </DataTable>

      <!-- ---------------------------------------------------------------- -->
      <!-- Destinations                                                      -->
      <DataTable
        v-else-if="tab === 'destinations'"
        :columns="destinationColumns"
        :rows="visibleDestinations"
        :loading="loading"
        :error="error"
        :api-missing="apiMissing"
        row-key="id"
        :empty-title="emptyTitle(destinations.length, 'Trash is empty')"
        :empty-description="
          emptyDescription(
            destinations.length,
            'No destination has been deleted.'
          )
        "
        @retry="load"
      >
        <template #cell-name="{ row }">
          <div class="sfere-flush">
            <p class="font-medium text-ink">{{ row.name }}</p>
            <p class="text-xs text-subtle">{{ row.slug }}</p>
          </div>
        </template>

        <template #cell-deletedAt="{ value }">
          {{ formatDateTime(value, NOT_KNOWN) }}
        </template>

        <template #cell-deletedByName="{ value }">
          {{ value || NOT_KNOWN }}
        </template>

        <template #cell-actions="{ row }">
          <!-- `flex-nowrap!` with the important SUFFIX: Quasar's unlayered
               `.flex` is `display:flex; flex-wrap:wrap`, so these two buttons
               drop onto two lines the moment the cell is narrower than they
               are — and a layered `flex-nowrap` loses to it (CLAUDE.md
               collision #4). `whitespace-nowrap` is the other half: kept on one
               line, a squeezed "Delete forever" would otherwise break inside
               the pill. -->
          <div class="flex flex-nowrap! items-center justify-end gap-2">
            <SfereButton
              variant="secondary"
              size="sm"
              class="whitespace-nowrap"
              @click="onRestore('destinations', row)"
              >Restore</SfereButton
            >
            <SfereButton
              variant="danger"
              size="sm"
              class="whitespace-nowrap"
              @click="askPurge('destinations', row)"
              >Delete forever</SfereButton
            >
          </div>
        </template>
      </DataTable>

      <!-- ---------------------------------------------------------------- -->
      <!-- Pipes                                                             -->
      <!--
        A pipe is never deleted, so this tab has no Restore, no Delete forever
        and no Empty trash. It lists the pipes whose source or destination is
        gone and names the end that is missing; the banner above says what is
        not wired yet.

        What it deliberately does NOT print: a countdown, a "restorable until"
        date, or a delivery count. The fixture rows carry `deliveryCountLastHour:
        0`, which is a zero over a period this pipe spent switched off — nobody
        measured it, so it does not get a column.
      -->
      <DataTable
        v-else
        :columns="pipeColumns"
        :rows="visiblePipes"
        :loading="loading"
        :error="error"
        :api-missing="apiMissing"
        row-key="id"
        :empty-title="emptyTitle(pipes.length, 'No pipe is waiting')"
        :empty-description="
          emptyDescription(
            pipes.length,
            'Every pipe still has a source and a destination.'
          )
        "
        @retry="load"
      >
        <template #cell-name="{ row }">
          <div class="sfere-flush">
            <p class="font-medium text-ink">{{ row.name }}</p>
            <p class="text-xs text-subtle">{{ endsLabel(row) }}</p>
          </div>
        </template>

        <template #cell-status>
          <StatusBadge tone="warn" label="Waiting to reconnect" />
        </template>

        <template #cell-waitingFor="{ row }">
          {{ waitingForLabel(row) }}
        </template>

        <template #cell-dormantSince="{ value }">
          {{ formatDateTime(value, NOT_KNOWN) }}
        </template>
      </DataTable>
    </div>

    <ConfirmDialog
      v-model="confirmOne"
      title="Delete forever?"
      :message="purgeMessage"
      confirm-label="Delete forever"
      destructive
      @confirm="onPurge"
    />

    <ConfirmDialog
      v-model="confirmEmpty"
      title="Empty the trash?"
      :message="emptyMessage"
      confirm-label="Empty trash"
      destructive
      @confirm="onPurgeAll"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataTable from '@/components/ui/DataTable.vue'
import TabNav from '@/components/ui/TabNav.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import { formatDateTime, sourceTypeLabel } from '@/composables/useSources'
import { useTrashCollections } from '@/composables/useTrashCollections'
import { NOT_KNOWN } from '@/lib/emptyValue'

// ONE Trash destination, replacing the ten '/x/trash' screens that used to hang
// off a toolbar icon on every list. It sits in the sidebar's bottom menu above
// Settings, for the reason Secrets and Authorizations moved there: a trash is
// somewhere you go occasionally to recover something, not somewhere you work.
//
// Three tabs in ?tab=, not three child routes — same reasoning as /sources and
// /settings. All three are the same screen with the same <h1>, and a child route
// would put each of them back in the rail, which is exactly what this undid.

const $q = useQuasar()
const route = useRoute()
const router = useRouter()

const {
  sources,
  destinations,
  pipes,
  loading,
  error,
  apiMissing,
  load,
  restore,
  purge,
  purgeAll
} = useTrashCollections()

// Describes the screen, not the retention policy. There is no retention policy:
// nothing keeps a deleted record, so "kept for 30 days" — which every one of the
// ten screens this replaced printed — was a promise about a collection that does
// not exist.
const SUBTITLE =
  'Deleted sources and destinations, and pipes left waiting for an end.'

// The tab's own sentence about what is not wired. Written per tab because the
// two halves are different promises: one is about getting a deleted record
// back, the other about giving a dormant pipe a new end.
const NOTICES = {
  restore: {
    tone: 'info',
    title: 'Restoring is not available yet',
    message:
      'Deleting a source or a destination removes it outright today: nothing keeps a copy, so restoring from trash is not available yet. Switch to Demo data in Settings to see the shape this screen takes once the backend grows a trash.'
  },
  reconnect: {
    tone: 'warn',
    title: 'Reconnecting is not available yet',
    message:
      "A pipe goes dormant when one of its ends is deleted, and waits for something to be connected in that end's place. Connecting one from this screen is not built yet, and the backend does not keep a dormant pipe today — it removes the pipeline with the source."
  }
}

const TABS = ['sources', 'destinations', 'pipes']

// Seeded from ?tab= so the three old URLs land on the right list, and validated
// below so a hand-typed one settles somewhere rather than rendering nothing.
const tab = ref(
  typeof route.query.tab === 'string' && TABS.includes(route.query.tab)
    ? route.query.tab
    : 'sources'
)

const query = ref('')
const confirmOne = ref(false)
const confirmEmpty = ref(false)
const target = ref(null)

const notice = computed(() =>
  tab.value === 'pipes' ? NOTICES.reconnect : NOTICES.restore
)

// A count on a tab is a measurement, so it is withheld — `undefined`, which
// TabNav renders as no pill at all — rather than shown as 0 when there is no
// endpoint to have counted. Same rule the Settings tabs follow.
const tabs = computed(() => [
  {
    key: 'sources',
    label: 'Sources',
    count: apiMissing.value ? undefined : sources.value.length
  },
  {
    key: 'destinations',
    label: 'Destinations',
    count: apiMissing.value ? undefined : destinations.value.length
  },
  {
    key: 'pipes',
    label: 'Pipes',
    count: apiMissing.value ? undefined : pipes.value.length
  }
])

const sourceColumns = [
  { key: 'name', label: 'Source', sortable: true },
  { key: 'sourceType', label: 'Type', sortable: true },
  { key: 'deletedAt', label: 'Deleted', sortable: true },
  { key: 'deletedByName', label: 'Deleted by', sortable: true },
  { key: 'actions', label: '', align: 'right', width: '260px' }
]

const destinationColumns = [
  { key: 'name', label: 'Destination', sortable: true },
  { key: 'deletedAt', label: 'Deleted', sortable: true },
  { key: 'deletedByName', label: 'Deleted by', sortable: true },
  { key: 'actions', label: '', align: 'right', width: '260px' }
]

// 'Waiting since', not 'Deleted'. The timestamp is the moment the pipe's end was
// deleted — which is the moment this pipe stopped carrying anything — and a
// "Deleted" header over it would say the pipe was deleted, the one thing this
// tab exists to deny.
const pipeColumns = [
  { key: 'name', label: 'Pipe', sortable: true },
  { key: 'status', label: 'State' },
  { key: 'waitingFor', label: 'Waiting for' },
  { key: 'dormantSince', label: 'Waiting since', sortable: true }
]

function matches(row, fields) {
  const q = query.value.trim().toLowerCase()
  if (!q) return true
  return fields.some(f =>
    String(row[f] ?? '')
      .toLowerCase()
      .includes(q)
  )
}

const visibleSources = computed(() =>
  sources.value.filter(r => matches(r, ['name', 'slug', 'deletedByName']))
)

const visibleDestinations = computed(() =>
  destinations.value.filter(r =>
    matches(r, ['name', 'slug', 'description', 'deletedByName'])
  )
)

const visiblePipes = computed(() =>
  pipes.value.filter(r =>
    matches(r, ['name', 'sourceName', 'eventDestinationName'])
  )
)

// What the header's Empty trash and its confirm are talking about. The Pipes tab
// never reaches either — its control is not rendered — so this only ever holds a
// deletable collection.
const currentRows = computed(() =>
  tab.value === 'destinations' ? destinations.value : sources.value
)

// An empty trash is the good outcome, so it gets no call to action. A trash
// filtered to nothing is a different situation and gets a way back.
function emptyTitle(total, whenEmpty) {
  return total ? 'Nothing matches your search' : whenEmpty
}

function emptyDescription(total, whenEmpty) {
  return total ? 'Try a different search term.' : whenEmpty
}

// Both ends, whatever state they are in — the reader wants to see the pipe, not
// only the half that broke.
function endsLabel(row) {
  return `${row.sourceName || row.sourceId} → ${
    row.eventDestinationName || row.eventDestinationId
  }`
}

// Names the end rather than counting it: "its destination, GA4 (retired)" is
// something you can act on, "1 end missing" is a number to go and decode.
//
// The composable filters out any pipe with both ends alive, so the fallback is
// unreachable today; it is here so that a row this screen cannot describe says
// so rather than rendering an empty cell beside a "Waiting to reconnect" badge.
function waitingForLabel(row) {
  if (!row.waitingFor.length) return NOT_KNOWN
  return row.waitingFor
    .map(end => `Its ${end.kind}, “${end.name}”`)
    .join(' and ')
}

// Nothing on this screen persists — say so in the toast rather than letting it
// read like a save that happened.
function notifyLocal(message) {
  $q.notify({
    message,
    caption: 'This browser only. Nothing was sent to a backend.',
    color: 'dark',
    timeout: 2500
  })
}

function onRestore(kind, row) {
  restore(kind, row)
  notifyLocal(`${row.name} restored`)
}

function askPurge(kind, row) {
  target.value = { kind, row }
  confirmOne.value = true
}

const purgeMessage = computed(() =>
  target.value
    ? `“${target.value.row.name}” and its configuration will be removed permanently. This cannot be undone.`
    : ''
)

const emptyMessage = computed(() => {
  const n = currentRows.value.length
  const noun = tab.value === 'destinations' ? 'destination' : 'source'
  return `All ${n} deleted ${noun}${n === 1 ? '' : 's'} will be removed permanently. This cannot be undone.`
})

function onPurge() {
  const hit = target.value
  if (!hit) return
  purge(hit.kind, hit.row)
  notifyLocal(`${hit.row.name} deleted permanently`)
  // `target` is deliberately NOT nulled: `purgeMessage` reads it, so clearing it
  // here blanks the dialog's sentence out while the dialog is still fading. The
  // dialog's open state is its own ref, and `askPurge()` overwrites `target` before
  // reopening, so nothing goes stale.
}

function onPurgeAll() {
  const n = currentRows.value.length
  const noun = tab.value === 'destinations' ? 'destination' : 'source'
  purgeAll(tab.value)
  notifyLocal(`${n} ${noun}${n === 1 ? '' : 's'} deleted permanently`)
}

// `replace`, so flipping tabs does not stack history entries the back button
// then has to chew through. Sources writes no query at all, keeping /trash the
// canonical URL — the same choice SettingsPage makes for General, and what the
// /sources/trash redirect targets.
watch(tab, next => {
  const tabQuery = next === 'sources' ? undefined : next
  if (route.query.tab === tabQuery) return
  router.replace({ query: { ...route.query, tab: tabQuery } })
  // A search typed against one list means nothing against the next, and a tab
  // that opens already filtered reads as an empty trash.
  query.value = ''
})

watch(
  () => route.query.tab,
  next => {
    if (next && next !== tab.value && TABS.includes(next)) tab.value = next
  }
)

onMounted(load)
</script>
