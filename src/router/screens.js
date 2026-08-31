// Screen manifest — the single source of truth for every route in the app.
//
// PURE DATA ON PURPOSE: no imports, no `@/` aliases, no Vue. That lets plain Node
// read this file (scripts/smoke.mjs imports it directly to walk every route), and
// it lets src/router/routes.js build the route table without hand-editing.
//
// Adding or renaming a screen is an edit here; implementing one is a rewrite of
// the component file this points at. An entry whose page file is missing throws
// at module load rather than 404-ing silently.
//
// Fields:
//   path         router path; ':id' segments need `smokeParams` to be smoke-testable
//   name         unique route name
//   component    path under src/pages/
//   title        shown in nav + <h1>; also route meta.title
//   group        nav group key AND feature-activation key — see below
//   issue        GitHub issue implementing this screen
//   parent       { name, label } of the screen this one drills down FROM — the
//                back target PageHeader renders. Omit on a top-level screen
//                (the sidebar is its nav, and a back arrow there points nowhere)
//   smokeParams  params substituted by scripts/smoke.mjs; ids MUST exist in public/data/
//
// ORDER MATTERS: static paths precede dynamic ones, so /sources/new wins over
// /sources/:id. The sort that produced this file enforces it; keep it that way.
//
// `group` DOES THREE JOBS, so it has to be right. It picks the sidebar section
// (src/layouts/MainLayout.vue navGroups), and it is the feature-activation key
// (src/config/features.js) that decides whether this route renders its real page
// or ComingSoonPanel. It used to be nav-group-ish and had drifted — /audiences
// claimed `engage`, /demo-store claimed `sources` — which was harmless while it
// was only a label and is not harmless now that it gates the route. routes.js
// throws at module load if a group here has no entry in features.js, which is
// what keeps the two files from drifting apart again.

// `parent` IS THE BACK BUTTON, and it is declared rather than derived, twice
// over. Not from the path, because '/profiles/search' and '/channels/email' have
// no '/profiles' or '/channels' route to return to; and not from the parent's own
// `title`, which is free to say 'Add a warehouse model' where the nav row says
// 'Warehouse models', and a back button has to say what the nav says.
//
// Deliberately NOT history: router.back() is empty on a cold load, which is every
// deep link from Slack and every route scripts/smoke.mjs visits, so the one place
// the control matters most is the one place history cannot answer. routes.js
// throws at module load if `parent.name` is not a screen here.

