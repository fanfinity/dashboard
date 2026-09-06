<template>
  <q-page class="p-6">
    <PageHeader
      title="Settings"
      subtitle="Workspace identity, data residency and retention, who can sign in, and what can call the API."
    >
      <template #actions>
        <StatusBadge
          v-if="workspace"
          tone="neutral"
          :label="workspace.regionLabel"
        />
      </template>
    </PageHeader>

    <LoadingState v-if="loading" variant="form" :rows="6" />

    <ErrorState
      v-else-if="error"
      title="Couldn't load the workspace settings."
      :message="error"
      @retry="load"
    />

    <template v-else>
      <!-- The tab bar itself must not depend on `workspace` loading: General,
           Feature activation and Data source are per-browser preferences, not
           workspace data, and Data source is the one screen that must stay
           reachable even when everything workspace-shaped is empty — it is the
           way back to demo data. -->
      <TabNav v-model="tab" :tabs="tabs" />

      <!-- General used to lead with a role picker — engineer / marketer /
           analyst — whose answer ordered the sidebar and the dashboard's blocks.
           Both orderings are gone (see CLAUDE.md), so the control was a question
           with no consequence, and it went with them. What is left is the
           workspace form, which is a workspace record like every tab below and
           is gated on one loading. -->
      <div v-if="tab === 'general'" class="flex max-w-3xl flex-col gap-4">
        <form
          v-if="workspace"
          class="flex flex-col gap-4"
          @submit.prevent="save"
        >
          <FormSection
            title="Workspace"
            description="How this workspace is named, and where its data physically lives."
          >
            <FormField
              label="Name"
              required
              for-id="workspace-name"
              :error="errors.name"
              hint="Shown in the sidebar and on every export."
            >
              <input
                id="workspace-name"
                v-model="form.name"
                type="text"
                placeholder="Sfere"
                class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
              />
            </FormField>

            <DefinitionList :items="workspaceFacts" :columns="2" />
          </FormSection>

          <FormSection
            title="Data retention"
            description="How long each class of data is kept before it is deleted automatically."
          >
            <FormField
              v-for="field in RETENTION_FIELDS"
              :key="field.key"
              :label="field.label"
              required
              :for-id="`retention-${field.key}`"
              :error="errors[field.key]"
              :hint="retentionHint(field)"
            >
              <input
                :id="`retention-${field.key}`"
                v-model="form[field.key]"
                type="number"
                :min="RETENTION_MIN_DAYS"
                :max="RETENTION_MAX_DAYS"
                class="h-9 w-40 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Identity resolution"
            description="How separate signals are folded into one fan. Changing these is a migration, not a setting. Talk to support first."
          >
            <DefinitionList :items="identityFacts" :columns="2" />
          </FormSection>

          <div class="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              :disabled="!dirty"
              class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              Save changes
            </button>
            <button
              type="button"
              :disabled="!dirty"
              class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill disabled:opacity-50"
              @click="seed"
            >
              Discard
            </button>
            <p class="text-xs text-subtle"
              >Nothing is persisted yet. There is no backend behind this
              form.</p
            >
          </div>
        </form>

        <!-- Workspace data too, so it goes when the form does: an empty alert
             list with no workspace behind it would read as "nobody is being
             told when a pipe fails", which is a measurement nothing took. -->
        <CardPanel v-if="workspace">
          <template #header>
            <span class="text-sm font-semibold text-ink">Error alerts</span>
            <StatusBadge tone="neutral" :label="String(alertChannels.length)" />
          </template>

          <EmptyState
            v-if="!alertChannels.length"
            variant="inline"
            title="No alert channels"
            description="Add a Slack or Teams webhook to be told when a pipe starts failing."
          />

          <ul v-else class="flex flex-col divide-y divide-line">
            <li
              v-for="channel in alertChannels"
              :key="channel.id"
              class="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="truncate text-sm font-medium text-ink">{{
                    channel.label
                  }}</p>
                  <StatusBadge tone="neutral" :label="channel.kind" />
                  <StatusBadge
                    :tone="channel.isEnabled ? 'success' : 'neutral'"
                    :label="channel.isEnabled ? 'Enabled' : 'Paused'"
                  />
                </div>
                <code
                  class="mt-1 block truncate font-mono text-xs text-subtle"
                  >{{ channel.url }}</code
                >
              </div>

              <StatusBadge tone="warn" :label="`≥ ${channel.minSeverity}`" />
            </li>
          </ul>

          <template #footer>
            <p class="text-xs text-subtle"
              >Webhook URLs are stored with their token segment redacted, so the
              part shown here is all there is to show.</p
            >
          </template>
        </CardPanel>

        <!-- LAST, and outside the `workspace` gate above it on purpose. The
             onboarding record is a per-account preference like Feature
             activation and Data source, not workspace data, so it is the one
             thing on this tab that has something to show in the default real
             mode — where `settings` has no endpoint and both blocks above
             render nothing. It goes at the bottom because restarting the
             welcome is an occasional errand, not what the tab is about. -->
        <SettingsOnboardingPanel />
      </div>

      <SettingsFeaturePanel v-else-if="tab === 'features'" />

      <SettingsDataSourcePanel v-else-if="tab === 'data-source'" />

      <!-- Two former sidebar rows, now tabs. Each is gated on its own feature
           key, the same one that used to decide whether its route rendered
           ComingSoonPanel — so switching `secrets` off in Feature activation
           still takes the surface away, it just takes a tab rather than a row. -->
      <SettingsAuthorizationsPanel v-else-if="tab === 'authorizations'" />

      <SettingsSecretsPanel v-else-if="tab === 'secrets'" />

      <SettingsMembersPanel
        v-else-if="tab === 'members'"
        :members="members"
        :pending="pending"
        :loading="membersLoading"
        :error="membersError"
        @retry="loadMembers"
        @remove="askRemoveMember"
        @revoke-invite="askRevokeInvite"
        @invite="inviteMember"
      />

      <SettingsApiTokensPanel
        v-else-if="tab === 'tokens'"
        :tokens="tokens"
        :loading="tokensLoading"
        :error="tokensError"
        :api-missing="tokensApiMissing"
        @retry="loadTokens"
        @revoke="askRevokeToken"
        @create="openTokenCreate"
      />

      <SettingsIngestDomainsPanel
        v-else-if="tab === 'domains'"
        :domains="domains"
        :loading="domainsLoading"
        :error="domainsError"
        :api-missing="domainsApiMissing"
        :selected="selectedDomain"
        :creating="domainCreating"
        :verifying="verifyingDomainId"
        @retry="loadDomains"
        @create="onCreateDomain"
        @verify="onVerifyDomain"
        @remove="onRemoveDomain"
        @show-records="row => (selectedDomainId = row.id)"
        @close-records="selectedDomainId = ''"
      />

      <SettingsNotificationsPanel
        v-else-if="tab === 'notifications'"
        :channels="channels"
        :loading="channelsLoading"
        :error="channelsError"
        :api-missing="channelsApiMissing"
        :testing="testingChannelId"
        @retry="loadChannels"
        @create="openChannelCreate"
        @edit="openChannelEdit"
        @test="onTestChannel"
        @toggle="onToggleChannel"
        @remove="onRemoveChannel"
      />

      <SettingsConnectorImagesPanel
        v-else-if="tab === 'images'"
        :images="images"
        :loading="imagesLoading"
        :error="imagesError"
        :api-missing="imagesApiMissing"
        :has-pending="imagesPending"
        :creating="imageCreating"
        @retry="loadImages"
        @create="onCreateImage"
        @remove="onRemoveImage"
      />

      <SettingsDangerZone
        v-else-if="tab === 'danger' && workspace"
        :workspace-name="workspace.name"
        :region-label="workspace.regionLabel"
        @purge="askPurgeEvents"
        @delete="askDeleteWorkspace"
      />
    </template>

    <!-- One dialog for every destructive action on the screen: each `ask*`
         hands it the copy and the thing to run on confirm. -->
    <ConfirmDialog
      v-model="confirmOpen"
      :title="pendingAction?.title ?? 'Are you sure?'"
      :message="pendingAction?.message ?? ''"
      :confirm-label="pendingAction?.confirmLabel ?? 'Confirm'"
      destructive
      @confirm="runPendingAction"
    />

    <SettingsNotificationChannelDialog
      v-model="channelDialogOpen"
      :channel="editingChannel"
      :submitting="channelSubmitting"
      :api-missing="!isReal"
      @submit="onSubmitChannel"
    />

    <SettingsApiTokenCreateDialog
      v-model="tokenCreateOpen"
      :api-missing="!isReal"
      :submitting="tokenSubmitting"
      @create="createToken"
    />

    <!-- The created token, shown once. Separate from the create dialog on
         purpose: `POST …/api-tokens` returns the plaintext on that one response
         and the backend stores only a hash, so this is the single moment it
         exists anywhere the user can reach. -->
    <SecretRevealDialog
      v-model="tokenRevealOpen"
      :secret="newTokenPlaintext"
      title="Copy your API token now"
      :subtitle="`“${newTokenName}” is live. Paste it into whatever is going to call the API.`"
      label="API token"
      @close="onTokenRevealClosed"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import TabNav from '@/components/ui/TabNav.vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import FormSection from '@/components/ui/FormSection.vue'
