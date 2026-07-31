<template>
  <q-page class="p-6">
    <PageHeader title="Profile search" :subtitle="subtitle">
      <template #actions>
        <router-link
          :to="{ name: 'profiles-identity-resolution' }"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          >Matching rules</router-link
        >
      </template>
    </PageHeader>

    <!-- The lookup box renders in every state below it, so a fan can always be
         searched again without navigating away. -->
    <CardPanel class="mb-4">
      <form class="flex flex-wrap items-start gap-3" @submit.prevent="submit">
        <FormField
          class="min-w-[280px] flex-1"
          label="Profile ID or identifier value"
          for="profile-query"
          :error="formError"
          hint="Matches any identifier — email, phone, browser cookie, account id, device id or ticket reference."
        >
          <input
            id="profile-query"
            v-model="query"
            type="text"
            autocomplete="off"
            placeholder="e.g. layla.alharbi@example.com"
            class="h-9 w-full rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
          />
        </FormField>

        <FormField
          class="w-full sm:w-[240px]"
          label="Identifier type"
          hint="Narrow the lookup to one rule."
        >
          <q-select
            v-model="typeId"
            dense
            outlined
            emit-value
            map-options
            options-dense
            :options="typeOptions"
            class="bg-white"
          />
        </FormField>

        <div class="flex items-center gap-2 pt-5">
          <button
            type="submit"
            class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          >
            Search
          </button>
          <button
            v-if="query || typeId"
            type="button"
            class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
            @click="clear"
          >
            Clear
          </button>
        </div>
      </form>
    </CardPanel>

    <!-- 1. Loading -->
    <LoadingState v-if="showSkeleton" variant="table" :rows="5" />

    <!-- 2. Error — the fan graph itself failed to load. -->
    <ErrorState
      v-else-if="error"
      title="Couldn't load the fan graph."
      :message="error"
      @retry="load"
    />

    <div v-else class="flex flex-col gap-4">
      <!-- 3a. No query. Not an error and not an empty result — an invitation. -->
      <div v-if="!trimmedQuery">
        <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
          >Recently updated fans</h2
        >
        <p class="mb-3 mt-0.5 max-w-3xl text-xs text-muted"
          >Search above by any identifier a fan has ever been seen with, or open
          one of the fans the platform resolved most recently.</p
        >

        <DataTable
          :columns="recentColumns"
          :rows="recentRows"
          :loading="recentLoading"
          :error="recentError"
          row-key="id"
          clickable-rows
          :per-page="10"
          empty-title="No fans resolved yet"
          empty-description="Once a source starts sending events, resolved fans appear here and become searchable."
          @retry="loadDashboard"
          @row-click="row => (selectedId = row.id)"
        >
          <template #cell-displayName="{ row }">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium text-ink">{{ row.displayName }}</span>
              <StatusBadge
                v-if="row.id === selectedId"
                variant="brand"
                label="Viewing"
              />
            </div>
            <p class="font-mono text-xs text-subtle">{{ row.id }}</p>
          </template>
        </DataTable>
      </div>

      <!-- 3b. A query that matched nothing. Still EmptyState: the load worked,
           the answer was "no such fan". -->
      <EmptyState
        v-else-if="!results.length"
        title="No fan matches that identifier"
        :description="noMatchDescription"
      >
        <template #cta>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click="clear"
          >
            Clear search
          </button>
        </template>
      </EmptyState>

      <!-- 3c. Hits. -->
      <div v-else>
        <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink">{{
          resultsHeading
        }}</h2>
        <p class="mb-3 mt-0.5 text-xs text-muted"
          >Every fan carrying that value on one of their identifiers.</p
        >

        <DataTable
          :columns="resultColumns"
          :rows="results"
          row-key="id"
          clickable-rows
          :per-page="10"
          empty-title="No fan matches that identifier"
          @row-click="row => (selectedId = row.id)"
        >
          <template #cell-displayName="{ row }">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium text-ink">{{ row.displayName }}</span>
              <StatusBadge
                v-if="row.id === selectedId"
                variant="brand"
                label="Viewing"
              />
            </div>
            <p class="font-mono text-xs text-subtle">{{ row.id }}</p>
          </template>

          <template #cell-matchedLabel="{ row }">
            <p class="text-ink">{{ row.matchedLabel }}</p>
            <p class="break-all font-mono text-xs text-subtle">{{
              row.matchedValue
            }}</p>
          </template>
        </DataTable>
      </div>

      <!-- The resolved fan behind the selected row. -->
      <ResolvedProfilePanel
        v-if="resolved"
        :profile="resolved"
        :lookups-error="lookupsError"
        @retry-lookups="loadLookups"
      />
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CardPanel from '@/components/ui/CardPanel.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import FormField from '@/components/ui/FormField.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ResolvedProfilePanel from '@/components/profiles/core/ResolvedProfilePanel.vue'
import { useProfilesSearch } from '@/composables/useProfilesSearch'

