<template>
  <div class="flex flex-col gap-4">
    <CardPanel>
      <template #header>
        <div class="min-w-0 flex-1">
          <span class="text-sm font-semibold text-ink"
            >Notification channels</span
          >
          <p class="mt-0.5! text-xs text-muted"
            >Where alerts go when a sync fails, a batch is dead-lettered, or the
            account changes.</p
          >
        </div>
        <SfereButton
          v-if="!apiMissing"
          class="shrink-0"
          size="sm"
          variant="secondary"
          @click="emit('create')"
          >New channel</SfereButton
        >
      </template>

      <DataTable
        :columns="columns"
        :rows="channels"
        :loading="loading"
        :error="error"
        :api-missing="apiMissing"
        row-key="id"
        @retry="emit('retry')"
      >
        <template #cell-name="{ row }">
          <p class="font-medium text-ink">{{ row.name }}</p>
          <p class="text-xs text-subtle">{{ recipientSummary(row) }}</p>
        </template>

        <template #cell-channel="{ row }">
          <StatusBadge tone="neutral" :label="channelLabel(row.channel)" />
        </template>

        <!-- `all` is rendered as its own thing, not as five chips. It is a real
             enum member that also covers event kinds added later, so showing it
             as "everything" is the accurate reading. -->
        <template #cell-events="{ row }">
          <div class="flex flex-wrap items-center gap-1">
            <StatusBadge
              v-if="row.events.includes('all')"
              tone="brand"
              label="Everything"
            />
            <template v-else-if="row.events.length">
              <StatusBadge
                v-for="event in row.events"
                :key="event"
                tone="neutral"
                :label="eventLabel(event)"
              />
            </template>
            <span v-else class="text-muted">{{ NONE }}</span>
          </div>
        </template>

        <template #cell-isEnabled="{ row }">
          <StatusBadge
            :tone="row.isEnabled ? 'success' : 'neutral'"
            :label="row.isEnabled ? 'Enabled' : 'Paused'"
          />
        </template>

        <template #cell-actions="{ row }">
          <div class="flex items-center justify-end gap-2">
            <button
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-fill disabled:opacity-50"
              :disabled="testing === row.id"
              @click.stop="askTest(row)"
            >
              {{ testing === row.id ? 'Sending…' : 'Test' }}
            </button>
            <button
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-fill"
              @click.stop="askToggle(row)"
            >
              {{ row.isEnabled ? 'Pause' : 'Enable' }}
            </button>
            <button
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-fill"
              @click.stop="emit('edit', row)"
            >
              Edit
            </button>
            <button
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill"
              @click.stop="askRemove(row)"
            >
              Delete
            </button>
          </div>
        </template>

        <template #empty>
          <EmptyState
            title="No notification channels"
            description="Nothing tells you when a sync fails. Add a Slack webhook or an email list so a broken pipe is something you hear about rather than something you find."
          >
            <template #cta>
              <SfereButton size="sm" @click="emit('create')"
                >Add a channel</SfereButton
              >
            </template>
          </EmptyState>
        </template>
      </DataTable>
    </CardPanel>

    <!-- A test sends a REAL message to a real Slack channel or inbox, so it asks
         first. A button that quietly posts into a shared channel is the kind of
         thing people only click once. -->
    <ConfirmDialog
      v-model="testOpen"
      :title="
        testTarget ? `Send a test to “${testTarget.name}”?` : 'Send a test?'
      "
      :message="testMessage"
      confirm-label="Send test"
      @confirm="submitTest"
    />

    <ConfirmDialog
      v-model="toggleOpen"
      :title="toggleTitle"
      :message="toggleMessage"
      :confirm-label="
        toggleTarget?.isEnabled ? 'Pause channel' : 'Enable channel'
      "
      @confirm="submitToggle"
    />

    <ConfirmDialog
      v-model="removeOpen"
      :title="
        removeTarget ? `Delete “${removeTarget.name}”?` : 'Delete this channel?'
      "
      :message="removeMessage"
      confirm-label="Delete channel"
      destructive
      @confirm="submitRemove"
    />
  </div>