import FormField from '@/components/ui/FormField.vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SettingsMembersPanel from '@/components/settings/SettingsMembersPanel.vue'
import SettingsApiTokensPanel from '@/components/settings/SettingsApiTokensPanel.vue'
import SettingsApiTokenCreateDialog from '@/components/settings/SettingsApiTokenCreateDialog.vue'
import SettingsIngestDomainsPanel from '@/components/settings/SettingsIngestDomainsPanel.vue'
import SettingsNotificationsPanel from '@/components/settings/SettingsNotificationsPanel.vue'
import SettingsNotificationChannelDialog from '@/components/settings/SettingsNotificationChannelDialog.vue'
import SettingsConnectorImagesPanel from '@/components/settings/SettingsConnectorImagesPanel.vue'
import { useIngestDomains } from '@/composables/useIngestDomains'
import { useNotificationChannels } from '@/composables/useNotificationChannels'
import { useConnectorImages } from '@/composables/useConnectorImages'
import SecretRevealDialog from '@/components/ui/SecretRevealDialog.vue'
import { useApiTokens } from '@/composables/useApiTokens'
import { notifyMutationResult } from '@/composables/useMutationFeedback'
import SettingsDangerZone from '@/components/settings/SettingsDangerZone.vue'
import SettingsFeaturePanel from '@/components/settings/SettingsFeaturePanel.vue'
import SettingsOnboardingPanel from '@/components/settings/SettingsOnboardingPanel.vue'
import SettingsAuthorizationsPanel from '@/components/settings/SettingsAuthorizationsPanel.vue'
import SettingsSecretsPanel from '@/components/settings/SettingsSecretsPanel.vue'
import SettingsDataSourcePanel from '@/components/settings/SettingsDataSourcePanel.vue'
import { useFeatures } from '@/composables/useFeatures'
import { useDataSource } from '@/composables/useDataSource'
import { formatDate, formatDays } from '@/composables/useSettingsFormat'
import {
  RETENTION_MAX_DAYS,
  RETENTION_MIN_DAYS,
  retentionError,
  useSettingsMembers,
  useSettingsWorkspace
} from '@/composables/useSettingsWorkspace'