export const screens = [
  {
    path: '/',
    name: 'dashboard-home',
    component: 'shell/DashboardHomePage.vue',
    title: 'Dashboard home',
    group: 'dashboard',
    issue: 16
  },
  {
    path: '/assets',
    name: 'assets',
    component: 'engage/content/AssetsListPage.vue',
    title: 'Assets',
    group: 'campaigns',
    issue: 17
  },
  {
    path: '/attributes',
    name: 'attributes',
    component: 'profiles/attributes/AttributesListPage.vue',
    title: 'Attributes',
    group: 'profiles',
    issue: 18
  },
  {
    path: '/audiences',
    name: 'audiences',
    component: 'engage/audience/AudiencesListPage.vue',
    title: 'Audiences',
    group: 'audiences',
    issue: 21
  },
  {
    path: '/authorizations',
    name: 'authorizations',
    component: 'settings/AuthorizationsPage.vue',
    title: 'Authorizations',
    group: 'authorizations',
    issue: 22
  },
  {
    path: '/billing',
    name: 'billing',
    component: 'account/BillingPage.vue',
    title: 'Billing',
    group: 'billing'
  },
  {
    path: '/catalogs',
    name: 'catalogs',
    component: 'engage/content/CatalogsListPage.vue',
    title: 'Catalogs',
    group: 'campaigns',
    issue: 23
  },
  {
    path: '/demo-event-inspector',
    name: 'demo-event-inspector',
    component: 'demo/DemoEventInspectorPage.vue',
    title: 'Demo event inspector',
    group: 'demo',
    issue: 26
  },
  {
    path: '/demo-store',
    name: 'demo-store',
    component: 'demo/DemoStorePage.vue',
    title: 'Demo store',
    group: 'demo',
    issue: 27
  },
  {
    path: '/destinations',
    name: 'destinations',
    component: 'destinations/DestinationsListPage.vue',
    title: 'Destinations',
    group: 'destinations',
    issue: 28
  },
  {
    path: '/dwh-connections',
    name: 'dwh-connections',
    component: 'warehouse/connections/DwhConnectionsListPage.vue',
    title: 'Warehouse connections',
    group: 'warehouse',
    issue: 32
  },
  {
    path: '/dwh-syncs',
    name: 'dwh-syncs',
    component: 'warehouse/syncs/DwhSyncsListPage.vue',
    title: 'Warehouse syncs',
    group: 'warehouse',
    issue: 35
  },
  {
    path: '/engage-settings',
    name: 'engage-settings',
    component: 'engage/channels/EngageSettingsPage.vue',
    title: 'Engage settings',
    group: 'engage',
    issue: 39
  },
  {
    path: '/errors',
    name: 'errors',
    component: 'monitoring/ErrorsListPage.vue',
    title: 'Errors',
    group: 'monitoring',
    issue: 40
  },
  {
    path: '/functions',
    name: 'functions',
    component: 'functions/FunctionsListPage.vue',
    title: 'Functions',
    group: 'functions',
    issue: 48
  },
  {
    path: '/functions/new',
    name: 'functions-new',
    component: 'functions/FunctionCreatePage.vue',
    title: 'Write a function',
    group: 'functions',
    parent: { name: 'functions', label: 'Functions' },
    issue: 48
  },
  {
    path: '/functions/:id',
    name: 'functions-detail',
    component: 'functions/FunctionDetailPage.vue',
    title: 'Function detail',
    group: 'functions',
    parent: { name: 'functions', label: 'Functions' },
    issue: 48,
    // Has to resolve in public/data/functions.json — the smoke run walks this
    // route in whatever data-source mode the profile is in, and an id that
    // matches nothing renders the not-found EmptyState rather than the screen.
    smokeParams: { id: 'fn_drop_internal' }
  },
  {
    path: '/goals',
    name: 'goals',
    component: 'engage/audience/GoalsListPage.vue',
    title: 'Goals',
    group: 'campaigns',
    issue: 41
  },
  {
    path: '/health',
    name: 'health',
    component: 'monitoring/HealthPage.vue',
    title: 'Health',
    group: 'monitoring',
    issue: 42
  },
  {
    path: '/journeys',
    name: 'journeys',
    component: 'engage/audience/JourneysListPage.vue',
    title: 'Journeys',
    group: 'campaigns',
    issue: 43
  },
  {
    path: '/live-profile-syncs',
    name: 'live-profile-syncs',
    component: 'profiles/live-syncs/LiveProfileSyncsListPage.vue',
    title: 'Live profile syncs',
    group: 'profiles',
    issue: 44
  },
  {
    path: '/pipes',
    name: 'pipes',
    component: 'pipes/PipesListPage.vue',
    title: 'Pipes',
    group: 'pipes',
    issue: 47
  },
  {
    path: '/profile-api',
    name: 'profile-api',
    component: 'profiles/api/ProfileApiListPage.vue',
    title: 'Profile API',
    group: 'profiles',
    issue: 51
  },
  {
    path: '/profile-builders',
    name: 'profile-builders',
    component: 'profiles/builders/ProfileBuildersListPage.vue',
    title: 'Profile builders',
    // `profiles`, matching every other screen under that module: the sidebar's
    // per-child key (`profile-builders` in features.js) gates the nav row, and
    // the screen's `group` is what MainLayout's feature gate reads.
    group: 'profiles',
    issue: 51
  },
  {
    path: '/profile-dwh-syncs',
    name: 'profile-dwh-syncs',
    component: 'profiles/dwh-syncs/ProfileDwhSyncsListPage.vue',
    title: 'Profile warehouse syncs',
    group: 'profiles',
    issue: 54
  },
  {
    path: '/reporting',
    name: 'reporting',
    component: 'monitoring/ReportingPage.vue',
    title: 'Reporting',
    group: 'reporting',
    issue: 59
  },
  {
    path: '/secrets',
    name: 'secrets',
    component: 'settings/SecretsPage.vue',
    title: 'Secrets',
    group: 'secrets',
    issue: 60
  },
  {
    path: '/settings',
    name: 'settings',
    component: 'settings/SettingsPage.vue',
    title: 'Settings',
    group: 'settings',
    issue: 61
  },
  {
    path: '/sources',
    name: 'sources',
    component: 'sources/SourcesListPage.vue',
    title: 'Sources',
    group: 'sources',
    issue: 62
  },
  {
    path: '/surveys',
    name: 'surveys',
    component: 'engage/audience/SurveysListPage.vue',
    title: 'Surveys',
    group: 'engage',
    issue: 66
  },
  {
    path: '/team',
    name: 'team',
    component: 'account/TeamPage.vue',
    title: 'Team & roles',
    group: 'team'
  },
  {
    path: '/warehouse-models',
    name: 'warehouse-models',
    component: 'warehouse/models/WarehouseModelsListPage.vue',
    title: 'Warehouse models',
    group: 'warehouse',
    issue: 67
  },
  {
    path: '/attributes/new',
    name: 'attributes-new',
    component: 'profiles/attributes/AttributeCreatePage.vue',
    title: 'Add an attribute',
    group: 'profiles',
    parent: { name: 'attributes', label: 'Attributes' },
    issue: 19
  },
  {
    path: '/attributes/trash',
    name: 'attributes-trash',
    component: 'profiles/attributes/AttributesTrashPage.vue',
    title: 'Attributes trash',
    group: 'profiles',
    parent: { name: 'attributes', label: 'Attributes' },
    issue: 20
  },
  {
    path: '/channels/email',
    name: 'channels-email',
    component: 'engage/channels/ChannelsEmailPage.vue',
    title: 'Email channel',
    group: 'campaigns',
    issue: 24
  },
  {
    path: '/channels/settings',
    name: 'channels-settings',
    component: 'engage/channels/ChannelsSettingsPage.vue',
    title: 'Channel settings',
    group: 'campaigns',
    issue: 25
  },
  {
    path: '/destinations/new',
    name: 'destinations-new',
    component: 'destinations/DestinationCreatePage.vue',
    title: 'Add a destination',
    group: 'destinations',
    parent: { name: 'destinations', label: 'Destinations' },
    issue: 30
  },
  {
    path: '/destinations/trash',
    name: 'destinations-trash',
    component: 'destinations/DestinationsTrashPage.vue',
    title: 'Destinations trash',
    group: 'destinations',
    parent: { name: 'destinations', label: 'Destinations' },
    issue: 31
  },
  {
    path: '/dwh-connections/new',
    name: 'dwh-connections-new',
    component: 'warehouse/connections/DwhConnectionCreatePage.vue',
    title: 'Add a warehouse connection',
    group: 'warehouse',
    parent: { name: 'dwh-connections', label: 'Warehouse connections' },
    issue: 33
  },
  {
    path: '/dwh-connections/trash',
    name: 'dwh-connections-trash',
    component: 'warehouse/connections/DwhConnectionsTrashPage.vue',
    title: 'Warehouse connections trash',
    group: 'warehouse',
    parent: { name: 'dwh-connections', label: 'Warehouse connections' },
    issue: 34
  },
  {
    path: '/dwh-syncs/new',
    name: 'dwh-syncs-new',
    component: 'warehouse/syncs/DwhSyncCreatePage.vue',
    title: 'Add a warehouse sync',
    group: 'warehouse',
    parent: { name: 'dwh-syncs', label: 'DWH syncs' },
    issue: 36
  },
  {
    path: '/dwh-syncs/trash',
    name: 'dwh-syncs-trash',
    component: 'warehouse/syncs/DwhSyncsTrashPage.vue',
    title: 'Warehouse syncs trash',
    group: 'warehouse',
    parent: { name: 'dwh-syncs', label: 'DWH syncs' },
    issue: 37
  },
  {
    path: '/engage-operator/work-log',
    name: 'engage-operator-work-log',
    component: 'engage/channels/EngageOperatorWorkLogPage.vue',
    title: 'Operator work log',
    group: 'engage',
    issue: 38
  },
  {
    path: '/live-profile-syncs/new',
    name: 'live-profile-syncs-new',
    component: 'profiles/live-syncs/LiveProfileSyncCreatePage.vue',
    title: 'Add a live profile sync',
    group: 'profiles',
    parent: { name: 'live-profile-syncs', label: 'Live profile syncs' },
    issue: 45
  },
  {
    path: '/live-profile-syncs/trash',
    name: 'live-profile-syncs-trash',
    component: 'profiles/live-syncs/LiveProfileSyncsTrashPage.vue',
    title: 'Live profile syncs trash',
    group: 'profiles',
    parent: { name: 'live-profile-syncs', label: 'Live profile syncs' },
    issue: 46
  },
  {
    path: '/pipes/new',
    name: 'pipes-new',
    component: 'pipes/PipeCreatePage.vue',
    title: 'Add a pipe',
    group: 'pipes',
    parent: { name: 'pipes', label: 'Pipes' },
    issue: 49
  },
  {
    path: '/pipes/trash',
    name: 'pipes-trash',
    component: 'pipes/PipesTrashPage.vue',
    title: 'Pipes trash',
    group: 'pipes',
    parent: { name: 'pipes', label: 'Pipes' },
    issue: 50
  },
  {
    path: '/profile-api-endpoints/new',
    name: 'profile-api-endpoints-new',
    component: 'profiles/api/ProfileApiEndpointCreatePage.vue',
    title: 'Add a profile API endpoint',
    group: 'profiles',
    parent: { name: 'profile-api', label: 'Profile API' },
    issue: 52
  },
  {
    path: '/profile-api-endpoints/trash',
    name: 'profile-api-endpoints-trash',
    component: 'profiles/api/ProfileApiEndpointsTrashPage.vue',
    title: 'Profile API endpoints trash',
    group: 'profiles',
    parent: { name: 'profile-api', label: 'Profile API' },
    issue: 53
  },
  {
    path: '/profile-dwh-syncs/new',
    name: 'profile-dwh-syncs-new',
    component: 'profiles/dwh-syncs/ProfileDwhSyncCreatePage.vue',
    title: 'Add a profile warehouse sync',
    group: 'profiles',
    parent: { name: 'profile-dwh-syncs', label: 'Profile DWH syncs' },
    issue: 55
  },
  {
    path: '/profile-dwh-syncs/trash',
    name: 'profile-dwh-syncs-trash',
    component: 'profiles/dwh-syncs/ProfileDwhSyncsTrashPage.vue',
    title: 'Profile warehouse syncs trash',
    group: 'profiles',
    parent: { name: 'profile-dwh-syncs', label: 'Profile DWH syncs' },
    issue: 56
  },
  {
    path: '/profiles/identity-resolution',
    name: 'profiles-identity-resolution',
    component: 'profiles/core/IdentityResolutionPage.vue',
    title: 'Identity resolution',
    group: 'profiles',
    issue: 57
  },
  {
    path: '/profiles/search',
    name: 'profiles-search',
    component: 'profiles/core/ProfileSearchPage.vue',
    title: 'Profile search',
    group: 'profiles',
    issue: 58
  },
  {
    path: '/sources/new',
    name: 'sources-new',
    component: 'sources/SourceCreatePage.vue',
    title: 'Add a source',
    group: 'sources',
    parent: { name: 'sources', label: 'Sources' },
    issue: 64
  },
  {
    path: '/sources/trash',
    name: 'sources-trash',
    component: 'sources/SourcesTrashPage.vue',
    title: 'Sources trash',
    group: 'sources',
    parent: { name: 'sources', label: 'Sources' },
    issue: 65
  },
  {
    path: '/warehouse-models/new',
    name: 'warehouse-models-new',
    component: 'warehouse/models/WarehouseModelCreatePage.vue',
    title: 'Add a warehouse model',
    group: 'warehouse',
    parent: { name: 'warehouse-models', label: 'Warehouse models' },
    issue: 68
  },
  {
    path: '/warehouse-models/trash',
    name: 'warehouse-models-trash',
    component: 'warehouse/models/WarehouseModelsTrashPage.vue',
    title: 'Warehouse models trash',
    group: 'warehouse',
    parent: { name: 'warehouse-models', label: 'Warehouse models' },
    issue: 69
  },
  {
    path: '/destinations/:id',
    name: 'destinations-detail',
    component: 'destinations/DestinationDetailPage.vue',
    title: 'Destination detail',
    group: 'destinations',
    parent: { name: 'destinations', label: 'Destinations' },
    issue: 29,
    smokeParams: { id: 'dst_snowflake' }
  },
  {
    path: '/pipes/:id',
    name: 'pipes-detail',
    component: 'pipes/PipeDetailPage.vue',
    title: 'Pipe detail',
    group: 'pipes',
    parent: { name: 'pipes', label: 'Pipes' },
    issue: 48,
    smokeParams: { id: 'pipe_web_to_snowflake' }
  },
  {
    path: '/sources/:id',
    name: 'sources-detail',
    component: 'sources/SourceDetailPage.vue',
    title: 'Source detail',
    group: 'sources',
    parent: { name: 'sources', label: 'Sources' },
    issue: 63,
    smokeParams: { id: 'src_web_sdk' }
  }
]

