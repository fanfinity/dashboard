<template>
  <div class="flex flex-col gap-5">
    <DataTable
      :columns="columns"
      :rows="visible"
      :loading="loading"
      :error="error"
      row-key="id"
      @retry="emit('retry')"
    >
      <template #toolbar>
        <ToolbarSearch v-model="query" placeholder="Search by name or email" />
      </template>

      <template #cell-name="{ row }">
        <p class="font-medium text-ink">{{ row.name }}</p>
        <p class="text-xs text-subtle">{{ row.email }}</p>
      </template>

      <template #cell-role="{ value }">
        <StatusBadge
          :tone="memberRole(value).variant"
          :label="memberRole(value).label"
        />
      </template>

      <template #cell-isActive="{ value }">
        <StatusBadge
          :tone="value ? 'success' : 'neutral'"
          :label="value ? 'Active' : 'Deactivated'"
        />
      </template>

      <template #cell-lastLogin="{ value }">
        {{ formatDateTime(value) }}
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <!-- The owner is the account of last resort: removing them would
               leave the workspace with nobody who can grant access back. -->
          <StatusBadge
            v-if="row.role === 'owner'"
            tone="neutral"
            label="Cannot be removed"
          />
          <button
            v-else
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill"
            @click.stop="emit('remove', row)"
          >
            Remove
          </button>
        </div>
      </template>

      <template #empty>
        <EmptyState :title="emptyTitle" :description="emptyDescription">
          <template #cta>
            <button
              v-if="members.length"
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
              @click="query = ''"
            >
              Clear filters
            </button>
            <button
              v-else
              class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
              @click="emit('invite')"
            >
              Invite your first member
            </button>
          </template>
        </EmptyState>
      </template>
    </DataTable>

    <CardPanel>
      <template #header>
        <span class="text-sm font-semibold text-ink">Pending invitations</span>
        <StatusBadge tone="neutral" :label="String(pending.length)" />
      </template>

      <EmptyState
        v-if="!pending.length"
        variant="inline"
        title="No invitations outstanding"
        description="Everyone invited has accepted."
      />

      <ul v-else class="flex flex-col divide-y divide-line">
        <li
          v-for="invite in pending"
          :key="invite.id"
          class="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="truncate text-sm font-medium text-ink">{{
                invite.email
              }}</p>
              <StatusBadge
                :tone="memberRole(invite.role).variant"
                :label="memberRole(invite.role).label"
              />
            </div>
            <p class="mt-0.5 text-xs text-subtle"
              >Invited by {{ invite.invitedByName }} on
              {{ formatDate(invite.invitedAt) }} · expires
              {{ formatDate(invite.expiresAt) }}</p
            >
          </div>

          <button
            class="shrink-0 rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill"
            @click="emit('revoke-invite', invite)"
          >
            Revoke invite
          </button>
        </li>
      </ul>
    </CardPanel>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import DataTable from '@/components/ui/DataTable.vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import { formatDate, formatDateTime } from '@/composables/useSettingsFormat'
import { memberRole } from '@/composables/useSettingsWorkspace'

// Who can sign in to this workspace, plus the invitations still outstanding.
// Search is local to the panel — it is view state, not page state, and nothing
// outside this component needs to read it.
const props = defineProps({
  members: { type: Array, default: () => [] },
  pending: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null }
})
const emit = defineEmits(['retry', 'remove', 'revoke-invite', 'invite'])

const query = ref('')

const columns = [
  { key: 'name', label: 'Member', sortable: true },
  { key: 'role', label: 'Role', sortable: true },
  { key: 'isActive', label: 'Status', sortable: true },
  { key: 'lastLogin', label: 'Last sign-in', sortable: true },
  { key: 'actions', label: '', align: 'right', width: '170px' }
]

const SEARCH_FIELDS = ['name', 'email', 'role']

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.members
  return props.members.filter(m =>
    SEARCH_FIELDS.some(f =>
      String(m[f] ?? '')
        .toLowerCase()
        .includes(q)
    )
  )
})

const emptyTitle = computed(() =>
  props.members.length ? 'No members match your search' : 'No members yet'
)

const emptyDescription = computed(() =>
  props.members.length
    ? 'Try a different name or email address.'
    : 'Invite a colleague so more than one person can reach this workspace.'
)
</script>