const $q = useQuasar()
const route = useRoute()
const router = useRouter()

// The workspace record is the PRIMARY resource: without it there is no screen,
// so its failure is the only one that escalates to a page-level ErrorState.
const { settings, workspace, loading, error, load } = useSettingsWorkspace()

// Members and tokens are secondary — each fills one tab, carries its own
// loading/error and retries in place.
const {
  members,
  pending,
  loading: membersLoading,
  error: membersError,
  load: loadMembers,
  removeMember,
  revokeInvite
} = useSettingsMembers()

const {
  tokens,
  loading: tokensLoading,
  error: tokensError,
  apiMissing: tokensApiMissing,
  load: loadTokens,
  create: createTokenRequest,
  revoke: revokeToken
} = useApiTokens()

// Seeded from ?tab= so the /secrets and /authorizations redirects land on the
// right panel. Validated against `tabs` by the watcher below, which also catches
// a tab that is not offered in this mode.
const tab = ref(
  typeof route.query.tab === 'string' ? route.query.tab : 'general'
)
const confirmOpen = ref(false)
const pendingAction = ref(null)

const RETENTION_FIELDS = [
  {
    key: 'rawEventDays',
    label: 'Raw events (days)',
    hint: 'Every event as collected. Resolved profiles outlive this window.'
  },
  {
    key: 'errorLogDays',
    label: 'Error logs (days)',
    hint: 'Delivery failures and function errors kept for debugging.'
  },
  {
    key: 'profileInactivityDays',
    label: 'Profile inactivity (days)',
    hint: 'A profile with no new signal for this long is deleted.'
  }
]