</template>

<script setup>
import { NONE } from '@/lib/emptyValue'
import { computed, ref } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS
} from '@/composables/useNotificationChannels'

// Full CRUD plus `POST …/notification-channels/{id}/test`, live as of backend
// PR #16.
defineProps({
  channels: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  apiMissing: { type: Boolean, default: false },
  /** The id currently being tested, or ''. */
  testing: { type: String, default: '' }
})

const emit = defineEmits([
  'retry',
  'create',
  'edit',
  'test',
  'toggle',
  'remove'
])

const columns = [
  { key: 'name', label: 'Channel', sortable: true },
  { key: 'channel', label: 'Kind' },
  { key: 'events', label: 'Alerts on' },
  { key: 'isEnabled', label: 'Status' },
  { key: 'actions', label: '', align: 'right', width: '330px' }
]

function channelLabel(kind) {
  return NOTIFICATION_CHANNELS.find(c => c.value === kind)?.label ?? kind
}

function eventLabel(event) {
  return NOTIFICATION_EVENTS.find(e => e.value === event)?.label ?? event
}

// Describes the recipients without printing the webhook: it comes back masked
// anyway, and a masked secret on screen is noise that looks like a value.
function recipientSummary(row) {
  if (row.channel === 'email') {
    const n = row.emails.length
    return n ? `${n} address${n === 1 ? '' : 'es'}` : 'No addresses yet'
  }
  return row.slackWebhookUrl ? 'Slack webhook set' : 'No webhook set'
}

const testOpen = ref(false)
const testTarget = ref(null)
const toggleOpen = ref(false)
const toggleTarget = ref(null)
const removeOpen = ref(false)
const removeTarget = ref(null)

const testMessage = computed(() => {
  const c = testTarget.value
  if (!c) return ''
  return c.channel === 'slack'
    ? 'A real message is posted to the Slack channel behind this webhook. Everyone in that channel will see it.'
    : `A real email goes to ${c.emails.length} address${c.emails.length === 1 ? '' : 'es'}. It says it is a test.`
})

const toggleTitle = computed(() =>
  toggleTarget.value?.isEnabled
    ? `Pause “${toggleTarget.value.name}”?`
    : `Enable “${toggleTarget.value?.name ?? 'this channel'}”?`
)

const toggleMessage = computed(() => {
  const c = toggleTarget.value
  if (!c) return ''
  return c.isEnabled
    ? `Alerts stop going to “${c.name}” straight away. Nothing else changes: the events still happen and anything else listening still hears about them. If this is your only channel, nothing will tell you when a sync fails.`
    : `Alerts start going to “${c.name}” again from the next matching event.`
})

const removeMessage = computed(() => {
  const c = removeTarget.value
  if (!c) return ''
  return `“${c.name}” is removed and stops receiving alerts. ${
    c.channel === 'slack'
      ? 'The webhook itself is not revoked in Slack — do that there if you want it dead.'
      : 'The addresses are not notified that they have been removed.'
  } There is no trash for a channel, so this cannot be undone.`
})

function askTest(row) {
  testTarget.value = row
  testOpen.value = true
}

function askToggle(row) {
  toggleTarget.value = row
  toggleOpen.value = true
}

function askRemove(row) {
  removeTarget.value = row
  removeOpen.value = true
}

// Each of the three keeps its own target ref and each is deliberately left set
// after the confirm, so the dialog's message does not blank out mid-fade.
function submitTest() {
  if (testTarget.value) emit('test', testTarget.value)
}

function submitToggle() {
  if (toggleTarget.value) emit('toggle', toggleTarget.value)
}

function submitRemove() {
  if (removeTarget.value) emit('remove', removeTarget.value)
}
</script>
