// Destination type registry — the single source of truth for the real-mode
// destination catalog and for the per-type config form on the create screen.
//
// Ported from admin-dashboard/lib/destinations/registry.tsx (kept field-for-
// field identical; verify against the backend `AnyDestinationConfig` shapes in
// src/api/model/anyDestinationConfig.ts when either side changes).
//
// PURE DATA ON PURPOSE, same idiom as src/config/features.js and
// src/config/sourceIntents.js: no imports, no Vue, no `@/` aliases.
//
// Masked-secret convention (backend Phase 0): on read, secrets come back as
// "***"; on write, "__MASKED_BY_JITSU__" keeps the stored value and any other
// string replaces it. Webhook `headers` merge per key.
//
// Field kinds: text | password | textarea | number | select | hosts | headers |
// json | switch. `hosts` and `headers` are edited as one-per-line text and
// parsed by `formToConfig` below.

const MASKED_BY_JITSU = '__MASKED_BY_JITSU__'

const selectOptions = values => values.map(value => ({ value, label: value }))

export const destinationRegistry = [
  {
    id: 'clickhouse',
    title: 'ClickHouse',
    description:
      'Column-oriented OLAP warehouse — auto-provisioned per account.',
    tags: ['Datawarehouse'],
    fields: [
      {
        key: 'hosts',
        label: 'Hosts',
        kind: 'hosts',
        required: true,
        placeholder: 'my-ch.example.com:443 — one per line'
      },
      {
        key: 'protocol',
        label: 'Protocol',
        kind: 'select',
        options: selectOptions([
          'http',
          'https',
          'clickhouse',
          'clickhouse-secure'
        ]),
        default: 'https'
      },
      { key: 'database', label: 'Database', kind: 'text', default: 'default' },
      { key: 'username', label: 'Username', kind: 'text', default: 'default' },
      { key: 'password', label: 'Password', kind: 'password', masked: true },
      {
        key: 'cluster',
        label: 'Cluster',
        kind: 'text',
        placeholder: 'Leave empty for ClickHouse Cloud'
      },
      {
        key: 'parameters',
        label: 'Parameters',
        kind: 'json',
        placeholder: '{} — additional driver parameters',
        default: {}
      }
    ]
  },
  {
    id: 'postgres',
    title: 'PostgreSQL',
    description: 'Powerful, open-source relational database.',
    tags: ['Datawarehouse'],
    fields: [
      { key: 'host', label: 'Host', kind: 'text', required: true },
      {
        key: 'port',
        label: 'Port',
        kind: 'number',
        min: 1,
        max: 65535,
        default: 5432
      },
      { key: 'database', label: 'Database', kind: 'text', required: true },
      { key: 'schema', label: 'Schema', kind: 'text', default: 'public' },
      { key: 'username', label: 'Username', kind: 'text', required: true },
      {
        key: 'password',
        label: 'Password',
        kind: 'password',
        required: true,
        masked: true
      },
      { key: 'ssl', label: 'SSL', kind: 'switch', default: true }
    ]
  },
  {
    id: 'bigquery',
    title: 'Google BigQuery',
    description: 'Cloud-based SQL data warehouse service by Google.',
    tags: ['Datawarehouse'],
    fields: [
      { key: 'project_id', label: 'Project ID', kind: 'text', required: true },
      { key: 'dataset', label: 'Dataset', kind: 'text', required: true },
      { key: 'location', label: 'Location', kind: 'text', default: 'US' },
      {
        key: 'service_account_key',
        label: 'Service account key',
        kind: 'textarea',
        required: true,
        masked: true
      }
    ]
  },
  {
    id: 'snowflake',
    title: 'Snowflake',
    description: 'Cloud data warehouse with compute-based pricing.',
    tags: ['Datawarehouse'],
    fields: [
      { key: 'account', label: 'Account', kind: 'text', required: true },
      { key: 'warehouse', label: 'Warehouse', kind: 'text', required: true },
      { key: 'database', label: 'Database', kind: 'text', required: true },
      { key: 'schema', label: 'Schema', kind: 'text', default: 'PUBLIC' },
      { key: 'role', label: 'Role', kind: 'text' },
      { key: 'username', label: 'Username', kind: 'text', required: true },
      {
        key: 'password',
        label: 'Password',
        kind: 'password',
        required: true,
        masked: true
      }
    ]
  },
  {
    id: 'meta-conversions-api',
    title: 'Meta Conversions API',
    description: 'Send events to Meta Ads Manager for campaign measurement.',
    tags: ['Product Analytics'],
    fields: [
      { key: 'pixel_id', label: 'Pixel ID', kind: 'text', required: true },
      {
        key: 'access_token',
        label: 'Access token',
        kind: 'password',
        required: true,
        masked: true
      },
      {
        key: 'test_event_code',
        label: 'Test event code',
        kind: 'text',
        tooltip:
          'Routes events to the Events Manager test tool instead of counting them'
      },
      {
        key: 'log_request',
        label: 'Log request',
        kind: 'switch',
        default: false
      }
    ]
  },
  {
    id: 'tiktok-events-api',
    title: 'TikTok Events API',
    description: 'Send events to TikTok for ads measurement.',
    tags: ['Product Analytics'],
    fields: [
      {
        key: 'event_source_id',
        label: 'Event source ID',
        kind: 'text',
        required: true
      },
      {
        key: 'access_token',
        label: 'Access token',
        kind: 'password',
        required: true,
        masked: true
      },
      { key: 'test_event_code', label: 'Test event code', kind: 'text' }
    ]
  },
  {
    id: 'google-ads',
    title: 'Google Ads Offline Conversions',
    description: 'Upload offline conversions to Google Ads.',
    tags: ['Product Analytics'],
    fields: [
      {
        key: 'customer_id',
        label: 'Customer ID',
        kind: 'text',
        required: true
      },
      {
        key: 'login_customer_id',
        label: 'Login (MCC) customer ID',
        kind: 'text',
        tooltip: 'Manager account id, when access is via an MCC'
      },
      {
        key: 'conversion_action_id',
        label: 'Conversion action ID',
        kind: 'text',
        required: true
      },
      {
        key: 'oauth_authorization_id',
        label: 'OAuth authorization ID',
        kind: 'text',
        required: true,
        tooltip: 'OAuth grant id from Authorizations'
      }
    ]
  },
  {
    id: 'webhook',
    title: 'Webhook',
    description: 'Send events as HTTP requests to any endpoint.',
    tags: ['Special'],
    fields: [
      { key: 'url', label: 'URL', kind: 'text', required: true },
      {
        key: 'method',
        label: 'Method',
        kind: 'select',
        options: selectOptions(['POST', 'PUT']),
        default: 'POST'
      },
      {
        key: 'headers',
        label: 'Headers',
        kind: 'headers',
        masked: true,
        placeholder: 'Authorization: <token> — one per line'
      },
      {
        key: 'batch_size',
        label: 'Batch size',
        kind: 'number',
        min: 1,
        max: 1000,
        default: 1
      },
      {
        key: 'timeout_ms',
        label: 'Timeout (ms)',
        kind: 'number',
        min: 100,
        max: 30000,
        default: 5000
      }
    ]
  },
  {
    id: 's3',
    title: 'Amazon S3',
    description: 'Cloud file storage service by Amazon.',
    tags: ['Block Storage'],
    fields: [
      { key: 'bucket', label: 'Bucket', kind: 'text', required: true },
      {
        key: 'region',
        label: 'Region',
        kind: 'select',
        required: true,
        // Must match Jitsu's S3 `region` enum exactly — a value outside this
        // list fails Jitsu's zod validation and the destination is silently
        // not created (see jitsu webapps/console/lib/schema/destinations.tsx).
        options: selectOptions([
          'us-east-1',
          'us-east-2',
          'us-west-1',
          'us-west-2',
          'ap-south-1',
          'ap-northeast-1',
          'ap-northeast-2',
          'ap-northeast-3',
          'ap-southeast-1',
          'ap-southeast-2',
          'ca-central-1',
          'cn-north-1',
          'cn-northwest-1',
          'eu-central-1',
          'eu-west-1',
          'eu-west-2',
          'eu-west-3',
          'eu-south-1',
          'eu-north-1',
          'me-south-1',
          'sa-east-1',
          'us-gov-east-1',
          'us-gov-west-1'
        ]),
        default: 'us-east-1'
      },
      {
        key: 'prefix',
        label: 'Prefix',
        kind: 'text',
        tooltip: 'Key prefix. Supports {date} and {table} placeholders.'
      },
      {
        key: 'access_key_id',
        label: 'Access key ID',
        kind: 'text',
        required: true,
        masked: true
      },
      {
        key: 'secret_access_key',
        label: 'Secret access key',
        kind: 'password',
        required: true,
        masked: true
      },
      {
        key: 'format',
        label: 'Format',
        kind: 'select',
        options: selectOptions(['ndjson', 'parquet', 'csv']),
        default: 'ndjson'
      },
      {
        key: 'compression',
        label: 'Compression',
        kind: 'select',
        options: selectOptions(['none', 'gzip']),
        default: 'none'
      }
    ]
  }
]

