<template>
  <q-page class="p-6">
    <PageHeader
      title="Channel settings"
      subtitle="Which transports can send, who messages come from, and the defaults each channel applies."
    >
      <template #actions>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'channels-email' })"
        >
          Email campaigns
        </button>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'engage-settings' })"
        >
          Engage settings
        </button>
      </template>
    </PageHeader>

    <LoadingState v-if="loading" variant="form" :rows="6" />

    <ErrorState
      v-else-if="error"
      title="Couldn't load the channel settings."
      :message="error"
      @retry="load"
    />

    <!-- The load succeeded and there is no configuration record. That is an
         answer, not a failure, so it must not render ErrorState. -->
    <EmptyState
      v-else-if="!hasSettings"
      title="No channel configuration"
      description="This workspace has no Engage configuration yet. Connect a transport to start sending."
    />

    <template v-else>
      <TabNav v-model="tab" :tabs="tabs" />

      <div class="flex max-w-4xl flex-col gap-4">
        <div
          v-if="tabTransports.length"
          class="grid grid-cols-1 gap-4 xl:grid-cols-2"
        >
          <ChannelTransportCard
            v-for="transport in tabTransports"
            :key="transport.id"
            :transport="transport"
            @make-default="makeDefault"
          />
        </div>

        <!-- A channel nobody has wired up yet is empty, not broken. -->
        <EmptyState
          v-else
          :title="`No ${channelLabel(tab)} transport connected`"
          :description="`Nothing can be sent over ${channelLabel(tab)} until a provider is connected and verified.`"
        >
          <template #cta>
            <button
              class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
              @click="
                notifyLocal(
                  `Connecting a ${channelLabel(tab)} transport needs the Engage backend`
                )
              "
            >
              Connect a transport
            </button>
          </template>
        </EmptyState>

        <NoticeBanner
          v-if="unverified.length"
          tone="warn"
          title="Some transports cannot send yet"
          :message="`${unverified.length} of the transports on this channel are unverified or waiting on setup.`"
        />

        <!-- Per-channel defaults. Only email and WhatsApp carry any; the other
             two are transport-only until a provider is connected. -->
        <form
          v-if="tab === 'email'"
          class="flex flex-col gap-4"
          @submit.prevent="saveEmail"
        >
          <FormSection
            title="Consent and opt-out"
            description="How addresses enter the sendable set, and how fans leave it."
          >
            <FormField
              label="Double opt-in"
              hint="A new address confirms by email before anything else is sent to it."
            >
              <q-toggle
                v-model="emailForm.doubleOptIn"
                dense
                label="Require confirmation"
                class="text-sm text-ink"
              />
            </FormField>

            <FormField
              label="Unsubscribe footer"
              hint="Appended to every email. Turning this off is a compliance decision, not a styling one."
            >
              <q-toggle
                v-model="emailForm.unsubscribeFooterEnabled"
                dense
                label="Append an unsubscribe link"
                class="text-sm text-ink"
              />
            </FormField>

            <DefinitionList :items="emailConsentFacts" :columns="1">
              <template #value-opt-out-attribute="{ item }">
                <router-link
                  :to="{ name: 'attributes' }"
                  class="font-mono text-sm font-medium text-brand hover:underline"
                  >{{ item.value }}</router-link
                >
              </template>
            </DefinitionList>
          </FormSection>

          <FormSection
            title="Tracking"
            description="What is measured on a delivered email. Both feed the rates on the campaign list."
          >
            <FormField label="Opens">
              <q-toggle
                v-model="emailForm.trackOpens"
                dense
                label="Track opens"
                class="text-sm text-ink"
              />
            </FormField>

            <FormField label="Clicks">
              <q-toggle
                v-model="emailForm.trackClicks"
                dense
                label="Track link clicks"
                class="text-sm text-ink"
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Sending window"
            description="Outside this window, email is queued rather than sent."
          >
            <FormField
              label="Opens at"
              required
              for-id="email-window-start"
              :error="emailErrors.start"
              hint="24-hour time."
            >
              <input
                id="email-window-start"
                v-model="emailForm.start"
                type="text"
                placeholder="08:00"
                class="h-9 w-40 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
              />
            </FormField>

            <FormField
              label="Closes at"
              required
              for-id="email-window-end"
              :error="emailErrors.end"
              :hint="`Times are read in ${emailTimezone}.`"
            >
              <input
                id="email-window-end"
                v-model="emailForm.end"
                type="text"
                placeholder="21:00"
                class="h-9 w-40 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
              />
            </FormField>
          </FormSection>

          <div class="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              :disabled="!emailDirty"
              class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              Save email defaults
            </button>
            <button
              type="button"
              :disabled="!emailDirty"
              class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill disabled:opacity-50"
              @click="seedEmail"
            >
              Discard
            </button>
            <p class="text-xs text-subtle"
              >Nothing is persisted yet. There is no backend behind this
              form.</p
            >
          </div>
        </form>

        <CardPanel v-else-if="tab === 'whatsapp'">
          <template #header>
            <span class="text-sm font-semibold text-ink"
              >WhatsApp Business account</span
            >
            <StatusBadge
              tone="neutral"
              :label="`${whatsapp.templatesApproved ?? 0} templates approved`"
            />
          </template>

          <DefinitionList :items="whatsappFacts" :columns="1">
            <template #value-account-id>
              <ChannelSecretValue
                :value="whatsapp.accountId ?? ''"
                @copied="notifyLocal('Account ID copied')"
                @copy-failed="notifyLocal('Your browser blocked the clipboard')"
              />
            </template>

            <template #value-opt-out-attribute="{ item }">
              <router-link
                :to="{ name: 'attributes' }"
                class="font-mono text-sm font-medium text-brand hover:underline"
                >{{ item.value }}</router-link
              >
            </template>
          </DefinitionList>

          <template #footer>
            <p class="text-xs text-subtle"
              >Message templates are approved by the provider, not here.</p
            >
          </template>
        </CardPanel>

        <NoticeBanner
          v-else-if="tab === 'push'"
          tone="info"
          title="Push has no channel-level defaults"
          message="Quiet hours and frequency caps apply to push from the module-level Engage settings instead."
        />

        <NoticeBanner
          tone="info"
          title="Provider credentials live in Secrets"
          message="No API key, token or signing key is stored on this screen. A transport only holds the identity it sends as."
        >
          <router-link
            :to="{ name: 'secrets' }"
            class="text-sm font-medium text-brand hover:underline"
            >Open Secrets</router-link
          >
        </NoticeBanner>
      </div>
    </template>
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import TabNav from '@/components/ui/TabNav.vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import FormSection from '@/components/ui/FormSection.vue'
import FormField from '@/components/ui/FormField.vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ChannelTransportCard from '@/components/engage/channels/ChannelTransportCard.vue'
import ChannelSecretValue from '@/components/engage/channels/ChannelSecretValue.vue'
import {
  CHANNELS,
  channelLabel,
  timeError,
  useEngageChannelsSettings
} from '@/composables/useEngageChannels'
import { formatCount } from '@/composables/useEngageChannelsFormat'

