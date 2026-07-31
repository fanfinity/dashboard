const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue')
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'overview',
        component: () => import('@/pages/OverviewPage.vue')
      },
      {
        path: 'contacts',
        name: 'contacts',
        component: () => import('@/pages/ContactsPage.vue')
      },
      {
        path: 'contacts/:email',
        name: 'contact-detail',
        component: () => import('@/pages/ContactDetailPage.vue')
      },
      {
        path: 'identity-resolution',
        name: 'identity-resolution',
        component: () => import('@/pages/IdentityResolutionPage.vue')
      },
      {
        path: 'segments',
        name: 'segments',
        component: () => import('@/pages/SegmentsPage.vue')
      },
      {
        path: 'activation',
        name: 'activation',
        component: () => import('@/pages/ActivationPage.vue')
      },
      {
        path: 'communications',
        name: 'communications',
        component: () => import('@/pages/CommunicationsPage.vue')
      },
      {
        path: 'integrations',
        name: 'integrations',
        component: () => import('@/pages/IntegrationsPage.vue')
      },
      {
        path: 'connectors',
        name: 'connectors',
        component: () => import('@/pages/ConnectorsPage.vue')
      },
      {
        path: 'live-events',
        name: 'live-events',
        component: () => import('@/pages/LiveEventsPage.vue')
      },
      {
        path: 'events-demo',
        name: 'events-demo',
        component: () => import('@/pages/JitsuDemoPage.vue')
      }
    ]
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('@/pages/ErrorNotFound.vue')
  }
]

export default routes
