import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed } from 'vue'
import { camelizeKeys, pageItems } from '@/lib/apiShape'
import { currentAccount, currentRole } from '@/composables/useMe'
import { useMockResource, sendMutation } from '@/composables/useMockResource'
import { useDataSource } from '@/composables/useDataSource'

/**
 * The workspace roster, the role registry, and the queue of people who signed
 * up with a matching email domain and are waiting to be let in.
 *
 * ## The roster is real; two of the three things around it are not
 *
 * `GET /v1/accounts/{account}/members`, `POST …/members` and
 * `DELETE …/members/{user_id}` all exist — they predate backend PR #16 and were
 * simply never wired here, which is what this change fixes. But the endpoint is
 * much thinner than the fixture, and the gap is the whole reason this file is
 * worth reading before touching:
 *
 * 1. **`Member` is two fields.** `{user: {id, email, display_name?}, role}`.
 *    There is no `status`, no `lastActiveAt` and no `joinedAt`. All three are
 *    columns on `/team` today, and all three come back `NOT_KNOWN` in real mode
 *    rather than being defaulted — an "Active" badge on a record with no status
 *    field is a claim, and `formatAgo(undefined)` reading as "just now" would be
 *    worse than a visible gap.
 * 2. **There is no approval queue, at all.** No pending state on a membership,
 *    no domain-match table, no route. So `pendingApprovals` is reported as
 *    unavailable in real mode rather than as an empty list: "nobody is waiting"
 *    and "nothing tracks who is waiting" are different answers, and only one of
 *    them is true. This is the half of `backend-ask-auth-onboarding.md` that is
 *    still open.
 * 3. **A role cannot be changed.** There is no `PATCH …/members/{id}`; the only
 *    writes are add and remove. `changeRole` therefore stays local-only and says
 *    so, rather than firing a toast that reads like a save.
 *
 * ## The role vocabularies disagree, and picking the wrong one is a 422
 *
 * The wire `Role` enum is `owner | admin | member | viewer`. This repo's fixture
 * registry adds `engineer`, `marketer` and `billing`, which no backend will
 * accept. `roles` therefore serves the wire enum in real mode and the fixture's
 * in Demo mode; `WIRE_ROLES` below is the real one.
 *
 * Two backend rules the UI has to respect rather than discover:
 * `invite_member` refuses a role above the inviter's own, and `remove_member`
 * refuses the account's last owner. Both are enforced server-side; the roster
 * surfaces the second by never offering to remove a sole owner.
 *
 * @returns {{
 *   members: import('vue').ComputedRef<Array>,
 *   pending: import('vue').ComputedRef<Array>,
 *   roles: import('vue').ComputedRef<Array>,
 *   roleLabel: (key: string) => string,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   apiMissing: import('vue').Ref<boolean>,
 *   load: () => Promise<void>,
 *   approve: (id: string, role: string) => void,
 *   decline: (id: string) => void,
 *   changeRole: (id: string, role: string) => void,
 *   removeMember: (id: string) => void
 * }}
 */
