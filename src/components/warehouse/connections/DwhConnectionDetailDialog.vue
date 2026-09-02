<template>
  <q-dialog v-model="open">
    <CardPanel :padded="false" class="w-[560px] max-w-[92vw]">
      <template #header>
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-ink">{{
            connection?.name
          }}</p>
          <p class="truncate font-mono text-xs text-subtle">{{
            connection?.id
          }}</p>
        </div>
        <q-btn v-close-popup flat round dense icon="close" size="sm" />
      </template>

      <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
        <!-- A warehouse that is refusing connections is information about a
             working screen, so it is a notice and not an ErrorState. -->
        <NoticeBanner
          v-if="errorMessage"
          tone="danger"
          class="mb-4"
          title="This connection is not accepting queries"
          :message="errorMessage"
        />

        <DefinitionList :items="facts" :columns="1">
          <template #value-status>
            <StatusBadge :tone="status.variant" :label="status.label" />
          </template>

          <template #value-role>
            <StatusBadge
              :tone="connection?.isPrimary ? 'brand' : 'neutral'"
              :label="connection?.isPrimary ? 'Primary' : 'Secondary'"
            />
          </template>

          <template #value-host="{ value }">
            <code class="font-mono text-xs text-ink">{{ value }}</code>
          </template>

          <template #value-database="{ value }">
            <code class="font-mono text-xs text-ink">{{ value }}</code>
          </template>

          <template #value-credentials>
            <span class="font-mono text-xs text-subtle">••••••••</span>
          </template>

          <template #value-in-use-by>
            <div class="flex flex-wrap justify-end gap-1">
              <StatusBadge
                v-for="part in usageParts"
                :key="part"
                tone="neutral"
                :label="part"
              />
              <span v-if="!usageParts.length" class="text-subtle"
                >Nothing reads from it</span
              >
            </div>
          </template>
        </DefinitionList>
      </div>

      <template #footer>
        <p class="text-xs text-subtle">Read-only demo data.</p>
        <div class="flex items-center gap-2">
          <button
            v-if="connection && !connection.isPrimary"
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click="emit('make-primary', connection)"
          >
            Make primary
          </button>
          <button
            v-close-popup
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
          >
            Close
          </button>
        </div>
      </template>
    </CardPanel>
  </q-dialog>
</template>

<script setup>
import { NEVER } from '@/lib/emptyValue'
import { computed } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import {
  connectionTypeLabel,
  formatConnectionError,
  formatCount,
  formatDateTime,
  statusMeta
} from '@/composables/useDwhConnections'

// The read-out for one warehouse connection.
//
// `/dwh-connections` has no detail route — the manifest ships a list, a create
// form and a trash. A connection still carries more than a table row can hold (the credentials
// shape, the recorded failure, what reads from it), so the row opens this
// instead. It is a q-dialog wrapping CardPanel, so it is the same white card as
// everywhere else.
//
// The password is never in this component: it is not in the mock data, it is not
// fetched, and the Credentials row renders a fixed mask rather than a value.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // The row being inspected; null between openings.
  connection: { type: Object, default: null },
  // Pre-counted dependants from the page, e.g. ['2 syncs', '3 models'].
  usageParts: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue', 'make-primary'])

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

const status = computed(() => statusMeta(props.connection?.status))

const errorMessage = computed(() =>
  props.connection?.status === 'error'
    ? formatConnectionError(props.connection?.lastError) ||
      'The last probe did not reach the warehouse.'
    : ''
)

const facts = computed(() => {
  const c = props.connection
  if (!c) return []
  return [
    { label: 'Status', value: c.status },
    { label: 'Role', value: c.isPrimary },
    { label: 'Engine', value: connectionTypeLabel(c.type) },
    { label: 'Host', value: `${c.host}:${c.port}` },
    {
      label: 'Database',
      value: [c.database, c.schema].filter(Boolean).join('.')
    },
    { label: 'Username', value: c.username },
    { label: 'Credentials', value: 'masked' },
    { label: 'Tables catalogued', value: formatCount(c.tableCount) },
    { label: 'In use by', value: props.usageParts },
    {
      label: 'Last validated',
      value: formatDateTime(c.lastValidatedAt, NEVER)
    },
    { label: 'Created', value: formatDateTime(c.createdAt) },
    { label: 'Last updated', value: formatDateTime(c.updatedAt) },
    { label: 'Config version', value: `v${c.version}` }
  ]
})
</script>
