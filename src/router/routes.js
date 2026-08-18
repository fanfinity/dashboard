import { allScreens } from './screens.js'

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
  return {
    // Children of the '/' layout route take relative paths.
    path: screen.path === '/' ? '' : screen.path.slice(1),
    name: screen.name,
    component,
    meta: { title: screen.title, group: screen.group, issue: screen.issue }
  }
})

const routes = [
  {
    path: '/login',
    name: 'login',
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

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('@/pages/ErrorNotFound.vue')
  }
]

export default routes
