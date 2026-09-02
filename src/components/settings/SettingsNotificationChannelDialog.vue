<template>
  <q-dialog v-model="open">
    <div :class="cardClasses">
      <div
        class="flex shrink-0 items-start justify-between gap-4 border-b border-sfere-line px-5 py-4"
      >
        <div class="min-w-0">
          <h2 class="font-sfere-display! text-sfere-h4! text-sfere-fg">{{
            channel ? `Edit “${channel.name}”` : 'New notification channel'
          }}</h2>
          <p class="mt-1 text-sfere-sm text-sfere-fg-muted"
            >Where alerts go, and which ones.</p
          >
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div class="flex flex-col gap-4">
          <NoticeBanner
            v-if="apiMissing"
            tone="info"
            title="Nothing will be saved"
            message="Demo data mode is on, so this form validates and stops. Switch Settings → Data source to Real API to save."
          />

          <FormField
            label="Name"
            required
            for-id="channel-name"
            hint="What this is for. Shown on the row and in the test confirmation."
            :error="errors.name"
          >
            <SfereInput
              id="channel-name"
              v-model="form.name"
              placeholder="e.g. #data-alerts"
              autocomplete="off"
            />
          </FormField>

          <!-- Only on create. `NotificationChannelUpdate` has no `channel`
               field: the kind of a channel cannot be changed, only its
               configuration, so offering it on edit would be a control whose
               value is dropped. -->
          <FormField
            v-if="!channel"
            label="Kind"
            required
            for-id="channel-kind"
          >
            <div id="channel-kind" class="flex flex-col gap-2">
              <label
                v-for="kind in NOTIFICATION_CHANNELS"
                :key="kind.value"
                class="flex cursor-pointer items-start gap-2.5 rounded-sfere border border-sfere-line bg-white px-3 py-2.5 hover:bg-sfere-fill"
              >
                <input
                  v-model="form.channel"
                  type="radio"
                  :value="kind.value"
                  class="mt-0.5 size-4 shrink-0 accent-sfere-500"
                />
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-medium text-sfere-fg">{{
                    kind.label
                  }}</span>
                  <span class="block text-xs text-sfere-fg-muted">{{
                    kind.description
                  }}</span>
                </span>
              </label>
            </div>
          </FormField>

          <FormField
            v-if="form.channel === 'slack'"
            label="Slack webhook URL"
            :required="!channel"
            for-id="channel-webhook"
            :hint="webhookHint"
            :error="errors.slackWebhookUrl"
          >
            <SfereInput
              id="channel-webhook"
              v-model="form.slackWebhookUrl"
              placeholder="https://hooks.slack.com/services/…"
              autocomplete="off"
            />
          </FormField>

          <FormField
            v-else
            label="Email addresses"
            required
            for-id="channel-emails"
            hint="One per line."
            :error="errors.emails"
          >
            <SfereTextarea
              id="channel-emails"
              v-model="emailsText"
              :rows="3"
              placeholder="data@example.com"
            />
          </FormField>

          <FormField
            label="Alert on"
            required
            for-id="channel-events"
            hint="“Everything” is its own setting, not a shortcut for ticking the rest — it also covers alert kinds added later."
            :error="errors.events"
          >
            <div id="channel-events" class="flex flex-col gap-2">
              <label
                v-for="event in NOTIFICATION_EVENTS"
                :key="event.value"
                class="flex cursor-pointer items-start gap-2.5 rounded-sfere border border-sfere-line bg-white px-3 py-2.5 hover:bg-sfere-fill"
              >
                <input
                  :checked="form.events.includes(event.value)"
                  type="checkbox"
                  class="mt-0.5 size-4 shrink-0 accent-sfere-500"
                  @change="toggleEvent(event.value)"
                />
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-medium text-sfere-fg">{{
                    event.label
                  }}</span>
                  <span class="block text-xs text-sfere-fg-muted">{{
                    event.description
                  }}</span>
                </span>
              </label>
            </div>
          </FormField>

          <FormField
            label="Repeat reminders every"
            optional
            for-id="channel-period"
            hint="Hours between reminders while something is still broken. Leave blank to be told once."
          >
            <SfereInput
              id="channel-period"
              v-model="periodText"
              type="number"
              min="1"
              placeholder="24"
            />
          </FormField>

          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-ink"
                >Group batch alerts by table</p
              >
              <p class="mt-1! text-sm text-muted"
                >One message per table instead of one per batch. Worth turning
                on for a warehouse that writes often.</p
              >
            </div>
            <SfereToggle
              v-model="form.summarizeBatchNotificationsByTable"
              class="shrink-0"
              label="Group batch alerts by table"
            />
          </div>
        </div>
      </div>

      <div
        class="flex shrink-0 items-center justify-end gap-2 border-t border-sfere-line px-5 py-3.5"
      >
        <SfereButton v-close-popup variant="secondary" size="sm"
          >Cancel</SfereButton
        >
        <SfereButton size="sm" :loading="submitting" @click="submit">{{
          channel ? 'Save channel' : 'Create channel'
        }}</SfereButton>
      </div>
    </div>
  </q-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import FormField from '@/components/ui/FormField.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import SfereTextarea from '@/components/ui/SfereTextarea.vue'
