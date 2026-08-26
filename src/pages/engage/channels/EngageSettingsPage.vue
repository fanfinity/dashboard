<template>
  <q-page class="p-6">
    <PageHeader
      title="Engage settings"
      subtitle="Module-level rules every campaign, journey and channel obeys — how much the operator may do on its own, and how often a fan may be messaged."
    >
      <template #actions>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'channels-settings' })"
        >
          Channel settings
        </button>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'engage-operator-work-log' })"
        >
          Work log
        </button>
      </template>
    </PageHeader>

    <LoadingState v-if="loading" variant="form" :rows="6" />

    <ErrorState
      v-else-if="error"
      title="Couldn't load the Engage settings."
      :message="error"
      @retry="load"
    />

    <!-- The load succeeded and there is no configuration record. That is an
         answer, not a failure, so it must not render ErrorState. -->
    <EmptyState
      v-else-if="!hasSettings"
      title="Engage is not configured"
      description="This workspace has no Engage configuration yet. Connect a channel transport and the module rules appear here."
    >
      <template #cta>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="router.push({ name: 'channels-settings' })"
        >
          Open channel settings
        </button>
      </template>
    </EmptyState>

    <template v-else>
      <TabNav v-model="tab" :tabs="tabs" />

      <div class="flex max-w-3xl flex-col gap-4">
        <form
          v-if="tab === 'operator'"
          class="flex flex-col gap-4"
          @submit.prevent="saveOperator"
        >
          <NoticeBanner
            tone="info"
            title="The operator proposes; a human decides"
            message="Every proposal and every applied change lands in the work log with the fan-facing effect spelled out."
          >
            <router-link
              :to="{ name: 'engage-operator-work-log' }"
              class="text-sm font-medium text-brand hover:underline"
              >Open the work log</router-link
            >
          </NoticeBanner>

          <FormSection
            title="Operating mode"
            description="How much the operator may change without being asked."
          >
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SelectableCard
                v-for="mode in OPERATOR_MODES"
                :key="mode.value"
                :selected="operatorForm.mode === mode.value"
                @select="operatorForm.mode = mode.value"
              >
                <div class="flex w-full items-start justify-between gap-2">
                  <span class="text-sm font-medium text-ink">{{
                    mode.label
                  }}</span>
                  <StatusBadge
                    v-if="operatorForm.mode === mode.value"
                    tone="brand"
                    label="Selected"
                  />
                </div>
                <p class="mt-1.5 text-xs leading-5 text-muted">{{
                  mode.description
                }}</p>
              </SelectableCard>
            </div>
          </FormSection>

          <FormSection
            title="Approval and notification"
            description="What autopilot may apply unattended, and where the team hears about it."
          >
            <FormField
              label="Auto-approve at or below"
              :hint="approvalHint"
              :error="operatorErrors.autoApproveBelowRisk"
            >
              <q-select
                v-model="operatorForm.autoApproveBelowRisk"
                dense
                outlined
                emit-value
                map-options
                options-dense
                :disable="operatorForm.mode !== 'autopilot'"
                :options="riskOptions"
                class="max-w-xs bg-white"
              />
            </FormField>

            <FormField
              label="Notify channel"
              required
              for-id="operator-notify"
              hint="Where proposals and applied changes are announced."
              :error="operatorErrors.notifyChannel"
            >
              <input
                id="operator-notify"
                v-model="operatorForm.notifyChannel"
                type="text"
                placeholder="#engage-ops"
                class="h-9 max-w-xs rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
              />
            </FormField>
          </FormSection>

          <div class="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              :disabled="!operatorDirty"
              class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              Save automation
            </button>
            <button
              type="button"
              :disabled="!operatorDirty"
              class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill disabled:opacity-50"
              @click="seedOperator"
            >
              Discard
            </button>
            <p class="text-xs text-subtle"
              >Nothing is persisted yet — there is no backend behind this
              form.</p
            >
          </div>
        </form>

        <form
          v-else-if="tab === 'limits'"
          class="flex flex-col gap-4"
          @submit.prevent="saveLimits"
        >
          <FormSection
            title="Frequency cap"
            description="The ceiling on how often one fan hears from you, counted across every channel."
          >
            <FormField
              label="Capping"
              hint="With capping off, a fan can be enrolled in every journey at once."
            >
              <q-toggle
                v-model="limitsForm.enabled"
                dense
                label="Cap messages per fan"
                class="text-sm text-ink"
              />
            </FormField>

            <FormField
              label="Maximum messages a week"
              required
              for-id="limits-max"
              :error="limitsErrors.max"
              hint="Counted per fan, Monday to Sunday."
            >
              <input
                id="limits-max"
                v-model="limitsForm.max"
                type="number"
                :min="CAP_MIN"
                :max="CAP_MAX"
                :disabled="!limitsForm.enabled"
                class="h-9 w-40 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle disabled:opacity-50"
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Quiet hours"
            description="Messages due inside this window are held until it closes. It may run over midnight."
          >
            <FormField
              label="Starts at"
              required
              for-id="limits-quiet-start"
              :error="limitsErrors.start"
              hint="24-hour time."
            >
              <input
                id="limits-quiet-start"
                v-model="limitsForm.start"
                type="text"
                placeholder="22:00"
                class="h-9 w-40 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
              />
            </FormField>

            <FormField
              label="Ends at"
              required
              for-id="limits-quiet-end"
              :error="limitsErrors.end"
              :hint="`Times are read in ${quietTimezone}.`"
            >
              <input
                id="limits-quiet-end"
                v-model="limitsForm.end"
                type="text"
                placeholder="07:00"
                class="h-9 w-40 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
              />
            </FormField>
          </FormSection>

          <NoticeBanner
            tone="warn"
            title="Quiet hours do not hold transactional mail"
            message="Ticket confirmations and password resets are sent regardless — only campaign and journey messages wait."
          />

          <div class="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              :disabled="!limitsDirty"
              class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              Save delivery limits
            </button>
            <button
              type="button"
              :disabled="!limitsDirty"
              class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill disabled:opacity-50"
              @click="seedLimits"
            >
              Discard
            </button>
            <p class="text-xs text-subtle"
              >Nothing is persisted yet — there is no backend behind this
              form.</p
            >
          </div>
        </form>

        <CardPanel v-else>
          <template #header>
            <span class="text-sm font-semibold text-ink"
              >Consent and opt-out</span
            >
            <router-link
              :to="{ name: 'channels-settings' }"
              class="text-sm font-medium text-brand hover:underline"
              >Edit per channel</router-link
            >
          </template>

          <!-- Read-only on purpose: consent is set per channel, and a second
               place to change it is a second place to get it wrong. -->
          <EmptyState
            v-if="!consentFacts.length"
            variant="inline"
            title="No channel has consent rules yet"
            description="Connect a transport and its opt-out handling appears here."
          />

          <DefinitionList v-else :items="consentFacts" :columns="1">
            <template #value-email-opt-out-attribute="{ item }">
              <router-link
                :to="{ name: 'attributes' }"
                class="font-mono text-sm font-medium text-brand hover:underline"
                >{{ item.value }}</router-link
              >
            </template>

            <template #value-whatsapp-opt-out-attribute="{ item }">
              <router-link
                :to="{ name: 'attributes' }"
                class="font-mono text-sm font-medium text-brand hover:underline"
                >{{ item.value }}</router-link
              >
            </template>
          </DefinitionList>

          <template #footer>
            <p class="text-xs text-subtle"
              >An opt-out is honoured across every campaign and journey, and it
              is never cleared by a re-import.</p
            >
          </template>
        </CardPanel>
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
import SelectableCard from '@/components/ui/SelectableCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import {
  CAP_MAX,
  CAP_MIN,
  OPERATOR_MODES,
  RISK_LEVELS,
  capError,
  notifyChannelError,
  timeError,
  useEngageChannelsSettings
} from '@/composables/useEngageChannels'

