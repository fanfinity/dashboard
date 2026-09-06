/**
 * Who built this destination — the honest half of the prototype's
 * "Included / Add-on" cell.
 *
 * `clickhouse_database` is a REAL field on the backend `Destination`, described
 * as "Auto-provisioned ClickHouse database name. Null while provisioning is
 * pending". So a name present means Sfere built it; a ClickHouse destination
 * without one is mid-provisioning; anything else is a warehouse or endpoint
 * somebody connected themselves.
 *
 * TYPE ALONE IS NOT THE DISCRIMINATOR, deliberately: `DestinationConfig.database`
 * says the backend provisions a fresh database only "when this is omitted", so a
 * customer's own ClickHouse cluster is also `destination_type: clickhouse`.
 *
 * THE WORD "INCLUDED" IS DELIBERATELY NOT HERE. The prototype's row says
 * "Included / Sfere covers the warehouse", which is a billing claim, and nothing
 * on the record measures billing — `clickhouse_database` measures who created
 * the database. The cost promise stays in the Destinations `IntroBand`, where it
 * is a statement about the product rather than a reading of a row.
 *
 * Shared by `DestinationsListPage`'s row and `DestinationDetailPage`'s
 * Provisioning stat card, so the list and the detail screen cannot end up
 * describing one record two ways.
 */

import { NOT_KNOWN } from '@/lib/emptyValue'

/**
 * @param {object|null|undefined} destination a record from `useDestinations()`
 * @returns {'sfere'|'pending'|'self'|'unknown'}
 */
export function destinationProvisioning(destination) {
  if (!destination) return 'unknown'
  if (destination.clickhouseDatabase) return 'sfere'
  if (destination.destinationType === 'clickhouse') return 'pending'
  return 'self'
}

/** Headline word for each state. */
export const PROVISIONING_LABELS = {
  sfere: 'Sfere managed',
  pending: 'In progress',
  self: 'Your own',
  unknown: NOT_KNOWN
}

/** The line under it — what the headline word is actually asserting. */
export const PROVISIONING_HINTS = {
  sfere: 'Sfere created the ClickHouse database',
  pending: 'Sfere is still creating the database',
  self: 'Not provisioned by Sfere',
  unknown: ''
}