const form = reactive({
  name: '',
  rawEventDays: '',
  errorLogDays: '',
  profileInactivityDays: ''
})

const errors = reactive({
  name: '',
  rawEventDays: '',
  errorLogDays: '',
  profileInactivityDays: ''
})

const retention = computed(() => settings.value?.retention ?? {})

// The saved window, spelled out next to the field being edited — otherwise a
// half-typed number is the only thing on screen and there is nothing to
// compare it against.
function retentionHint(field) {
  const current = retention.value?.[field.key]
  if (current === undefined || current === null) return field.hint
  return `${field.hint} Saved: ${formatDays(current)}.`
}

// The form is seeded from the loaded record and re-seeded whenever it changes,
// which is also what makes Discard and a successful save reset `dirty`.
function seed() {
  form.name = workspace.value?.name ?? ''
  for (const field of RETENTION_FIELDS) {
    form[field.key] = String(retention.value?.[field.key] ?? '')
  }
  for (const key of Object.keys(errors)) errors[key] = ''
}

watch(settings, seed, { immediate: true })

const dirty = computed(() => {
  if (form.name !== (workspace.value?.name ?? '')) return true
  return RETENTION_FIELDS.some(
    field => form[field.key] !== String(retention.value?.[field.key] ?? '')
  )
})

// Only the count is needed here — the panel itself reads the registry.
// `isActive` is the other half: two tabs below are former sidebar rows and keep
// the feature key that used to gate their route.
const { activeCount, isActive: isFeatureActive } = useFeatures()
const { isReal } = useDataSource()
const dataSourceLabel = computed(() => {
  if (isReal.value) return 'Data source (Real)'
  return 'Data source (Demo)'
})

// Whether the workspace-shaped tabs are worth offering at all.
//
// Nothing behind Members, API tokens, Ingest domains, Notifications, Connector
// images or Danger zone has a workspace endpoint yet, so in the default real mode
// every one of them opened on "No workspace settings — ask an admin to add you to
// one": six tabs, one answer, and an answer that blames the reader for a missing
// backend. Demo data is the mode where they have something to show, so that is
// the mode that offers them.
//
// Written as "demo, OR a workspace actually loaded" rather than "demo" alone so
// the day a real workspace endpoint ships the tabs come back on their own instead
// of staying hidden behind a mode switch nobody remembers to remove.
const hasWorkspaceTabs = computed(
  () => !isReal.value || Boolean(workspace.value)
)