// The pre-existing pages that survived the legacy consolidation: the ones with
// no equivalent among the screens above. The other eight were duplicates of a
// product screen — a second, bespoke surface for the same concept, and none of
// them backed by real data — so they were deleted rather than ported. Dead URLs:
// /fan-overview, /contacts, /contacts/:email, /identity-resolution, /segments,
// /activation, /communications, /integrations. The catch-all in routes.js 404s
// them; there are deliberately no redirects.
//
// These are routed exactly like `screens` but are NOT walked by
// scripts/smoke.mjs, which imports `screens` alone.
//
// /live-events used to be excluded for a concrete reason: it read a third-party
// events console through the /japi dev proxy, and `pnpm smoke:dist` serves a
// production build where no proxy exists, so the failed request would fail the
// gate for a reason that had nothing to do with the screen. That reason is
// gone — it now reads GET /v1/accounts/{account}/events/live through the same
// data-source gate as every other screen, and mock mode serves
// public/data/live-events.json, so
// nothing about it is dev-only any more. Promoting it into `screens` is a
// deliberate, separate change (it adds a route to the gate's walk); it is
// left here only because nobody has made that call yet, not because it
// cannot be made.
//
// /connectors used to live here. It is now a tab inside /sources rather than a
// route of its own — routes.js redirects the old URL to /sources?tab=connectors.
//
// /events-demo used to live here too. It drove a third-party ingestion SDK
// straight from the browser behind a consent banner; the dashboard has no
// ingestion path any more, so the page, its banner and the SDK were deleted
// rather than rewired. There is deliberately no redirect.
export const legacyScreens = [
  {
    path: '/live-events',
    name: 'live-events',
    component: 'LiveEventsPage.vue',
    title: 'Live Events',
    group: 'live-events'
  }
]

export const allScreens = [...screens, ...legacyScreens]

export default allScreens
