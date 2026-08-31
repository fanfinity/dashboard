import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed } from 'vue'
import { useMockResource } from '@/composables/useMockResource'

/**
 * The workspace roster, the role registry, and the queue of people who signed
 * up with a matching email domain and are waiting to be let in.
 *
 * NO `api` OPTION ON PURPOSE. There is no members endpoint on the backend yet
 * (`GET /v1/me` returns the acting user's memberships, not the workspace's
 * roster), so this reads the bundled fixture in Demo mode and reports
 * `apiMissing` in the default real mode. That is the honest answer — a roster
 * invented client-side and shown as if it were live is worse than a screen
 * that says the endpoint is missing. Wire `api.path` here the day
 * `/v1/accounts/{account_id}/members` ships.
 *
 * The three writes below are local-only for the same reason. They exist so the
 * approval flow can be walked end to end (approve a joiner, watch them appear
 * in the roster) rather than being a dead form.
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
  const { data, loading, error, apiMissing, load } = useMockResource('team', {
    initial: { roles: [], members: [], pendingApprovals: [] }
  })

  const members = computed(() => data.value?.members ?? [])
  const pending = computed(() => data.value?.pendingApprovals ?? [])
  const roles = computed(() => data.value?.roles ?? [])

  // Roles a joiner can be approved into. Owner is excluded because a workspace
  // has exactly one and it is transferred, never granted.
  const assignableRoles = computed(() =>
    roles.value.filter(r => r.key !== 'owner')
  )

  function roleLabel(key) {
    return roles.value.find(r => r.key === key)?.label ?? key
  }

  function patch(next) {
    data.value = { ...data.value, ...next }
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

  function removeMember(id) {
    patch({ members: members.value.filter(m => m.id !== id) })
  }

  return {
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