const router = useRouter()
const $q = useQuasar()

// The configuration record is the PRIMARY resource: transports, per-channel
// defaults and the module-level rules all come out of the one file.
const {
  settings,
  transports,
  hasSettings,
  loading,
  error,
  load,
  patchSection,
  setDefaultTransport
} = useEngageChannelsSettings()

const tab = ref('email')

const tabs = computed(() =>
  CHANNELS.map(c => ({
    key: c.value,
    label: c.label,
    count: transports.value.filter(t => t.channel === c.value).length
  }))
)

const tabTransports = computed(() =>
  transports.value.filter(t => t.channel === tab.value)
)

const unverified = computed(() =>
  tabTransports.value.filter(t => !t.isVerified || t.status === 'needs_setup')
)

const email = computed(() => settings.value?.email ?? {})
const whatsapp = computed(() => settings.value?.whatsapp ?? {})
const emailTimezone = computed(
  () => email.value?.sendingWindow?.timezone ?? 'UTC'
)

const emailForm = reactive({
  doubleOptIn: false,
  unsubscribeFooterEnabled: true,
  trackOpens: true,
  trackClicks: true,
  start: '',
  end: ''
})

const emailErrors = reactive({ start: '', end: '' })

// The form is seeded from the loaded record and re-seeded whenever it changes,
// which is also what makes Discard and a successful save reset `dirty`.
function seedEmail() {
  const e = email.value
  emailForm.doubleOptIn = Boolean(e.doubleOptIn)
  emailForm.unsubscribeFooterEnabled = Boolean(e.unsubscribeFooterEnabled)
  emailForm.trackOpens = Boolean(e.trackOpens)
  emailForm.trackClicks = Boolean(e.trackClicks)
  emailForm.start = e.sendingWindow?.start ?? ''
  emailForm.end = e.sendingWindow?.end ?? ''
  emailErrors.start = ''
  emailErrors.end = ''
}