const router = useRouter()
const $q = useQuasar()

// Same PRIMARY record as /channels/settings, read at a different altitude: this
// screen owns the module-level rules, that one owns the per-channel ones, and
// neither renders the other's fields.
const { settings, hasSettings, loading, error, load, patchSection } =
  useEngageChannelsSettings()

const tab = ref('operator')

const tabs = [
  { key: 'operator', label: 'Automation' },
  { key: 'limits', label: 'Delivery limits' },
  { key: 'consent', label: 'Consent' }
]

const riskOptions = RISK_LEVELS.map(r => ({ label: r.label, value: r.value }))

const operator = computed(() => settings.value?.operator ?? {})
const capping = computed(() => settings.value?.frequencyCapping ?? {})
const email = computed(() => settings.value?.email ?? {})
const whatsapp = computed(() => settings.value?.whatsapp ?? {})

const quietTimezone = computed(
  () => capping.value?.quietHours?.timezone ?? 'UTC'
)

const operatorForm = reactive({
  mode: 'propose',
  autoApproveBelowRisk: 'low',
  notifyChannel: ''
})

const operatorErrors = reactive({
  autoApproveBelowRisk: '',
  notifyChannel: ''
})

const limitsForm = reactive({
  enabled: false,
  max: '',
  start: '',
  end: ''
})

const limitsErrors = reactive({ max: '', start: '', end: '' })

