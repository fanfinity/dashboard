// What each connector asks for, and where to find it.
//
// The catalog (`GET /v1/connectors`) returns a name, a package id and a licence
// — not a credential schema — so the connect form has nothing to render from.
// This file supplies that half for the connectors worth naming, and a generic
// fallback for the rest, so picking any card leads somewhere real instead of a
// "coming soon" toast.
//
// PURE DATA, no imports, same idiom as features.js / personas.js /
// sourceIntents.js. Every `help` line answers "where do I get this?", because
// that is the actual work of connecting a third-party system: the form is thirty
// seconds, finding the key in someone else's console is twenty minutes.
//
// Field `kind`: 'text' | 'password' | 'file' | 'textarea'. A `file` field is a
// drop target that never uploads anywhere in this build — see the panel.
//
// When the backend grows a real per-connector schema, this map is what it
// replaces. Match on `packageId` first, then on the substring keys below, so a
// vendor rename does not silently drop to the generic form.

const SCHEDULES = [
  { value: 'hourly', label: 'Every hour' },
  { value: 'daily', label: 'Once a day' },
  { value: 'weekly', label: 'Once a week' },
  { value: 'manual', label: 'Manual only' }
]

export const CONNECTOR_SCHEDULES = SCHEDULES

const SPECS = [
  {
    match: 'firebase',
    lede: 'One-time setup by whoever owns the Firebase project. It pulls the web, iOS and Android events already landing there — no new SDK on your side.',
    fields: [
      {
        key: 'project_id',
        label: 'Firebase project ID',
        kind: 'text',
        required: true,
        placeholder: 'e.g. sfere-prod-4f21a',
        help: 'Firebase console → Project settings → General. The short ID, not the display name.'
      },
      {
        key: 'service_account_key',
        label: 'Service account key',
        kind: 'file',
        required: true,
        accept: 'application/json',
        help: 'Firebase console → Project settings → Service accounts → Generate new private key. We never show this value again after it is stored.'
      },
      {
        key: 'dataset',
        label: 'BigQuery export dataset',
        kind: 'text',
        required: false,
        placeholder: 'analytics_123456789',
        help: 'Only if you export Analytics to BigQuery. Leave blank to read the events API directly.'
      }
    ]
  },
  {
    match: 'mongodb',
    lede: 'Sfere reads the collections you name on a schedule. Give it a user with read access and nothing more.',
    fields: [
      {
        key: 'connection_string',
        label: 'Connection string',
        kind: 'password',
        required: true,
        placeholder: 'mongodb+srv://…',
        help: 'Atlas → Database → Connect → Drivers. Include the database name.'
      },
      {
        key: 'collections',
        label: 'Collections',
        kind: 'text',
        required: true,
        placeholder: 'users, orders',
        help: 'Comma-separated. Leave off anything you do not want copied.'
      }
    ]
  },
  {
    match: 'shopify',
    lede: 'Reads orders, customers and products. Sfere never writes back to your store.',
    fields: [
      {
        key: 'shop',
        label: 'Shop domain',
        kind: 'text',
        required: true,
        placeholder: 'your-store.myshopify.com',
        help: 'The .myshopify.com domain, even if you serve the store on your own.'
      },
      {
        key: 'access_token',
        label: 'Admin API access token',
        kind: 'password',
        required: true,
        help: 'Shopify admin → Settings → Apps and sales channels → Develop apps. Read scopes on orders, customers and products are enough.'
      }
    ]
  },
  {
    match: 'stripe',
    lede: 'Payments, subscriptions and invoices, as they settle.',
    fields: [
      {
        key: 'secret_key',
        label: 'Restricted API key',
        kind: 'password',
        required: true,
        placeholder: 'rk_live_…',
        help: 'Stripe dashboard → Developers → API keys → Restricted keys. Read-only on charges, customers, invoices and subscriptions.'
      }
    ]
  },
  {
    match: 'google-analytics',
    lede: 'Pulls the reports GA4 already builds, so trend numbers agree with what your marketing team sees.',
    fields: [
      {
        key: 'property_id',
        label: 'GA4 property ID',
        kind: 'text',
        required: true,
        placeholder: '123456789',
        help: 'GA4 → Admin → Property settings. Numeric, not the G- measurement id.'
      },
      {
        key: 'service_account_key',
        label: 'Service account key',
        kind: 'file',
        required: true,
        accept: 'application/json',
        help: 'A GCP service account with the Viewer role on that property.'
      }
    ]
  }
]

const GENERIC = {
  lede: 'Sfere signs in and pulls from this system on a schedule. Nothing is written back.',
  fields: [
    {
      key: 'credentials',
      label: 'Credentials',
      kind: 'textarea',
      required: true,
      placeholder: '{ "api_key": "…" }',
      help: "This connector's credential shape is not described by the catalog yet, so paste the JSON its docs ask for. Stored as a workspace secret."
    }
  ]
}

/**
 * The connect spec for one catalog entry.
 *
 * @param {object} connector a row from `GET /v1/connectors`
 * @returns {{ lede: string, fields: object[], generic: boolean }}
 */
export function specForConnector(connector) {
  const haystack =
    `${connector?.packageId ?? ''} ${connector?.meta?.name ?? ''}`
      .toLowerCase()
      .replace(/\s+/g, '-')

  const hit = SPECS.find(spec => haystack.includes(spec.match))
  return hit ? { ...hit, generic: false } : { ...GENERIC, generic: true }
}

export default specForConnector
