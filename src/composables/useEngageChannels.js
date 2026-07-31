import { computed } from 'vue'
import { useMockResource } from '@/composables/useMockResource'
import { rate } from '@/composables/useEngageChannelsFormat'

/**
 * The Engage channel layer: what was sent (`channel-campaigns.json`), how the
 * transports that sent it are configured (`engage-settings.json`), and what the
 * automated operator did about it (`engage-work-log.json`).
 *
 * Three object/list-shaped mock files back four screens:
 *
 *   channel-campaigns.json  one record per campaign — PRIMARY on /channels/email
 *   engage-settings.json    transports + per-channel + module-level config
 *   engage-work-log.json    the operator's audit trail
 *
 * There is no Engage backend. Every write here mutates the loaded value and the
 * page raises a toast saying so — nothing implies a save.
 */

/** Channels a campaign or transport can belong to, in nav order. */
export const CHANNELS = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'push', label: 'Push' },
  { value: 'whatsapp', label: 'WhatsApp' }
]

/**
 * @param {string} value
 * @returns {string}
 */
export function channelLabel(value) {
  return CHANNELS.find(c => c.value === value)?.label ?? String(value ?? '—')
}

/** How a campaign's lifecycle state reads. */
export const CAMPAIGN_STATUSES = [
  { value: 'draft', label: 'Draft', variant: 'neutral' },
  { value: 'sending', label: 'Sending', variant: 'success' },
  { value: 'paused', label: 'Paused', variant: 'warn' },
  { value: 'completed', label: 'Completed', variant: 'brand' }
]

/**
 * @param {string} status
 * @returns {{ value: string, label: string, variant: string }}
 */
export function campaignStatus(status) {
  return (
    CAMPAIGN_STATUSES.find(s => s.value === status) ?? {
      value: status,
      label: String(status ?? '—'),
      variant: 'neutral'
    }
  )
}

/**
 * How a transport's connection state reads. `needs_setup` is deliberately
 * `warn` and not `danger`: a transport nobody has finished wiring up is
 * unfinished work, not a failure.
 */
export const TRANSPORT_STATUSES = [
  { value: 'active', label: 'Active', variant: 'success' },
  { value: 'paused', label: 'Paused', variant: 'warn' },
  { value: 'needs_setup', label: 'Needs setup', variant: 'warn' }
]

/**
 * @param {string} status
 * @returns {{ value: string, label: string, variant: string }}
 */
export function transportStatus(status) {
  return (
    TRANSPORT_STATUSES.find(s => s.value === status) ?? {
      value: status,
      label: String(status ?? '—'),
      variant: 'neutral'
    }
  )
}

/** Provider ids as they read in the UI. */
const PROVIDER_LABELS = {
  'aws-ses': 'Amazon SES',
  'meta-cloud-api': 'Meta Cloud API',
  apns: 'Apple Push Notification service'
}

/**
 * @param {string} provider
 * @returns {string}
 */
export function providerLabel(provider) {
  return PROVIDER_LABELS[provider] ?? String(provider ?? '—')
}

/** What the operator is allowed to do without being asked. */
export const OPERATOR_MODES = [
  {
    value: 'off',
    label: 'Off',
    description: 'The operator watches nothing and proposes nothing.'
  },
  {
    value: 'propose',
    label: 'Propose',
    description:
      'The operator writes proposals to the work log; a human approves each one.'
  },
  {
    value: 'autopilot',
    label: 'Autopilot',
    description:
      'The operator applies changes at or below the risk threshold and logs them.'
  }
]

/** Risk bands a proposal can carry, least severe first. */
export const RISK_LEVELS = [
  { value: 'low', label: 'Low risk', variant: 'neutral' },
  { value: 'medium', label: 'Medium risk', variant: 'warn' },
  { value: 'high', label: 'High risk', variant: 'danger' }
]

/**
 * @param {string} level
 * @returns {{ value: string, label: string, variant: string }}
 */
export function riskLevel(level) {
  return (
    RISK_LEVELS.find(r => r.value === level) ?? {
      value: level,
      label: String(level ?? '—'),
      variant: 'neutral'
    }
  )
}

/** How a work-log entry's outcome reads. */
export const WORK_LOG_STATUSES = [
  { value: 'pending', label: 'Awaiting approval', variant: 'warn' },
  { value: 'approved', label: 'Approved', variant: 'success' },
  { value: 'completed', label: 'Completed', variant: 'success' },
  { value: 'rejected', label: 'Rejected', variant: 'danger' }
]

/**
 * @param {string} status
 * @returns {{ value: string, label: string, variant: string }}
 */
export function workLogStatus(status) {
  return (
    WORK_LOG_STATUSES.find(s => s.value === status) ?? {
      value: status,
      label: String(status ?? '—'),
      variant: 'neutral'
    }
  )
}

/** Frequency caps a form may set, in messages per fan per week. */
export const CAP_MIN = 1
export const CAP_MAX = 50

/**
 * Whether a weekly frequency cap is a whole number inside the allowed range.
 * Returned as a message rather than a boolean so `FormField` can show it.
 *
 * @param {*} value
 * @returns {string} an error message, or `''` when valid
 */
export function capError(value) {
  const n = Number(value)
  if (value === '' || value === null || !Number.isFinite(n)) {
    return 'Enter a number of messages.'
  }
  if (!Number.isInteger(n)) return 'Use whole messages.'
  if (n < CAP_MIN || n > CAP_MAX) {
    return `Choose between ${CAP_MIN} and ${CAP_MAX} messages a week.`
  }
  return ''
}

