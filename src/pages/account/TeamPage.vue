<template>
  <q-page class="p-6">
    <PageHeader
      eyebrow="Account"
      title="Team &amp; roles"
      subtitle="Who has access to this workspace, and what each of them can do."
    >
      <template #actions>
        <SfereButton
          v-if="!apiMissing"
          variant="secondary"
          size="sm"
          @click="rolesOpen = true"
          >What can each role do?</SfereButton
        >
        <SfereButton size="sm" @click="inviteOpen = true"
          >Invite member</SfereButton
        >
      </template>
    </PageHeader>

    <!-- 1. Loading -->
    <div v-if="showSkeleton" class="flex flex-col gap-4">
      <LoadingState variant="grid" :rows="3" />
      <LoadingState variant="table" :rows="6" />
    </div>

    <!-- 2. Error -->
    <ErrorState
      v-else-if="error"
      title="Couldn't load the team."
      :message="error"
      @retry="load"
    />

    <!-- 3. No endpoint yet. Not a fault, and not an empty roster either — a
         workspace always has at least an Owner, so an empty list here would be
         a lie. Say which switch shows the shape instead. -->
    <EmptyState
      v-else-if="apiMissing"
      title="No members API yet"
      description="The workspace roster and the domain-match approval queue are not served by the backend yet. Switch Settings → Data source to Demo data to walk the shape this screen is built against."
    >
      <template #cta>
        <SfereButton variant="secondary" :to="{ name: 'settings' }"
          >Open data source settings</SfereButton
        >
      </template>
    </EmptyState>

    <!-- 4. Populated -->
    <div v-else class="flex flex-col gap-5">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Active members"
          :value="activeCount"
          :hint="seatHint"
        />
        <StatCard
          label="Awaiting approval"
          :value="pending.length"
          :hint="
            pending.length
              ? 'They can see nothing until you approve them.'
              : 'Nobody is waiting.'
          "
        />
        <StatCard
          label="Pending invitations"
          :value="invitedCount"
          hint="Invited, not yet signed in."
        />
      </div>

      <!-- The queue comes first while it has anything in it: it is the only
           thing on this page that someone is actively waiting on. -->
      <CardPanel v-if="pending.length" gradient-border>
        <template #header>
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-ink">Pending approval</span>
            <StatusBadge tone="warn" :label="String(pending.length)" dot />
          </div>
          <p class="text-xs text-subtle"
            >Matched by email domain — no invite on file</p
          >
        </template>

        <div class="flex flex-col gap-3">
          <div
            v-for="joiner in pending"
            :key="joiner.id"
            class="flex flex-col gap-3 rounded-sfere-lg border border-sfere-line bg-sfere-fill p-4 lg:flex-row lg:items-center lg:justify-between"
          >
            <div class="flex min-w-0 flex-1 items-center gap-3">
              <SfereAvatar :name="joiner.name" size="sm" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-ink">{{
                  joiner.name
                }}</p>
                <p class="truncate text-xs text-muted"
                  >{{ joiner.email }} · signed up
                  {{ formatAgo(joiner.signedUpAt) }}</p
                >
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-2">
              <SfereSelect
                v-model="draftRole[joiner.id]"
                :options="roleOptions"
                placeholder="Choose a role…"
                class="w-48"
              />
              <SfereButton
                size="sm"
                :disabled="!draftRole[joiner.id]"
                @click="onApprove(joiner)"
                >Approve</SfereButton
              >
              <SfereButton
                variant="secondary"
                size="sm"
                @click="onDecline(joiner)"
                >Decline</SfereButton
              >
            </div>
          </div>
        </div>

        <template #footer>
          <p class="text-xs text-muted"
            >People signing up with a
            <span class="font-medium text-ink">@{{ domain }}</span> address land
            here automatically. Nothing in the workspace is visible to them
            until an Owner or Admin approves them and picks a role.</p
          >
        </template>
      </CardPanel>

      <DataTable
        :columns="columns"
        :rows="members"
        row-key="id"
        empty-title="No members yet"
      >
        <template #cell-name="{ row }">
          <div class="flex items-center gap-3">
            <SfereAvatar :name="row.name" size="sm" />
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-ink">{{ row.name }}</p>
              <p class="truncate text-xs text-subtle">{{ row.email }}</p>
            </div>
          </div>
        </template>

        <template #cell-role="{ row }">
          <StatusBadge
            :tone="row.role === 'owner' ? 'brand' : 'neutral'"
            :label="roleLabel(row.role)"
          />
        </template>

        <template #cell-status="{ row }">
          <StatusBadge
            :tone="row.status === 'active' ? 'success' : 'warn'"
            :label="row.status === 'active' ? 'Active' : 'Invited'"
          />
        </template>

        <template #cell-lastActiveAt="{ row }">
          <span class="text-muted">{{
            row.status === 'active'
              ? formatAgo(row.lastActiveAt)
              : `Invited ${formatAgo(row.invitedAt)}`
          }}</span>
        </template>

        <template #cell-actions="{ row }">
          <div class="flex items-center justify-end gap-2">
            <!-- The Owner row is deliberately inert: ownership is transferred
                 from the danger zone, not demoted from a table. -->
            <span v-if="row.role === 'owner'" class="text-sm text-subtle"
              >Workspace owner</span
            >
            <template v-else>
              <SfereSelect
                :model-value="row.role"
                :options="roleOptions"
                class="w-40"
                @update:model-value="v => changeRole(row.id, v)"
              />
              <SfereButton variant="ghost" size="sm" @click="ask(row)"
                >Remove</SfereButton
              >
            </template>
          </div>
        </template>
      </DataTable>

      <NoticeBanner
        tone="info"
        title="Roles are not enforced by the backend yet"
        message="This screen is the agreed shape for members, roles and domain-match approvals. Changes made here are local to this browser until the members API ships."
      />
    </div>

    <!-- Role reference. A dialog rather than a permanent column because it is
         read once, when someone is deciding what to grant. -->
    <q-dialog v-model="rolesOpen">
      <!-- Both width utilities carry the important suffix. Quasar ships an
           unlayered `.q-dialog__inner--minimized > div { max-width: 560px }`, so
           `w-[Npx]!` alone still renders at 560 and `max-w-full` (layered) loses
           to it as well. The max-width is the one that actually has to win, and
           it is a `min()` rather than a flat pixel value so the dialog still
           shrinks on a narrow window instead of overflowing it. -->
      <div
        class="w-[min(720px,92vw)]! max-w-[min(720px,92vw)]! rounded-sfere-xl border border-sfere-line bg-white p-6"
      >
        <h2 class="font-sfere-display text-lg! font-semibold! text-ink"
          >What each role can do</h2
        >
        <p class="mt-1 text-sm text-muted"
          >Roles are additive within a workspace — nobody has to be an Admin to
          get their own job done.</p
        >

        <div class="mt-5 flex flex-col gap-3">
          <div
            v-for="role in roles"
            :key="role.key"
            class="rounded-sfere-lg border border-sfere-line p-4"
          >
            <div class="flex items-center gap-2">
              <StatusBadge
                :tone="role.key === 'owner' ? 'brand' : 'neutral'"
                :label="role.label"
              />
              <span class="text-xs text-subtle">{{
                countByRole(role.key)
              }}</span>
            </div>
            <p class="mt-2 text-sm text-muted">{{ role.description }}</p>
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <SfereButton variant="secondary" @click="rolesOpen = false"
            >Close</SfereButton
          >
        </div>
      </div>
    </q-dialog>

    <!-- Invite. Local-only, and it says so rather than implying a mail send. -->
    <q-dialog v-model="inviteOpen">
      <div
        class="w-[min(520px,92vw)]! max-w-[min(520px,92vw)]! rounded-sfere-xl border border-sfere-line bg-white p-6"
      >
        <h2 class="font-sfere-display text-lg! font-semibold! text-ink"
          >Invite a member</h2
        >
        <p class="mt-1 text-sm text-muted"
          >They get access as soon as they accept — no approval step, because
          you are picking the role now.</p
        >

        <div class="mt-5 flex flex-col gap-4">
          <FormField
            label="Work email"
            required
            for-id="invite-email"
            :hint="`Anyone at @${domain} can also just sign up and wait in the approval queue.`"
          >
            <SfereInput
              id="invite-email"
              v-model="inviteEmail"
              type="email"
              :placeholder="`name@${domain}`"
            />
          </FormField>

          <FormField
            label="Role"
            required
            for-id="invite-role"
            hint="Changeable later from the roster."
          >
            <SfereSelect
              id="invite-role"
              v-model="inviteRole"
              :options="roleOptions"
              placeholder="Choose a role…"
            />
          </FormField>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <SfereButton variant="secondary" @click="inviteOpen = false"
            >Cancel</SfereButton
          >
          <SfereButton :disabled="!inviteEmail || !inviteRole" @click="invite"
            >Send invitation</SfereButton
          >
        </div>
      </div>
    </q-dialog>

    <ConfirmDialog
      v-model="confirmRemove"
      title="Remove this member?"
      :message="removeMessage"
      confirm-label="Remove"
      destructive
      @confirm="remove"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import FormField from '@/components/ui/FormField.vue'
