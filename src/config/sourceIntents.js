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
// `hero` marks the two intents that are the reason this screen exists. A website
// and an online store are what people actually connect; the other four are the
// long tail. Six equal cards in a 3x2 grid said all six were equally likely,
// which is a layout stating something untrue about the product. The picker reads
// this to build two rows rather than one grid — a flag here, not a hardcoded
// `key === 'website'` in the component, so promoting a third takes one line.
//
// THE MARKS ARE NOT HERE. Each entry used to carry an `icon` string — one 24x24
// path — and five of the six marks need more than one element to read (a phone
// needs an earpiece, a server needs ports, a bag needs a handle above the bag),
// so they were subpaths crammed into one `d` that never closed. They live in
// SourceIntentIcon.vue now, keyed by `key`, the same way PersonaIcon.vue holds
// the persona marks. Adding an intent means adding a branch there too.
//
// `body` IS SEGMENTS, NOT A SENTENCE, and that is the one shape decision here
// worth defending. The words that let someone scan six cards and find their own
// stack are the proper nouns — Zid, Shopify, Stripe, iOS, Android — so they are
// emphasised. The alternatives were both worse: HTML in a data file means
// `v-html` at the render site, and a sibling list of terms means the component
// runs a regex over user-visible copy on every render and silently emphasises
// the wrong half of a word the day someone writes "Android" inside "Androids".
// Segments are pre-split at authoring time, so the component only ever loops.
// A plain string is still legal for a card with nothing to emphasise; the picker
// normalises both.

export const SOURCE_INTENTS = [
  {
    key: 'website',
    title: 'A website',
    body: [
      { text: 'Add one ' },
      { text: 'script tag', strong: true },
      { text: ' and page views, clicks and custom events start arriving.' }
    ],
    outcome: 'Web source',
    hero: true,
    templates: ['web-sdk']
  },
  {
    key: 'store',
    title: 'An online store',
    body: [
      { text: 'Zid', strong: true },
      { text: ' or ' },
      { text: 'Shopify', strong: true },
      {
        text: '. We listen for new orders and customers automatically, no code.'
      }
    ],
    outcome: 'Store source',
    hero: true,
    templates: ['zid', 'shopify']
  },
  {
    key: 'app',
    title: 'A mobile app',
    body: [
      { text: 'Our ' },
      { text: 'iOS', strong: true },
      { text: ' or ' },
      { text: 'Android', strong: true },
      { text: ' SDK, with the same event model on both platforms.' }
    ],
    outcome: 'App source',
    templates: ['ios-sdk', 'android-sdk']
  },
  {
    key: 'backend',
    title: 'My own backend',
    body: [
      { text: 'Send events straight from your server with one ' },
      { text: 'HTTP call', strong: true },
      { text: '. No library needed.' }
    ],
    outcome: 'HTTP API source',
    templates: ['http-api']
  },
  {
    key: 'payments',
    title: 'Payments',
    body: [
      { text: 'Stripe', strong: true },
      { text: '. Track payments, subscriptions and invoices as they happen.' }
    ],
    outcome: 'Payments source',
    templates: ['stripe']
  },
  {
    key: 'connector',
    title: 'Something else',
    body: [
      { text: 'Browse pre-built connectors: ' },
      { text: 'Firebase', strong: true },
      { text: ', ' },
      { text: 'MongoDB', strong: true },
      { text: ', Attio, Linear. One login, no code.' }
    ],
    outcome: 'Go to Connectors',
    templates: [],
    to: { name: 'sources', query: { tab: 'connectors' } }
  }
]

// Templates that exist in the catalog but cannot yet receive a single event.
//
// Both are real rows in source-templates.json and both create a real source, and
// then the install guide says "Nothing to install" — because there is no OAuth
// handshake and no connector wiring behind either. A source built from one of
// these is inert, and the person who built it has no way to find that out except
// by waiting for data that never comes. Offering it silently is the failure;
// offering it greyed and labelled is the honest version of the same catalog.
//
// THIS LIST IS THE ONE SWITCH. The day Shopify's connector ships, deleting its
// id here re-enables the card, the intent and the submit — there is no
// `id === 'shopify'` anywhere in a template to hunt down.
export const COMING_SOON_TEMPLATE_IDS = ['shopify', 'stripe']

export function isTemplateComingSoon(templateId) {
  return COMING_SOON_TEMPLATE_IDS.includes(templateId)
}

/**
 * An intent is coming-soon when every template behind it is — Payments, whose
 * only template is Stripe. Derived rather than flagged so the two can never
 * disagree: "An online store" keeps Zid live and shows Shopify greyed inside it,
 * and it goes back to fully live on its own the day Shopify does.
 *
 * The length guard is not defensive noise: `[].every()` is `true`, and
 * `connector` carries no templates at all, so without it the one intent that
 * always works would render as coming-soon.
 */
export function isIntentComingSoon(intent) {
  if (!intent || intent.to) return false
  return (
    intent.templates.length > 0 && intent.templates.every(isTemplateComingSoon)
  )
}

/** The intent a template belongs to, for pre-selecting the picker on re-entry. */
export function intentForTemplate(templateId) {
  return SOURCE_INTENTS.find(i => i.templates.includes(templateId))?.key ?? ''
}

export function intentByKey(key) {
  return SOURCE_INTENTS.find(i => i.key === key) ?? null
}

export default SOURCE_INTENTS