/**
 * Whether a value is a 24-hour `HH:MM` time of day.
 *
 * @param {*} value
 * @returns {string} an error message, or `''` when valid
 */
export function timeError(value) {
  if (!value) return 'Enter a time.'
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))
    ? ''
    : 'Use a 24-hour time, e.g. 21:00.'
}

/**
 * Whether a notification target reads like a chat channel.
 *
 * @param {*} value
 * @returns {string} an error message, or `''` when valid
 */
export function notifyChannelError(value) {
  const text = String(value ?? '').trim()
  if (!text) return 'Enter a channel to notify.'
  if (!text.startsWith('#')) return 'Start with # — e.g. #engage-ops.'
  if (text.length > 60) return 'Keep it under 60 characters.'
  return ''
}

/**
 * Campaigns across every channel. PRIMARY on `/channels/email`, which filters
 * to the email ones.
 *
 * Delivery rates are derived here rather than in the page: `DataTable` sorts on
 * the raw cell value, so a rate column has to arrive as a number.
 *
 * @returns {{
 *   campaigns: import('vue').Ref<Array>,
 *   emailCampaigns: import('vue').ComputedRef<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   setStatus: (id: string, status: string) => void
 * }}
 *
 * @example
 * const { emailCampaigns, loading, error, load } = useEngageChannelsCampaigns()
 * onMounted(load)
 */
export function useEngageChannelsCampaigns() {
  const {
    data: campaigns,
    loading,
    error,
    load
  } = useMockResource('channel-campaigns')

  const emailCampaigns = computed(() =>
    campaigns.value
      .filter(c => c.channel === 'email')
      .map(c => ({
        ...c,
        deliveredRate: rate(c.deliveredCount, c.sentCount),
        openRate: rate(c.openCount, c.deliveredCount),
        clickRate: rate(c.clickCount, c.deliveredCount),
        bounceRate: rate(c.bounceCount, c.sentCount),
        unsubscribeRate: rate(c.unsubscribeCount, c.deliveredCount)
      }))
  )

  function setStatus(id, status) {
    campaigns.value = campaigns.value.map(c =>
      c.id === id ? { ...c, status, updatedAt: new Date().toISOString() } : c
    )
  }

  return { campaigns, emailCampaigns, loading, error, load, setStatus }
}

/**
 * The Engage configuration record: transports, per-channel defaults, and the
 * module-level operator and frequency-capping rules. Object-shaped, so
 * `initial` is an object — a failed load must not hand an array to a template
 * that reads `settings.email.trackOpens`.
 *
 * PRIMARY on both `/channels/settings` and `/engage-settings`; the two screens
 * read different slices of it, and neither duplicates the other's.
 *
 * @returns {{
 *   settings: import('vue').Ref<object>,
 *   transports: import('vue').ComputedRef<Array>,
 *   hasSettings: import('vue').ComputedRef<boolean>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   patchSection: (key: string, patch: object) => void,
 *   setDefaultTransport: (id: string) => void
 * }}
 */
export function useEngageChannelsSettings() {
  const {
    data: settings,
    loading,
    error,
    load
  } = useMockResource('engage-settings', { initial: {} })

  const transports = computed(() => settings.value?.transports ?? [])

  // A payload with no transports and no sections is "no such record", which the
  // pages render as an EmptyState — not as a failure.
  const hasSettings = computed(
    () => Boolean(settings.value) && Object.keys(settings.value).length > 0
  )

  /**
   * Merge a patch into one top-level section (`email`, `operator`, …). Replaces
   * the whole ref so a computed reading a nested key still re-evaluates.
   */
  function patchSection(key, patch) {
    settings.value = {
      ...settings.value,
      [key]: { ...settings.value?.[key], ...patch }
    }
  }

  /** Exactly one transport per channel is the default. */
  function setDefaultTransport(id) {
    const target = transports.value.find(t => t.id === id)
    if (!target) return
    settings.value = {
      ...settings.value,
      transports: transports.value.map(t =>
        t.channel === target.channel ? { ...t, isDefault: t.id === id } : t
      )
    }
  }

  return {
    settings,
    transports,
    hasSettings,
    loading,
    error,
    load,
    patchSection,
    setDefaultTransport
  }
}

/**
 * The operator's work log: what it did, what it proposed, and what a human
 * decided. PRIMARY on `/engage-operator/work-log`.
 *
 * @returns {{
 *   entries: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   approve: (id: string, byName: string) => void,
 *   reject: (id: string, byName: string, reason: string) => void
 * }}
 */
export function useEngageChannelsWorkLog() {
  const {
    data: entries,
    loading,
    error,
    load
  } = useMockResource('engage-work-log')

  function patch(id, fields) {
    entries.value = entries.value.map(e =>
      e.id === id ? { ...e, ...fields } : e
    )
  }

  function approve(id, byName) {
    patch(id, {
      status: 'approved',
      approvedBy: 'local-preview',
      approvedByName: byName
    })
  }

  function reject(id, byName, reason) {
    patch(id, {
      status: 'rejected',
      rejectedBy: 'local-preview',
      rejectedByName: byName,
      rejectionReason: String(reason ?? '').trim()
    })
  }

  return { entries, loading, error, load, approve, reject }
}
