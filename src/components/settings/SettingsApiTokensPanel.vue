<template>
  <DataTable
    :columns="columns"
    :rows="tokens"
    :loading="loading"
    :error="error"
    :api-missing="apiMissing"
    row-key="id"
    @retry="emit('retry')"
  >
    <template #cell-name="{ row }">
      <p class="font-medium text-ink">{{ row.name }}</p>
      <p v-if="row.description" class="text-xs text-subtle">{{
        row.description
      }}</p>
    </template>

    <!-- Same masked-by-default treatment as every other credential in the app:
         nothing legible until someone asks, and a Reveal shows only the stored
         preview because the full token was displayed once at creation — which is
         now literally true rather than a convention: `ApiToken` carries a
         four-character `hint` and the backend stores a SHA-256 hash. -->
    <template #cell-tokenPreview="{ row }">
      <SettingsSecretValue :preview="row.tokenPreview" />
    </template>

    <template #cell-scopes="{ row }">
      <div class="flex flex-wrap items-center gap-1">
        <StatusBadge
          v-for="scope in row.scopes"
          :key="scope"
          tone="neutral"
          :label="scope"
        />
      </div>
    </template>

    <template #cell-status="{ row }">
      <StatusBadge
        :tone="tokenStatus(row).variant"
        :label="tokenStatus(row).label"
      />
    </template>

    <!-- NOT "Never". `ApiToken.last_used_at` is in the schema and nothing in
         the backend ever assigns it, so it is null on every response — and a
         confident "Never" against a token that may be serving production
         traffic is the one answer that makes a revoke decision worse. -->
    <template #cell-lastUsedAt="{ row, value }">
      {{ formatDateTime(value, row.lastUsedFallback ?? NOT_KNOWN) }}
    </template>

    <!-- "Never" IS right here: an absent `expires_at` means the token was
         deliberately created without an expiry, which is a dated event that will
         not happen rather than a measurement nobody took. -->
    <template #cell-expiresAt="{ value }">
      {{ value ? formatDate(value) : NEVER }}
    </template>

    <template #cell-actions="{ row }">
      <div class="flex items-center justify-end gap-2">
        <button
          v-if="!row.isRevoked"
          class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill"
          @click.stop="emit('revoke', row)"
        >
          Delete
        </button>
        <StatusBadge
          v-else
          tone="neutral"
          :label="`Revoked ${formatDate(row.revokedAt, NEVER)}`"
        />
      </div>
    </template>

    <template #empty>
      <EmptyState
        title="No API tokens yet"
        description="Create a token so CI, a warehouse job or a kiosk fleet can call the API without a person signing in."
      >
        <template #cta>
          <button
            class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
            @click="emit('create')"
          >
            Create your first token
          </button>
        </template>
      </EmptyState>
    </template>
  </DataTable>
</template>

<script setup>
import { NEVER, NOT_KNOWN } from '@/lib/emptyValue'
import DataTable from '@/components/ui/DataTable.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SettingsSecretValue from '@/components/settings/SettingsSecretValue.vue'
import { formatDate, formatDateTime } from '@/composables/useSettingsFormat'
import { tokenStatus } from '@/composables/useSettingsWorkspace'

// Machine tokens that can call the API without a person signing in. There is no
// filter here — the list is short by nature.
//
// The row action says Delete, not Revoke, and that is not a wording preference.
// `DELETE /v1/accounts/{account}/api-tokens/{id}` removes the row
// (`revoke_api_token()` in `app/services/api_tokens.py`); there is no
// `is_revoked` and no `revoked_at` on `ApiToken`, so a deleted token leaves this
// table rather than staying in it as an audit record. The fixture models the
// revoked-but-visible version, which is why the `isRevoked` branch below is
// still here and is only ever taken in Demo mode.
defineProps({
  tokens: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  apiMissing: { type: Boolean, default: false }
})
const emit = defineEmits(['retry', 'revoke', 'create'])

const columns = [
  { key: 'name', label: 'Token', sortable: true },
  { key: 'tokenPreview', label: 'Value', width: '180px' },
  { key: 'scopes', label: 'Scopes' },
  { key: 'status', label: 'Status' },
  { key: 'lastUsedAt', label: 'Last used', sortable: true },
  { key: 'expiresAt', label: 'Expires', sortable: true },
  { key: 'actions', label: '', align: 'right', width: '190px' }
]
</script>
