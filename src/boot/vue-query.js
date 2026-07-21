import { defineBoot } from '#q-app'
import { VueQueryPlugin } from '@tanstack/vue-query'

// Registers @tanstack/vue-query so the generated composables in
// src/api/fanfinity.ts (useGetMe, useListAccounts, ...) can be used in
// components. Plain fetchers (getMe, ...) work without this.
export default defineBoot(({ app }) => {
  app.use(VueQueryPlugin)
})
