import { defineConfig } from 'orval'

// Codegen for the Fanfinity backend client (docs/backend-auth-integration.md).
// `pnpm openapi` re-pulls openapi/sfere-api.json from staging and
// regenerates src/api/ (typed fetchers + @tanstack/vue-query composables).
// Auth (Identity Platform bearer token, 401 retry) lives in src/api/mutator.js.
export default defineConfig({
  fanfinity: {
    input: './openapi/sfere-api.json',
    output: {
      target: './src/api/fanfinity.ts',
      schemas: './src/api/model',
      client: 'vue-query',
      httpClient: 'fetch',
      prettier: false,
      override: {
        mutator: {
          path: './src/api/mutator.js',
          name: 'customFetch'
        }
      }
    }
  }
})