watch(email, seedEmail, { immediate: true })

const emailDirty = computed(() => {
  const e = email.value
  return (
    emailForm.doubleOptIn !== Boolean(e.doubleOptIn) ||
    emailForm.unsubscribeFooterEnabled !==
      Boolean(e.unsubscribeFooterEnabled) ||
    emailForm.trackOpens !== Boolean(e.trackOpens) ||
    emailForm.trackClicks !== Boolean(e.trackClicks) ||
    emailForm.start !== (e.sendingWindow?.start ?? '') ||
    emailForm.end !== (e.sendingWindow?.end ?? '')
  )
})

const emailConsentFacts = computed(() => [
  {
    label: 'Opt-out attribute',
    value: email.value?.unsubscribeAttributeId,
    hint: 'A fan carrying this attribute is skipped by every email send.'
  }
])

const whatsappFacts = computed(() => [
  {
    label: 'Account ID',
    value: whatsapp.value?.accountId,
    hint: 'The provider account messages are billed against.'
  },
  {
    label: 'Approved templates',
    value: formatCount(whatsapp.value?.templatesApproved)
  },
  {
    label: 'Pending approval',
    value: formatCount(whatsapp.value?.templatesPending)
  },
  {
    label: 'Opt-out attribute',
    value: whatsapp.value?.unsubscribeAttributeId
  }
])

// Nothing here persists — say so in the toast rather than implying a save.
function notifyLocal(message) {
  $q.notify({
    message,
    caption: 'Local preview only. No backend is connected yet.',
    color: 'dark',
    timeout: 2500
  })
}

function validateEmail() {
  emailErrors.start = timeError(emailForm.start)
  emailErrors.end = timeError(emailForm.end)
  if (
    !emailErrors.start &&
    !emailErrors.end &&
    emailForm.start === emailForm.end
  ) {
    emailErrors.end = 'The window has to be longer than nothing.'
  }
  return !emailErrors.start && !emailErrors.end
}

function saveEmail() {
  if (!validateEmail()) return
  // Local state only. The watcher above re-seeds from this, which is what
  // settles the form back to clean without pretending a PUT happened.
  patchSection('email', {
    doubleOptIn: emailForm.doubleOptIn,
    unsubscribeFooterEnabled: emailForm.unsubscribeFooterEnabled,
    trackOpens: emailForm.trackOpens,
    trackClicks: emailForm.trackClicks,
    sendingWindow: {
      ...email.value?.sendingWindow,
      start: emailForm.start,
      end: emailForm.end
    }
  })
  notifyLocal('Email defaults updated')
}

function makeDefault(transport) {
  setDefaultTransport(transport.id)
  notifyLocal(
    `${transport.label} is now the default ${channelLabel(
      transport.channel
    )} transport`
  )
}

onMounted(load)
</script>
