<template>
  <q-page class="p-6">
    <PageHeader
      title="Authorizations"
      subtitle="OAuth grants that let Sfere act on a third-party ad or CRM account on your behalf."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search authorizations..." />
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="openConnect()"
        >
          Connect provider
        </button>
      </template>
    </PageHeader>

    <div
      v-if="!loading && !error && authorizations.length"
      class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatCard
        label="Authorizations"
        :value="formatCount(authorizations.length)"
      />
      <StatCard
        label="Active"
        :value="`${statusCounts.active} of ${authorizations.length}`"
        :hint="
          statusCounts.active === authorizations.length
            ? 'All usable'
            : 'Some need attention'
        "
      />
      <StatCard
        label="Expired"
        :value="formatCount(statusCounts.expired)"
        :hint="statusCounts.expired ? 'Reconnect to restore access' : 'None'"
      />
      <StatCard
        label="Providers connected"
        :value="
          providersError ? '—' : `${connectedCount} of ${providers.length}`
        "
        :hint="providersError ? 'Provider catalog unavailable' : 'Catalog'"
      />
    </div>

    <NoticeBanner
      v-if="!loading && !error && statusCounts.expired"
      class="mb-5"
      tone="warn"
      :title="expiredTitle"
      message="Anything that reads through an expired grant fails on its next run. Reconnect it to mint a fresh token."
    />

    <SettingsOauthProvidersPanel
      class="mb-5"
      :providers="decoratedProviders"
      :loading="providersLoading"
      :error="providersError"
      @retry="loadProviders"
      @connect="openConnect"
    />

    <TabNav v-model="tab" :tabs="tabs" />

    <DataTable
      :columns="columns"
      :rows="visible"
      :loading="loading"
      :error="error"
      row-key="id"
      @retry="load"
    >
      <template #cell-providerName="{ row }">
        <p class="font-medium text-ink">{{ row.providerName }}</p>
        <p class="text-xs text-subtle">{{ row.accountLabel }}</p>
      </template>

      <template #cell-scopes="{ row }">
        <p class="text-muted">{{ scopeCount(row) }}</p>
        <p class="truncate font-mono text-xs text-subtle">{{
          formatScopes(row.scopes)
        }}</p>
      </template>

      <template #cell-status="{ row }">
        <StatusBadge
          :tone="authorizationStatus(row).variant"
          :label="authorizationStatus(row).label"
        />
      </template>

      <template #cell-authorizedByName="{ row }">
        <p class="text-muted">{{ row.authorizedByName }}</p>
        <p class="text-xs text-subtle">{{ formatDate(row.authorizedAt) }}</p>
      </template>

      <template #cell-expiresAt="{ value }">{{ formatDate(value) }}</template>

      <template #cell-lastUsedAt="{ value }">
        {{ formatDateTime(value) }}
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click.stop="reconnect(row)"
          >
            Reconnect
          </button>
          <button
            v-if="row.status !== 'revoked'"
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill"
            @click.stop="askRevoke(row)"
          >
            Revoke
          </button>
        </div>
      </template>

      <!-- Two different "no rows" cases: nothing authorized yet (offer the
           primary CTA) and nothing matching the filters (offer a way back). -->
      <template #empty>
        <EmptyState :title="emptyTitle" :description="emptyDescription">
          <template #cta>
            <button
              v-if="authorizations.length"
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
              @click="clearFilters"
            >
              Clear filters
            </button>
            <button
              v-else
              class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
              @click="openConnect()"
            >
              Connect your first provider
            </button>
          </template>
        </EmptyState>
      </template>
    </DataTable>

    <ConfirmDialog
      v-model="connectOpen"
      title="Connect a provider"
      message="You'll be sent to the provider to sign in and approve the scopes below."
      confirm-label="Continue to provider"
      @confirm="connect"
    >
      <EmptyState
        v-if="!providers.length"
        variant="inline"
        title="No providers available"
        description="An instance admin configures client credentials before a provider can be authorized."
      />

      <div v-else class="flex flex-col gap-2">
        <SelectableCard
          v-for="provider in providers"
          :key="provider.id"
          :selected="connectProviderId === provider.id"
          @select="connectProviderId = provider.id"
        >
          <div class="flex w-full items-start justify-between gap-2">
            <span class="text-sm font-medium text-ink">{{
              provider.displayName
            }}</span>
            <StatusBadge
              v-if="connectProviderId === provider.id"
              tone="brand"
              label="Selected"
            />
          </div>
          <p class="mt-1.5 font-mono text-xs leading-5 text-muted">{{
            formatScopes(provider.scopes)
          }}</p>
        </SelectableCard>
      </div>
    </ConfirmDialog>

    <ConfirmDialog
      v-model="confirmRevoke"
      title="Revoke this authorization?"
      :message="revokeMessage"
      confirm-label="Revoke"
      destructive
      @confirm="revokeTarget"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import TabNav from '@/components/ui/TabNav.vue'
