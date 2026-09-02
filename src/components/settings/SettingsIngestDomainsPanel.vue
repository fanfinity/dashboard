<template>
  <div class="flex flex-col gap-4">
    <CardPanel>
      <template #header>
        <div class="min-w-0 flex-1">
          <span class="text-sm font-semibold text-ink">Ingest domains</span>
          <p class="mt-0.5! text-xs text-muted"
            >Collect events on your own domain instead of ours. A first-party
            request survives the tracking protection that blocks a third-party
            collector, which is the whole reason to bother.</p
          >
        </div>
        <SfereButton
          v-if="!apiMissing"
          class="shrink-0"
          size="sm"
          variant="secondary"
          @click="addOpen = true"
          >Add a domain</SfereButton
        >
      </template>

      <DataTable
        :columns="columns"
        :rows="domains"
        :loading="loading"
        :error="error"
        :api-missing="apiMissing"
        row-key="id"
        @retry="emit('retry')"
      >
        <template #cell-domain="{ row }">
          <code class="font-sfere-mono text-sm text-ink">{{ row.domain }}</code>
          <p v-if="row.error" class="text-xs text-rose-600">{{ row.error }}</p>
        </template>

        <!-- Two badges, not one. Ownership and the TLS certificate fail
             independently: a verified domain with a failed certificate is broken
             in a way a single "Verified" would hide completely. -->
        <template #cell-status="{ row }">
          <div class="flex flex-wrap items-center gap-1.5">
            <StatusBadge
              :tone="domainStatusBadge(row.status).tone"
              :label="domainStatusBadge(row.status).label"
            />
            <StatusBadge
              :tone="certificateStatusBadge(row.certificateStatus).tone"
              :label="certificateStatusBadge(row.certificateStatus).label"
            />
          </div>
        </template>

        <template #cell-verifiedAt="{ value }">
          <span class="whitespace-nowrap text-muted">{{
            formatDateTime(value, NEVER)
          }}</span>
        </template>

        <template #cell-actions="{ row }">
          <div class="flex items-center justify-end gap-2">
            <button
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-fill"
              @click.stop="emit('show-records', row)"
            >
              DNS records
            </button>
            <button
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-fill disabled:opacity-50"
              :disabled="verifying === row.id"
              @click.stop="emit('verify', row)"
            >
              {{ verifying === row.id ? 'Checking…' : 'Re-check' }}
            </button>
            <button
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill"
              @click.stop="askRemove(row)"
            >
              Remove
            </button>
          </div>
        </template>

        <template #empty>
          <EmptyState
            title="No custom ingest domains"
            description="Events are collected on Sfere's own host, which works and is more likely to be blocked by browser tracking protection than a domain of your own."
          >
            <template #cta>
              <SfereButton size="sm" @click="addOpen = true"
                >Add a domain</SfereButton
              >
            </template>
          </EmptyState>
        </template>
      </DataTable>
    </CardPanel>

    <!-- The DNS records for one domain. Shown below rather than in a dialog
         because they get copied into another tab, and a modal is the wrong shape
         for something you read while typing somewhere else. -->
    <CardPanel v-if="selected">
      <template #header>
        <div class="min-w-0 flex-1">
          <span class="text-sm font-semibold text-ink"
            >DNS records for
            <code class="font-sfere-mono">{{ selected.domain }}</code></span
          >
          <p class="mt-0.5! text-xs text-muted"
            >Add these at your DNS provider, then use Re-check. Verification and
            the certificate can take a few minutes after the records land.</p
          >
        </div>
        <SfereButton
          class="shrink-0"
          variant="ghost"
          size="sm"
          @click="emit('close-records')"
          >Close</SfereButton
        >
      </template>

      <!-- Null records is "Jitsu has not evaluated this domain yet", NOT "no
           records needed". Getting that the wrong way round would tell someone
           their setup is complete when they have not been given the instruction
           yet. -->
      <NoticeBanner
        v-if="selected.dnsRecords === null"
        tone="info"
        title="The records are not ready yet"
        message="The backend has not reported the DNS challenge for this domain yet. They appear here shortly — this does not mean no records are needed."
      />

      <EmptyState
        v-else-if="!selected.dnsRecords.length"
        title="No records reported"
        description="The backend returned an empty record list for this domain. Re-check, and raise it if it stays empty."
      />

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-max border-collapse text-left">
          <thead>
            <tr class="border-b border-sfere-line">
              <th class="px-3 py-2 text-xs font-semibold text-subtle">Type</th>
              <th class="px-3 py-2 text-xs font-semibold text-subtle">Name</th>
              <th class="px-3 py-2 text-xs font-semibold text-subtle">Value</th>
              <th class="px-3 py-2 text-xs font-semibold text-subtle">TTL</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(record, index) in selected.dnsRecords"
              :key="`${record.type}-${record.name}-${index}`"
              class="border-b border-sfere-line/60"
            >
              <td class="px-3 py-2 font-sfere-mono text-xs text-ink">{{
                record.type
              }}</td>
              <td class="px-3 py-2 font-sfere-mono text-xs text-ink">{{
                record.name
              }}</td>
              <td
                class="max-w-[380px] break-all px-3 py-2 font-sfere-mono text-xs text-ink"
                >{{ record.value }}</td
              >
              <!-- `NOT_SET`: a TTL the provider did not state is theirs to
                   choose, not 3600. -->
              <td class="px-3 py-2 font-sfere-mono text-xs text-muted">{{
                record.ttl == null ? NOT_SET : record.ttl
              }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </CardPanel>

    <ConfirmDialog
      v-model="addOpen"
      title="Add an ingest domain"
      message="Sfere will give you DNS records to add at your provider. Nothing collects on this domain until they are in place and verified."
      confirm-label="Add domain"
      :loading="creating"
      @confirm="submitAdd"
    >
      <FormField
        label="Domain"
        required
        for-id="ingest-domain"
        hint="The fully-qualified host events will be posted to."
        :error="addError"
      >
        <SfereInput
          id="ingest-domain"
          v-model="draftDomain"
          placeholder="events.example.com"
          autocomplete="off"
        />
      </FormField>
    </ConfirmDialog>

    <ConfirmDialog
      v-model="removeOpen"
      :title="
        removeTarget ? `Remove ${removeTarget.domain}?` : 'Remove this domain?'
      "
      :message="removeMessage"
      confirm-label="Remove domain"
      destructive
      @confirm="submitRemove"
    />
  </div>
</template>

<script setup>
import { NEVER, NOT_SET } from '@/lib/emptyValue'
import { computed, ref, watch } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FormField from '@/components/ui/FormField.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import {
  certificateStatusBadge,
  domainStatusBadge
} from '@/composables/useIngestDomains'
import { formatDateTime } from '@/composables/useSources'