// Look a fan up by any identifier, then read the profile those identifiers were
// resolved into. There is no search backend — the fan graph is loaded once and
// filtered in the browser, which is also what lets the results table say WHICH
// identifier matched rather than just that the record did.

const route = useRoute()
const router = useRouter()

const {
  loading,
  error,
  load,
  lookupsError,
  loadLookups,
  recentLoading,
  recentError,
  loadDashboard,
  typeOptions,
  search,
  findProfile,
  recentRows,
  resolve
} = useProfilesSearch()

// A repeated `?q=` arrives as an array; take the first and keep everything
// downstream a plain string.
function first(value) {
  return String((Array.isArray(value) ? value[0] : value) ?? '')
}

// The query lives in the URL so a lookup is shareable — "here is the fan I am
// looking at" is a link, not a screenshot.
const query = ref(first(route.query.q))
const typeId = ref(first(route.query.type))
const selectedId = ref('')
const formError = ref('')

const loaded = ref(false)
const showSkeleton = computed(() => loading.value && !loaded.value)

const subtitle =
  'Find a fan by any identifier they have ever been seen with, and read back the profile those identifiers resolved into.'

const trimmedQuery = computed(() => query.value.trim())

const results = computed(() => search(trimmedQuery.value, typeId.value))

const resultsHeading = computed(() =>
  results.value.length === 1
    ? '1 fan matches'
    : `${results.value.length} fans match`
)

const noMatchDescription = computed(() => {
  const scope = typeId.value
    ? `No ${typeLabelFor(typeId.value)} identifier contains “${trimmedQuery.value}”.`
    : `No identifier, profile ID or display name contains “${trimmedQuery.value}”.`
  return `${scope} Check for a typo, widen the identifier type, or search the value exactly as the source sends it.`
})

const resolved = computed(() => {
  const hit = results.value.find(r => r.id === selectedId.value)
  if (hit) return resolve(hit.profile, hit.matchedIdentifier)
  return resolve(findProfile(selectedId.value))
})

const recentColumns = [
  { key: 'displayName', label: 'Fan', sortable: true },
  {
    key: 'identifierCount',
    label: 'Identifiers',
    sortable: true,
    align: 'right',
    width: '130px'
  },
  {
    key: 'audienceCount',
    label: 'Audiences',
    sortable: true,
    align: 'right',
    width: '130px'
  },
  {
    key: 'lastSeen',
    label: 'Last seen',
    sortable: true,
    align: 'right',
    width: '140px'
  }
]

const resultColumns = [
  { key: 'displayName', label: 'Fan', sortable: true },
  { key: 'matchedLabel', label: 'Matched on' },
  {
    key: 'identifierCount',
    label: 'Identifiers',
    sortable: true,
    align: 'right',
    width: '130px'
  },
  {
    key: 'audienceCount',
    label: 'Audiences',
    sortable: true,
    align: 'right',
    width: '130px'
  },
  {
    key: 'lastSeen',
    label: 'Last seen',
    sortable: true,
    align: 'right',
    width: '140px'
  }
]

function typeLabelFor(id) {
  return (
    typeOptions.value.find(o => o.value === id)?.label.toLowerCase() ??
    'identifier'
  )
}

// The top hit opens automatically: one result is the common case, and making
// someone click the single row they just searched for is busywork.
watch(results, list => {
  if (!list.length) {
    if (trimmedQuery.value) selectedId.value = ''
    return
  }
  if (!list.some(r => r.id === selectedId.value)) {
    selectedId.value = list[0].id
  }
})

// Box -> URL.
watch([query, typeId], ([q, t]) => {
  if (q.trim()) formError.value = ''
  const next = {}
  if (q.trim()) next.q = q.trim()
  if (t) next.type = t
  if (!sameAsUrl(next.q ?? '', next.type ?? '')) router.replace({ query: next })
})

// URL -> box. The router reuses this component across query changes, so
// following a link to a different lookup, or hitting Back, has to push the new
// query into the field rather than leave the previous search on screen.
watch(
  () => [first(route.query.q), first(route.query.type)],
  ([q, t]) => {
    if (q !== query.value.trim()) query.value = q
    if (t !== typeId.value) typeId.value = t
  }
)

function sameAsUrl(q, t) {
  return first(route.query.q) === q && first(route.query.type) === t
}

function submit() {
  formError.value = trimmedQuery.value
    ? ''
    : 'Enter a profile ID or identifier value to search.'
}

function clear() {
  query.value = ''
  typeId.value = ''
  formError.value = ''
  selectedId.value = ''
}

async function refresh() {
  await load()
  loaded.value = true
}

onMounted(refresh)
</script>