import SfereAvatar from '@/components/ui/SfereAvatar.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import SfereSelect from '@/components/ui/SfereSelect.vue'
import { formatAgo, useTeam } from '@/composables/useTeam'

const $q = useQuasar()

const {
  members,
  pending,
  roles,
  assignableRoles,
  roleLabel,
  loading,
  error,
  apiMissing,
  load,
  approve,
  decline,
  changeRole,
  removeMember
} = useTeam()

const loaded = ref(false)
const showSkeleton = computed(() => loading.value && !loaded.value)

const rolesOpen = ref(false)
const inviteOpen = ref(false)
const inviteEmail = ref('')
const inviteRole = ref('')
const confirmRemove = ref(false)
const target = ref(null)

// One draft role per queued joiner, so approving the second person does not
// inherit the role picked for the first.
const draftRole = reactive({})

const roleOptions = computed(() =>
  assignableRoles.value.map(r => ({ value: r.key, label: r.label }))
)

const columns = [
  { key: 'name', label: 'Member' },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
  { key: 'lastActiveAt', label: 'Last active' },
  { key: 'actions', label: '', align: 'right' }
]

const activeCount = computed(
  () => members.value.filter(m => m.status === 'active').length
)
const invitedCount = computed(
  () => members.value.filter(m => m.status === 'invited').length
)