// `GET/POST …/domains`, `GET/DELETE …/domains/{id}` and
// `POST …/domains/{id}/verify`, all live as of backend PR #16.
const props = defineProps({
  domains: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  apiMissing: { type: Boolean, default: false },
  /** The domain whose DNS records are open, or null. */
  selected: { type: Object, default: null },
  creating: { type: Boolean, default: false },
  /** The id currently being re-checked, or ''. */
  verifying: { type: String, default: '' }
})

const emit = defineEmits([
  'retry',
  'create',
  'verify',
  'remove',
  'show-records',
  'close-records'
])

const columns = [
  { key: 'domain', label: 'Domain', sortable: true },
  { key: 'status', label: 'Status' },
  { key: 'verifiedAt', label: 'Verified' },
  { key: 'actions', label: '', align: 'right', width: '300px' }
]

const addOpen = ref(false)
const draftDomain = ref('')
const addError = ref('')

watch(addOpen, isOpen => {
  if (isOpen) {
    draftDomain.value = ''
    addError.value = ''
  }
})

const removeOpen = ref(false)
const removeTarget = ref(null)

const removeMessage = computed(() => {
  const d = removeTarget.value
  if (!d) return ''
  return `Events posted to ${d.domain} stop being accepted immediately. Anything already collected through it is untouched — it is in the warehouse, not here. Any snippet still pointing at this host starts failing, so change those first.`
})

function askRemove(row) {
  removeTarget.value = row
  removeOpen.value = true
}

function submitAdd() {
  const value = draftDomain.value.trim().toLowerCase()
  // Checked here rather than sent: a 422 about a field name says less than this
  // does, and says it further from the box.
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(value)) {
    addError.value =
      'That does not look like a domain. Use a host like events.example.com.'
    return
  }
  addError.value = ''
  emit('create', value)
}

function submitRemove() {
  if (removeTarget.value) emit('remove', removeTarget.value)
  // Left set — the message must not blank out while the dialog fades.
}
</script>