import DataTable from '@/components/ui/DataTable.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SelectableCard from '@/components/ui/SelectableCard.vue'
import SettingsOauthProvidersPanel from '@/components/settings/SettingsOauthProvidersPanel.vue'
import {
  formatCount,
  formatDate,
  formatDateTime
} from '@/composables/useSettingsFormat'
import {
  authorizationStatus,
  decorateProviders,
  formatScopes,
  useSettingsAuthorizations,
  useSettingsOauthProviders
} from '@/composables/useSettingsAuthorizations'

const $q = useQuasar()

const { authorizations, loading, error, load, revoke } =
  useSettingsAuthorizations()

// The provider catalog is secondary: it fills one panel and the connect dialog,
// so it carries its own loading/error/retry and never escalates to a page-level
// ErrorState.
const {
  providers,
  loading: providersLoading,
  error: providersError,
  load: loadProviders
} = useSettingsOauthProviders()

const query = ref('')
const tab = ref('all')
const connectOpen = ref(false)
const connectProviderId = ref('')
const confirmRevoke = ref(false)
const target = ref(null)

const columns = [
  { key: 'providerName', label: 'Provider', sortable: true },
  { key: 'scopes', label: 'Scopes' },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'authorizedByName', label: 'Authorized by', sortable: true },
  { key: 'expiresAt', label: 'Expires', sortable: true },
  { key: 'lastUsedAt', label: 'Last used', sortable: true },
  { key: 'actions', label: '', align: 'right', width: '240px' }
]

// Each tab is a predicate over an authorization; 'all' has none.
const TAB_PREDICATES = {
  active: a => a.status === 'active',
  expired: a => a.status === 'expired',
  revoked: a => a.status === 'revoked'
}

const statusCounts = computed(() => ({
  active: authorizations.value.filter(TAB_PREDICATES.active).length,
  expired: authorizations.value.filter(TAB_PREDICATES.expired).length,
  revoked: authorizations.value.filter(TAB_PREDICATES.revoked).length
}))

const tabs = computed(() => [
  { key: 'all', label: 'All', count: authorizations.value.length },
  { key: 'active', label: 'Active', count: statusCounts.value.active },
  { key: 'expired', label: 'Expired', count: statusCounts.value.expired },
  { key: 'revoked', label: 'Revoked', count: statusCounts.value.revoked }
])

const expiredTitle = computed(
  () =>
    `${statusCounts.value.expired} authorization${statusCounts.value.expired === 1 ? ' has' : 's have'} expired`
)

const decoratedProviders = computed(() =>
  decorateProviders(providers.value, authorizations.value)
)

const connectedCount = computed(
  () => decoratedProviders.value.filter(p => p.isConnected).length
)

const SEARCH_FIELDS = [
  'providerName',
  'providerId',
  'accountLabel',
  'authorizedByName'
]

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  const predicate = TAB_PREDICATES[tab.value]
  return authorizations.value.filter(a => {
    if (predicate && !predicate(a)) return false
    if (!q) return true
    if ((a.scopes ?? []).some(s => s.toLowerCase().includes(q))) return true
    return SEARCH_FIELDS.some(f =>
      String(a[f] ?? '')
        .toLowerCase()
        .includes(q)
    )
  })
})

const emptyTitle = computed(() =>
  authorizations.value.length
    ? 'No authorizations match your filters'
    : 'No authorizations yet'
)

const emptyDescription = computed(() =>
  authorizations.value.length
    ? 'Try a different search term, or switch back to the All tab.'
    : 'Authorize a provider so sources and destinations can reach its account with a token you can revoke here.'
)

function clearFilters() {
  query.value = ''
  tab.value = 'all'
}

function scopeCount(row) {
  const n = (row.scopes ?? []).length
  return `${n} scope${n === 1 ? '' : 's'}`
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

// The dialog opens with something already chosen, because ConfirmDialog's
// confirm button cannot be disabled — a dialog you can confirm with no
// selection would have to fail afterwards, which is worse.
function openConnect(provider = null) {
  if (provider?.id) {
    connectProviderId.value = provider.id
  } else if (!connectProviderId.value) {
    connectProviderId.value = providers.value[0]?.id ?? ''
  }
  connectOpen.value = true
}

function connect() {
  const provider = providers.value.find(p => p.id === connectProviderId.value)
  if (!provider) return
  notifyLocal(`Redirect to ${provider.displayName} would start here`)
}

function reconnect(row) {
  notifyLocal(`Reconnect to ${row.providerName} would start here`)
}

function askRevoke(row) {
  target.value = row
  confirmRevoke.value = true
}

const revokeMessage = computed(() =>
  target.value
    ? `${target.value.providerName} (${target.value.accountLabel}) stops accepting Sfere's token immediately, and anything reading through it fails on its next run.`
    : ''
)

function revokeTarget() {
  const row = target.value
  if (!row) return
  revoke(row.id)
  notifyLocal(`${row.providerName} authorization revoked`)
  target.value = null
}

onMounted(() => {
  load()
  loadProviders()
})
</script>
