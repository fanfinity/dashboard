// Which product modules are switched on — the activation registry.
//
// This is NOT entitlements. `useEntitlements` answers "did this account buy the
// module?" and defaults to optimistically-on, because hiding a module someone
// paid for is worse than briefly showing one they didn't. This file answers a
// different question — "is the module built yet?" — and defaults to off, because
// the CDP core (sources, pipes, destinations) is real and the other fifty screens
// are scaffolding. Folding the two together would give one flag two meanings and
// the wrong default for both, so Engage is gated by both: an entitlement AND an
// activation switch.
//
// PURE DATA ON PURPOSE, like src/router/screens.js: no imports, no Vue. That
// keeps it readable from plain Node and makes activation a data edit.
//
// `key` matches the `group` field on every screen in src/router/screens.js and
// the `key` on every navGroups entry in src/layouts/MainLayout.vue. That one
// identifier is what ties a sidebar row to its routes, so there is no second
// path→feature table to keep in sync. src/router/routes.js throws at module load
// if a screen names a group that is missing here.
//
// TO ACTIVATE A MODULE PERMANENTLY: flip `enabled` to true here. That changes
// the default for every browser and every teammate. The toggles under
// Settings → Feature activation override this per-browser via localStorage,
// which is for trying a screen out, not for shipping it.
export const FEATURES = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'The landing screen — headline numbers and recent activity.',
    enabled: true
  },
  // The CDP core, listed in the same order the sidebar shows it — Settings →
  // Feature activation renders this array as-is, so the two reading differently
  // is the kind of small mismatch that makes the panel hard to scan.
  {
    key: 'live-events',
    label: 'Live events',
    description: 'The raw incoming event feed, read from the backend.',
    enabled: true
  },
  {
    key: 'sources',
    label: 'Sources',
    description:
      'Event streams feeding the fan graph, plus the connector catalog.',
    enabled: true
  },
  {
    key: 'destinations',
    label: 'Destinations',
    description: 'Where resolved events and profiles get delivered.',
    enabled: true
  },
  {
    key: 'pipes',
    label: 'Pipes',
    description:
      'Transformations carrying events from a source to a destination.',
    enabled: true
  },
  {
    // The switchboard cannot switch itself off — `locked` renders its toggle
    // disabled. Without this, one click makes Feature activation unreachable and
    // the only way back is clearing localStorage by hand.
    key: 'settings',
    label: 'Settings',
    description:
      'Workspace settings, members, API tokens — and this activation panel.',
    enabled: true,
    locked: true
  },
  {
    key: 'warehouse',
    label: 'Warehouse',
    description: 'Warehouse connections, syncs and models.',
    enabled: true
  },
  {
    key: 'dwh-syncs',
    label: 'DWH syncs',
    description:
      'Scheduled copies of collected events between a source and a warehouse.',
    enabled: false
  },
  {
    key: 'warehouse-models',
    label: 'Warehouse models',
    description: 'Named selects against a warehouse connection.',
    enabled: false
  },
  {
    key: 'identity-resolution',
    label: 'Identity resolution',
    description: 'Identity stitching over the fan graph.',
    enabled: false
  },
  {
    key: 'attributes',
    label: 'Attributes',
    description: 'Fan profile attributes.',
    enabled: false
  },
  {
    key: 'profile-api',
    label: 'Profile API',
    description: 'API for profile access.',
    enabled: false
  },
  {
    key: 'live-profile-syncs',
    label: 'Live profile syncs',
    description: 'Real-time profile synchronization.',
    enabled: false
  },
  {
    key: 'profile-dwh-syncs',
    label: 'Profile DWH syncs',
    description: 'Batch writes of profiles to warehouses.',
    enabled: false
  },
  {
    key: 'monitoring',
    label: 'Monitoring',
    description: 'Delivery errors and pipeline health.',
    enabled: true
  },
  {
    key: 'profiles',
    label: 'Profiles',
    description:
      'Profile search, identity resolution, attributes and the profile API.',
    enabled: true
  },
  {
    key: 'audiences',
    label: 'Audiences',
    description: 'Segment definitions built over the fan graph.',
    enabled: false
  },
  {
    key: 'campaigns',
    label: 'Campaigns',
    description: 'Journeys, goals, email, assets, catalogs and channels.',
    enabled: false
  },
  {
    key: 'engage',
    label: 'Engage',
    description:
      'Surveys and the operator work log. Also gated by the engage entitlement.',
    enabled: false
  },
  {
    key: 'reporting',
    label: 'Reporting',
    description: 'Cross-module reporting and exports.',
    enabled: false
  },
  {
    key: 'demo',
    label: 'Demo lab',
    description: 'The demo store and event inspector.',
    enabled: false
  },
  {
    key: 'secrets',
    label: 'Secrets',
    description: 'Credentials shared across sources and destinations.',
    enabled: true
  },
  {
    key: 'authorizations',
    label: 'Authorizations',
    description: 'OAuth grants and per-integration authorizations.',
    enabled: true
  }
]

// Every key that exists, for the module-load check in src/router/routes.js.
export const FEATURE_KEYS = FEATURES.map(f => f.key)

export default FEATURES
