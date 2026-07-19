import { ref } from 'vue'
import { Notify } from 'quasar'
import { jitsuAnalytics } from '@jitsu/js'

// Sends events TO Jitsu ingestion using the official browser SDK. This is the
// write-side counterpart to useLiveEvents.js (which reads incoming events back
// from the same console). The SDK is bundled via npm, so it is first-party code
// and satisfies the page CSP (script-src 'self'); it POSTs to {HOST}/api/s/...,
// which the CSP connect-src already whitelists for the console origin.
const HOST = import.meta.env.VITE_JITSU_HOST || 'https://console.fanfinity.io'
const WRITE_KEY = import.meta.env.VITE_JITSU_WRITE_KEY || ''

// localStorage key holding the user's consent decision (see JitsuConsentBanner).
export const CONSENT_KEY = 'fanfinity_jitsu_consent'

// Module-scoped singletons so every useJitsu() call shares one client + one
// reactive view of the last event / error.
let client = null
const lastEvent = ref(null)
const error = ref(null)
const privacy = ref(restrictivePrivacy())

// Privacy applied before the banner is answered (or when consent is withdrawn):
// nothing is sent, IPs are stripped, and identify/group are no-ops.
function restrictivePrivacy() {
  return { dontSend: true, ipPolicy: 'stripLastOctet', disableUserIds: true }
}

/**
 * Maps the three-category consent state from the banner onto Jitsu's privacy
 * config (https://jitsu.com/docs/sending-data/consent-management):
 *  - dontSend       : suppress all transmission + cookie storage
 *  - ipPolicy       : 'keep' | 'stripLastOctet'
 *  - disableUserIds : when true, identify()/group() have no effect (PII off)
 *  - consentCategories : mirrored by name so downstream destinations can branch
 */
export function mapConsentToPrivacy(state) {
  const analytics = !!state?.analytics
  const marketing = !!state?.marketing
  return {
    dontSend: !analytics && !marketing,
    ipPolicy: analytics ? 'keep' : 'stripLastOctet',
    disableUserIds: !analytics,
    consentCategories: { necessary: true, analytics, marketing }
  }
}

function getClient() {
  if (!client) {
    client = jitsuAnalytics({ host: HOST, writeKey: WRITE_KEY, debug: true })
    // Apply stored consent on first use; if none, stay restrictive until the
    // user answers the banner so nothing leaks pre-consent.
    let stored = null
    try {
      stored = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null')
    } catch {
      stored = null
    }
    const p = stored ? mapConsentToPrivacy(stored) : restrictivePrivacy()
    privacy.value = p
    client.configure({ privacy: p })
  }
  return client
}

// Wraps an SDK call: records it as the "last event" for on-page feedback,
// surfaces failures via the error ref + a toast, and never throws to the caller.
async function send(method, name, payload) {
  error.value = null
  try {
    const c = getClient()
    const result = await c[method](...payload)
    lastEvent.value = {
      method,
      name,
      args: payload,
      at: new Date().toISOString()
    }
    return result
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    error.value = msg
    Notify.create({
      type: 'negative',
      message: `Jitsu ${method} failed: ${msg}`
    })
    return null
  }
}

export function useJitsu() {
  const page = (name, props) => send('page', `page: ${name}`, [name, props])
  const track = (event, props) =>
    send('track', `track: ${event}`, [event, props])
  const identify = (userId, traits) =>
    send('identify', `identify: ${userId}`, [userId, traits])
  const group = (groupId, traits) =>
    send('group', `group: ${groupId}`, [groupId, traits])

  function configurePrivacy(p) {
    privacy.value = p
    getClient().configure({ privacy: p })
  }

  function setConsent(state) {
    configurePrivacy(mapConsentToPrivacy(state))
  }

  function applyRestrictive() {
    configurePrivacy(restrictivePrivacy())
  }

  function resetIdentity() {
    getClient().reset()
    lastEvent.value = {
      method: 'reset',
      name: 'reset (back to anonymous)',
      args: [],
      at: new Date().toISOString()
    }
  }

  return {
    page,
    track,
    identify,
    group,
    configurePrivacy,
    setConsent,
    applyRestrictive,
    resetIdentity,
    lastEvent,
    error,
    privacy,
    HOST,
    WRITE_KEY
  }
}