const workspaceFacts = computed(() => [
  { label: 'Workspace ID', value: workspace.value?.id },
  { label: 'Slug', value: workspace.value?.slug },
  {
    label: 'Region',
    value: `${workspace.value?.regionLabel} (${workspace.value?.region})`,
    hint: 'Data residency is fixed when the workspace is created.'
  },
  { label: 'Time zone', value: workspace.value?.timezone },
  { label: 'Created', value: formatDate(workspace.value?.createdAt) }
])

const identityFacts = computed(() => {
  const ir = settings.value?.identityResolution ?? {}
  return [
    { label: 'Strategy', value: ir.strategy },
    {
      label: 'Merge on shared email',
      value: ir.mergeOnSharedEmail ? 'Yes' : 'No'
    },
    {
      label: 'Merge on shared phone',
      value: ir.mergeOnSharedPhone ? 'Yes' : 'No'
    },
    { label: 'Max identifiers per profile', value: ir.maxIdentifiersPerProfile }
  ]
})

// Slack and Teams webhooks are the same row shape, so they render as one list
// with the channel named on the row rather than as two half-empty panels.
const alertChannels = computed(() => {
  const alerts = settings.value?.errorAlerts ?? {}
  return [
    ...(alerts.slackWebhooks ?? []).map(w => ({ ...w, kind: 'Slack' })),
    ...(alerts.teamsWebhooks ?? []).map(w => ({ ...w, kind: 'Teams' }))
  ]
})

// Nothing here persists — say so in the toast rather than implying a save.
function notifyLocal(message) {
  $q.notify({
    message,
    caption: 'Local preview only. No backend is connected yet.',
    color: 'dark',
    timeout: 2500
  })
}

function validate() {
  const name = form.name.trim()
  if (!name) errors.name = 'A workspace name is required.'
  else if (name.length > 60) errors.name = 'Keep it under 60 characters.'
  else errors.name = ''

  for (const field of RETENTION_FIELDS) {
    errors[field.key] = retentionError(form[field.key])
  }

  return Object.values(errors).every(e => !e)
}

function save() {
  if (!validate()) return
  // Local state only. The watcher above re-seeds from this, which is what makes
  // the form settle back to clean without pretending a POST happened.
  settings.value = {
    ...settings.value,
    workspace: { ...settings.value.workspace, name: form.name.trim() },
    retention: RETENTION_FIELDS.reduce(
      (acc, field) => ({ ...acc, [field.key]: Number(form[field.key]) }),
      {}
    )
  }
  notifyLocal('Workspace settings updated')
}

function ask(action) {
  pendingAction.value = action
  confirmOpen.value = true
}

function runPendingAction() {
  const action = pendingAction.value
  pendingAction.value = null
  action?.run()
}

function askRemoveMember(member) {
  ask({
    title: 'Remove this member?',
    message: `${member.name} (${member.email}) loses access to the workspace immediately. Their audit history stays.`,
    confirmLabel: 'Remove member',
    run: () => {
      removeMember(member.id)
      notifyLocal(`${member.name} removed`)
    }
  })
}

function askRevokeInvite(invite) {
  ask({
    title: 'Revoke this invitation?',
    message: `The link sent to ${invite.email} stops working. You can invite them again later.`,
    confirmLabel: 'Revoke invite',
    run: () => {
      revokeInvite(invite.id)
      notifyLocal(`Invitation to ${invite.email} revoked`)
    }
  })
}

// Names the one thing the fixture's model got wrong: the backend deletes the
// row rather than marking it revoked, so there is no audit trail afterwards and
// the table has one fewer entry, not one more badge.
function askRevokeToken(token) {
  ask({
    title: 'Delete this token?',
    message: `“${token.name}” stops authenticating immediately, and anything using it starts failing on its next call. The value was only ever shown once and cannot be recovered. The token is deleted rather than marked revoked, so it leaves this list and no record of it is kept.`,
    confirmLabel: 'Delete token',
    run: async () => {
      const res = await revokeToken(token.id)
      notifyMutationResult($q, res, {
        success: `${token.name} deleted`,
        apiMissing: `Can't delete ${token.name} yet.`
      })
    }
  })
}

