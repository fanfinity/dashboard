<template>
  <q-page class="p-6">
    <PageHeader :title="destination?.name || 'Destination'">
      <template #subtitle>
        <span v-if="destination">{{
          destination.description ||
          `Delivers routed events to /${destination.slug}.`
        }}</span>
        <span v-else>Destination {{ id }}</span>
      </template>

      <template #actions>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'destinations' })"
        >
          All destinations
        </button>
        <template v-if="destination">
          <button
            class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
            @click="toggle"
          >
            {{ destination.isEnabled ? 'Pause deliveries' : 'Enable' }}
          </button>
          <button
            class="rounded-lg bg-rose-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
            @click="confirmDelete = true"
          >
            Delete
          </button>
        </template>
      </template>
    </PageHeader>

    <LoadingState v-if="loading" variant="form" :rows="5" />

    <ErrorState
      v-else-if="error"
      title="Couldn't load this destination."
      :message="error"
      @retry="load"
    />

    <EmptyState
      v-else-if="!destination"
      title="Destination not found"
      :description="`Nothing in this workspace has the id “${id}”. It may have been deleted.`"
    >
      <template #cta>
        <div class="flex items-center gap-2">
          <button
            class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
            @click="router.push({ name: 'destinations' })"
          >
            Back to destinations
          </button>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click="router.push({ name: 'destinations-trash' })"
          >
            Check the trash
          </button>
        </div>
      </template>
    </EmptyState>

    <div v-else class="flex flex-col gap-5">
      <!-- Template upgrade notice: only when the record is behind. -->
      <CardPanel v-if="hasUpgrade(destination)">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-ink">{{
              upgradeLabel(destination)
            }}</p>
            <p class="mt-1 text-xs text-muted"
              >This destination runs template version
              {{ destination.templateVersion }}. Upgrading replays the
              template's current configuration schema.</p
            >
          </div>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click="upgrade"
          >
            Upgrade template
          </button>
        </div>
      </CardPanel>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Inbound pipes"
          :value="formatCount(destination.pipeCount)"
        />
        <StatCard
          label="Delivered (last hour)"
          :value="formatCount(destination.deliveryCountLastHour)"
        />
        <StatCard
          label="Warehouse connections"
          :value="formatCount(warehouses.length)"
        />
        <StatCard label="Config version" :value="`v${destination.version}`" />
      </div>

      <div class="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <!-- Inbound pipes: everything routing events into this destination. -->
        <section class="flex flex-col gap-3 xl:col-span-2">
          <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
            >Inbound pipes</h2
          >
          <DataTable
            :columns="pipeColumns"
            :rows="inboundPipes"
            :loading="pipesLoading"
            :error="pipesError"
            row-key="id"
            clickable-rows
            empty-title="No pipes deliver here yet"
            empty-description="A pipe connects a source to this destination and decides which events reach it."
            empty-cta-label="New pipe"
            :empty-cta-to="{ name: 'pipes-new' }"
            @retry="loadPipes"
            @row-click="openPipe"
          >
            <template #cell-name="{ row }">
              <p class="font-medium text-ink">{{ row.name }}</p>
              <p class="text-xs text-subtle">{{ row.sourceName }}</p>
            </template>

            <template #cell-isEnabled="{ value }">
              <StatusBadge
                :enabled="value"
                :label="value ? 'Running' : 'Paused'"
              />
            </template>

            <template #cell-deliveryCountLastHour="{ value }">{{
              formatCount(value)
            }}</template>

            <template #cell-updatedAt="{ value }">{{
              formatDate(value)
            }}</template>
          </DataTable>
        </section>

        <!-- Configuration summary. -->
        <section class="flex flex-col gap-3">
          <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
            >Configuration</h2
          >

          <CardPanel>
            <DefinitionList :items="details" :columns="1">
              <template #value-status>
                <StatusBadge
                  :enabled="destination.isEnabled"
                  :label="destination.isEnabled ? 'Enabled' : 'Paused'"
                />
              </template>

              <template #value-template>
                <DestinationTemplateBadge
                  :record="destination"
                  class="justify-end"
                />
              </template>
            </DefinitionList>
          </CardPanel>

          <CardPanel>
            <p class="text-xs font-medium text-subtle">Warehouse connections</p>
            <div v-if="warehouses.length" class="mt-2 flex flex-wrap gap-1.5">
              <StatusBadge
                v-for="w in warehouses"
                :key="w"
                variant="brand"
                :label="w"
              />
            </div>
            <p v-else class="mt-2 text-sm text-muted"
              >None. This destination delivers over the network rather than into
              a warehouse.</p
            >
          </CardPanel>
        </section>
      </div>
    </div>

    <ConfirmDialog
      v-model="confirmDelete"
      title="Delete this destination?"
      :message="deleteMessage"
      confirm-label="Delete destination"
      destructive
      @confirm="remove"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import DataTable from '@/components/ui/DataTable.vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DestinationTemplateBadge from '@/components/destinations/DestinationTemplateBadge.vue'
