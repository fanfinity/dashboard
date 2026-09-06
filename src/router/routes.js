import { allScreens } from './screens.js'
import { FEATURE_KEYS } from '@/config/features'

// Do not add routes here — add them to src/router/screens.js.
//
// Every app route is generated from the manifest, so adding a screen is a data
// edit rather than a code edit, and several screens can be built at once without
// everyone contending on this one file.
//
// import.meta.glob gives Vite a statically-analysable set of page modules while
// still returning lazy loaders, so code-splitting behaves exactly as it did when
// each route had its own inline `() => import(...)`.
const pages = import.meta.glob('../pages/**/*.vue')

const screenNames = new Set(allScreens.map(s => s.name))

const children = allScreens.map(screen => {
  const key = `../pages/${screen.component}`
  const component = pages[key]
  if (!component) {
    // A manifest entry with no file is a wiring bug, and a silently missing route
    // is very hard to spot among 64 of them — fail loudly at module load instead.
    throw new Error(
      `screens.js references ${screen.component}, but src/pages/${screen.component} does not exist`
    )
  }
  // meta.group is what MainLayout consults to decide between the real page and
  // ComingSoonPanel, so a group with no entry in the activation registry would
  // switch the screen off silently and for good — no toggle could reach it. Same
  // reasoning as the missing-file throw above: fail at module load, loudly.
  if (!FEATURE_KEYS.includes(screen.group)) {
    throw new Error(
      `screens.js gives ${screen.path} the group '${screen.group}', which has no entry in src/config/features.js — add one, or point the screen at an existing feature key`
    )
  }

  // meta.parent is the back target PageHeader renders, and a router-link to a
  // route name that does not exist logs a console warning — which is one of the
  // things `pnpm smoke:dist` fails on. Same idiom as the two throws above: catch
  // a renamed or mistyped parent at module load, not on the screen.
  if (screen.parent && !screenNames.has(screen.parent.name)) {
    throw new Error(
      `screens.js points ${screen.path} back at '${screen.parent.name}', which is not a screen name in screens.js`
    )
  }

  return {
    // Children of the '/' layout route take relative paths.
    path: screen.path === '/' ? '' : screen.path.slice(1),
    name: screen.name,
    component,
    meta: {
      title: screen.title,
      group: screen.group,
      issue: screen.issue,
      parent: screen.parent ?? null
    }
  }
})

const routes = [
  // Sign-in and sign-up are two routes over one component, deliberately.
  //
  // They used to be one route and a client-side toggle, which meant sign-up had
  // no address: it could not be linked from a marketing CTA, the browser's back
  // button did not move between the two views, and every page-view landed on
  // /login whichever form the person actually saw. LoginPage reads `route.name`
  // to decide which of the two it is rendering.
  //
  // Neither carries `requiresAuth` — they are the way in — and neither belongs
  // in screens.js, which would nest them under MainLayout behind the auth guard.
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue')
  },
  {
    path: '/signup',
    name: 'signup',
    component: () => import('@/pages/LoginPage.vue')
  },

  // The Sfere design system, deliberately NOT a manifest screen.
  //
  // A screens.js entry would nest it under MainLayout, wrapping a Sfere-branded
  // reference page in the Sfere sidebar and putting it behind the auth
  // guard — both wrong for a style guide meant to be opened and eyeballed. So
  // it sits here as a top-level route alongside /login, with no requiresAuth
  // meta and its own shell.
  //
  // Consequence worth knowing: scripts/smoke.mjs walks screens.js, so this
  // route is invisible to the smoke gate. `pnpm build` still covers it.
  {
    path: '/design-system',
    name: 'design-system',
    component: () => import('@/pages/design-system/DesignSystemPage.vue'),
    meta: { title: 'Sfere design system' }
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children
  },

  // Same move, for the same reason: Secrets and Authorizations are workspace
  // configuration you set up once, not screens you work in, so they are tabs on
  // /settings rather than two permanent rows in the sidebar. Both old URLs keep
  // working — they are in handover docs and in the address bar of anyone who
  // bookmarked them.
  //
  // Both keep their `name`, because a named link is how the rest of the app
  // reaches them (ChannelsSettingsPage points at `{ name: 'secrets' }`) and an
  // unresolved name logs the console warning scripts/smoke.mjs fails on.
  {
    path: '/secrets',
    name: 'secrets',
    redirect: '/settings?tab=secrets'
  },
  {
    path: '/authorizations',
    name: 'authorizations',
    redirect: '/settings?tab=authorizations'
  },

  // Ten '/x/trash' screens became one Trash destination in the bottom menu, and
  // these ten redirects are what keeps their URLs working. Same move, same
  // reasoning as the three above: a trash is somewhere you go occasionally to
  // recover something, not somewhere you work, so ten rows' worth of toolbar
  // buttons pointing at ten near-identical screens cost more than one row does.
  //
  // EVERY `name` IS KEPT, and that is the load-bearing half. A `router-link` to
  // an unresolved route name logs the console warning `pnpm smoke:dist` fails on,
  // and these names are still reachable from handover docs and from any page that
  // has not been swept yet.
  //
  // A static redirect outranks the '/sources/:id' child it looks like it
  // collides with — vue-router 4 scores a static segment above a param
  // regardless of declaration order, verified against this exact pair rather
  // than assumed, which is why these can sit here at the bottom next to the
  // other redirects instead of ahead of the layout route.
  //
  // Only three of the ten have a tab: the Trash screen covers Sources,
  // Destinations and Pipes. The other seven land on the screen's default tab
  // rather than 404-ing, and their fixture slices are no longer surfaced
  // anywhere — every one of those modules is switched off in features.js today
  // (dwh-connections aside), so nothing live lost a surface.
  //
  // Sources writes no `?tab=` because Sources is the default tab, keeping
  // /trash the canonical URL — the same choice SettingsPage makes for General.
  {
    path: '/sources/trash',
    name: 'sources-trash',
    redirect: '/trash'
  },
  {
    path: '/destinations/trash',
    name: 'destinations-trash',
    redirect: '/trash?tab=destinations'
  },
  {
    path: '/pipes/trash',
    name: 'pipes-trash',
    redirect: '/trash?tab=pipes'
  },
  {
    path: '/attributes/trash',
    name: 'attributes-trash',
    redirect: '/trash'
  },
  {
    path: '/dwh-connections/trash',
    name: 'dwh-connections-trash',
    redirect: '/trash'
  },
  {
    path: '/dwh-syncs/trash',
    name: 'dwh-syncs-trash',
    redirect: '/trash'
  },
  {
    path: '/live-profile-syncs/trash',
    name: 'live-profile-syncs-trash',
    redirect: '/trash'
  },
  {
    path: '/profile-api-endpoints/trash',
    name: 'profile-api-endpoints-trash',
    redirect: '/trash'
  },
  {
    path: '/profile-dwh-syncs/trash',
    name: 'profile-dwh-syncs-trash',
    redirect: '/trash'
  },
  {
    path: '/warehouse-models/trash',
    name: 'warehouse-models-trash',
    redirect: '/trash'
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('@/pages/ErrorNotFound.vue')
  }
]

export default routes
