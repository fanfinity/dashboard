import { camelizeKeys, pageItems } from '@/lib/apiShape'
import { currentAccount } from '@/composables/useMe'
import { useMockResource, sendMutation } from '@/composables/useMockResource'

/**
 * Where alerts go — Slack webhooks and email lists — plus a test button. Full
 * CRUD, live as of backend PR #16:
 *
 *   GET/POST       …/notification-channels
 *   GET/PUT/DELETE …/notification-channels/{id}
 *   POST           …/notification-channels/{id}/test
 *
 * ## `slack_webhook_url` is write-only and comes back masked
 *
 * The field is `writeOnly` on create and update, and a read returns it masked.
 * So an edit form pre-filled from a read would put a masked string in the box
 * and save the mask over the real webhook. `webhookIsMasked()` below is how the
 * edit dialog tells the two apart: a value that looks masked is treated as
 * "unchanged" and omitted from the update body rather than sent.
 *
 * ## `events: ['all']` is not the same as every event listed
 *
 * The vocabulary is `all | sync | batch | dead | account`, and `all` is a member
 * of it rather than a shorthand the client expands. Ticking every box is
 * therefore NOT equivalent to picking `all`: a new event kind added later is
 * covered by `all` and not by a list. The picker offers `all` as its own choice
 * and clears the others when it is chosen, so the saved value says what was
 * meant.
 *
 * ## `PUT` replaces, so a partial body drops fields
 *
 * `NotificationChannelUpdate` is a full replacement. `update()` therefore sends
 * every field it was given, and `setEnabled()` re-sends the whole record rather
 * than just the flag — otherwise pausing a channel would wipe its recipients.
 */

/** What an alert can be about. `all` is a real value, not a shorthand. */
export const NOTIFICATION_EVENTS = [
  {
    value: 'all',
    label: 'Everything',
    description:
      'Every alert, including kinds added later. Not the same as ticking all of the boxes below.'
  },
  {
    value: 'sync',
    label: 'Sync runs',
    description: 'A scheduled pull from a source succeeded or failed.'
  },
  {
    value: 'batch',
    label: 'Batch delivery',
    description: 'A batch of events was written to a destination, or was not.'
  },
  {
    value: 'dead',
    label: 'Dead letters',
    description: 'Events that could not be delivered and were parked.'
  },
  {
    value: 'account',
    label: 'Account',
    description: 'Membership, billing and workspace-level changes.'
  }
]

export const NOTIFICATION_CHANNELS = [
  {
    value: 'slack',
    label: 'Slack',
    description: 'Posts to an incoming webhook.'
  },
  {
    value: 'email',
    label: 'Email',
    description: 'Sends to a list of addresses.'
  }
]

/**
 * Whether a `slack_webhook_url` read back from the API is the mask rather than a
 * real URL.
 *
 * The masked form is not a documented shape, so this is deliberately loose: a
 * value that is not a URL, or that contains a run of asterisks, is treated as
 * masked. Being wrong in this direction costs a re-paste; being wrong the other
 * way saves `"***"` over a working webhook and silently stops every alert.
 *
 * @param {string|null|undefined} value
 * @returns {boolean}
 */
export function webhookIsMasked(value) {
  if (!value) return false
  if (value.includes('***')) return true
  return !/^https?:\/\//i.test(value)
}

/** One wire `NotificationChannel`. */
export function adaptNotificationChannel(raw) {
  const c = camelizeKeys(raw)
  return {
    id: c.id,
    accountId: c.accountId ?? null,
    name: c.name || '',
    channel: c.channel === 'email' ? 'email' : 'slack',
    events: Array.isArray(c.events) ? c.events : [],
    // Masked on read. Never sent back as-is — see `webhookIsMasked`.
    slackWebhookUrl: c.slackWebhookUrl ?? null,
    emails: Array.isArray(c.emails) ? c.emails : [],
    recurringAlertsPeriodHours: c.recurringAlertsPeriodHours ?? null,
    summarizeBatchNotificationsByTable: Boolean(
      c.summarizeBatchNotificationsByTable
    ),
    isEnabled: Boolean(c.isEnabled),
    createdAt: c.createdAt ?? null,
    updatedAt: c.updatedAt ?? null
  }
}

