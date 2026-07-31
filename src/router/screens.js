// Screen manifest — the single source of truth for every route in the app.
//
// PURE DATA ON PURPOSE: no imports, no `@/` aliases, no Vue. That lets plain Node
// read this file (scripts/smoke.mjs imports it directly to walk every route), and
// it lets src/router/routes.js build the route table without hand-editing.
//
// FROZEN. Adding or renaming a screen is a foundation-phase change, not story work.
// Story agents rewrite the component file this points at; they never touch this.
//
// Fields:
//   path         router path; ':id' segments need `smokeParams` to be smoke-testable
//   name         unique route name
//   component    path under src/pages/
//   title        shown in nav + <h1>; also route meta.title
//   group        nav group key (see src/layouts/MainLayout.vue navGroups)
//   issue        GitHub issue implementing this screen
//   smokeParams  params substituted by scripts/smoke.mjs; ids MUST exist in public/data/
//
// ORDER MATTERS: static paths precede dynamic ones, so /sources/new wins over
// /sources/:id. The sort that produced this file enforces it; keep it that way.

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
    title: 'Assets — list view',
    group: 'engage',
    issue: 17
  },
  {
    path: '/attributes',
    name: 'attributes',
    component: 'profiles/attributes/AttributesListPage.vue',
    title: 'Attributes — list view',
    group: 'profiles',
    issue: 18
  },
  {
    path: '/audiences',
    name: 'audiences',
    component: 'engage/audience/AudiencesListPage.vue',
    title: 'Audiences — list view',
    group: 'engage',
    issue: 21
  },
  {
    path: '/authorizations',
    name: 'authorizations',
    component: 'settings/AuthorizationsPage.vue',
    title: 'Authorizations — list view',
    group: 'settings',
    issue: 22
  },
  {
    path: '/catalogs',
    name: 'catalogs',
    component: 'engage/content/CatalogsListPage.vue',
    title: 'Catalogs — list view',
    group: 'engage',
    issue: 23
  },
  {
    path: '/demo-event-inspector',
    name: 'demo-event-inspector',
    component: 'demo/DemoEventInspectorPage.vue',
    title: 'Demo Event Inspector — list view',
    group: 'sources',
    issue: 26
  },
  {
    path: '/demo-store',
    name: 'demo-store',
    component: 'demo/DemoStorePage.vue',
    title: 'Demo Store — list view',
    group: 'sources',
    issue: 27
  },
  {
    path: '/destinations',
    name: 'destinations',
    component: 'destinations/DestinationsListPage.vue',
    title: 'Destinations — list view',
    group: 'destinations',
    issue: 28
  },
  {
    path: '/dwh-connections',
    name: 'dwh-connections',
    component: 'warehouse/connections/DwhConnectionsListPage.vue',
    title: 'DWH Connections — list view',
    group: 'warehouse',
    issue: 32
  },
  {
    path: '/dwh-syncs',
    name: 'dwh-syncs',
    component: 'warehouse/syncs/DwhSyncsListPage.vue',
    title: 'DWH Syncs — list view',
    group: 'warehouse',
    issue: 35
  },
  {
    path: '/engage-settings',
    name: 'engage-settings',
    component: 'engage/channels/EngageSettingsPage.vue',
    title: 'Engage Settings — list view',
    group: 'engage',
    issue: 39
  },
  {
    path: '/errors',
    name: 'errors',
    component: 'monitoring/ErrorsListPage.vue',
    title: 'Errors — list view',
    group: 'monitoring',
    issue: 40
  },
  {
    path: '/goals',
    name: 'goals',
    component: 'engage/audience/GoalsListPage.vue',
    title: 'Goals — list view',
    group: 'engage',
    issue: 41
  },
  {
    path: '/health',
    name: 'health',
    component: 'monitoring/HealthPage.vue',
    title: 'Health — list view',
    group: 'monitoring',
    issue: 42
  },
  {
    path: '/journeys',
    name: 'journeys',
    component: 'engage/audience/JourneysListPage.vue',
    title: 'Journeys — list view',
    group: 'engage',
    issue: 43
  },
  {
    path: '/live-profile-syncs',
    name: 'live-profile-syncs',
    component: 'profiles/live-syncs/LiveProfileSyncsListPage.vue',
    title: 'Live Profile Syncs — list view',
    group: 'profiles',
    issue: 44
  },
  {
    path: '/pipes',
    name: 'pipes',
    component: 'pipes/PipesListPage.vue',
    title: 'Pipes — list view',
    group: 'pipes',
    issue: 47
  },
  {
    path: '/profile-api',
    name: 'profile-api',
    component: 'profiles/api/ProfileApiListPage.vue',
    title: 'Profile API — list view',
    group: 'profiles',
    issue: 51
  },
  {
    path: '/profile-dwh-syncs',
    name: 'profile-dwh-syncs',
    component: 'profiles/dwh-syncs/ProfileDwhSyncsListPage.vue',
    title: 'Profile DWH Syncs — list view',
    group: 'profiles',
    issue: 54
  },
  {
    path: '/reporting',
    name: 'reporting',
    component: 'monitoring/ReportingPage.vue',
    title: 'Reporting — list view',
    group: 'monitoring',
    issue: 59
  },
  {
    path: '/secrets',
    name: 'secrets',
    component: 'settings/SecretsPage.vue',
    title: 'Secrets — list view',
    group: 'settings',
    issue: 60
  },
  {
    path: '/settings',
    name: 'settings',
    component: 'settings/SettingsPage.vue',
    title: 'Settings — list view',
    group: 'settings',
    issue: 61
  },
  {
    path: '/sources',
    name: 'sources',
    component: 'sources/SourcesListPage.vue',
    title: 'Sources — list view',
    group: 'sources',
    issue: 62
  },
  {
    path: '/surveys',
    name: 'surveys',
    component: 'engage/audience/SurveysListPage.vue',
    title: 'Surveys — list view',
    group: 'engage',
    issue: 66
  },
  {
    path: '/warehouse-models',
    name: 'warehouse-models',
    component: 'warehouse/models/WarehouseModelsListPage.vue',
    title: 'Warehouse Models — list view',
    group: 'warehouse',
    issue: 67
  },
  {
    path: '/attributes/new',
    name: 'attributes-new',
    component: 'profiles/attributes/AttributeCreatePage.vue',
    title: 'Attributes — create form',
    group: 'profiles',
    issue: 19
  },
  {
    path: '/attributes/trash',
    name: 'attributes-trash',
    component: 'profiles/attributes/AttributesTrashPage.vue',
    title: 'Attributes — trash & restore',
    group: 'profiles',
    issue: 20
  },
  {
    path: '/channels/email',
    name: 'channels-email',
    component: 'engage/channels/ChannelsEmailPage.vue',
    title: 'Channels — email',
    group: 'engage',
    issue: 24
  },
  {
    path: '/channels/settings',
    name: 'channels-settings',
    component: 'engage/channels/ChannelsSettingsPage.vue',
    title: 'Channels — settings',
    group: 'engage',
    issue: 25
  },
  {
    path: '/destinations/new',
    name: 'destinations-new',
    component: 'destinations/DestinationCreatePage.vue',
    title: 'Destinations — create form',
    group: 'destinations',
    issue: 30
  },
  {
    path: '/destinations/trash',
    name: 'destinations-trash',
    component: 'destinations/DestinationsTrashPage.vue',
    title: 'Destinations — trash & restore',
    group: 'destinations',
    issue: 31
  },
  {
    path: '/dwh-connections/new',
    name: 'dwh-connections-new',
    component: 'warehouse/connections/DwhConnectionCreatePage.vue',
    title: 'DWH Connections — create form',
    group: 'warehouse',
    issue: 33
  },
  {
    path: '/dwh-connections/trash',
    name: 'dwh-connections-trash',
    component: 'warehouse/connections/DwhConnectionsTrashPage.vue',
    title: 'DWH Connections — trash & restore',
    group: 'warehouse',
    issue: 34
  },
  {
    path: '/dwh-syncs/new',
    name: 'dwh-syncs-new',
    component: 'warehouse/syncs/DwhSyncCreatePage.vue',
    title: 'DWH Syncs — create form',
    group: 'warehouse',
    issue: 36
  },
  {
    path: '/dwh-syncs/trash',
    name: 'dwh-syncs-trash',
    component: 'warehouse/syncs/DwhSyncsTrashPage.vue',
    title: 'DWH Syncs — trash & restore',
    group: 'warehouse',
    issue: 37
  },
  {
    path: '/engage-operator/work-log',
    name: 'engage-operator-work-log',
    component: 'engage/channels/EngageOperatorWorkLogPage.vue',
    title: 'Engage Operator — work-log',
    group: 'engage',
    issue: 38
  },
  {
    path: '/live-profile-syncs/new',
    name: 'live-profile-syncs-new',
    component: 'profiles/live-syncs/LiveProfileSyncCreatePage.vue',
    title: 'Live Profile Syncs — create form',
    group: 'profiles',
    issue: 45
  },
  {
    path: '/live-profile-syncs/trash',
    name: 'live-profile-syncs-trash',
    component: 'profiles/live-syncs/LiveProfileSyncsTrashPage.vue',
    title: 'Live Profile Syncs — trash & restore',
    group: 'profiles',
    issue: 46
  },
  {
    path: '/pipes/new',
    name: 'pipes-new',
    component: 'pipes/PipeCreatePage.vue',
    title: 'Pipes — create form',
    group: 'pipes',
    issue: 49
  },
  {
    path: '/pipes/trash',
    name: 'pipes-trash',
    component: 'pipes/PipesTrashPage.vue',
    title: 'Pipes — trash & restore',
    group: 'pipes',
    issue: 50
  },
  {
    path: '/profile-api-endpoints/new',
    name: 'profile-api-endpoints-new',
    component: 'profiles/api/ProfileApiEndpointCreatePage.vue',
    title: 'Profile API Endpoints — create form',
    group: 'profiles',
    issue: 52
  },
  {
    path: '/profile-api-endpoints/trash',
    name: 'profile-api-endpoints-trash',
    component: 'profiles/api/ProfileApiEndpointsTrashPage.vue',
    title: 'Profile API Endpoints — trash & restore',
    group: 'profiles',
    issue: 53
  },
  {
    path: '/profile-dwh-syncs/new',
    name: 'profile-dwh-syncs-new',
    component: 'profiles/dwh-syncs/ProfileDwhSyncCreatePage.vue',
    title: 'Profile DWH Syncs — create form',
    group: 'profiles',
    issue: 55
  },
  {
    path: '/profile-dwh-syncs/trash',
    name: 'profile-dwh-syncs-trash',
    component: 'profiles/dwh-syncs/ProfileDwhSyncsTrashPage.vue',
    title: 'Profile DWH Syncs — trash & restore',
    group: 'profiles',
    issue: 56
  },
  {
    path: '/profiles/identity-resolution',
    name: 'profiles-identity-resolution',
    component: 'profiles/core/IdentityResolutionPage.vue',
    title: 'Profiles — identity-resolution',
    group: 'profiles',
    issue: 57
  },
  {
    path: '/profiles/search',
    name: 'profiles-search',
    component: 'profiles/core/ProfileSearchPage.vue',
    title: 'Profiles — search',
    group: 'profiles',
    issue: 58
  },
  {
    path: '/sources/new',
    name: 'sources-new',
    component: 'sources/SourceCreatePage.vue',
    title: 'Sources — create form',
    group: 'sources',
    issue: 64
  },
  {
    path: '/sources/trash',
    name: 'sources-trash',
    component: 'sources/SourcesTrashPage.vue',
    title: 'Sources — trash & restore',
    group: 'sources',
    issue: 65
  },
  {
    path: '/warehouse-models/new',
    name: 'warehouse-models-new',
    component: 'warehouse/models/WarehouseModelCreatePage.vue',
    title: 'Warehouse Models — create form',
    group: 'warehouse',
    issue: 68
  },
  {
    path: '/warehouse-models/trash',
    name: 'warehouse-models-trash',
    component: 'warehouse/models/WarehouseModelsTrashPage.vue',
    title: 'Warehouse Models — trash & restore',
    group: 'warehouse',
    issue: 69
  },
  {
    path: '/destinations/:id',
    name: 'destinations-detail',
    component: 'destinations/DestinationDetailPage.vue',
    title: 'Destinations — detail view',
    group: 'destinations',
    issue: 29,
    smokeParams: { id: 'dst_snowflake' }
  },
  {
    path: '/pipes/:id',
    name: 'pipes-detail',
    component: 'pipes/PipeDetailPage.vue',
    title: 'Pipes — detail view',
    group: 'pipes',
    issue: 48,
    smokeParams: { id: 'pipe_web_to_snowflake' }
  },
  {
    path: '/sources/:id',
    name: 'sources-detail',
    component: 'sources/SourceDetailPage.vue',
    title: 'Sources — detail view',
    group: 'sources',
    issue: 63,
    smokeParams: { id: 'src_web_sdk' }
  }
]

// The pre-existing pages that survived the legacy consolidation: the only three
// with no equivalent among the screens above. The other eight were duplicates of
// a product screen — a second, bespoke surface for the same concept, and none of
// them backed by real data — so they were deleted rather than ported. Dead URLs:
// /fan-overview, /contacts, /contacts/:email, /identity-resolution, /segments,
// /activation, /communications, /integrations. The catch-all in routes.js 404s
// them; there are deliberately no redirects.
export const legacyScreens = [
  {
    path: '/connectors',
    name: 'connectors',
    component: 'ConnectorsPage.vue',
    title: 'Connectors',
    group: 'legacy'
  },
  {
    path: '/live-events',
    name: 'live-events',
    component: 'LiveEventsPage.vue',
    title: 'Live Events',
    group: 'legacy'
  },
  {
    path: '/events-demo',
    name: 'events-demo',
    component: 'JitsuDemoPage.vue',
    title: 'Events Demo',
    group: 'legacy'
  }
]

export const allScreens = [...screens, ...legacyScreens]

export default allScreens