// Both forms are seeded from the loaded record and re-seeded whenever it
// changes, which is what makes Discard and a successful save reset `dirty`.
function seedOperator() {
  operatorForm.mode = operator.value?.mode ?? 'propose'
  operatorForm.autoApproveBelowRisk =
    operator.value?.autoApproveBelowRisk ?? 'low'
  operatorForm.notifyChannel = operator.value?.notifyChannel ?? ''
  operatorErrors.autoApproveBelowRisk = ''
  operatorErrors.notifyChannel = ''
}

function seedLimits() {
  limitsForm.enabled = Boolean(capping.value?.enabled)
  limitsForm.max = String(capping.value?.maxMessagesPerFanPerWeek ?? '')
  limitsForm.start = capping.value?.quietHours?.start ?? ''
  limitsForm.end = capping.value?.quietHours?.end ?? ''
  limitsErrors.max = ''
  limitsErrors.start = ''
  limitsErrors.end = ''
}

watch(operator, seedOperator, { immediate: true })
watch(capping, seedLimits, { immediate: true })

const operatorDirty = computed(
  () =>
    operatorForm.mode !== (operator.value?.mode ?? 'propose') ||
    operatorForm.autoApproveBelowRisk !==
      (operator.value?.autoApproveBelowRisk ?? 'low') ||
    operatorForm.notifyChannel !== (operator.value?.notifyChannel ?? '')
)

const limitsDirty = computed(
  () =>
    limitsForm.enabled !== Boolean(capping.value?.enabled) ||
    limitsForm.max !== String(capping.value?.maxMessagesPerFanPerWeek ?? '') ||
    limitsForm.start !== (capping.value?.quietHours?.start ?? '') ||
    limitsForm.end !== (capping.value?.quietHours?.end ?? '')
)

const approvalHint = computed(() =>
  operatorForm.mode === 'autopilot'
    ? 'Anything riskier than this waits for a human in the work log.'
    : 'Only applies on autopilot — in Propose mode every change waits for a human.'
)

const consentFacts = computed(() => {
  const facts = []
  if (Object.keys(email.value).length) {
    facts.push(
      {
        label: 'Email double opt-in',
        value: email.value.doubleOptIn ? 'Required' : 'Not required'
      },
      {
        label: 'Email unsubscribe footer',
        value: email.value.unsubscribeFooterEnabled ? 'Appended' : 'Off'
      },
      {
        label: 'Email opt-out attribute',
        value: email.value.unsubscribeAttributeId
      }
    )
  }
  if (Object.keys(whatsapp.value).length) {
    facts.push({
      label: 'WhatsApp opt-out attribute',
      value: whatsapp.value.unsubscribeAttributeId
    })
  }
  return facts
})

// Nothing here persists — say so in the toast rather than implying a save.
function notifyLocal(message) {
  $q.notify({
    message,
    caption: 'Local preview only — no backend is connected yet.',
    color: 'dark',
    timeout: 2500
  })
}

function saveOperator() {
  operatorErrors.notifyChannel =
    operatorForm.mode === 'off'
      ? ''
      : notifyChannelError(operatorForm.notifyChannel)
  operatorErrors.autoApproveBelowRisk =
    operatorForm.mode === 'autopilot' && !operatorForm.autoApproveBelowRisk
      ? 'Pick the highest risk autopilot may apply on its own.'
      : ''
  if (operatorErrors.notifyChannel || operatorErrors.autoApproveBelowRisk) {
    return
  }

  // Local state only. The watcher above re-seeds from this, which settles the
  // form back to clean without pretending a PUT happened.
  patchSection('operator', {
    mode: operatorForm.mode,
    autoApproveBelowRisk: operatorForm.autoApproveBelowRisk,
    notifyChannel: operatorForm.notifyChannel.trim()
  })
  notifyLocal('Operator automation updated')
}

function saveLimits() {
  limitsErrors.max = limitsForm.enabled ? capError(limitsForm.max) : ''
  limitsErrors.start = timeError(limitsForm.start)
  limitsErrors.end = timeError(limitsForm.end)
  if (
    !limitsErrors.start &&
    !limitsErrors.end &&
    limitsForm.start === limitsForm.end
  ) {
    limitsErrors.end = 'Quiet hours have to cover some time.'
  }
  if (limitsErrors.max || limitsErrors.start || limitsErrors.end) return

  patchSection('frequencyCapping', {
    enabled: limitsForm.enabled,
    maxMessagesPerFanPerWeek: Number(limitsForm.max),
    quietHours: {
      ...capping.value?.quietHours,
      start: limitsForm.start,
      end: limitsForm.end
    }
  })
  notifyLocal('Delivery limits updated')
}

onMounted(load)
</script>