function askPurgeEvents() {
  ask({
    title: 'Purge raw event history?',
    message:
      'Every raw event collected so far is deleted. Nothing can be re-resolved or re-delivered from history afterwards.',
    confirmLabel: 'Purge raw events',
    run: () => notifyLocal('Raw event purge requested')
  })
}

function askDeleteWorkspace() {
  ask({
    title: 'Delete this workspace?',
    message: `${workspace.value?.name} and everything in it is removed, and every member loses access. This cannot be undone.`,
    confirmLabel: 'Delete workspace',
    run: () => notifyLocal('Workspace deletion requested')
  })
}

function inviteMember() {
  notifyLocal('Member invitations need the accounts backend')
}

// --------------------------------------------- ingest domains, alerts, images

// Three domains backend PR #16 made real. Each keeps its own loading and
// apiMissing so one failing tab does not take the others with it — the same
// reason members and tokens were already split out above.

const {
  domains,
  loading: domainsLoading,
  error: domainsError,
  apiMissing: domainsApiMissing,
  load: loadDomains,
  create: createDomain,
  verify: verifyDomain,
  remove: removeDomain
} = useIngestDomains()

const domainCreating = ref(false)
const verifyingDomainId = ref('')
// Held as an id rather than the row, so the open records panel re-renders from
// the refreshed record after a Re-check instead of showing the pre-verify copy.
const selectedDomainId = ref('')
const selectedDomain = computed(
  () => domains.value.find(d => d.id === selectedDomainId.value) ?? null
)

async function onCreateDomain(domain) {
  domainCreating.value = true
  try {
    const res = await createDomain(domain)
    notifyMutationResult($q, res, {
      success: `${domain} added. Add its DNS records next.`,
      apiMissing: `Can't add ${domain} yet.`
    })
    // Opens the records panel straight away: the DNS records are the whole point
    // of the create response, and burying them behind a second click is how
    // someone leaves thinking the domain is live.
    if (res.ok && !res.skipped) selectedDomainId.value = res.data.id
  } finally {
    domainCreating.value = false
  }
}

async function onVerifyDomain(row) {
  verifyingDomainId.value = row.id
  try {
    const res = await verifyDomain(row.id)
    if (!res.ok) {
      notifyMutationResult($q, res, {
        success: '',
        apiMissing: "Can't re-check a domain yet."
      })
      return
    }
    // Reports what the backend actually said, not "verified". A re-check that
    // still cannot find the records comes back pending or failed, and saying
    // otherwise would send someone away from a broken setup.
    const record = res.data ?? row
    $q.notify({
      message:
        record.status === 'verified'
          ? `${row.domain} is verified`
          : `${row.domain} is still ${record.status}`,
      caption:
        record.status === 'verified'
          ? record.certificateStatus === 'issued'
            ? 'The certificate is issued too, so it is ready to collect.'
            : 'The certificate is still being issued. That usually takes a few minutes.'
          : (record.error ??
            'DNS changes can take a while to propagate. Check the records and try again shortly.'),
      color: 'dark',
      position: 'top-right',
      timeout: 6000
    })
  } finally {
    verifyingDomainId.value = ''
  }
}

async function onRemoveDomain(row) {
  const res = await removeDomain(row.id)
  notifyMutationResult($q, res, {
    success: `${row.domain} removed`,
    apiMissing: `Can't remove ${row.domain} yet.`
  })
  if (res.ok && selectedDomainId.value === row.id) selectedDomainId.value = ''
}

const {
  channels,
  loading: channelsLoading,
  error: channelsError,
  apiMissing: channelsApiMissing,
  load: loadChannels,
  create: createChannel,
  update: updateChannel,
  setEnabled: setChannelEnabled,
  test: testChannel,
  remove: removeChannel
} = useNotificationChannels()

