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
      <!-- The tab bar itself must not depend on `workspace` loading: Your
           role / Feature activation / Data source are per-browser
           preferences, not workspace data, and Data source is the one screen
           that must stay reachable even when everything workspace-shaped is
           empty — it is the way back to demo data. -->
      <TabNav v-model="tab" :tabs="tabs" />

      <SettingsPersonaPanel v-if="tab === 'persona'" />

      <SettingsFeaturePanel v-else-if="tab === 'features'" />

      <SettingsDataSourcePanel v-else-if="tab === 'data-source'" />

      <!-- The load succeeded and there is no workspace record. That is an
           answer, not a failure, so it must not render ErrorState — and it
           only applies to the tabs below, which are actually workspace data. -->
      <EmptyState
        v-else-if="!workspace"
        title="No workspace settings"
        description="This account is not attached to a workspace yet. Ask an admin to add you to one."
      />

      <div v-else-if="tab === 'general'" class="flex max-w-3xl flex-col gap-4">
        <form class="flex flex-col gap-4" @submit.prevent="save">
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

        <CardPanel>
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
      </div>

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
        @retry="loadTokens"
        @revoke="askRevokeToken"
        @create="createToken"
      />

      <SettingsDangerZone
        v-else
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
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
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
import SettingsDangerZone from '@/components/settings/SettingsDangerZone.vue'
import SettingsFeaturePanel from '@/components/settings/SettingsFeaturePanel.vue'
import SettingsPersonaPanel from '@/components/settings/SettingsPersonaPanel.vue'
import SettingsDataSourcePanel from '@/components/settings/SettingsDataSourcePanel.vue'
import { useFeatures } from '@/composables/useFeatures'
import { useDataSource } from '@/composables/useDataSource'
import { formatDate, formatDays } from '@/composables/useSettingsFormat'
import {
  RETENTION_MAX_DAYS,
  RETENTION_MIN_DAYS,
  retentionError,
  useSettingsApiTokens,
  useSettingsMembers,
  useSettingsWorkspace
} from '@/composables/useSettingsWorkspace'

const $q = useQuasar()

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
  load: loadTokens,
  revoke: revokeToken
} = useSettingsApiTokens()

const tab = ref('general')
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
const { activeCount } = useFeatures()
const { isReal } = useDataSource()
const dataSourceLabel = computed(() => {
  if (isReal.value) return 'Data source (Real)'
  return 'Data source (Demo)'
})

const tabs = computed(() => [
  { key: 'general', label: 'General' },
  // Two per-person preferences sit next to each other on purpose: this one and
  // Feature activation are the only tabs here that are about you and this
  // browser rather than about the workspace everyone shares.
  { key: 'persona', label: 'Your role' },
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
  { key: 'danger', label: 'Danger zone' }
])

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

function askRevokeToken(token) {
  ask({
    title: 'Revoke this token?',
    message: `“${token.name}” stops authenticating immediately. Anything using it starts failing on its next call, and the value cannot be recovered.`,
    confirmLabel: 'Revoke token',
    run: () => {
      revokeToken(token.id)
      notifyLocal(`${token.name} revoked`)
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

function createToken() {
  notifyLocal('Token creation needs the accounts backend')
}

onMounted(() => {
  load()
  loadMembers()
  loadTokens()
})
</script>
