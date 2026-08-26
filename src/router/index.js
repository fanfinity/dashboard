import { defineRouter } from '#q-app'
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory
} from 'vue-router'

import routes from './routes.js'
import { waitForAuthReady } from '@/composables/useAuth'
import { clearTokens, isAuthenticated } from '@/composables/useSession'
import { waitForAccount, accountMissing } from '@/composables/useMe'

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default defineRouter((/* { store, ssrContext } */) => {
  const createHistory = import.meta.env.QUASAR_SERVER
    ? createMemoryHistory
    : import.meta.env.QUASAR_VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(import.meta.env.QUASAR_VUE_ROUTER_BASE)
  })

  // Gate routes tagged requiresAuth (see routes.js) behind sign-in. The access
  // token is hydrated synchronously from localStorage, so waitForAuthReady()
  // resolves immediately — kept for symmetry with useMe's account bootstrap.
  Router.beforeEach(async to => {
    if (!to.matched.some(record => record.meta.requiresAuth)) return true
    await waitForAuthReady()
    if (!isAuthenticated.value)
      return { path: '/login', query: { redirect: to.fullPath } }
    // Signed in, but the backend may hold no account for this identity
    // (self-provisioning is disabled — accounts come only from registration or
    // invitation). Confirm before entering the app; otherwise every API call
    // 403s and the shell looks broken. Transient /v1/me errors don't set
    // accountMissing, so a backend hiccup won't bounce a real user.
    await waitForAccount()
    if (accountMissing.value) {
      clearTokens()
      return { path: '/login', query: { redirect: to.fullPath } }
    }
    return true
  })

  return Router
})
