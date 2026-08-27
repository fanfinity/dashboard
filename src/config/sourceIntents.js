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

export const SOURCE_INTENTS = [
  {
    key: 'website',
    title: 'A website',
    body: 'Add one script tag and page views, clicks and custom events start arriving.',
    outcome: 'Web source',
    templates: ['web-sdk'],
    // 24×24 stroke path, drawn here rather than imported: these are six marks
    // used in one place, and src/assets/dashboard/ is <img> with brand purple
    // baked into a stroke attribute, so it cannot take the colour of the card.
    icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m-9 9h18M12 3c2.5 2.4 3.9 5.6 3.9 9S14.5 18.6 12 21c-2.5-2.4-3.9-5.6-3.9-9S9.5 5.4 12 3'
  },
  {
    key: 'app',
    title: 'A mobile app',
    body: 'Our iOS or Android SDK — the same event model on both platforms.',
    outcome: 'App source',
    templates: ['ios-sdk', 'android-sdk'],
    icon: 'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1m4 15h2'
  },
  {
    key: 'backend',
    title: 'My own backend',
    body: 'Send events straight from your server with one HTTP call. No library needed.',
    outcome: 'HTTP API source',
    templates: ['http-api'],
    icon: 'M4 6h16M4 6v4h16V6M4 14h16v4H4zM7 8h.01M7 16h.01'
  },
  {
    key: 'store',
    title: 'An online store',
    body: 'Zid or Shopify. We listen for new orders and customers automatically, no code.',
    outcome: 'Store source',
    templates: ['zid', 'shopify'],
    icon: 'M3 6h18l-1.5 12a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2zM9 10a3 3 0 0 0 6 0'
  },
  {
    key: 'payments',
    title: 'Payments',
    body: 'Stripe. Track payments, subscriptions and invoices as they happen.',
    outcome: 'Payments source',
    templates: ['stripe'],
    icon: 'M2 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 11h20M6 15h3'
  },
  {
    key: 'connector',
    title: 'Something else',
    body: 'Browse pre-built connectors — Firebase, MongoDB, Attio, Linear. One login, no code.',
    outcome: 'Go to Connectors',
    templates: [],
    to: { name: 'sources', query: { tab: 'connectors' } },
    icon: 'M9 3v6m6-6v6M5 9h14v4a7 7 0 0 1-14 0zM12 20v1'
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
