// The backend spells a destination's kind in snake_case / kebab-case
// (`clickhouse`, `meta-conversions-api`), which is a key rather than something
// a screen should print. `destination_type` is a REAL field on the backend
// `Destination` — unlike the `templateId` this replaced on the list, which is a
// `destinations.json` invention and resolved to the badge's "Custom" ("hand
// configured, not created from a template") on every live row, including the
// ClickHouse destinations the backend provisions itself.
//
// The labels match the registry titles in src/config/destinationRegistry.js.
// Anything not in the table — including `event_destination`, which is what the
// Demo fixture carries — comes out as sentence-cased words rather than as a raw
// identifier, so an unanticipated type degrades to "in the wrong words" and
// never to a leaked key.
const DESTINATION_TYPE_LABELS = {
  clickhouse: 'ClickHouse',
  postgres: 'PostgreSQL',
  bigquery: 'Google BigQuery',
  snowflake: 'Snowflake',
  'meta-conversions-api': 'Meta Conversions API',
  'tiktok-events-api': 'TikTok Events API',
  'google-ads': 'Google Ads Offline Conversions',
  webhook: 'Webhook',
  s3: 'Amazon S3'
}

/**
 * A human label for a `destination_type`.
 *
 * @param {string} [type] the record's `destinationType`
 * @returns {string} the label, or '' when the record carries no type
 */
export function destinationTypeLabel(type) {
  if (!type) return ''
  return (
    DESTINATION_TYPE_LABELS[type] ??
    String(type)
      .replace(/[-_]/g, ' ')
      .replace(/^./, c => c.toUpperCase())
  )
}
