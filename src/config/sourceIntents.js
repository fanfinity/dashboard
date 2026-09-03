// What someone is actually trying to connect, in their words rather than ours.
//
// The create flow used to open on a grid of templates — "Web SDK", "HTTP API",
// "Zid" — which asks the reader to already know our vocabulary. This registry is
// the layer above: six plain-English intents, each resolving to the templates
// that serve it. "A mobile app" is one card that leads to two templates; "My own
// backend" is one card that leads to one.
//
// PURE DATA ON PURPOSE, same idiom as src/config/features.js and
// src/config/personas.js: no imports, no Vue, no `@/` aliases. An intent is a
// content decision, and content decisions should not require reading a
// component.
//
// `templates` are ids in public/data/source-templates.json (and in the live
// template list, which uses the same ids). An intent whose templates are all
// missing is filtered out of the picker rather than leading to a dead step —
// see SourceIntentPicker.
//
// `to` is the escape hatch: an intent that is not a template at all but a
// different screen. Only `connector` uses it.
//
// THE MARKS ARE NOT HERE. Each entry used to carry an `icon` string — one 24x24
// path — and five of the six marks need more than one element to read (a phone
// needs an earpiece, a server needs ports, a bag needs a handle above the bag),
// so they were subpaths crammed into one `d` that never closed. They live in
// SourceIntentIcon.vue now, keyed by `key`, the same way PersonaIcon.vue holds
// the persona marks. Adding an intent means adding a branch there too.

export const SOURCE_INTENTS = [
  {
    key: 'website',
    title: 'A website',
    body: 'Add one script tag and page views, clicks and custom events start arriving.',
    outcome: 'Web source',
    templates: ['web-sdk']
  },
  {
    key: 'app',
    title: 'A mobile app',
    body: 'Our iOS or Android SDK, with the same event model on both platforms.',
    outcome: 'App source',
    templates: ['ios-sdk', 'android-sdk']
  },
  {
    key: 'backend',
    title: 'My own backend',
    body: 'Send events straight from your server with one HTTP call. No library needed.',
    outcome: 'HTTP API source',
    templates: ['http-api']
  },
  {
    key: 'store',
    title: 'An online store',
    body: 'Zid, Salla or Shopify. We listen for new orders and customers automatically, no code.',
    outcome: 'Store source',
    templates: ['zid', 'salla', 'shopify']
  },
  {
    key: 'payments',
    title: 'Payments',
    body: 'Stripe. Track payments, subscriptions and invoices as they happen.',
    outcome: 'Payments source',
    templates: ['stripe']
  },
  {
    key: 'connector',
    title: 'Something else',
    body: 'Browse pre-built connectors: Firebase, MongoDB, Attio, Linear. One login, no code.',
    outcome: 'Go to Connectors',
    templates: [],
    to: { name: 'sources', query: { tab: 'connectors' } }
  }
]

/** The intent a template belongs to, for pre-selecting the picker on re-entry. */
export function intentForTemplate(templateId) {
  return SOURCE_INTENTS.find(i => i.templates.includes(templateId))?.key ?? ''
}

export function intentByKey(key) {
  return SOURCE_INTENTS.find(i => i.key === key) ?? null
}

export default SOURCE_INTENTS
