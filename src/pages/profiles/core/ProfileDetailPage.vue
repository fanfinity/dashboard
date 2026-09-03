<template>
  <q-page class="p-6">
    <PageHeader :title="title" :subtitle="profileId" />

    <LoadingState v-if="loading" variant="table" :rows="4" />

    <ErrorState
      v-else-if="error"
      title="Couldn't load this profile."
      :message="error"
      @retry="load"
    />

    <NoticeBanner
      v-else-if="apiMissing"
      tone="info"
      title="Profiles are not available here yet"
      message="No live profiles endpoint responded. Switch Settings → Data source to real to see your own."
    />

    <EmptyState
      v-else-if="!profile"
      title="No such profile"
      description="This identity key did not resolve to a profile. It may have merged into another, or never sent an identify event."
    />

    <div v-else class="flex flex-col gap-4">
      <div class="grid gap-3 sm:grid-cols-4">
        <CardPanel v-for="stat in stats" :key="stat.label">
          <p class="text-xs text-muted">{{ stat.label }}</p>
          <p class="mt-1 text-lg font-semibold text-ink">{{ stat.value }}</p>
        </CardPanel>
      </div>

      <CardPanel>
        <template #header>
          <span class="text-sm font-semibold text-ink">Traits</span>
        </template>
        <dl class="grid gap-3 sm:grid-cols-3">
          <div v-for="t in traitRows" :key="t.label">
            <dt class="text-xs text-muted">{{ t.label }}</dt>
            <dd class="text-sm text-ink">{{ t.value || '—' }}</dd>
          </div>
        </dl>
      </CardPanel>

      <div>
        <h2 class="mb-2 text-sm! font-semibold! text-ink">Identifiers</h2>
        <DataTable :columns="idColumns" :rows="identifierRows" row-key="id">
          <template #cell-value="{ value }">
            <code class="font-mono text-xs text-ink">{{ value }}</code>
          </template>
          <template #cell-match="{ value }">
            <StatusBadge
              :tone="value === 'deterministic' ? 'success' : 'warn'"
              :label="value"
            />
          </template>
        </DataTable>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { NOT_KNOWN } from '@/lib/emptyValue'
import PageHeader from '@/components/ui/PageHeader.vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { fetchProfile } from '@/composables/useProfileList'
import {
  formatAgo,
  formatDateTime,
  formatNumber
} from '@/composables/useProfilesFormat'

const route = useRoute()
const profileId = String(route.params.id)

const profile = ref(null)
const loading = ref(false)
const error = ref(null)
const apiMissing = ref(false)

const title = computed(() => {
  const t = profile.value?.traits ?? {}
  return t.name || t.email || t.phone || profileId
})

const stats = computed(() => {
  const p = profile.value
  if (!p) return []
  return [
    { label: 'Identifiers', value: formatNumber((p.identifiers ?? []).length) },
    { label: 'Events', value: formatNumber(p.eventCount ?? 0) },
    { label: 'First seen', value: formatDateTime(p.firstSeenAt, NOT_KNOWN) },
    { label: 'Last seen', value: formatAgo(p.lastSeenAt, NOT_KNOWN) }
  ]
})

const traitRows = computed(() => {
  const t = profile.value?.traits ?? {}
  return [
    { label: 'Name', value: t.name },
    { label: 'Email', value: t.email },
    { label: 'Phone', value: t.phone }
  ]
})

const idColumns = [
  { key: 'type', label: 'Type' },
  { key: 'value', label: 'Value' },
  { key: 'firstSeen', label: 'First seen' },
  { key: 'lastSeen', label: 'Last seen' },
  { key: 'match', label: 'Match' }
]

const identifierRows = computed(() =>
  (profile.value?.identifiers ?? []).map(i => ({
    id: `${i.type}-${i.value}`,
    type: i.type,
    value: i.value,
    firstSeen: formatDateTime(i.firstSeenAt, NOT_KNOWN),
    lastSeen: formatDateTime(i.lastSeenAt, NOT_KNOWN),
    match: i.match
  }))
)

async function load() {
  loading.value = true
  error.value = null
  apiMissing.value = false
  const res = await fetchProfile(profileId)
  loading.value = false
  if (!res.ok) {
    if (res.apiMissing) apiMissing.value = true
    else error.value = res.error ?? 'Failed to load profile.'
    return
  }
  profile.value = res.data
}

load()
</script>