export function getDestinationTypeDef(id) {
  const def = destinationRegistry.find(d => d.id === id)
  if (!def) {
    throw new Error(`Unknown destination type: ${id}`)
  }
  return def
}

function isEmptyValue(value) {
  if (value === undefined || value === null) {
    return true
  }
  if (typeof value === 'string') {
    return value.trim() === ''
  }
  if (Array.isArray(value)) {
    return value.length === 0
  }
  return false
}

function splitLines(value) {
  if (typeof value !== 'string') {
    return []
  }
  return value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
}

// Form values -> the `config` blob POSTed with the destination. Only kinds the
// create screen renders are handled; empty optional fields are omitted rather
// than sent as "".
export function formToConfig(def, values) {
  const config = {}
  for (const field of def.fields) {
    const raw = values[field.key]
    switch (field.kind) {
      case 'hosts': {
        const hosts = splitLines(raw)
        if (hosts.length > 0) {
          config[field.key] = hosts
        }
        break
      }
      case 'headers': {
        const headers = {}
        for (const line of splitLines(raw)) {
          const separator = line.indexOf(':')
          if (separator <= 0) {
            continue // no "key: value" separator — drop the line
          }
          const key = line.slice(0, separator).trim()
          const value = line.slice(separator + 1).trim()
          if (!key) {
            continue
          }
          // A line with a blank value keeps the stored value for that key.
          headers[key] = value === '' ? MASKED_BY_JITSU : value
        }
        if (Object.keys(headers).length > 0) {
          config[field.key] = headers
        }
        break
      }
      case 'json': {
        if (isEmptyValue(raw)) {
          break
        }
        try {
          config[field.key] = JSON.parse(raw)
        } catch {
          throw new Error(`Invalid JSON in "${field.label}"`)
        }
        break
      }
      case 'number': {
        if (isEmptyValue(raw)) {
          break
        }
        const number = Number(raw)
        if (!Number.isNaN(number)) {
          config[field.key] = number
        }
        break
      }
      case 'switch': {
        if (raw === undefined || raw === null) {
          if (field.default !== undefined) {
            config[field.key] = !!field.default
          }
        } else {
          config[field.key] = !!raw
        }
        break
      }
      default: {
        // text / password / textarea / select
        if (isEmptyValue(raw)) {
          if (field.masked && field.required) {
            config[field.key] = MASKED_BY_JITSU
          }
          // Empty optional (and empty non-masked) fields are omitted.
          break
        }
        config[field.key] = raw
        break
      }
    }
  }
  return config
}