const seatHint = computed(() => `${members.value.length} of 10 seats used`)

// The workspace's email domain, taken from the Owner rather than hardcoded, so
// a different fixture or a real payload reads correctly.
const domain = computed(() => {
  const owner = members.value.find(m => m.role === 'owner') ?? members.value[0]
  return owner?.email?.split('@')[1] ?? 'yourcompany.com'
})

function countByRole(key) {
  const n = members.value.filter(m => m.role === key).length
  return n === 1 ? '1 member' : `${n} members`
}

const removeMessage = computed(() =>
  target.value
    ? `${target.value.name} loses access immediately. Anything they created — sources, pipes, audiences — stays where it is.`
    : ''
)

function onApprove(joiner) {
  const role = draftRole[joiner.id]
  approve(joiner.id, role)
  delete draftRole[joiner.id]
  $q.notify({
    message: `${joiner.name} approved as ${roleLabel(role)}`,
    caption: 'Local to this browser — the members API is not live yet.',
    color: 'dark',
    position: 'top-right'
  })
}

function onDecline(joiner) {
  decline(joiner.id)
  $q.notify({
    message: `${joiner.name} declined`,
    caption: 'They keep their account but get no access to this workspace.',
    color: 'dark',
    position: 'top-right'
  })
}

function invite() {
  $q.notify({
    message: `Invitation drafted for ${inviteEmail.value}`,
    caption: 'Nothing was sent — there is no invitations endpoint yet.',
    color: 'dark',
    position: 'top-right'
  })
  inviteOpen.value = false
  inviteEmail.value = ''
  inviteRole.value = ''
}

function ask(row) {
  target.value = row
  confirmRemove.value = true
}

function remove() {
  if (target.value) removeMember(target.value.id)
  target.value = null
}

onMounted(async () => {
  await load()
  loaded.value = true
})
</script>
