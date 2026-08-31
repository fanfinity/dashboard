import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed } from 'vue'
import { useMockResource } from '@/composables/useMockResource'

/**
 * Workspace settings = the instance-wide configuration behind `/settings`:
 * what the workspace is called, where its data physically lives, how long that
 * data is kept, who can sign in, and which machine tokens can call the API.
 *
 * Three object-shaped mock files back it, and each is loaded on its own so a
 * failure stays local to the panel that needed it:
 *
 *   settings.json     the workspace record itself — the PRIMARY resource.
 *   users.json        members and pending invitations — secondary.
 *   api-tokens.json   machine tokens — secondary.
 *
 * This is deliberately NOT the real accounts/RBAC backend. `src/api/` stays
 * reserved for that; nothing here calls it, and nothing here persists. Writes
 * mutate the loaded value and the page raises a toast that says so.
 */

/** Roles a member can hold, most privileged first. */
export const MEMBER_ROLES = [
  { value: 'owner', label: 'Owner', variant: 'brand' },
  { value: 'admin', label: 'Admin', variant: 'brand' },
  { value: 'editor', label: 'Editor', variant: 'neutral' },
  { value: 'viewer', label: 'Viewer', variant: 'neutral' }
]

/**
 * @param {string} role
 * @returns {{ value: string, label: string, variant: string }}
 */
export function memberRole(role) {
  return (
    MEMBER_ROLES.find(r => r.value === role) ?? {
      value: role,
      label: String(role ?? NOT_KNOWN),
      variant: 'neutral'
    }
  )
}

/** Retention windows a form may set, in days. */
export const RETENTION_MIN_DAYS = 1
export const RETENTION_MAX_DAYS = 3650

/**
 * Whether a retention window is a whole number of days inside the allowed
 * range. Returned as a message rather than a boolean so a `FormField` can show
 * it directly.
 *
 * @param {*} value
 * @returns {string} an error message, or `''` when valid
 */
export function retentionError(value) {
  const days = Number(value)
  if (value === '' || value === null || !Number.isFinite(days)) {
    return 'Enter a number of days.'
  }
  if (!Number.isInteger(days)) return 'Use whole days.'
  if (days < RETENTION_MIN_DAYS || days > RETENTION_MAX_DAYS) {
    return `Choose between ${RETENTION_MIN_DAYS} and ${RETENTION_MAX_DAYS} days.`
  }
  return ''
}

/**
 * How an API token reads. There is no stored status field — a token is revoked
 * explicitly, or it lapses when its expiry passes, or it works.
 *
 * @param {object} token
 * @returns {{ key: string, label: string, variant: string }}
 */
export function tokenStatus(token) {
  if (token?.isRevoked) {
    return { key: 'revoked', label: 'Revoked', variant: 'danger' }
  }
  if (token?.expiresAt && new Date(token.expiresAt).getTime() < Date.now()) {
    return { key: 'expired', label: 'Expired', variant: 'warn' }
  }
  return { key: 'active', label: 'Active', variant: 'success' }
}

/**
 * The workspace settings record. Object-shaped, so `initial` is an object —
 * screens render straight off `data` and an array would blow the template up on
 * a failed load.
 *
 * @returns {{
 *   settings: import('vue').Ref<object>,
 *   workspace: import('vue').ComputedRef<object|null>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>
 * }}
 *
 * @example
 * const { settings, workspace, loading, error, load } = useSettingsWorkspace()
 * onMounted(load)
 */
export function useSettingsWorkspace() {
  const {
    data: settings,
    loading,
    error,
    load
  } = useMockResource('settings', { initial: {} })

  // A payload with no `workspace` key is "no such record", which the page
  // renders as an EmptyState — not as a failure.
  const workspace = computed(() => settings.value?.workspace ?? null)

  return { settings, workspace, loading, error, load }
}

/**
 * Members and pending invitations. Secondary on `/settings`: its failure
 * degrades the Members tab and leaves the rest of the screen working.
 *
 * @returns {{
 *   members: import('vue').ComputedRef<Array>,
 *   pending: import('vue').ComputedRef<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   removeMember: (id: string) => void,
 *   revokeInvite: (id: string) => void
 * }}
 */
export function useSettingsMembers() {
  const {
    data: users,
    loading,
    error,
    load
  } = useMockResource('users', {
    initial: { managedUsers: [], pendingUsers: [] }
  })

  const members = computed(() => users.value?.managedUsers ?? [])
  const pending = computed(() => users.value?.pendingUsers ?? [])

  function removeMember(id) {
    users.value = {
      ...users.value,
      managedUsers: members.value.filter(u => u.id !== id)
    }
  }

  function revokeInvite(id) {
    users.value = {
      ...users.value,
      pendingUsers: pending.value.filter(i => i.id !== id)
    }
  }

  return {
    members,
    pending,
    loading,
    error,
    load,
    removeMember,
    revokeInvite
  }
}

/**
 * Machine API tokens. Secondary on `/settings`, same as members.
 *
 * Only the last four characters of a token are stored, so revoking is the only
 * write worth having — there is nothing to re-show.
 *
 * @returns {{
 *   tokens: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   revoke: (id: string) => void
 * }}
 */
export function useSettingsApiTokens() {
  const { data: tokens, loading, error, load } = useMockResource('api-tokens')

  function revoke(id) {
    tokens.value = tokens.value.map(t =>
      t.id === id
        ? { ...t, isRevoked: true, revokedAt: new Date().toISOString() }
        : t
    )
  }

  return { tokens, loading, error, load, revoke }
}
