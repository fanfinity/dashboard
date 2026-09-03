import { customFetch } from './mutator.js'
import type {
  SallaAuthorizeUrl,
  SallaConnectionList,
  SallaSourceConnectResult
} from './model'

/**
 * Hand-written Salla fetchers, a thin sibling of the orval-generated Zid ones in
 * `fanfinity.ts`.
 *
 * ## Why this is not in the generated client (yet)
 *
 * `pnpm openapi` pulls the spec from staging, and the Salla endpoints only exist
 * on staging once the backend change deploys. Until then the generated client has
 * no Salla fetchers, so these mirror the generated shape (same `customFetch`
 * mutator, same `{ data }` envelope) to unblock the UI. When the backend is live
 * and `pnpm openapi` regenerates `fanfinity.ts` with the Salla operations, switch
 * the imports in `useSourcesAPI`/`useSallaConnections` over and delete this file.
 *
 * The four operations mirror the Zid set:
 *   POST /v1/accounts/{account}/sources/{source}/connect-salla (connectSallaSource)
 *   GET  /v1/accounts/{account}/sources/{source}/salla-status  (getSallaConnectStatus)
 *   GET  /v1/accounts/{account}/salla-authorize                (getSallaAuthorizeUrl)
 *   GET  /v1/accounts/{account}/salla-connections              (listSallaConnections)
 */

export const getConnectSallaSourceUrl = (accountId: string, sourceId: string) =>
  `/v1/accounts/${accountId}/sources/${sourceId}/connect-salla`

export const connectSallaSource = async (
  accountId: string,
  sourceId: string,
  options?: RequestInit
): Promise<{ data: SallaSourceConnectResult }> =>
  customFetch(getConnectSallaSourceUrl(accountId, sourceId), {
    ...options,
    method: 'POST'
  })

export const getGetSallaConnectStatusUrl = (
  accountId: string,
  sourceId: string
) => `/v1/accounts/${accountId}/sources/${sourceId}/salla-status`

export const getSallaConnectStatus = async (
  accountId: string,
  sourceId: string,
  options?: RequestInit
): Promise<{ data: Record<string, unknown> }> =>
  customFetch(getGetSallaConnectStatusUrl(accountId, sourceId), {
    ...options,
    method: 'GET'
  })

export const getGetSallaAuthorizeUrlUrl = (accountId: string) =>
  `/v1/accounts/${accountId}/salla-authorize`

export const getSallaAuthorizeUrl = async (
  accountId: string,
  options?: RequestInit
): Promise<{ data: SallaAuthorizeUrl }> =>
  customFetch(getGetSallaAuthorizeUrlUrl(accountId), {
    ...options,
    method: 'GET'
  })

export const getListSallaConnectionsUrl = (accountId: string) =>
  `/v1/accounts/${accountId}/salla-connections`

export const listSallaConnections = async (
  accountId: string,
  options?: RequestInit
): Promise<{ data: SallaConnectionList }> =>
  customFetch(getListSallaConnectionsUrl(accountId), {
    ...options,
    method: 'GET'
  })