const channelDialogOpen = ref(false)
const editingChannel = ref(null)
const channelSubmitting = ref(false)
const testingChannelId = ref('')

function openChannelCreate() {
  editingChannel.value = null
  channelDialogOpen.value = true
}

function openChannelEdit(row) {
  editingChannel.value = row
  channelDialogOpen.value = true
}

async function onSubmitChannel(payload) {
  channelSubmitting.value = true
  try {
    const res = editingChannel.value
      ? await updateChannel(editingChannel.value.id, {
          ...editingChannel.value,
          ...payload
        })
      : await createChannel(payload)
    notifyMutationResult($q, res, {
      success: editingChannel.value
        ? `${payload.name} saved`
        : `${payload.name} created`,
      apiMissing: "Can't save a notification channel yet."
    })
    if (res.ok) channelDialogOpen.value = false
  } finally {
    channelSubmitting.value = false
  }
}

async function onTestChannel(row) {
  testingChannelId.value = row.id
  try {
    const res = await testChannel(row.id)
    notifyMutationResult($q, res, {
      success:
        row.channel === 'slack'
          ? `Test posted to ${row.name}`
          : `Test sent to ${row.emails.length} address${row.emails.length === 1 ? '' : 'es'}`,
      apiMissing: "Can't send a test yet."
    })
  } finally {
    testingChannelId.value = ''
  }
}

async function onToggleChannel(row) {
  const res = await setChannelEnabled(row.id, !row.isEnabled)
  notifyMutationResult($q, res, {
    success: `${row.name} ${row.isEnabled ? 'paused' : 'enabled'}`,
    apiMissing: `Can't ${row.isEnabled ? 'pause' : 'enable'} ${row.name} yet.`
  })
}

async function onRemoveChannel(row) {
  const res = await removeChannel(row.id)
  notifyMutationResult($q, res, {
    success: `${row.name} deleted`,
    apiMissing: `Can't delete ${row.name} yet.`
  })
}

const {
  images,
  loading: imagesLoading,
  error: imagesError,
  apiMissing: imagesApiMissing,
  load: loadImages,
  hasPending: imagesHasPending,
  create: createImage,
  remove: removeImage
} = useConnectorImages()

const imageCreating = ref(false)
const imagesPending = computed(() => imagesHasPending())

async function onCreateImage(input) {
  imageCreating.value = true
  try {
    const res = await createImage(input)
    notifyMutationResult($q, res, {
      success: `${input.package}:${input.version} registered. It is being prepared.`,
      apiMissing: "Can't register a connector image yet."
    })
  } finally {
    imageCreating.value = false
  }
}

async function onRemoveImage(row) {
  const res = await removeImage(row.id)
  notifyMutationResult($q, res, {
    success: `${row.package}:${row.version} removed`,
    apiMissing: `Can't remove ${row.package} yet.`
  })
}

// -------------------------------------------------------------- token creation

const tokenCreateOpen = ref(false)
const tokenSubmitting = ref(false)
// Held only between the create response and the moment the reveal dialog is
// dismissed. Nothing persists it, and closing the dialog clears it — the
// backend stores a hash, so a value kept around here would be the only copy in
// existence and the one place it could leak from.
const newTokenPlaintext = ref('')
const newTokenName = ref('')
const tokenRevealOpen = ref(false)

function openTokenCreate() {
  tokenCreateOpen.value = true
}

async function createToken({ name, scopes, expiresAt }) {
  tokenSubmitting.value = true
  try {
    const res = await createTokenRequest({ name, scopes, expiresAt })
    if (!res.ok) {
      notifyMutationResult($q, res, {
        success: '',
        apiMissing: "Can't create a token yet."
      })
      return
    }
    tokenCreateOpen.value = false
    if (res.skipped) {
      // Demo mode. There is no token and therefore no plaintext; opening the
      // reveal dialog on an empty string would show a blank secret.
      notifyLocal(`${name} would be created. Demo data mode saves nothing.`)
      return
    }
    newTokenName.value = name
    newTokenPlaintext.value = res.data.plaintext
    tokenRevealOpen.value = true
  } finally {
    tokenSubmitting.value = false
  }
}