import SfereToggle from '@/components/ui/SfereToggle.vue'
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  webhookIsMasked
} from '@/composables/useNotificationChannels'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** null for create. */
  channel: { type: Object, default: null },
  submitting: { type: Boolean, default: false },
  apiMissing: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'submit'])

// Both halves, and a `min()`: Quasar's unlayered 560px `max-width` on a dialog
// child would otherwise win, and a flat pixel max-width would stop this
// shrinking on a narrow window.
//
// `flex-nowrap!` is the other half, and the important suffix is the whole point:
// Quasar's unlayered `.flex` sets `flex-wrap: wrap`, so a capped-height column
// does not scroll when it overflows, it wraps into a SECOND COLUMN. The header
// sat in column one and the whole form in column two, clipped by
// `overflow-hidden`. The plain `flex-nowrap` utility is layered and loses.
const cardClasses = [
  'flex max-h-[85vh] w-[min(600px,94vw)]! max-w-[min(600px,94vw)]! flex-col flex-nowrap! overflow-hidden',
  'rounded-sfere-xl! border border-sfere-line bg-sfere-surface shadow-sfere-pop'
]

const open = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

const form = reactive({
  name: '',
  channel: 'slack',
  events: ['all'],
  slackWebhookUrl: '',
  summarizeBatchNotificationsByTable: false,
  isEnabled: true
})
const emailsText = ref('')
const periodText = ref('')
const errors = reactive({
  name: '',
  events: '',
  slackWebhookUrl: '',
  emails: ''
})

watch(open, isOpen => {
  if (!isOpen) return
  const c = props.channel
  form.name = c?.name ?? ''
  form.channel = c?.channel ?? 'slack'
  form.events = [...(c?.events ?? ['all'])]
  // Pre-filled with whatever came back, INCLUDING the mask — which is deliberate
  // and is why `webhookIsMasked` exists. An empty box would suggest no webhook is
  // set; the mask shows one is, and `submit()` omits it rather than saving the
  // asterisks over the real thing.
  form.slackWebhookUrl = c?.slackWebhookUrl ?? ''
  form.summarizeBatchNotificationsByTable = Boolean(
    c?.summarizeBatchNotificationsByTable
  )
  form.isEnabled = c ? c.isEnabled : true
  emailsText.value = (c?.emails ?? []).join('\n')
  periodText.value =
    c?.recurringAlertsPeriodHours == null
      ? ''
      : String(c.recurringAlertsPeriodHours)
  errors.name = ''
  errors.events = ''
  errors.slackWebhookUrl = ''
  errors.emails = ''
})

const webhookHint = computed(() =>
  webhookIsMasked(form.slackWebhookUrl)
    ? 'A webhook is already set. The value above is masked by the API, so leaving it as-is keeps the existing one — replace it only to change it.'
    : 'Slack → your app → Incoming Webhooks. The API masks this on read, so it cannot be shown back to you later.'
)

/**
 * `all` is exclusive: picking it clears the rest, and picking one of the rest
 * clears `all`. It is a real enum member that also covers future alert kinds, so
 * holding both would be saving two different intentions at once.
 */
function toggleEvent(value) {
  errors.events = ''
  if (value === 'all') {
    form.events = form.events.includes('all') ? [] : ['all']
    return
  }
  const without = form.events.filter(e => e !== 'all' && e !== value)
  form.events = form.events.includes(value) ? without : [...without, value]
}

function parseEmails() {
  return emailsText.value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

function validate() {
  errors.name = form.name.trim() ? '' : 'Give the channel a name.'
  errors.events = form.events.length ? '' : 'Pick at least one kind of alert.'
  errors.slackWebhookUrl = ''
  errors.emails = ''

  if (form.channel === 'slack') {
    const url = form.slackWebhookUrl.trim()
    if (!url) {
      errors.slackWebhookUrl = 'A Slack channel needs a webhook URL.'
    } else if (!webhookIsMasked(url) && !/^https:\/\//i.test(url)) {
      errors.slackWebhookUrl = 'A webhook URL starts with https://.'
    }
  } else {
    const emails = parseEmails()
    if (!emails.length) {
      errors.emails = 'Add at least one address.'
    } else {
      const bad = emails.filter(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      if (bad.length) errors.emails = `Not an email address: ${bad[0]}`
    }
  }

  return !(
    errors.name ||
    errors.events ||
    errors.slackWebhookUrl ||
    errors.emails
  )
}

function submit() {
  if (!validate()) return
  const period = Number(periodText.value)
  emit('submit', {
    name: form.name.trim(),
    channel: form.channel,
    events: [...form.events],
    // Passed through as-is. The composable's `channelBody()` is what drops it
    // when it is the mask, so that rule lives in one place rather than two.
    slackWebhookUrl:
      form.channel === 'slack' ? form.slackWebhookUrl.trim() : '',
    emails: form.channel === 'email' ? parseEmails() : [],
    recurringAlertsPeriodHours:
      periodText.value && Number.isFinite(period) && period > 0 ? period : null,
    summarizeBatchNotificationsByTable: form.summarizeBatchNotificationsByTable,
    isEnabled: form.isEnabled
  })
}
</script>
