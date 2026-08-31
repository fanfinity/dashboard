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
      description="The roster endpoint did not answer for this account. It is real — GET /v1/accounts/{account}/members — so this usually means the account has not settled yet. Switch Settings → Data source to Demo data to walk the shape this screen is built against."
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
          :hint="
            hasStatus
              ? seatHint
              : `${seatHint}. A member record carries no status, so this counts every row.`
          "
        />
        <!-- NOT a confident 0. Nothing on the backend tracks a pending
             member — no state on a membership, no domain-match table, no route
             — so "nobody is waiting" is a claim rather than a reading. The two
             answers are genuinely different and only one of them is available. -->
        <StatCard
          label="Awaiting approval"
          :value="approvalsAvailable ? String(pending.length) : NOT_KNOWN"
          :hint="
            approvalsAvailable
              ? pending.length
                ? 'They can see nothing until you approve them.'
                : 'Nobody is waiting.'
              : 'No endpoint tracks domain-matched joiners yet.'
          "
        />
        <StatCard
          label="Pending invitations"
          :value="invitedCount === null ? NOT_KNOWN : String(invitedCount)"
          :hint="
            invitedCount === null
              ? 'A member record carries no status field.'
              : 'Invited, not yet signed in.'
          "
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
            >Matched by email domain, with no invite on file</p
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

        <!-- `Member` is `{user, role}` and nothing else, so a real row has no
             status to show. An "Active" badge here would be the app asserting
             something the backend never sent. -->
        <template #cell-status="{ row }">
          <StatusBadge
            v-if="row.status"
            :tone="row.status === 'active' ? 'success' : 'warn'"
            :label="row.status === 'active' ? 'Active' : 'Invited'"
          />
          <span v-else class="text-muted">{{ NOT_KNOWN }}</span>
        </template>

        <template #cell-lastActiveAt="{ row }">
          <span class="text-muted">{{
            !row.status
              ? NOT_KNOWN
              : row.status === 'active'
                ? formatAgo(row.lastActiveAt, NEVER)
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
              <!-- There is no `PATCH …/members/{id}`: the only member writes
                   are add and remove. Disabled rather than firing a toast that
                   reads like a save. The tooltip on the row's own text below
                   carries the reason; the banner states it once for the page. -->
              <SfereSelect
                :model-value="row.role"
                :options="roleOptions"
                class="w-40"
                :disabled="!canChangeRole"
                @update:model-value="v => changeRole(row.id, v)"
              />
              <SfereButton
                variant="ghost"
                size="sm"
                :disabled="isLastOwner(row)"
                @click="ask(row)"
                >Remove</SfereButton
              >
            </template>
          </div>
        </template>
      </DataTable>

      <!-- Narrowed rather than dropped. The roster and its add/remove writes
           are real; what is still missing is a role change and the approval
           queue. A banner that overstates what is missing misleads as much as
           one that understates it. -->
      <NoticeBanner tone="info" :title="bannerTitle" :message="bannerMessage" />
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
          >Roles are additive within a workspace, so nobody has to be an Admin
          to get their own job done.</p
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
          >They get access as soon as they accept, with no approval step,
          because you are picking the role now.</p
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
import { NEVER, NOT_KNOWN } from '@/lib/emptyValue'
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
import { notifyMutationResult } from '@/composables/useMutationFeedback'

const $q = useQuasar()

const {
  members,
  pending,
  roles,
  assignableRoles,
  approvalsAvailable,
  canChangeRole,
  isLastOwner,
  roleLabel,
  loading,
  error,
  apiMissing,
  load,
  invite: inviteMember,
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

// Both counts are derived from `status`, which a real `Member` does not carry.
// So they answer null in real mode rather than 0 — an "Active members: 0" on a
// roster that just rendered four rows is the kind of confident zero that gets
// believed. `members.length` is the honest headline there, and it is what the
// seat hint already says.
const hasStatus = computed(() => members.value.some(m => m.status))

const activeCount = computed(() =>
  hasStatus.value
    ? String(members.value.filter(m => m.status === 'active').length)
    : String(members.value.length)
)
const invitedCount = computed(() =>
  hasStatus.value
    ? members.value.filter(m => m.status === 'invited').length
    : null
)

const bannerTitle = computed(() =>
  canChangeRole.value
    ? 'Roles are not enforced by the backend yet'
    : 'Two things on this screen have no endpoint'
)

const bannerMessage = computed(() =>
  canChangeRole.value
    ? 'This screen is the agreed shape for members, roles and domain-match approvals. Changes made here are local to this browser while Demo data mode is on.'
    : 'The roster is live, and adding or removing a member writes for real. Changing an existing member’s role has no endpoint — the only member writes are add and remove — so that control is disabled. The domain-match approval queue has no endpoint either: nothing on the backend records who signed up with a matching domain, which is why the count above reads “Not known” rather than zero.'
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
    ? `${target.value.name} loses access immediately. Anything they created (sources, pipes, audiences) stays where it is.`
    : ''
)

function onApprove(joiner) {
  const role = draftRole[joiner.id]
  approve(joiner.id, role)
  delete draftRole[joiner.id]
  $q.notify({
    message: `${joiner.name} approved as ${roleLabel(role)}`,
    caption:
      'Local to this browser. Nothing on the backend records a domain-matched joiner, so there is no approval to send.',
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

// `POST /v1/accounts/{account}/members` is real, so this adds a member rather
// than drafting one. The backend creates a shell user if none exists for the
// email and activates the membership when that person first signs in — so the
// success line says "added", not "invited by email": nothing sends a mail.
async function invite() {
  const email = inviteEmail.value.trim()
  const role = inviteRole.value
  if (!email || !role) return
  const res = await inviteMember({ email, role })
  notifyMutationResult($q, res, {
    success: `${email} added as ${roleLabel(role)}`,
    apiMissing: `Can't add ${email} yet.`
  })
  if (res.ok) {
    inviteOpen.value = false
    inviteEmail.value = ''
    inviteRole.value = ''
  }
}

function ask(row) {
  target.value = row
  confirmRemove.value = true
}

// `DELETE …/members/{user_id}` is real, so the toast has to be able to say the
// three things that can happen rather than one. The backend refuses the last
// owner (`LastOwnerError`) and refuses removing someone who outranks you
// (`RoleNotAllowedError`); both come back as a 4xx with a message, which
// `notifyMutationResult` shows rather than swallowing.
async function remove() {
  const row = target.value
  if (!row) return
  const res = await removeMember(row.id)
  notifyMutationResult($q, res, {
    success: `${row.name} removed`,
    apiMissing: `Can't remove ${row.name} yet.`
  })
  // Left in place rather than nulled here: the message must not blank out while
  // the dialog fades. `ask()` overwrites it on the next open.
}

onMounted(async () => {
  await load()
  loaded.value = true
})
</script>
