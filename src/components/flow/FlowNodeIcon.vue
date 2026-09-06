<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- Website: a globe. Two meridians rather than one, or it reads as a
         clock face at 18px. -->
    <template v-if="mark === 'web'">
      <circle cx="12" cy="12" r="8.2" />
      <path d="M3.8 12h16.4" />
      <path d="M12 3.8c2.1 2.3 3.2 5.2 3.2 8.2s-1.1 5.9-3.2 8.2" />
      <path d="M12 3.8c-2.1 2.3-3.2 5.2-3.2 8.2s1.1 5.9 3.2 8.2" />
    </template>

    <!-- Online store: a shopping bag. The handle is a separate arc above the
         body, which is why this is a component and not a single `d` string in
         a config file. -->
    <template v-else-if="mark === 'store'">
      <path
        d="M4.6 8.4h14.8l-1.1 11a1.6 1.6 0 0 1-1.6 1.4H7.3a1.6 1.6 0 0 1-1.6-1.4Z"
      />
      <path d="M9 8.4V6.7a3 3 0 0 1 6 0v1.7" />
    </template>

    <!-- Mobile app: a handset with an earpiece and a home line. -->
    <template v-else-if="mark === 'app'">
      <rect x="6.7" y="2.6" width="10.6" height="18.8" rx="2.4" />
      <path d="M10.6 5.4h2.8" />
      <path d="M10.8 18.4h2.4" />
    </template>

    <!-- Your own backend: a stacked server, ports on the left of each tier. -->
    <template v-else-if="mark === 'api'">
      <rect x="3.4" y="4.6" width="17.2" height="6" rx="1.8" />
      <rect x="3.4" y="13.4" width="17.2" height="6" rx="1.8" />
      <path d="M7 7.6h.01" />
      <path d="M7 16.4h.01" />
    </template>

    <!-- Data warehouse: columns in a container. The house mark the prototype
         drew as `▥`, given a border so it reads at chip size. -->
    <template v-else-if="mark === 'warehouse'">
      <rect x="3.6" y="4.4" width="16.8" height="15.2" rx="2" />
      <path d="M8.2 8.6v6.8" />
      <path d="M12 8.6v6.8" />
      <path d="M15.8 8.6v6.8" />
    </template>

    <!-- Ad platform / analytics: a rising bar trio. -->
    <template v-else-if="mark === 'analytics'">
      <path d="M5 19.2V13" />
      <path d="M12 19.2V6.4" />
      <path d="M19 19.2v-9" />
    </template>

    <!-- Webhook / custom endpoint: a link. -->
    <template v-else-if="mark === 'webhook'">
      <path d="M10.2 13.8a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.2 1.2" />
      <path d="M13.8 10.2a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.2-1.2" />
    </template>

    <!-- Anything with no mark of its own: a filled dot inside a ring, which
         reads as "a node" without claiming to be a kind of thing. -->
    <template v-else>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
    </template>
  </svg>
</template>

<script setup>
import { computed } from 'vue'

// The mark inside a FlowNode's chip, chosen from the record's own type string.
//
// DRAWN HERE RATHER THAN KEYED IN A CONFIG FILE, for the reason SourceIntentIcon
// and PersonaIcon give: five of these need more than one element to read — a bag
// needs a handle above the bag, a server needs ports, a globe needs two
// meridians — so as single `d` strings they were subpaths crammed together that
// never closed. A component can hold a `<rect>` and two `<path>`s and stay
// legible.
//
// `stroke="currentColor"` and nothing else, so one mark serves the light chip on
// a list row and the on-ink chip inside the first-run overlay. The brand purple
// baked into `src/assets/dashboard/*.svg` is exactly why those files could not
// be reused here.
const props = defineProps({
  // 'source' | 'destination'. Decides the fallback when the subtype is unknown,
  // and nothing else — the marks themselves are per subtype.
  kind: {
    type: String,
    default: 'source',
    validator: v => ['source', 'destination'].includes(v)
  },
  // The record's `source_type` / `destination_type`, or a template id. Unknown
  // strings fall through to the generic node mark rather than throwing.
  subtype: { type: String, default: '' },
  size: { type: [Number, String], default: 20 }
})

// Both backend enums, plus the template ids the create flow uses, mapped onto
// the seven marks above. Written as a table rather than a chain of `includes`
// so adding a connector is one line and never a new branch.
const MARKS = {
  // SourceType, and the template ids that resolve to each
  web: 'web',
  'web-sdk': 'web',
  zid: 'store',
  salla: 'store',
  shopify: 'store',
  cloud_app: 'store',
  'ios-sdk': 'app',
  'android-sdk': 'app',
  event_stream: 'api',
  'http-api': 'api',
  stripe: 'api',
  // DestinationType
  clickhouse: 'warehouse',
  postgres: 'warehouse',
  bigquery: 'warehouse',
  snowflake: 'warehouse',
  s3: 'warehouse',
  'meta-conversions-api': 'analytics',
  'tiktok-events-api': 'analytics',
  'google-ads': 'analytics',
  webhook: 'webhook',
  // THE MARK NAMES THEMSELVES, so a caller with no record to key off can ask for
  // a glyph by name. `web` and `webhook` above already double as both, and the
  // first-run screens need exactly this: their touchpoints and numbered steps
  // are illustrations of categories, not renderings of a source that exists, so
  // there is no `source_type` or template id to look up. Identity entries rather
  // than a second lookup table, so the two can never disagree about which glyph
  // `store` means.
  store: 'store',
  app: 'app',
  api: 'api',
  warehouse: 'warehouse',
  analytics: 'analytics'
}

const mark = computed(() => {
  const key = String(props.subtype || '').toLowerCase()
  if (MARKS[key]) return MARKS[key]
  // A destination nobody has a mark for is still more usefully a warehouse than
  // a bare dot: every destination this product provisions is one, and the
  // generic ring says nothing at all.
  return props.kind === 'destination' ? 'warehouse' : ''
})
</script>
