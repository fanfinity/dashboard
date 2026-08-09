<template>
  <q-page class="p-6">
    <!-- Header -->
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl! font-semibold! tracking-[-0.5px]! text-ink"
          >Connectors</h1
        >
        <p class="mt-2 text-sm text-muted">
          Browse the connector catalog. Pick a source to start syncing data into
          Sfere.
        </p>
      </div>

      <!-- Search -->
      <div
        class="flex h-9 w-full max-w-[320px] items-center gap-2 rounded-lg border border-line2 bg-white px-2.5 shadow-sm"
      >
        <img :src="icSearch" alt="" class="size-4 shrink-0" />
        <input
          v-model="query"
          type="text"
          placeholder="Search connectors..."
          class="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-subtle"
        />
      </div>
    </div>

    <!-- Loading -->
    <div
      v-if="loading"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <q-skeleton v-for="n in 12" :key="n" height="74px" class="rounded-xl!" />
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="flex flex-col items-start gap-3 rounded-xl border border-line2 bg-white p-6"
    >
      <p class="text-sm text-ink">Couldn't load the connector catalog.</p>
      <p class="text-xs text-muted">{{ error }}</p>
      <button
        class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
        @click="load"
      >
        Retry
      </button>
    </div>

    <!-- Empty -->
    <div
      v-else-if="!filteredGroups.length"
      class="rounded-xl border border-line2 bg-white p-6 text-sm text-muted"
    >
      No connectors match "{{ query }}".
    </div>

    <!-- Grouped grid -->
    <div v-else class="flex flex-col gap-8">
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
            @select="onSelect"
          />
        </div>
      </section>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'

import ConnectorCard from '@/components/ConnectorCard.vue'
import { useConnectorCatalog } from '@/composables/useConnectorCatalog'
import icSearch from '@/assets/dashboard/ic-search.svg'

const $q = useQuasar()
const { connectors, loading, error, load } = useConnectorCatalog()
const query = ref('')

// Order + human labels for connectorSubtype values returned by the API.
const SUBTYPES = [
  { key: 'database', label: 'Databases' },
  { key: 'api', label: 'APIs' },
  { key: 'file', label: 'Files' },
  { key: 'custom image', label: 'Custom' }
]

const filteredGroups = computed(() => {
  const q = query.value.trim().toLowerCase()
  const matches = connectors.value.filter(s => {
    if (!q) return true
    const name = (s.meta?.name || '').toLowerCase()
    return name.includes(q) || s.packageId.toLowerCase().includes(q)
  })

  const byKey = new Map()
  for (const s of matches) {
    const key = s.meta?.connectorSubtype || 'other'
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(s)
  }

  const order = SUBTYPES.map(t => t.key)
  const keys = [...byKey.keys()].sort((a, b) => {
    const ia = order.indexOf(a)
    const ib = order.indexOf(b)
    return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib)
  })

  return keys.map(key => ({
    key,
    label: SUBTYPES.find(t => t.key === key)?.label || titleCase(key),
    items: byKey.get(key).sort(sortBySalience)
  }))
})

// Popular connectors carry a higher sortIndex; fall back to alphabetical.
function sortBySalience(a, b) {
  const sa = a.sortIndex ?? -1
  const sb = b.sortIndex ?? -1
  if (sa !== sb) return sb - sa
  return (a.meta?.name || a.packageId).localeCompare(
    b.meta?.name || b.packageId
  )
}

function titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function onSelect(connector) {
  // Browse-only for now. Wiring an actual sync (config form, credentials, version)
  // attaches here once the deployment's API keys are provided.
  $q.notify({
    message: `${connector.meta?.name || connector.packageId} — connecting sources is coming soon`,
    color: 'dark',
    position: 'bottom',
    timeout: 2000
  })
}

onMounted(load)
</script>