function channelsPath() {
  return (
    currentAccount.value &&
    `/v1/accounts/${currentAccount.value.id}/notification-channels`
  )
}

/** The body shared by create and update, built from a form payload. */
function channelBody(input, { includeChannel }) {
  return {
    name: input.name,
    ...(includeChannel ? { channel: input.channel } : {}),
    events: input.events ?? [],
    // Omitted rather than sent when the form's value is the mask read back from
    // the API: sending it would overwrite the real webhook with asterisks.
    ...(input.slackWebhookUrl && !webhookIsMasked(input.slackWebhookUrl)
      ? { slack_webhook_url: input.slackWebhookUrl }
      : {}),
    ...(input.emails?.length ? { emails: input.emails } : {}),
    ...(input.recurringAlertsPeriodHours != null
      ? { recurring_alerts_period_hours: input.recurringAlertsPeriodHours }
      : {}),
    summarize_batch_notifications_by_table: Boolean(
      input.summarizeBatchNotificationsByTable
    )
  }
}

export function useNotificationChannels() {
  const {
    data: channels,
    loading,
    error,
    apiMissing,
    load
  } = useMockResource('notification-channels', {
    api: {
      path: channelsPath,
      select: payload => pageItems(payload).map(adaptNotificationChannel)
    }
  })

  function channelPath(id) {
    const base = channelsPath()
    return base && `${base}/${id}`
  }

  async function create(input) {
    const res = await sendMutation({
      method: 'POST',
      path: channelsPath,
      body: channelBody(input, { includeChannel: true })
    })
    if (!res.ok || res.skipped) return res
    const channel = adaptNotificationChannel(camelizeKeys(res.data))
    channels.value = [...channels.value, channel]
    return { ok: true, data: channel }
  }

  /**
   * `PUT`, so this replaces the channel. `channel` itself is not in the update
   * schema — the kind of a channel cannot be changed, only its configuration.
   *
   * @param {string} id
   * @param {object} input
   */
  async function update(id, input) {
    const res = await sendMutation({
      method: 'PUT',
      path: () => channelPath(id),
      body: {
        ...channelBody(input, { includeChannel: false }),
        is_enabled: Boolean(input.isEnabled)
      }
    })
    if (!res.ok) return res
    if (res.skipped) {
      channels.value = channels.value.map(c =>
        c.id === id ? { ...c, ...input } : c
      )
      return res
    }
    const channel = adaptNotificationChannel(camelizeKeys(res.data))
    channels.value = channels.value.map(c => (c.id === id ? channel : c))
    return { ok: true, data: channel }
  }

  /**
   * Enable or pause. Re-sends the whole record because `PUT` replaces it — a
   * body carrying only the flag would drop the recipients.
   */
  async function setEnabled(id, isEnabled) {
    const current = channels.value.find(c => c.id === id)
    if (!current) return { ok: false, error: 'No such notification channel.' }
    return update(id, { ...current, isEnabled })
  }

  /**
   * Send a test alert. A real message goes to the real Slack channel or inbox,
   * which is why the button confirms first rather than firing on the click.
   *
   * @param {string} id
   */
  async function test(id) {
    return sendMutation({
      method: 'POST',
      path: () => {
        const base = channelPath(id)
        return base && `${base}/test`
      }
    })
  }

  async function remove(id) {
    const res = await sendMutation({
      method: 'DELETE',
      path: () => channelPath(id)
    })
    if (res.ok) channels.value = channels.value.filter(c => c.id !== id)
    return res
  }

  return {
    channels,
    loading,
    error,
    apiMissing,
    load,
    create,
    update,
    setEnabled,
    test,
    remove
  }
}
