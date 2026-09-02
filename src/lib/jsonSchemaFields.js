// Turns a connector's `config_schema` — a JSON Schema object served by
// `GET /v1/connectors/{id}/spec` — into the flat field list the connect form
// renders.
//
// This is the half `src/config/connectorCredentials.js` was standing in for.
// That file exists because the catalog "returns a name, a package id and a
// licence — not a credential schema", and its own header says it is "what a
// real per-connector schema replaces". Backend PR #16 shipped the schema, so
// this is the adapter that lets the form render it. The hand-written specs are
// NOT deleted: they still cover Demo mode, and they carry the one thing a JSON
// Schema cannot — a `help` line saying *where in someone else's console* to
// find the value, which is the actual work of connecting a third-party system.
// The live schema wins where it exists; the hand-written help text is merged in
// per field where the keys match.
//
// Deliberately shallow. A nested object property becomes one JSON textarea
// rather than a recursive sub-form: the schemas the backend ships today are one
// level deep (see `app/services/connectors.py`), and a generated recursive form
// is a worse form than a JSON box with a real example in it.

/**
 * `'store_id'` -> `'Store id'`. Only used when the schema property has no
 * `title`; a schema that bothers to name its fields keeps its own wording.
 *
 * @param {string} key
 * @returns {string}
 */
function humanize(key) {
  const spaced = String(key).replace(/[_-]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Which input renders this property.
 *
 * `format: 'password'` is the only signal the backend gives that a value is a
 * secret, and it uses it (`clickhouse.password`). An enum becomes a select
 * rather than a free-text field, because a typo in `protocol` is a 422 nobody
 * can debug from the form.
 *
 * @param {object} prop  One JSON Schema property.
 * @returns {'password'|'select'|'textarea'|'text'}
 */
function kindFor(prop) {
  if (prop?.format === 'password') return 'password'
  if (Array.isArray(prop?.enum) && prop.enum.length) return 'select'
  if (prop?.type === 'array' || prop?.type === 'object') return 'textarea'
  return 'text'
}

/**
 * A short example for the placeholder, derived from the schema rather than
 * invented. Only shapes worth showing get one — a bare string field gets
 * nothing rather than a made-up value that reads like a default.
 *
 * @param {object} prop
 * @returns {string}
 */
function placeholderFor(prop) {
  if (prop?.type === 'array') {
    return prop.items?.type === 'string' ? '["host-1", "host-2"]' : '[]'
  }
  if (prop?.type === 'object') return '{ }'
  if (prop?.type === 'integer' || prop?.type === 'number') return ''
  return ''
}

/**
 * A connector's `config_schema` as connect-form fields, in schema order with
 * required fields kept where the schema puts them.
 *
 * Returns `[]` for an absent schema and for the backend's `_EMPTY_SCHEMA`
 * (`{type: 'object', properties: {}, additionalProperties: false}`), which is
 * what the Jitsu-hosted Airbyte connectors ship: their configuration lives on
 * Jitsu, so there is genuinely nothing to ask for. An empty list is a real
 * answer here and the caller must not treat it as a failed read — see
 * `hasSchema` below.
 *
 * @param {object|null|undefined} schema  A `config_schema` from `ConnectorSpec`.
 * @param {object[]} [helpFields]
 *   Hand-written fields from `connectorCredentials.js` for the same connector,
 *   used only to borrow a `help` line and a `placeholder` where the keys match.
 *   Never used to add a field the schema does not declare.
 * @returns {object[]}
 *
 * @example
 * fieldsFromJsonSchema({
 *   type: 'object',
 *   required: ['store_id'],
 *   properties: { store_id: { type: 'string', title: 'Zid store id' } }
 * })
 * // [{ key: 'store_id', label: 'Zid store id', kind: 'text', required: true, ... }]
 */
export function fieldsFromJsonSchema(schema, helpFields = []) {
  const properties = schema?.properties
  if (!properties || typeof properties !== 'object') return []
  const required = new Set(
    Array.isArray(schema.required) ? schema.required : []
  )
  const helpByKey = new Map((helpFields ?? []).map(f => [f.key, f]))

  return Object.entries(properties).map(([key, raw]) => {
    const prop = raw && typeof raw === 'object' ? raw : {}
    const hand = helpByKey.get(key)
    return {
      key,
      label: prop.title || hand?.label || humanize(key),
      kind: kindFor(prop),
      required: required.has(key),
      // The schema's own description first: it describes this backend's
      // expectation, where the hand-written line describes the vendor's console.
      // Both are useful, so both are shown when they differ.
      help: [prop.description, hand?.help]
        .filter(Boolean)
        .filter((line, i, all) => all.indexOf(line) === i)
        .join(' '),
      placeholder: hand?.placeholder || placeholderFor(prop),
      options: Array.isArray(prop.enum)
        ? prop.enum.map(value => ({ value, label: String(value) }))
        : null,
      // A textarea field holds JSON, so the panel parses it before sending.
      json: prop.type === 'array' || prop.type === 'object'
    }
  })
}

/**
 * Whether a `config_schema` describes anything at all to ask for.
 *
 * Separates "this connector needs no configuration" (a real answer — the
 * Airbyte connectors configured on Jitsu) from "we have no schema" (fall back
 * to the hand-written spec). The caller needs that distinction: rendering the
 * generic paste-your-JSON box for a connector that legitimately needs nothing
 * asks for a credential that has nowhere to go.
 *
 * @param {object|null|undefined} schema
 * @returns {boolean}
 */
export function describesConfig(schema) {
  return Boolean(schema && typeof schema === 'object' && 'properties' in schema)
}