import { useTemplates } from '@/composables/useTemplates'
import {
  formatCount,
  formatDate,
  formatDateTime,
  useDestinations,
  useDestinationPipes,
  useDestinationToasts
} from '@/composables/useDestinations'

const route = useRoute()
const router = useRouter()
const { hasUpgrade, upgradeLabel } = useTemplates()
const { toast } = useDestinationToasts()

const {
  destinations,
  loading,
  error,
  load: loadDestinations
} = useDestinations()
const {
  pipes,
  loading: pipesLoading,
  error: pipesError,
  load: loadPipes
} = useDestinationPipes()

const confirmDelete = ref(false)

const id = computed(() => String(route.params.id ?? ''))

// A missing record is "empty", not "error": the fetch succeeded, this id just
// isn't in it. Only a failed fetch may reach ErrorState, which is what the
// smoke run treats as a broken screen.
const destination = computed(
  () => destinations.value.find(d => d.id === id.value) ?? null
)

// `pipeCount` on the destination is authored to agree with this filter.
const inboundPipes = computed(() =>
  pipes.value.filter(p => p.eventDestinationId === id.value)
)

const warehouses = computed(() => destination.value?.warehouseConnections ?? [])

const pipeColumns = [
  { key: 'name', label: 'Pipe', sortable: true },
  { key: 'isEnabled', label: 'Status', sortable: true },
  {
    key: 'deliveryCountLastHour',
    label: 'Delivered (1h)',
    sortable: true,
    align: 'right'
  },
  { key: 'updatedAt', label: 'Updated', sortable: true, align: 'right' }
]

// `Status` and `Template` are rendered as badges through DefinitionList's
// `#value-status` / `#value-template` slots; the rest fall through to `value`.
const details = computed(() => {
  const d = destination.value
  if (!d) return []
  return [
    { label: 'Status', value: d.isEnabled ? 'Enabled' : 'Paused' },
    { label: 'Template', value: d.templateId ?? 'Custom' },
    { label: 'Slug', value: `/${d.slug}` },
    { label: 'Destination ID', value: d.id },
    { label: 'Type', value: 'Event destination' },
    { label: 'Created', value: formatDateTime(d.createdAt) },
    { label: 'Last updated', value: formatDateTime(d.updatedAt) }
  ]
})

const deleteMessage = computed(() => {
  const d = destination.value
  if (!d) return ''
  const pipeLabel =
    d.pipeCount === 1 ? '1 pipe' : `${formatCount(d.pipeCount)} pipes`
  return `“${d.name}” moves to the trash and its ${pipeLabel} stop delivering. You can restore it for 30 days.`
})

// Both resources back one screen, so Retry has to re-run both.
function load() {
  loadDestinations()
  loadPipes()
}

function toggle() {
  const d = destination.value
  d.isEnabled = !d.isEnabled
  toast(
    `“${d.name}” ${d.isEnabled ? 'enabled' : 'paused'} — demo data, nothing was saved.`
  )
}

function upgrade() {
  const d = destination.value
  d.templateVersion = d.latestTemplateVersion
  toast(
    `“${d.name}” moved to template ${d.templateVersion} — demo data, nothing was saved.`
  )
}

function remove() {
  const name = destination.value.name
  const i = destinations.value.findIndex(d => d.id === id.value)
  if (i !== -1) destinations.value.splice(i, 1)
  toast(`“${name}” deleted — demo data, nothing was saved.`)
  router.push({ name: 'destinations' })
}

function openPipe(row) {
  router.push({ name: 'pipes-detail', params: { id: row.id } })
}

onMounted(load)
</script>