function onTokenRevealClosed() {
  newTokenPlaintext.value = ''
  newTokenName.value = ''
}

// -------------------------------------------------------------------- the tabs
//
// DECLARED DOWN HERE, after every resource above, and that is load-bearing rather
// than tidy. `tabs` reads the ingest-domain, notification and connector-image
// state, and `watch(tabs, …)` evaluates its source once to capture the initial
// value — so with this block in its old place, high up next to the other
// computeds, setup threw a temporal-dead-zone ReferenceError and the whole screen
// failed to render. A plain computed got away with it because only the template
// ever read it, and the template runs after setup.

const tabs = computed(() => [
  // General carries the role now, so it is the one workspace-shaped tab that is
  // never withheld: it always has something of its own to show.
  { key: 'general', label: 'General' },
  // Counted so the tab reads "6 of 16 on" at a glance — this is the panel you
  // come here to check, and the number is the answer to the question.
  {
    key: 'features',
    label: 'Feature activation',
    count: activeCount.value
  },
  {
    key: 'data-source',
    label: dataSourceLabel.value
  },
  ...(isFeatureActive('authorizations')
    ? [{ key: 'authorizations', label: 'Authorizations' }]
    : []),
  ...(isFeatureActive('secrets') ? [{ key: 'secrets', label: 'Secrets' }] : []),
  ...(hasWorkspaceTabs.value
    ? [
        {
          key: 'members',
          label: 'Members',
          count: membersError.value ? undefined : members.value.length
        },
        {
          key: 'tokens',
          label: 'API tokens',
          count: tokensError.value ? undefined : tokens.value.length
        },
        // Three surfaces backend PR #16 made real. Tabs here rather than sidebar
        // rows, following the same reasoning that put the connector catalog on
        // /sources: each is workspace configuration you set up once, not a screen
        // you work in.
        {
          key: 'domains',
          label: 'Ingest domains',
          count: domainsApiMissing.value ? undefined : domains.value.length
        },
        {
          key: 'notifications',
          label: 'Notifications',
          count: channelsApiMissing.value ? undefined : channels.value.length
        },
        {
          key: 'images',
          label: 'Connector images',
          count: imagesApiMissing.value ? undefined : images.value.length
        },
        { key: 'danger', label: 'Danger zone' }
      ]
    : [])
])

// Which tab you are on, held in ?tab= for the same reason /sources does it: two
// of these were routes of their own until this change, and /secrets and
// /authorizations redirect straight into their tab (src/router/routes.js). Both
// halves are the same screen with the same <h1>, so a query beats a child route.
//
// `replace` so flipping tabs does not stack history entries the back button then
// has to chew through. General writes no query at all, keeping /settings clean as
// the canonical URL.
watch(tab, next => {
  const tabQuery = next === 'general' ? undefined : next
  if (route.query.tab === tabQuery) return
  router.replace({ query: { ...route.query, tab: tabQuery } })
})

watch(
  () => route.query.tab,
  next => {
    if (next && next !== tab.value && tabs.value.some(t => t.key === next)) {
      tab.value = next
    }
  }
)

// A tab can vanish under you: flipping Data source back to Real takes the six
// workspace tabs with it, and switching `secrets` off in Feature activation takes
// that one. Falling through to nothing would leave the page blank below the tab
// bar, so the selection comes home to General.
watch(tabs, list => {
  if (!list.some(t => t.key === tab.value)) tab.value = 'general'
})

onMounted(() => {
  // A ?tab= naming a tab this mode does not offer — /settings?tab=members in real
  // mode, say — settles on General rather than rendering nothing under the bar.
  if (!tabs.value.some(t => t.key === tab.value)) tab.value = 'general'

  load()
  loadMembers()
  loadTokens()
  loadDomains()
  loadChannels()
  loadImages()
})
</script>
