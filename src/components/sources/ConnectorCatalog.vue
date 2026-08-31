<template>
  <div class="flex flex-col gap-4">
    <!-- The catalog has its own search: it filters the connector *types*
         served by GET /v1/connectors, which has nothing to do with the search
         over this account's configured sources on the sibling tab. Two boxes
         for two haystacks.

         It used to say "a few hundred", which was true of the fixture and is
         not true of the endpoint: the live catalog is the Zid cloud app plus
         the Airbyte connectors already hosted on Jitsu. The number is left out
         rather than restated, because it is a list that grows. -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <!-- max-w keeps the copy from claiming the whole row and pushing the
           search box onto a line of its own. -->
      <p class="max-w-xl text-sm text-muted">
        Browse the connector catalog and pick what to pull into Sfere. This is
        the list of connector types Sfere supports, not the streams this account
        has configured.
      </p>
      <ToolbarSearch v-model="query" placeholder="Search connectors..." />
    </div>

    <LoadingState v-if="loading" variant="grid" :rows="8" />

    <ErrorState
      v-else-if="error"
      title="Couldn't load the connector catalog."
      :message="error"
      @retry="load"
    />

    <EmptyState
      v-else-if="!filteredGroups.length && !selected"
      :title="emptyTitle"
      :description="emptyDescription"
    >
      <template v-if="query && !apiMissing" #cta>
        <button
          class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
          @click="query = ''"
        >
          Clear search
        </button>
      </template>
    </EmptyState>

    <!-- Picking a card opens the connect form here, above the grid, and marks
         the chosen card selected. Not a dialog: the credential help text runs to
         several lines per field, and a 560px-capped q-dialog is the wrong shape
         for a form whose real content is instructions. -->
    <ConnectorConnectPanel
      v-if="selected"
      :connector="selected"
      @cancel="selected = null"
      @connect="onConnect"
    />

    <div v-if="!loading && !error" class="flex flex-col gap-8">
      <section v-for="group in filteredGroups" :key="group.key">
        <h2
          class="mb-3 text-xs! font-semibold! uppercase tracking-[0.4px]! text-subtle"
        >
          {{ group.label }}
          <span class="ml-1 text-muted">({{ group.items.length }})</span>
        </h2>
        <div
          class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <ConnectorCard
            v-for="item in group.items"
            :key="item.id"
            :connector="item"
            :selected="selected?.id === item.id"
            @select="onSelect"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'

import ConnectorCard from '@/components/ConnectorCard.vue'
import ConnectorConnectPanel from '@/components/sources/ConnectorConnectPanel.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useConnectorCatalog } from '@/composables/useConnectorCatalog'

// Was src/pages/ConnectorsPage.vue and a sidebar entry of its own. Browsing
// connector types is a step in adding a source, not a separate destination, so it
// became the second tab on /sources and the page shell went with it: no q-page,
// no <h1>, because SourcesListPage already owns both.
//
// The hand-rolled skeleton/error/empty blocks it used to carry are gone in favour
// of LoadingState/ErrorState/EmptyState. That also closes a gate blind spot —
// ErrorState is the only thing that renders [data-smoke="error"], so a failed
// catalog load used to be invisible to scripts/smoke.mjs.
const $q = useQuasar()
// `sourceConnectors`, not `connectors`: one live catalog carries both kinds and
// this is the source half of /sources. A warehouse type is not something you add
// a source from, and the destination catalog has its own picker.
const { sourceConnectors, loading, error, apiMissing, load } =
  useConnectorCatalog()
const query = ref('')
const selected = ref(null)

// Section order. `native`/`airbyte` come off the live record's `protocol`; the
// four subtypes are what the fixture groups by. One list rather than two
// because both adapters emit the same `category`, and a key that is not here
// simply sorts last under its own label.
const CATEGORY_ORDER = [
  'native',
  'airbyte',
  'database',
  'api',
  'file',
  'custom image'
]

const filteredGroups = computed(() => {
  const q = query.value.trim().toLowerCase()
  const matches = sourceConnectors.value.filter(c => {
    if (!q) return true
    return (
      c.name.toLowerCase().includes(q) ||
      c.packageId.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.tags.some(tag => tag.toLowerCase().includes(q))
    )
  })

  const byKey = new Map()
  for (const c of matches) {
    if (!byKey.has(c.category)) byKey.set(c.category, [])
    byKey.get(c.category).push(c)
  }

  const keys = [...byKey.keys()].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a)
    const ib = CATEGORY_ORDER.indexOf(b)
    return (
      (ia === -1 ? CATEGORY_ORDER.length : ia) -
      (ib === -1 ? CATEGORY_ORDER.length : ib)
    )
  })

  return keys.map(key => ({
    key,
    label: byKey.get(key)[0].categoryLabel || titleCase(key),
    items: byKey.get(key).sort(sortBySalience)
  }))
})

// Two different "nothing here" cases, same as the sources table: a search that
// matched nothing, versus a catalog that came back empty.
const emptyTitle = computed(() => {
  if (apiMissing.value) return 'No API yet'
  return query.value
    ? 'No connectors match your search'
    : 'No connectors available'
})

const emptyDescription = computed(() => {
  if (apiMissing.value) {
    return 'GET /v1/connectors did not answer on this backend. It is live as of backend PR #16, so this means the deployment predates it. Switch Settings → Data source to Demo data to browse the catalog meanwhile.'
  }
  return query.value
    ? `Nothing in the catalog matches “${query.value}”.`
    : 'The catalog came back empty. Retry in a moment.'
})

// Popular connectors carry a higher sortIndex (fixture only); then anything
// pickable before anything `coming_soon`, so the roadmap entries sit at the
// bottom of their section rather than interleaved with what works today.
function sortBySalience(a, b) {
  const sa = a.sortIndex ?? -1
  const sb = b.sortIndex ?? -1
  if (sa !== sb) return sb - sa
  if (a.selectable !== b.selectable) return a.selectable ? -1 : 1
  return a.name.localeCompare(b.name)
}

function titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function onSelect(connector) {
  selected.value = connector
  // The panel renders above the grid, so scroll it into view rather than leaving
  // someone looking at an unchanged screen after a click. Hash-mode routing means
  // an in-page anchor would replace the route, so this has to be scrollIntoView.
  requestAnimationFrame(() => {
    document
      .querySelector('[data-connector-connect]')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

// The credential VALUES never reach this handler — the panel emits field names
// only, so nothing here can log a secret by accident.
function onConnect({ connector, schedule, mode, schemaSource, provided }) {
  const modePart = mode ? `, a ${mode.replace('_', ' ')} sync mode` : ''
  const sourcePart =
    schemaSource === 'live'
      ? "The field list came from the connector's own config schema."
      : 'The field list is the in-repo fallback; no config schema came back.'
  $q.notify({
    message: `${connector.name} is not connectable yet`,
    caption: `Would send ${provided.length} credential field${provided.length === 1 ? '' : 's'}${modePart} and a ${schedule} sync schedule to POST /v1/accounts/{account}/connectors, which is still not built. ${sourcePart}`,
    color: 'dark',
    position: 'top-right',
    timeout: 4000
  })
}

onMounted(load)
</script>