export function useTeam() {
  const { isReal } = useDataSource()

  const { data, loading, error, apiMissing, load } = useMockResource('team', {
    initial: { roles: [], members: [], pendingApprovals: [] },
    // Demo mode reads the fixture as-is; its `approvalsAvailable` is absent,
    // which the computed below reads as true. Only the real select sets it
    // false, because only the real backend has no approval queue.
    api: {
      path: () =>
        currentAccount.value &&
        `/v1/accounts/${currentAccount.value.id}/members`,
      // The endpoint answers only the roster, so the other two slices of this
      // payload are filled from what is actually knowable: the wire role enum,
      // and an empty approval queue flagged as unavailable rather than empty.
      select: payload => ({
        members: pageItems(payload).map(adaptMember),
        roles: WIRE_ROLES,
        pendingApprovals: [],
        approvalsAvailable: false
      })
    }
  })

  const members = computed(() => data.value?.members ?? [])
  const pending = computed(() => data.value?.pendingApprovals ?? [])
  const roles = computed(() => data.value?.roles ?? [])

  /**
   * Whether the approval queue means anything on this payload. False in real
   * mode always: nothing on the backend tracks a pending member, so an empty
   * list there is an absence of data rather than an absence of joiners.
   */
  const approvalsAvailable = computed(
    () => data.value?.approvalsAvailable !== false
  )

  /**
   * Whether a role can be saved. No `PATCH …/members/{id}` exists, so in real
   * mode the answer is no and the screen has to say why.
   */
  const canChangeRole = computed(() => !isReal.value)

  // Roles a joiner can be approved into. Owner is excluded because a workspace
  // has exactly one and it is transferred, never granted — and because the
  // backend refuses a grant above the inviter's own role anyway, which for
  // anyone who is not the owner already excludes it.
  const assignableRoles = computed(() =>
    roles.value.filter(r => r.key !== 'owner' && !outranksActor(r.key))
  )

  function roleLabel(key) {
    return roles.value.find(r => r.key === key)?.label ?? key
  }

  function patch(next) {
    data.value = { ...data.value, ...next }
  }

  function memberPath(userId) {
    const account = currentAccount.value
    return account && `/v1/accounts/${account.id}/members/${userId}`
  }

  /** The only owner cannot be removed — the backend raises `LastOwnerError`. */
  function isLastOwner(member) {
    if (member.role !== 'owner') return false
    return members.value.filter(m => m.role === 'owner').length <= 1
  }

  /**
   * Add someone by email. The backend creates a shell user if none exists and
   * the membership activates when that person first signs in — so a fresh row
   * legitimately has no last-active time, which is one more reason that column
   * reads `NOT_KNOWN` rather than a date.
   *
   * @param {{ email: string, role: string }} input
   */
  async function invite({ email, role }) {
    const res = await sendMutation({
      method: 'POST',
      path: () =>
        currentAccount.value &&
        `/v1/accounts/${currentAccount.value.id}/members`,
      body: { email, role }
    })
    if (!res.ok) return res
    if (res.skipped) {
      patch({
        members: [
          ...members.value,
          {
            id: `mem_${email}`,
            name: email,
            email,
            role,
            status: 'invited',
            lastActiveAt: null,
            joinedAt: new Date().toISOString()
          }
        ]
      })
      return res
    }
    patch({ members: [...members.value, adaptMember(camelizeKeys(res.data))] })
    return res
  }

  function approve(id, role) {
    const joiner = pending.value.find(p => p.id === id)
    if (!joiner) return
    patch({
      pendingApprovals: pending.value.filter(p => p.id !== id),
      members: [
        ...members.value,
        {
          id: `mem_${joiner.id}`,
          name: joiner.name,
          email: joiner.email,
          role,
          status: 'active',
          lastActiveAt: new Date().toISOString(),
          joinedAt: new Date().toISOString()
        }
      ]
    })
  }

  function decline(id) {
    patch({ pendingApprovals: pending.value.filter(p => p.id !== id) })
  }

  function changeRole(id, role) {
    patch({
      members: members.value.map(m => (m.id === id ? { ...m, role } : m))
    })
  }

  /**
   * Remove a member. Real in both directions: `DELETE …/members/{user_id}`
   * exists, and the id it takes is the USER's, not the membership's — which is
   * what `adaptMember` puts on `id` for exactly this reason.
   *
   * @param {string} id  The member's user id.
   */
  async function removeMember(id) {
    const res = await sendMutation({
      method: 'DELETE',
      path: () => memberPath(id)
    })
    if (res.ok) patch({ members: members.value.filter(m => m.id !== id) })
    return res
  }

  return {
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
    invite,
    approve,
    decline,
    changeRole,
    removeMember
  }
}

/**
 * The wire `Role` enum, as the role-registry shape this screen renders.
 *
 * Deliberately NOT the fixture's six: `engineer`, `marketer` and `billing` are
 * this repo's invention and a `POST …/members` carrying one is a 422. The
 * descriptions are ours — the backend ships no role documentation — but the keys
 * are the backend's.
 */
export const WIRE_ROLES = [
  {
    key: 'owner',
    label: 'Owner',
    description:
      'One per workspace. Can do everything, including removing other owners, and cannot be removed while they are the only one.'
  },
  {
    key: 'admin',
    label: 'Admin',
    description:
      'Everything except granting a role above their own. Can add and remove members.'
  },
  {
    key: 'member',
    label: 'Member',
    description:
      'Reads and changes the workspace’s data: sources, destinations, pipes.'
  },
  {
    key: 'viewer',
    label: 'Viewer',
    description: 'Reads everything and changes nothing.'
  }
]

/** Rank, most privileged first, for the "cannot grant above your own" rule. */
const ROLE_RANK = ['owner', 'admin', 'member', 'viewer']

/**
 * Whether `role` is above the signed-in user's own. The backend enforces this
 * (`invite_member` raises `RoleNotAllowedError`); the UI stops offering it, so
 * the rule is visible rather than discovered through a rejection.
 *
 * @param {string} role
 * @returns {boolean}
 */
export function outranksActor(role) {
  const actor = currentRole.value
  if (!actor) return false
  const mine = ROLE_RANK.indexOf(actor)
  const theirs = ROLE_RANK.indexOf(role)
  if (mine === -1 || theirs === -1) return false
  return theirs < mine
}

/**
 * One wire `Member` in the roster shape this screen reads.
 *
 * `id` is the USER's id, not a membership id, because that is what
 * `DELETE …/members/{user_id}` takes.
 *
 * The three nulls are the point of this function: `status`, `joinedAt` and
 * `lastActiveAt` are not on the wire record. Left null so the screen prints
 * `NOT_KNOWN`, rather than defaulted to 'active' / now — which would put a
 * measured-looking badge and a measured-looking timestamp on a field nobody
 * sent.
 *
 * @param {object} raw  A snake_case `Member`.
 * @returns {object}
 */
export function adaptMember(raw) {
  const m = camelizeKeys(raw)
  const user = camelizeKeys(m.user) ?? {}
  return {
    id: user.id,
    email: user.email || '',
    name: user.displayName || user.email || '',
    role: m.role || 'viewer',
    status: null,
    joinedAt: null,
    lastActiveAt: null
  }
}

/** Relative time, coarse on purpose — "3 days ago" beats "3d 4h 12m ago". */
export function formatAgo(iso, fallback = NOT_KNOWN) {
  if (!iso) return fallback
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return NOT_KNOWN
  const mins = Math.round((Date.now() - then) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

export function formatDate(iso, fallback = NOT_KNOWN) {
  if (!iso) return fallback
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return NOT_KNOWN
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

export default useTeam
