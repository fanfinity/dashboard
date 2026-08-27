// The proposed half of the Sfere CDP contract — everything the dashboard needs
// that the backend does not serve yet. `scripts/build-cdp-contract.mjs` merges
// this with the backend's own spec into openapi/sfere-cdp-contract.yaml.
//
// **Edit this file, never the generated YAML.**
//
// Import-free plain data, the same idiom as src/router/screens.js,
// src/config/features.js and src/config/personas.js — so plain Node can read it
// and nothing here can drag in a Vue or `@/` dependency.
//
// Where a Jitsu operation models the same thing, `jitsu:` names it. Jitsu
// supplies field names and payload shape; it supplies nothing about the URL,
// the casing or the envelope. Rules for anything added here:
//
//   - Account-owned resources live under /v1/accounts/{account_id}/…
//     Global catalogs and identity stay flat.
//   - snake_case fields, Page[…] envelope for unbounded collections.
//   - Every operation gets an accurate `tags` entry from the set declared in
//     the builder, or Scalar drops it into "Uncategorised".
//   - Never propose an operation the backend already serves; the builder exits
//     non-zero if you do, because a live endpoint marked "proposed" is the
//     exact drift this document exists to prevent.

// ---------------------------------------------------------------------------
// Shorthand
// ---------------------------------------------------------------------------

const problem = {
  'application/problem+json': {
    schema: { $ref: '#/components/schemas/Problem' }
  }
}

const ERRORS = {
  400: { description: 'Malformed request', content: problem },
  401: { description: 'Missing or invalid credentials', content: problem },
  403: { description: 'Authenticated but not permitted', content: problem },
  404: { description: 'Resource not found', content: problem },
  422: { description: 'Request failed validation', content: problem }
}

const conflict = { 409: { description: 'Already exists', content: problem } }
const badGateway = {
  502: {
    description: 'An upstream system the backend depends on failed',
    content: problem
  }
}

const ref = name => ({ $ref: `#/components/schemas/${name}` })

const json = name => ({ 'application/json': { schema: ref(name) } })

const ok = (name, description = 'Successful Response') => ({
  200: { description, content: json(name) }
})

const created = (name, description = 'Created') => ({
  201: { description, content: json(name) }
})

const noContent = { 204: { description: 'Deleted' } }

const pathParam = (name, description) => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'string' },
  description
})

const ACCOUNT = pathParam('account_id', 'The account that owns this resource.')

const PAGINATION = [
  {
    name: 'page',
    in: 'query',
    schema: { type: 'integer', minimum: 1, default: 1 },
    description: 'Page number, from 1.'
  },
  {
    name: 'size',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
    description: 'Page size.'
  }
]

const IDEMPOTENCY = {
  name: 'Idempotency-Key',
  in: 'header',
  required: false,
  schema: {
    type: 'string',
    minLength: 1,
    maxLength: 255,
    pattern: '^[A-Za-z0-9._-]+$'
  },
  description:
    'Retry-safe key. Required in practice for any create that provisions infrastructure.'
}

// Every operation this file declares is proposed by definition, so the status is
// stamped here rather than repeated 90 times below — as is `security`. The
// document declares a global bearer requirement, so an absent `security` key
// would inherit it and mean the same thing; stating it saves the reader recalling
// OpenAPI's inheritance rules, and is what `sfere-security-explicit` enforces.
// Nothing proposed here is public — one that should be would need `security: []`
// and a reason.
function op({
  tag,
  summary,
  description,
  operationId,
  jitsu,
  parameters,
  requestBody,
  responses
}) {
  return {
    tags: [tag],
    summary,
    description,
    operationId,
    'x-sfere-status': 'proposed',
    'x-jitsu-equivalent': jitsu,
    security: [{ HTTPBearer: [] }],
    parameters,
    requestBody,
    responses
  }
}

const body = (name, { required = true, description } = {}) => ({
  required,
  description,
  content: json(name)
})

// A paginated collection schema, so the Page[…] envelope is written once.
const page = (item, description) => ({
  type: 'object',
  title: `Page[${item}]`,
  description,
  properties: {
    items: { type: 'array', items: ref(item) },
    total: { type: 'integer', minimum: 0 },
    page: { type: 'integer', minimum: 1 },
    size: { type: 'integer', minimum: 1 },
    pages: { type: 'integer', minimum: 0 }
  },
  required: ['items', 'total', 'page', 'size', 'pages']
})

const timestamp = description => ({
  type: 'string',
  format: 'date-time',
  description
})
const nullableString = description => ({
  anyOf: [{ type: 'string' }, { type: 'null' }],
  description
})
const nullableTimestamp = description => ({
  anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }],
  description
})

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export const proposedPaths = {
  // -- Sources: ingest configuration -----------------------------------------
  //
  // Shipped `SourceUpdate` accepts only `is_enabled`, so there is no way to
  // rename a source or change how it accepts events. Jitsu keeps this on the
  // stream object itself; splitting it into a sub-resource keeps the shipped
  // Source payload — which the dashboard's list screens already render — from
  // growing a config blob most callers do not want.

  '/v1/accounts/{account_id}/sources/{source_id}/ingest-settings': {
    get: op({
      tag: 'Sources',
      summary: "Get a source's ingest settings",
      description:
        'Which domains may send events to this source, and how it deduplicates them. Only meaningful for an `event_stream`; a `cloud_app` source answers 404.',
      operationId: 'getSourceIngestSettings',
      jitsu: 'GET /api/{workspaceId}/config/stream/{id}',
      parameters: [ACCOUNT, pathParam('source_id')],
      responses: { ...ok('SourceIngestSettings'), ...ERRORS }
    }),
    put: op({
      tag: 'Sources',
      summary: "Replace a source's ingest settings",
      description:
        'Full replacement, not a merge — send every field you want kept.',
      operationId: 'updateSourceIngestSettings',
      jitsu: 'PUT /api/{workspaceId}/config/stream/{id}',
      parameters: [ACCOUNT, pathParam('source_id')],
      requestBody: body('SourceIngestSettingsUpdate'),
      responses: { ...ok('SourceIngestSettings'), ...ERRORS }
    })
  },

  // -- Sources: write keys ---------------------------------------------------
  //
  // Shipped `Source.write_key` is a single string, which cannot express key
  // rotation: rotating means creating the new key before retiring the old one,
  // so an SDK still holding the old key keeps working through the changeover.
  // Jitsu already models this as a list, split public (browser-safe) from
  // private (server-side).

  '/v1/accounts/{account_id}/sources/{source_id}/write-keys': {
    get: op({
      tag: 'Sources',
      summary: "List a source's write keys",
      description:
        'Secrets are never returned in full after creation — each key carries a `hint` (last four characters) instead.',
      operationId: 'listSourceWriteKeys',
      jitsu: 'GET /api/{workspaceId}/config/stream/{id}',
      parameters: [ACCOUNT, pathParam('source_id')],
      responses: { ...ok('WriteKeyList'), ...ERRORS }
    }),
    post: op({
      tag: 'Sources',
      summary: 'Create a write key',
      description:
        'The **only** response that carries the plaintext secret. The dashboard shows it once and cannot retrieve it again.',
      operationId: 'createSourceWriteKey',
      parameters: [ACCOUNT, pathParam('source_id'), IDEMPOTENCY],
      requestBody: body('WriteKeyCreate'),
      responses: {
        ...created(
          'WriteKeyCreated',
          'Created — contains the plaintext secret, shown once'
        ),
        ...ERRORS
      }
    })
  },

  '/v1/accounts/{account_id}/sources/{source_id}/write-keys/{write_key_id}': {
    delete: op({
      tag: 'Sources',
      summary: 'Revoke a write key',
      description:
        'Takes effect immediately. Anything still sending on this key starts getting 401s.',
      operationId: 'revokeSourceWriteKey',
      parameters: [ACCOUNT, pathParam('source_id'), pathParam('write_key_id')],
      responses: { ...noContent, ...ERRORS }
    })
  },

  // -- Sources: connectivity test --------------------------------------------

  '/v1/accounts/{account_id}/sources/{source_id}/test': {
    post: op({
      tag: 'Sources',
      summary: "Test a source's credentials",
      description:
        'Checks that the backend can reach the upstream system with the stored credentials. Cheap enough to call from a form; does not pull data.',
      operationId: 'testSource',
      jitsu: 'POST /api/{workspaceId}/config/{type}/test',
      parameters: [ACCOUNT, pathParam('source_id')],
      responses: {
        ...ok(
          'ConnectionTestResult',
          'The test ran — check `ok` for the result'
        ),
        ...ERRORS,
        ...badGateway
      }
    })
  },

  // -- Syncs: catalog discovery ----------------------------------------------
  //
  // Jitsu exposes discovery as a workspace-level GET taking a `serviceId`
  // query. Under a source is where it belongs: discovery is always about one
  // source's credentials, and the result is cached against that source.

  '/v1/accounts/{account_id}/sources/{source_id}/discover': {
    post: op({
      tag: 'Syncs',
      summary: 'Discover what a source can sync',
      description:
        'Asks the connector what entities it can pull with the stored credentials. Slow (it round-trips to the upstream system), so the result is cached against the source; `refresh=true` bypasses the cache. A `202` means discovery is still running — poll the catalog.',
      operationId: 'discoverSourceCatalog',
      jitsu: 'GET /api/{workspaceId}/sources/discover',
      parameters: [
        ACCOUNT,
        pathParam('source_id'),
        {
          name: 'refresh',
          in: 'query',
          schema: { type: 'boolean', default: false },
          description:
            'Re-run discovery instead of returning the cached catalog.'
        }
      ],
      responses: {
        ...ok('SourceCatalog'),
        202: {
          description: 'Discovery started; poll the catalog for the result',
          content: json('SourceCatalog')
        },
        ...ERRORS,
        ...badGateway
      }
    })
  },

  '/v1/accounts/{account_id}/sources/{source_id}/catalog': {
    get: op({
      tag: 'Syncs',
      summary: "Get a source's catalog and selection",
      description:
        'What discovery found, and which entities are currently selected for syncing.',
      operationId: 'getSourceCatalog',
      parameters: [ACCOUNT, pathParam('source_id')],
      responses: { ...ok('SourceCatalog'), ...ERRORS }
    }),
    put: op({
      tag: 'Syncs',
      summary: 'Select which entities to sync',
      description:
        'Full replacement of the selection. An entity named here that discovery did not find is a `422`, not a silent skip — a typo that quietly syncs nothing is the failure mode worth spending an error on.',
      operationId: 'updateSourceCatalogSelection',
      parameters: [ACCOUNT, pathParam('source_id')],
      requestBody: body('SourceCatalogUpdate'),
      responses: { ...ok('SourceCatalog'), ...ERRORS }
    })
  },

  // -- Syncs: schedule -------------------------------------------------------

  '/v1/accounts/{account_id}/sources/{source_id}/sync-schedule': {
    get: op({
      tag: 'Syncs',
      summary: "Get a source's sync schedule",
      description:
        'Shipped syncs are trigger-only. This is what makes a `cloud_app` source pull on its own.',
      operationId: 'getSourceSyncSchedule',
      parameters: [ACCOUNT, pathParam('source_id')],
      responses: { ...ok('SyncSchedule'), ...ERRORS }
    }),
    put: op({
      tag: 'Syncs',
      summary: "Set a source's sync schedule",
      description:
        'Full replacement. `next_run_at` is recomputed from the new `cron` and `timezone`; setting `is_enabled` false stops the schedule without discarding it.',
      operationId: 'updateSourceSyncSchedule',
      parameters: [ACCOUNT, pathParam('source_id')],
      requestBody: body('SyncScheduleUpdate'),
      responses: { ...ok('SyncSchedule'), ...ERRORS }
    })
  },

  // -- Syncs: a single run ---------------------------------------------------
  //
  // Shipped syncs stop at the collection. A run detail screen needs the single
  // read, the logs and a way out of a run that has hung.

  '/v1/accounts/{account_id}/sources/{source_id}/sync-runs/{sync_run_id}': {
    get: op({
      tag: 'Syncs',
      summary: 'Get a sync run',
      description:
        'What a triggered sync polls until `status` settles. `counts` fills in as entities complete, so a running sync reports partial totals rather than nothing.',
      operationId: 'getSourceSyncRun',
      jitsu: 'GET /api/{workspaceId}/sources/tasks',
      parameters: [ACCOUNT, pathParam('source_id'), pathParam('sync_run_id')],
      responses: { ...ok('SyncRun'), ...ERRORS }
    })
  },

  '/v1/accounts/{account_id}/sources/{source_id}/sync-runs/{sync_run_id}/logs':
    {
      get: op({
        tag: 'Syncs',
        summary: "Read a sync run's logs",
        description:
          'Structured lines rather than a text blob, so the dashboard can filter by level without parsing. Paginated because a full sync of a large store produces a lot of them.',
        operationId: 'listSourceSyncRunLogs',
        jitsu: 'GET /api/{workspaceId}/sources/logs',
        parameters: [
          ACCOUNT,
          pathParam('source_id'),
          pathParam('sync_run_id'),
          ...PAGINATION,
          {
            name: 'level',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['all', 'info', 'warn', 'error'],
              default: 'all'
            },
            description: 'Minimum level to return.'
          }
        ],
        responses: { ...ok('Page_SyncRunLogEntry_'), ...ERRORS }
      })
    },

  '/v1/accounts/{account_id}/sources/{source_id}/sync-runs/{sync_run_id}/cancel':
    {
      post: op({
        tag: 'Syncs',
        summary: 'Cancel a sync run',
        description:
          'Requests cancellation; the run lands in `cancelled` once the connector stops. A run that has already finished answers `409`.',
        operationId: 'cancelSourceSyncRun',
        parameters: [ACCOUNT, pathParam('source_id'), pathParam('sync_run_id')],
        responses: { ...ok('SyncRun'), ...ERRORS, ...conflict, ...badGateway }
      })
    },

  // -- Destinations: connectivity test ---------------------------------------

  '/v1/accounts/{account_id}/destinations/{destination_id}/test': {
    post: op({
      tag: 'Destinations',
      summary: 'Test a destination',
      description:
        'Verifies the backend can connect and write with the stored config. Shipped `Destination.test_connection_error` has no endpoint that sets it; this is that endpoint.',
      operationId: 'testDestination',
      jitsu: 'POST /api/{workspaceId}/config/{type}/test',
      parameters: [ACCOUNT, pathParam('destination_id')],
      responses: {
        ...ok(
          'ConnectionTestResult',
          'The test ran — check `ok` for the result'
        ),
        ...ERRORS,
        ...badGateway
      }
    })
  },

  '/v1/accounts/{account_id}/destinations/test': {
    post: op({
      tag: 'Destinations',
      summary: 'Test a destination config before saving it',
      description:
        'Same check against an unsaved config, so the create form can validate credentials before it provisions anything. Writes nothing.',
      operationId: 'testDestinationConfig',
      jitsu: 'POST /api/{workspaceId}/config/{type}/test',
      parameters: [ACCOUNT],
      requestBody: body('DestinationTestRequest'),
      responses: {
        ...ok(
          'ConnectionTestResult',
          'The test ran — check `ok` for the result'
        ),
        ...ERRORS,
        ...badGateway
      }
    })
  },

  // -- Connectors: the global catalog ----------------------------------------
  //
  // Flat, not account-scoped: the catalog of what can be connected is the same
  // for every account. `GET /v1/connectors` is the one path here the dashboard
  // already calls (useConnectorCatalog) against a backend that 404s it.

  '/v1/connectors': {
    get: op({
      tag: 'Connectors',
      summary: 'List connectors',
      description:
        'Every source and destination type the platform supports. The dashboard renders this at `/sources?tab=connectors`; today it reads a bundled fixture because this endpoint does not exist.',
      operationId: 'listConnectors',
      parameters: [
        ...PAGINATION,
        {
          name: 'kind',
          in: 'query',
          schema: { type: 'string', enum: ['source', 'destination'] },
          description: 'Restrict to one side of the pipeline.'
        },
        {
          name: 'search',
          in: 'query',
          schema: { type: 'string' },
          description: 'Free-text match on name and tags.'
        }
      ],
      responses: { ...ok('Page_Connector_'), ...ERRORS }
    })
  },

  '/v1/connectors/{connector_id}': {
    get: op({
      tag: 'Connectors',
      summary: 'Get a connector',
      description:
        'Same shape as a row from the catalog. Use the spec endpoint for the config schema its create form needs.',
      operationId: 'getConnector',
      parameters: [
        pathParam(
          'connector_id',
          'Connector id, e.g. `zid` or `meta-conversions-api`.'
        )
      ],
      responses: { ...ok('Connector'), ...ERRORS }
    })
  },

  '/v1/connectors/{connector_id}/spec': {
    get: op({
      tag: 'Connectors',
      summary: "Get a connector's config schema",
      description:
        'The JSON Schema of the config this connector needs, so the dashboard can render a create form without hardcoding a field list per connector. This is what makes adding a connector a backend-only change.',
      operationId: 'getConnectorSpec',
      jitsu: 'GET /api/{workspaceId}/sources/spec',
      parameters: [
        pathParam('connector_id'),
        {
          name: 'version',
          in: 'query',
          schema: { type: 'string' },
          description: 'Connector version; defaults to the latest.'
        }
      ],
      responses: {
        ...ok('ConnectorSpec'),
        202: {
          description:
            'The spec is being fetched from the connector image; retry shortly',
          content: json('ConnectorSpec')
        },
        ...ERRORS,
        ...badGateway
      }
    })
  },

  '/v1/source-templates': {
    get: op({
      tag: 'Connectors',
      summary: 'List source templates',
      description:
        'The curated, product-facing subset of connectors with copy and defaults attached — what the "add a source" picker shows. Distinct from `/v1/connectors`, which is the raw capability list.',
      operationId: 'listSourceTemplates',
      responses: { ...ok('SourceTemplateList'), ...ERRORS }
    })
  },

  '/v1/destination-templates': {
    get: op({
      tag: 'Connectors',
      summary: 'List destination templates',
      description:
        'The curated, product-facing subset with copy and defaults attached — the destination-side counterpart to source templates, not the raw connector list.',
      operationId: 'listDestinationTemplates',
      responses: { ...ok('DestinationTemplateList'), ...ERRORS }
    })
  },

  '/v1/accounts/{account_id}/connector-images': {
    get: op({
      tag: 'Connectors',
      summary: 'List custom connector images',
      description:
        "Customer-supplied connector images, for a source the catalog does not cover. Account-scoped because an image is the account's, not the platform's.",
      operationId: 'listConnectorImages',
      jitsu: 'GET /api/{workspaceId}/config/custom-image',
      parameters: [ACCOUNT, ...PAGINATION],
      responses: { ...ok('Page_ConnectorImage_'), ...ERRORS }
    }),
    post: op({
      tag: 'Connectors',
      summary: 'Register a custom connector image',
      description:
        'The backend pulls the image asynchronously, so the response comes back `pending`; poll until it is `ready` or `failed`. Registry credentials are write-only.',
      operationId: 'createConnectorImage',
      jitsu: 'POST /api/{workspaceId}/config/custom-image',
      parameters: [ACCOUNT, IDEMPOTENCY],
      requestBody: body('ConnectorImageCreate'),
      responses: { ...created('ConnectorImage'), ...ERRORS, ...conflict }
    })
  },

  '/v1/accounts/{account_id}/connector-images/{connector_image_id}': {
    delete: op({
      tag: 'Connectors',
      summary: 'Remove a custom connector image',
      description:
        'Refused while a source still runs on this image — detach or delete those sources first.',
      operationId: 'deleteConnectorImage',
      jitsu: 'DELETE /api/{workspaceId}/config/custom-image/{id}',
      parameters: [ACCOUNT, pathParam('connector_image_id')],
      responses: {
        ...noContent,
        ...ERRORS,
        409: { description: 'A source still uses this image', content: problem }
      }
    })
  },

  // -- Functions: the account-level library ----------------------------------
  //
  // Shipped functions exist only as instances attached to a pipeline, each
  // instantiated from a template the API never exposes. This is the library
  // behind `PipelineFunction.template`: write a transform once, attach it to
  // several pipelines.

  '/v1/accounts/{account_id}/functions': {
    get: op({
      tag: 'Functions',
      summary: 'List functions',
      description: 'Transforms owned by this account, attached or not.',
      operationId: 'listFunctions',
      jitsu: 'GET /api/{workspaceId}/config/function',
      parameters: [ACCOUNT, ...PAGINATION],
      responses: { ...ok('Page_FunctionDefinition_'), ...ERRORS }
    }),
    post: op({
      tag: 'Functions',
      summary: 'Create a function',
      description:
        "TypeScript, run in the backend's sandbox. `template` set means this was instantiated from a platform template and can be reset to it.",
      operationId: 'createFunction',
      jitsu: 'POST /api/{workspaceId}/config/function',
      parameters: [ACCOUNT, IDEMPOTENCY],
      requestBody: body('FunctionCreate'),
      responses: { ...created('FunctionDefinition'), ...ERRORS, ...conflict }
    })
  },

  '/v1/accounts/{account_id}/functions/{function_id}': {
    get: op({
      tag: 'Functions',
      summary: 'Get a function',
      description:
        'Includes `code` and `attached_pipeline_ids`, so a function editor can load the source and show what it is currently affecting in one read.',
      operationId: 'getFunction',
      jitsu: 'GET /api/{workspaceId}/config/function/{id}',
      parameters: [ACCOUNT, pathParam('function_id')],
      responses: { ...ok('FunctionDefinition'), ...ERRORS }
    }),
    put: op({
      tag: 'Functions',
      summary: 'Update a function',
      description:
        'Bumps `version`. Pipelines using it pick the new code up on their next event.',
      operationId: 'updateFunction',
      jitsu: 'PUT /api/{workspaceId}/config/function/{id}',
      parameters: [ACCOUNT, pathParam('function_id')],
      requestBody: body('FunctionUpdate'),
      responses: { ...ok('FunctionDefinition'), ...ERRORS }
    }),
    delete: op({
      tag: 'Functions',
      summary: 'Delete a function',
      description:
        'Refused while the function is still attached to a pipeline — detach it there first, so deleting a transform can never silently change what a live pipeline does.',
      operationId: 'deleteFunction',
      jitsu: 'DELETE /api/{workspaceId}/config/function/{id}',
      parameters: [ACCOUNT, pathParam('function_id')],
      responses: {
        ...noContent,
        ...ERRORS,
        409: { description: 'Still attached to a pipeline', content: problem }
      }
    })
  },

  '/v1/accounts/{account_id}/functions/{function_id}/test': {
    post: op({
      tag: 'Functions',
      summary: 'Run a function against a sample event',
      description:
        'Executes the function in the sandbox on an event you supply and returns what came out, plus anything it logged. This is what makes a function editor usable — without it the only way to test a transform is to ship it and watch the error log.',
      operationId: 'testFunction',
      parameters: [ACCOUNT, pathParam('function_id')],
      requestBody: body('FunctionTestRequest'),
      responses: {
        ...ok(
          'FunctionTestResult',
          'The function ran — check `ok` for whether it threw'
        ),
        ...ERRORS
      }
    })
  },

  // -- Functions: attaching to a pipeline ------------------------------------
  //
  // Shipped covers list, update and reset, which means the dashboard can edit a
  // function already on a pipeline but cannot put one there or take it off.

  '/v1/accounts/{account_id}/pipelines/{pipeline_id}/functions': {
    post: op({
      tag: 'Functions',
      summary: 'Attach a function to a pipeline',
      description:
        'Order matters — functions run in list order. `position` inserts; omit it to append.',
      operationId: 'attachPipelineFunction',
      parameters: [ACCOUNT, pathParam('pipeline_id')],
      requestBody: body('PipelineFunctionAttach'),
      responses: { ...created('PipelineFunction'), ...ERRORS, ...conflict }
    }),
    put: op({
      tag: 'Functions',
      summary: "Reorder a pipeline's functions",
      description:
        'Send the full list of function ids in the order they should run.',
      operationId: 'reorderPipelineFunctions',
      parameters: [ACCOUNT, pathParam('pipeline_id')],
      requestBody: body('PipelineFunctionOrder'),
      responses: { ...ok('PipelineFunctionList'), ...ERRORS }
    })
  },

  '/v1/accounts/{account_id}/pipelines/{pipeline_id}/functions/{function_id}': {
    delete: op({
      tag: 'Functions',
      summary: 'Detach a function from a pipeline',
      description:
        'Leaves the function in the account library; only the attachment goes.',
      operationId: 'detachPipelineFunction',
      parameters: [ACCOUNT, pathParam('pipeline_id'), pathParam('function_id')],
      responses: { ...noContent, ...ERRORS }
    })
  },

  // -- Pipelines: the diagram ------------------------------------------------

  '/v1/accounts/{account_id}/pipelines/diagram': {
    get: op({
      tag: 'Pipelines',
      summary: 'Get the pipeline graph',
      description:
        'Every source, destination and pipeline as nodes and edges, with throughput and health per edge. One call instead of the dashboard fetching three collections and joining them client-side, which is what it does today.',
      operationId: 'getPipelineDiagram',
      parameters: [
        ACCOUNT,
        {
          name: 'minutes',
          in: 'query',
          schema: { type: 'integer', minimum: 5, maximum: 180, default: 60 },
          description: 'Window for the per-edge throughput figures.'
        }
      ],
      responses: { ...ok('PipelineDiagram'), ...ERRORS }
    })
  },

  // -- Metrics ---------------------------------------------------------------

  '/v1/accounts/{account_id}/metrics': {
    get: op({
      tag: 'Metrics',
      summary: 'Get event volume over time',
      description:
        'Time series for charts. Distinct from `/dashboard`, which is a fixed aggregate for the home screen: this one takes an arbitrary window and grouping, so a reporting screen can ask its own question.',
      operationId: 'getAccountMetrics',
      jitsu: 'GET /api/{workspaceId}/metrics',
      parameters: [
        ACCOUNT,
        {
          name: 'start',
          in: 'query',
          required: true,
          schema: { type: 'string', format: 'date-time' },
          description: 'Window start, inclusive.'
        },
        {
          name: 'end',
          in: 'query',
          schema: { type: 'string', format: 'date-time' },
          description: 'Window end, exclusive. Defaults to now.'
        },
        {
          name: 'granularity',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['minute', 'hour', 'day'],
            default: 'hour'
          },
          description: 'Bucket size.'
        },
        {
          name: 'group_by',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['none', 'source', 'destination', 'pipeline', 'status'],
            default: 'none'
          },
          description: 'Split the series by this dimension.'
        },
        {
          name: 'source_id',
          in: 'query',
          schema: { type: 'string' },
          description: 'Restrict to one source.'
        },
        {
          name: 'destination_id',
          in: 'query',
          schema: { type: 'string' },
          description: 'Restrict to one destination.'
        }
      ],
      responses: { ...ok('MetricsResult'), ...ERRORS }
    })
  },

  // -- Profiles --------------------------------------------------------------
  //
  // The dashboard does probabilistic identity stitching client-side today
  // (useProfilesIdentityResolution.js), over whatever contacts it happens to
  // have fetched. That cannot see the full event history, so it can only ever
  // approximate. Jitsu's profile builder is the server-side answer.

  '/v1/accounts/{account_id}/profile-builders': {
    get: op({
      tag: 'Profiles',
      summary: 'List profile builders',
      description:
        'Each builder stitches event history into per-person profiles on a schedule and writes them to a destination.',
      operationId: 'listProfileBuilders',
      jitsu: 'GET /api/{workspaceId}/config/profile-builder',
      parameters: [ACCOUNT, ...PAGINATION],
      responses: { ...ok('Page_ProfileBuilder_'), ...ERRORS }
    }),
    post: op({
      tag: 'Profiles',
      summary: 'Create a profile builder',
      description:
        'Creating a builder does not backfill — profiles appear after its first run. Give it a `cron` or trigger it, or it sits idle.',
      operationId: 'createProfileBuilder',
      jitsu: 'POST /api/{workspaceId}/config/profile-builder',
      parameters: [ACCOUNT, IDEMPOTENCY],
      requestBody: body('ProfileBuilderCreate'),
      responses: { ...created('ProfileBuilder'), ...ERRORS, ...conflict }
    })
  },

  '/v1/accounts/{account_id}/profile-builders/{profile_builder_id}': {
    get: op({
      tag: 'Profiles',
      summary: 'Get a profile builder',
      description:
        '`profile_count` and `last_run_at` come from the most recent run, so a builder created but never run reports null for both.',
      operationId: 'getProfileBuilder',
      parameters: [ACCOUNT, pathParam('profile_builder_id')],
      responses: { ...ok('ProfileBuilder'), ...ERRORS }
    }),
    put: op({
      tag: 'Profiles',
      summary: 'Update a profile builder',
      description:
        'Changing `identifier_types` re-stitches from scratch on the next run, which can merge or split existing profiles. It is not a cosmetic edit.',
      operationId: 'updateProfileBuilder',
      jitsu: 'PUT /api/{workspaceId}/config/profile-builder',
      parameters: [ACCOUNT, pathParam('profile_builder_id')],
      requestBody: body('ProfileBuilderUpdate'),
      responses: { ...ok('ProfileBuilder'), ...ERRORS }
    }),
    delete: op({
      tag: 'Profiles',
      summary: 'Delete a profile builder',
      description:
        'The profiles it built go with it. Data already written to a destination stays there; only the profiles queryable through this API are removed.',
      operationId: 'deleteProfileBuilder',
      jitsu: 'DELETE /api/{workspaceId}/config/profile-builder',
      parameters: [ACCOUNT, pathParam('profile_builder_id')],
      responses: { ...noContent, ...ERRORS }
    })
  },

  '/v1/accounts/{account_id}/profiles': {
    get: op({
      tag: 'Profiles',
      summary: 'Search profiles',
      description:
        'Look a person up by any identifier they are known by — email, user id, anonymous id, phone. `identifier_type` narrows the search; omit it to match across all of them.',
      operationId: 'listProfiles',
      parameters: [
        ACCOUNT,
        ...PAGINATION,
        {
          name: 'q',
          in: 'query',
          schema: { type: 'string' },
          description: 'Identifier value to match.'
        },
        {
          name: 'identifier_type',
          in: 'query',
          schema: { type: 'string' },
          description:
            'Restrict the match to one identifier type; see `/identifier-types`.'
        }
      ],
      responses: { ...ok('Page_Profile_'), ...ERRORS }
    })
  },

  '/v1/accounts/{account_id}/profiles/{profile_id}': {
    get: op({
      tag: 'Profiles',
      summary: 'Get a profile',
      description:
        'The stitched profile: every identifier that resolved to this person, the traits computed for them, and how confident the stitch is.',
      operationId: 'getProfile',
      parameters: [ACCOUNT, pathParam('profile_id')],
      responses: { ...ok('Profile'), ...ERRORS }
    })
  },

  '/v1/accounts/{account_id}/identifier-types': {
    get: op({
      tag: 'Profiles',
      summary: 'List identifier types',
      description:
        "Which identifiers this account's data actually carries, and how distinguishing each one is. `is_unique` marks the ones safe to stitch on deterministically.",
      operationId: 'listIdentifierTypes',
      parameters: [ACCOUNT],
      responses: { ...ok('IdentifierTypeList'), ...ERRORS }
    })
  },

  // -- Domains ---------------------------------------------------------------

  '/v1/accounts/{account_id}/domains': {
    get: op({
      tag: 'Domains',
      summary: 'List ingestion domains',
      description:
        "Custom domains events can be sent to, so a customer's SDK posts to `events.their-site.com` rather than a Sfere host — which keeps it clear of tracker blocklists.",
      operationId: 'listIngestDomains',
      jitsu: 'GET /api/{workspaceId}/config/domain',
      parameters: [ACCOUNT, ...PAGINATION],
      responses: { ...ok('Page_IngestDomain_'), ...ERRORS }
    }),
    post: op({
      tag: 'Domains',
      summary: 'Add an ingestion domain',
      description:
        'Returns the DNS records to create. The domain stays `pending` until the backend verifies them and issues a certificate.',
      operationId: 'createIngestDomain',
      jitsu: 'POST /api/{workspaceId}/config/domain',
      parameters: [ACCOUNT, IDEMPOTENCY],
      requestBody: body('IngestDomainCreate'),
      responses: { ...created('IngestDomain'), ...ERRORS, ...conflict }
    })
  },

  '/v1/accounts/{account_id}/domains/{domain_id}': {
    get: op({
      tag: 'Domains',
      summary: 'Get an ingestion domain',
      description:
        '`dns_records` is populated while the domain is `pending`, so this is what a setup screen polls until verification lands.',
      operationId: 'getIngestDomain',
      jitsu: 'GET /api/{workspaceId}/config/domain/{id}',
      parameters: [ACCOUNT, pathParam('domain_id')],
      responses: { ...ok('IngestDomain'), ...ERRORS }
    }),
    delete: op({
      tag: 'Domains',
      summary: 'Remove an ingestion domain',
      description:
        'The domain stops accepting events immediately. Anything still sending to it fails, so retire it from the SDK config first.',
      operationId: 'deleteIngestDomain',
      jitsu: 'DELETE /api/{workspaceId}/config/domain/{id}',
      parameters: [ACCOUNT, pathParam('domain_id')],
      responses: { ...noContent, ...ERRORS }
    })
  },

  '/v1/accounts/{account_id}/domains/{domain_id}/verify': {
    post: op({
      tag: 'Domains',
      summary: "Re-check a domain's DNS",
      description:
        'Verification is also attempted on a schedule; this is the "check now" button after adding the records.',
      operationId: 'verifyIngestDomain',
      parameters: [ACCOUNT, pathParam('domain_id')],
      responses: { ...ok('IngestDomain'), ...ERRORS }
    })
  },

  // -- Notification channels -------------------------------------------------

  '/v1/accounts/{account_id}/notification-channels': {
    get: op({
      tag: 'Notifications',
      summary: 'List notification channels',
      description:
        'Where alerts go when a sync fails, a batch fails, or events are dropped.',
      operationId: 'listNotificationChannels',
      jitsu: 'GET /api/{workspaceId}/config/notification',
      parameters: [ACCOUNT, ...PAGINATION],
      responses: { ...ok('Page_NotificationChannel_'), ...ERRORS }
    }),
    post: op({
      tag: 'Notifications',
      summary: 'Create a notification channel',
      description:
        'Which credential is required depends on `channel`: `slack` needs `slack_webhook_url`, `email` needs at least one address. Send a test before relying on it.',
      operationId: 'createNotificationChannel',
      jitsu: 'POST /api/{workspaceId}/config/notification',
      parameters: [ACCOUNT, IDEMPOTENCY],
      requestBody: body('NotificationChannelCreate'),
      responses: { ...created('NotificationChannel'), ...ERRORS, ...conflict }
    })
  },

  '/v1/accounts/{account_id}/notification-channels/{notification_channel_id}': {
    get: op({
      tag: 'Notifications',
      summary: 'Get a notification channel',
      description:
        'The Slack webhook comes back masked — it is a credential, and knowing it exists is enough to render a settings screen.',
      operationId: 'getNotificationChannel',
      jitsu: 'GET /api/{workspaceId}/config/notification/{id}',
      parameters: [ACCOUNT, pathParam('notification_channel_id')],
      responses: { ...ok('NotificationChannel'), ...ERRORS }
    }),
    put: op({
      tag: 'Notifications',
      summary: 'Update a notification channel',
      description:
        'Full replacement, not a merge: omitting `emails` clears the list rather than leaving it alone.',
      operationId: 'updateNotificationChannel',
      jitsu: 'PUT /api/{workspaceId}/config/notification/{id}',
      parameters: [ACCOUNT, pathParam('notification_channel_id')],
      requestBody: body('NotificationChannelUpdate'),
      responses: { ...ok('NotificationChannel'), ...ERRORS }
    }),
    delete: op({
      tag: 'Notifications',
      summary: 'Delete a notification channel',
      description:
        'Alerts stop going anywhere for the events it covered. Deleting the last channel leaves the account with no notifications at all — allowed, but worth surfacing in the UI.',
      operationId: 'deleteNotificationChannel',
      jitsu: 'DELETE /api/{workspaceId}/config/notification/{id}',
      parameters: [ACCOUNT, pathParam('notification_channel_id')],
      responses: { ...noContent, ...ERRORS }
    })
  },

  '/v1/accounts/{account_id}/notification-channels/{notification_channel_id}/test':
    {
      post: op({
        tag: 'Notifications',
        summary: 'Send a test alert',
        description:
          'Proves the webhook or address works before an incident depends on it.',
        operationId: 'testNotificationChannel',
        parameters: [ACCOUNT, pathParam('notification_channel_id')],
        responses: { ...ok('ConnectionTestResult'), ...ERRORS, ...badGateway }
      })
    },

  // -- Warehouse -------------------------------------------------------------
  //
  // A warehouse connection is a customer's own warehouse that Sfere reads from
  // or writes to, as opposed to a `Destination`, which is provisioned by Sfere.
  // Different lifecycle, so a separate resource rather than a destination flag.

  '/v1/accounts/{account_id}/warehouse/connections': {
    get: op({
      tag: 'Warehouse',
      summary: 'List warehouse connections',
      description:
        'Credentials inside `config` come back masked. `last_test_ok` is the cheap signal for whether a connection is still good without running a test.',
      operationId: 'listWarehouseConnections',
      parameters: [ACCOUNT, ...PAGINATION],
      responses: { ...ok('Page_WarehouseConnection_'), ...ERRORS }
    }),
    post: op({
      tag: 'Warehouse',
      summary: 'Create a warehouse connection',
      description:
        'Nothing is provisioned — this warehouse belongs to the customer, and Sfere only stores how to reach it. A create with bad credentials succeeds and fails later, so test it.',
      operationId: 'createWarehouseConnection',
      parameters: [ACCOUNT, IDEMPOTENCY],
      requestBody: body('WarehouseConnectionCreate'),
      responses: { ...created('WarehouseConnection'), ...ERRORS, ...conflict }
    })
  },

  '/v1/accounts/{account_id}/warehouse/connections/{warehouse_connection_id}': {
    get: op({
      tag: 'Warehouse',
      summary: 'Get a warehouse connection',
      description:
        'Same shape as a row from the list, credentials masked the same way.',
      operationId: 'getWarehouseConnection',
      parameters: [ACCOUNT, pathParam('warehouse_connection_id')],
      responses: { ...ok('WarehouseConnection'), ...ERRORS }
    }),
    patch: op({
      tag: 'Warehouse',
      summary: 'Update a warehouse connection',
      description:
        'Partial update, except `config`, which replaces the whole blob — send every field it needs, not just the one that changed.',
      operationId: 'updateWarehouseConnection',
      parameters: [ACCOUNT, pathParam('warehouse_connection_id')],
      requestBody: body('WarehouseConnectionUpdate'),
      responses: { ...ok('WarehouseConnection'), ...ERRORS }
    }),
    delete: op({
      tag: 'Warehouse',
      summary: 'Delete a warehouse connection',
      description:
        "Removes how Sfere reaches the warehouse. Nothing inside the customer's warehouse is touched, including data Sfere previously wrote there.",
      operationId: 'deleteWarehouseConnection',
      parameters: [ACCOUNT, pathParam('warehouse_connection_id')],
      responses: { ...noContent, ...ERRORS }
    })
  },

  '/v1/accounts/{account_id}/warehouse/connections/{warehouse_connection_id}/test':
    {
      post: op({
        tag: 'Warehouse',
        summary: 'Test a warehouse connection',
        description:
          'What gets checked follows `direction`: a `read` connection is tested for select access, a `write` one for create-and-insert.',
        operationId: 'testWarehouseConnection',
        parameters: [ACCOUNT, pathParam('warehouse_connection_id')],
        responses: { ...ok('ConnectionTestResult'), ...ERRORS, ...badGateway }
      })
    },

  // -- Monitoring ------------------------------------------------------------

  '/v1/accounts/{account_id}/errors': {
    get: op({
      tag: 'Monitoring',
      summary: 'List delivery errors',
      description:
        'Events that failed on the way to a destination, with enough of the payload to diagnose why. The dashboard drafted this flat as `/v1/errors`; it is account-scoped here for the same reason everything else is.',
      operationId: 'listDeliveryErrors',
      parameters: [
        ACCOUNT,
        ...PAGINATION,
        { name: 'source_id', in: 'query', schema: { type: 'string' } },
        { name: 'destination_id', in: 'query', schema: { type: 'string' } },
        { name: 'pipeline_id', in: 'query', schema: { type: 'string' } },
        {
          name: 'severity',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['all', 'warning', 'error'],
            default: 'all'
          }
        },
        {
          name: 'start',
          in: 'query',
          schema: { type: 'string', format: 'date-time' }
        },
        {
          name: 'end',
          in: 'query',
          schema: { type: 'string', format: 'date-time' }
        },
        {
          name: 'search',
          in: 'query',
          schema: { type: 'string' },
          description: 'Free-text match on the message.'
        }
      ],
      responses: { ...ok('Page_DeliveryError_'), ...ERRORS }
    })
  },

  '/v1/accounts/{account_id}/errors/{delivery_error_id}/retry': {
    post: op({
      tag: 'Monitoring',
      summary: 'Retry a failed delivery',
      description:
        'Re-sends the stored payload. Answers `409` once the retention window has passed and the payload is gone.',
      operationId: 'retryDeliveryError',
      parameters: [ACCOUNT, pathParam('delivery_error_id')],
      responses: {
        ...ok('DeliveryError'),
        ...ERRORS,
        ...conflict,
        ...badGateway
      }
    })
  },

  '/v1/accounts/{account_id}/error-stats': {
    get: op({
      tag: 'Monitoring',
      summary: 'Get error statistics',
      description:
        'Counts grouped by cause and by pipeline, for the monitoring overview — cheaper than paging the full error list to count it.',
      operationId: 'getErrorStats',
      parameters: [
        ACCOUNT,
        {
          name: 'start',
          in: 'query',
          schema: { type: 'string', format: 'date-time' }
        },
        {
          name: 'end',
          in: 'query',
          schema: { type: 'string', format: 'date-time' }
        }
      ],
      responses: { ...ok('ErrorStats'), ...ERRORS }
    })
  },

  '/v1/accounts/{account_id}/health': {
    get: op({
      tag: 'Monitoring',
      summary: 'Get pipeline health',
      description:
        "Per-queue depth, lag and throughput. This is the account's view of whether data is flowing — distinct from `/healthz`, which is the service's own liveness and takes no account.",
      operationId: 'getAccountHealth',
      parameters: [ACCOUNT],
      responses: { ...ok('HealthReport'), ...ERRORS }
    })
  },

  // -- Trash -----------------------------------------------------------------
  //
  // Shipped deletes are hard. The dashboard has a trash screen with a restore
  // window and nothing behind it, so a mis-click on a pipeline is unrecoverable
  // today.

  '/v1/accounts/{account_id}/trash': {
    get: op({
      tag: 'Trash',
      summary: 'List soft-deleted resources',
      description:
        'Sources, destinations and pipelines inside their restore window, newest deletion first.',
      operationId: 'listTrash',
      parameters: [
        ACCOUNT,
        ...PAGINATION,
        {
          name: 'resource',
          in: 'query',
          schema: { $ref: '#/components/schemas/TrashResource' },
          description: 'Restrict to one kind of resource.'
        }
      ],
      responses: { ...ok('Page_TrashItem_'), ...ERRORS }
    })
  },

  '/v1/accounts/{account_id}/trash/{resource}/{resource_id}/restore': {
    post: op({
      tag: 'Trash',
      summary: 'Restore a soft-deleted resource',
      description:
        'Brings it back with its config intact, and re-provisions what was torn down. Answers `409` if the slug has since been reused or the window has closed.',
      operationId: 'restoreTrashItem',
      parameters: [
        ACCOUNT,
        {
          ...pathParam('resource'),
          schema: { $ref: '#/components/schemas/TrashResource' }
        },
        pathParam('resource_id')
      ],
      responses: { ...ok('TrashItem'), ...ERRORS, ...conflict }
    })
  },

  '/v1/accounts/{account_id}/trash/{resource}/{resource_id}': {
    delete: op({
      tag: 'Trash',
      summary: 'Purge a soft-deleted resource',
      description:
        'Irreversible. Ends the restore window early rather than waiting for it to expire.',
      operationId: 'purgeTrashItem',
      parameters: [
        ACCOUNT,
        {
          ...pathParam('resource'),
          schema: { $ref: '#/components/schemas/TrashResource' }
        },
        pathParam('resource_id')
      ],
      responses: { ...noContent, ...ERRORS }
    })
  },

  // -- Secrets ---------------------------------------------------------------
  //
  // Destination templates already declare what they need
  // (`secrets[].key_prefix`), so the store those refer to has to exist. The
  // browser holding a customer's Meta access token is exactly what the CSP and
  // the "credentials live in the backend" rule are there to prevent.

  '/v1/accounts/{account_id}/secrets': {
    get: op({
      tag: 'Secrets',
      summary: 'List secrets',
      description:
        "Names and metadata only. A secret's value is never returned after it is written.",
      operationId: 'listSecrets',
      parameters: [ACCOUNT, ...PAGINATION],
      responses: { ...ok('Page_Secret_'), ...ERRORS }
    }),
    post: op({
      tag: 'Secrets',
      summary: 'Create a secret',
      description:
        'The value is write-only and the response carries metadata only, so the plaintext exists nowhere after this call. Reference it from a config as `secret://NAME`.',
      operationId: 'createSecret',
      parameters: [ACCOUNT, IDEMPOTENCY],
      requestBody: body('SecretCreate'),
      responses: {
        ...created(
          'Secret',
          'Created — the response carries metadata, never the value'
        ),
        ...ERRORS,
        ...conflict
      }
    })
  },

  '/v1/accounts/{account_id}/secrets/{secret_id}': {
    get: op({
      tag: 'Secrets',
      summary: "Get a secret's metadata",
      description:
        'Metadata and `used_by` — the list of things referring to it, which is what makes a delete refusable rather than silently breaking a destination.',
      operationId: 'getSecret',
      parameters: [ACCOUNT, pathParam('secret_id')],
      responses: { ...ok('Secret'), ...ERRORS }
    }),
    patch: op({
      tag: 'Secrets',
      summary: 'Rotate a secret',
      description:
        'Replaces the value in place, so every destination referring to it picks up the new one.',
      operationId: 'updateSecret',
      parameters: [ACCOUNT, pathParam('secret_id')],
      requestBody: body('SecretUpdate'),
      responses: { ...ok('Secret'), ...ERRORS }
    }),
    delete: op({
      tag: 'Secrets',
      summary: 'Delete a secret',
      description:
        'Refused while a destination or source still references it. Rotate instead if the point is to change the value.',
      operationId: 'deleteSecret',
      parameters: [ACCOUNT, pathParam('secret_id')],
      responses: {
        ...noContent,
        ...ERRORS,
        409: {
          description: 'Still referenced by a destination',
          content: problem
        }
      }
    })
  },

  // -- OAuth authorizations --------------------------------------------------
  //
  // The generic form of the shipped Zid handshake. `connect-zid` works because
  // Zid is the first cloud app to ship; a second one should not need a second
  // endpoint.

  '/v1/oauth-providers': {
    get: op({
      tag: 'Authorizations',
      summary: 'List OAuth providers',
      description:
        'Third-party systems the backend can obtain a grant for. Flat — the provider list is platform-wide.',
      operationId: 'listOauthProviders',
      responses: { ...ok('OauthProviderList'), ...ERRORS }
    })
  },

  '/v1/accounts/{account_id}/oauth-authorizations': {
    get: op({
      tag: 'Authorizations',
      summary: 'List OAuth authorizations',
      description: 'Grants this account holds, and which sources use them.',
      operationId: 'listOauthAuthorizations',
      parameters: [ACCOUNT, ...PAGINATION],
      responses: { ...ok('Page_OauthAuthorization_'), ...ERRORS }
    }),
    post: op({
      tag: 'Authorizations',
      summary: 'Start an OAuth authorization',
      description:
        'Returns the provider URL to send the user to, plus a `state` to match the callback against. The backend handles the callback and the token exchange — the browser never sees the code or the tokens.',
      operationId: 'startOauthAuthorization',
      parameters: [ACCOUNT],
      requestBody: body('OauthAuthorizationCreate'),
      responses: {
        ...created(
          'OauthAuthorizationStart',
          'Redirect the user to `authorize_url`'
        ),
        ...ERRORS
      }
    })
  },

  '/v1/accounts/{account_id}/oauth-authorizations/{oauth_authorization_id}': {
    get: op({
      tag: 'Authorizations',
      summary: 'Get an OAuth authorization',
      description:
        'Poll this after starting an authorization to watch it move from `pending` to `active`; the backend fills it in when the provider calls back.',
      operationId: 'getOauthAuthorization',
      parameters: [ACCOUNT, pathParam('oauth_authorization_id')],
      responses: { ...ok('OauthAuthorization'), ...ERRORS }
    }),
    delete: op({
      tag: 'Authorizations',
      summary: 'Revoke an OAuth authorization',
      description:
        'Revokes with the provider where possible, and drops the stored tokens either way. Sources using it stop syncing.',
      operationId: 'revokeOauthAuthorization',
      parameters: [ACCOUNT, pathParam('oauth_authorization_id')],
      responses: { ...noContent, ...ERRORS }
    })
  },

  // -- API tokens ------------------------------------------------------------
  //
  // Jitsu authenticates with a `keyId:secret` API key; Sfere uses a
  // user-scoped Identity Platform token, which is right for the dashboard and
  // wrong for a customer's own script — it expires hourly and belongs to a
  // person, not to the account.

  '/v1/accounts/{account_id}/api-tokens': {
    get: op({
      tag: 'API tokens',
      summary: 'List API tokens',
      description:
        "Metadata only — a token's plaintext exists in exactly one response, the create. Use `last_used_at` to find tokens nothing is using before revoking them.",
      operationId: 'listApiTokens',
      parameters: [ACCOUNT, ...PAGINATION],
      responses: { ...ok('Page_ApiToken_'), ...ERRORS }
    }),
    post: op({
      tag: 'API tokens',
      summary: 'Create an API token',
      description:
        "The only response carrying the plaintext token. Scopes cannot exceed the creating member's role, so a viewer cannot mint themselves a write token.",
      operationId: 'createApiToken',
      parameters: [ACCOUNT, IDEMPOTENCY],
      requestBody: body('ApiTokenCreate'),
      responses: {
        ...created(
          'ApiTokenCreated',
          'Created — contains the plaintext token, shown once'
        ),
        ...ERRORS
      }
    })
  },

  '/v1/accounts/{account_id}/api-tokens/{api_token_id}': {
    delete: op({
      tag: 'API tokens',
      summary: 'Revoke an API token',
      description:
        'Takes effect immediately; anything still authenticating with it starts getting 401s. There is no un-revoke.',
      operationId: 'revokeApiToken',
      parameters: [ACCOUNT, pathParam('api_token_id')],
      responses: { ...noContent, ...ERRORS }
    })
  }
}

// ---------------------------------------------------------------------------
// Schemas
//
// A name here must not collide with one the shipped spec already defines — the
// builder exits non-zero if it does, rather than silently redefining a live
// shape. `Source`, `Destination`, `Pipeline`, `SyncRun`, `PipelineFunction`,
// `PipelineFunctionList`, `Page_*` for the shipped entities and
// `DestinationConfig` all come from the backend; refer to them, do not restate
// them.
// ---------------------------------------------------------------------------

export const proposedSchemas = {
  // -- Source ingest ---------------------------------------------------------

  SourceIngestSettings: {
    type: 'object',
    title: 'Source ingest settings',
    description:
      'How an `event_stream` source accepts events. Jitsu keeps these on the stream object itself.',
    properties: {
      source_id: { type: 'string' },
      domains: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Domains allowed to send events. Empty means any, which is only sensible for a server-side source.'
      },
      authorized_javascript_domains: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Origins the browser SDK may run on. Enforced as CORS on the ingest endpoint.'
      },
      strict: {
        type: 'boolean',
        default: false,
        description:
          'Reject events that fail schema validation instead of passing them through and flagging them.'
      },
      deduplicate_window_ms: {
        type: 'integer',
        minimum: 0,
        description:
          'Drop a repeated `message_id` seen within this window. 0 disables deduplication.'
      },
      updated_at: timestamp()
    },
    required: [
      'source_id',
      'domains',
      'authorized_javascript_domains',
      'strict'
    ]
  },

  SourceIngestSettingsUpdate: {
    type: 'object',
    title: 'Source ingest settings update',
    properties: {
      domains: { type: 'array', items: { type: 'string' } },
      authorized_javascript_domains: {
        type: 'array',
        items: { type: 'string' }
      },
      strict: { type: 'boolean' },
      deduplicate_window_ms: { type: 'integer', minimum: 0 }
    },
    required: ['domains', 'authorized_javascript_domains', 'strict']
  },

  WriteKey: {
    type: 'object',
    title: 'Write key',
    description:
      'A credential events are sent on. `public` keys are browser-safe; `private` keys are for server-side use only.',
    properties: {
      id: { type: 'string' },
      source_id: { type: 'string' },
      kind: { type: 'string', enum: ['public', 'private'] },
      name: nullableString('Optional label, e.g. "marketing site".'),
      hint: {
        type: 'string',
        description:
          'Last four characters, for recognising a key without revealing it.'
      },
      created_at: timestamp(),
      last_used_at: nullableTimestamp(
        'Null if the key has never been used — which usually means an SDK was never wired up.'
      ),
      expires_at: nullableTimestamp()
    },
    required: ['id', 'source_id', 'kind', 'hint', 'created_at']
  },

  WriteKeyCreate: {
    type: 'object',
    title: 'Write key create',
    properties: {
      kind: { type: 'string', enum: ['public', 'private'], default: 'public' },
      name: { type: 'string', maxLength: 255 },
      expires_at: nullableTimestamp('Omit for a key that does not expire.')
    },
    required: ['kind']
  },

  WriteKeyCreated: {
    type: 'object',
    title: 'Write key created',
    description:
      'The one response that carries `plaintext`. It is not retrievable afterwards.',
    properties: {
      key: { $ref: '#/components/schemas/WriteKey' },
      plaintext: {
        type: 'string',
        description:
          'The secret. Shown to the user once and never returned again.'
      }
    },
    required: ['key', 'plaintext']
  },

  WriteKeyList: {
    type: 'object',
    title: 'Write key list',
    description:
      'A plain list rather than a page: a source has a handful of keys, not thousands.',
    properties: {
      items: { type: 'array', items: { $ref: '#/components/schemas/WriteKey' } }
    },
    required: ['items']
  },

  // -- Connectivity tests ----------------------------------------------------

  ConnectionTestResult: {
    type: 'object',
    title: 'Connection test result',
    description:
      'A failed test is a `200` with `ok: false`, not a `4xx`. The request succeeded — it is the connection that did not, and the dashboard needs the reason to render rather than an exception to catch.',
    properties: {
      ok: { type: 'boolean' },
      error: nullableString(
        'Why it failed, safe to show a user. Null when `ok` is true.'
      ),
      latency_ms: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
      checked_at: timestamp(),
      details: {
        anyOf: [
          { type: 'object', additionalProperties: true },
          { type: 'null' }
        ],
        description:
          'Connector-specific diagnostics — permissions found, tables visible, API version reached.'
      }
    },
    required: ['ok', 'checked_at']
  },

  DestinationTestRequest: {
    type: 'object',
    title: 'Destination test request',
    description:
      'An unsaved destination to test. Secrets may be sent by reference (`secret://NAME`) instead of inline.',
    properties: {
      destination_type: { $ref: '#/components/schemas/DestinationType' },
      config: { $ref: '#/components/schemas/AnyDestinationConfig' }
    },
    required: ['destination_type', 'config']
  },

  // -- Sync catalog, schedule, logs ------------------------------------------

  SourceCatalog: {
    type: 'object',
    title: 'Source catalog',
    description:
      'What a cloud-app source can pull, and what is selected. `pending` means discovery is still running.',
    properties: {
      source_id: { type: 'string' },
      pending: { type: 'boolean', default: false },
      discovered_at: nullableTimestamp(),
      error: nullableString('Why the last discovery failed.'),
      entities: {
        type: 'array',
        items: { $ref: '#/components/schemas/SourceCatalogEntity' }
      }
    },
    required: ['source_id', 'pending', 'entities']
  },

  SourceCatalogEntity: {
    type: 'object',
    title: 'Source catalog entity',
    description: 'One thing a connector can pull — customers, orders, events.',
    properties: {
      key: {
        type: 'string',
        description:
          'Stable identifier, e.g. `orders`. What `SyncTriggerRequest.entities` names.'
      },
      name: { type: 'string', description: 'Human label.' },
      selected: { type: 'boolean' },
      supported_modes: {
        type: 'array',
        items: { $ref: '#/components/schemas/Mode' },
        description:
          'Not every entity supports incremental — one that cannot must be re-pulled in full.'
      },
      cursor_field: nullableString('Field the incremental watermark tracks.'),
      primary_key: { type: 'array', items: { type: 'string' } },
      schema: {
        anyOf: [
          { type: 'object', additionalProperties: true },
          { type: 'null' }
        ],
        description: 'JSON Schema of a record, as reported by the connector.'
      },
      record_count_estimate: { anyOf: [{ type: 'integer' }, { type: 'null' }] }
    },
    required: ['key', 'name', 'selected', 'supported_modes']
  },

  SourceCatalogUpdate: {
    type: 'object',
    title: 'Source catalog selection update',
    properties: {
      selected_entities: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Entity keys to sync. A key discovery did not find is a `422`.'
      }
    },
    required: ['selected_entities']
  },

  SyncSchedule: {
    type: 'object',
    title: 'Sync schedule',
    properties: {
      source_id: { type: 'string' },
      is_enabled: { type: 'boolean' },
      cron: nullableString(
        'Five-field cron expression, interpreted in `timezone`.'
      ),
      timezone: {
        type: 'string',
        default: 'UTC',
        description:
          'IANA name. Matters for a daily sync a customer expects at local midnight.'
      },
      mode: { $ref: '#/components/schemas/Mode' },
      next_run_at: nullableTimestamp(),
      last_run_at: nullableTimestamp()
    },
    required: ['source_id', 'is_enabled', 'mode']
  },

  SyncScheduleUpdate: {
    type: 'object',
    title: 'Sync schedule update',
    properties: {
      is_enabled: { type: 'boolean' },
      cron: { type: 'string' },
      timezone: { type: 'string' },
      mode: { $ref: '#/components/schemas/Mode' }
    },
    required: ['is_enabled']
  },

  SyncRunLogEntry: {
    type: 'object',
    title: 'Sync run log entry',
    properties: {
      timestamp: timestamp(),
      level: { type: 'string', enum: ['info', 'warn', 'error'] },
      message: { type: 'string' },
      entity: nullableString(
        'Which catalog entity the line concerns, when it concerns one.'
      )
    },
    required: ['timestamp', 'level', 'message']
  },

  Page_SyncRunLogEntry_: page(
    'SyncRunLogEntry',
    'A page of sync run log lines.'
  ),

  // -- Connectors ------------------------------------------------------------

  Connector: {
    type: 'object',
    title: 'Connector',
    description: 'A source or destination type the platform supports.',
    properties: {
      id: {
        type: 'string',
        description: 'Stable slug, e.g. `zid`, `meta-conversions-api`.'
      },
      name: { type: 'string' },
      kind: { type: 'string', enum: ['source', 'destination'] },
      description: { type: 'string' },
      source_type: nullableString(
        'For a source connector: `event_stream` or `cloud_app`.'
      ),
      destination_type: {
        anyOf: [
          { $ref: '#/components/schemas/DestinationType' },
          { type: 'null' }
        ]
      },
      protocol: {
        anyOf: [
          { type: 'string', enum: ['native', 'airbyte'] },
          { type: 'null' }
        ]
      },
      package: nullableString(
        'Connector image, for an Airbyte-protocol connector.'
      ),
      version: { type: 'string' },
      icon: {
        type: 'string',
        description:
          "Icon key served by this API. Not a third-party URL — `img-src` is `'self'`."
      },
      tags: { type: 'array', items: { type: 'string' } },
      status: {
        type: 'string',
        enum: ['available', 'beta', 'coming_soon'],
        description:
          '`coming_soon` is listed but not selectable, so the catalog can show the roadmap.'
      },
      requires_oauth: {
        type: 'boolean',
        default: false,
        description: 'Needs an authorization before it can sync.'
      }
    },
    required: ['id', 'name', 'kind', 'version', 'status']
  },

  Page_Connector_: page('Connector', 'A page of connectors.'),

  ConnectorSpec: {
    type: 'object',
    title: 'Connector spec',
    description:
      'The config schema a connector needs, as JSON Schema, so a create form can be rendered from it rather than hand-built per connector. `pending` means the backend is still fetching it from the connector image.',
    properties: {
      connector_id: { type: 'string' },
      version: { type: 'string' },
      pending: { type: 'boolean', default: false },
      error: nullableString(),
      config_schema: {
        anyOf: [
          { type: 'object', additionalProperties: true },
          { type: 'null' }
        ],
        description:
          'JSON Schema. `format: password` on a property marks it as a secret the form should mask and store by reference.'
      },
      supported_modes: {
        type: 'array',
        items: { $ref: '#/components/schemas/Mode' }
      },
      documentation_url: nullableString()
    },
    required: ['connector_id', 'version', 'pending']
  },

  TemplateSecretRequirement: {
    type: 'object',
    title: 'Template secret requirement',
    description:
      "A credential a template needs. The value lives in the backend's secret store; the browser only ever holds this description of it.",
    properties: {
      key_prefix: {
        type: 'string',
        description:
          'Naming convention for the secret, e.g. `META_ACCESS_TOKEN`.'
      },
      description: { type: 'string' },
      required: { type: 'boolean', default: true }
    },
    required: ['key_prefix', 'description']
  },

  SourceTemplate: {
    type: 'object',
    title: 'Source template',
    description:
      'A curated, product-facing source type: copy, defaults and what it needs, ready to render in the picker.',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      source_type: { type: 'string', enum: ['event_stream', 'cloud_app'] },
      connector_id: nullableString('The connector this template configures.'),
      version: { type: 'string' },
      icon: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      defaults: {
        type: 'object',
        additionalProperties: true,
        description: 'Pre-filled create-form values.'
      },
      secrets: {
        type: 'array',
        items: { $ref: '#/components/schemas/TemplateSecretRequirement' }
      },
      params_schema: {
        anyOf: [
          { type: 'object', additionalProperties: true },
          { type: 'null' }
        ],
        description:
          'JSON Schema for the template-specific fields, e.g. a Zid store id.'
      },
      event_type_count: { type: 'integer', minimum: 0 },
      realtime_attribute_count: { type: 'integer', minimum: 0 }
    },
    required: ['id', 'name', 'description', 'source_type', 'version']
  },

  SourceTemplateList: {
    type: 'object',
    title: 'Source template list',
    description:
      'A plain list: the curated catalog is short by design, and the picker renders all of it.',
    properties: {
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/SourceTemplate' }
      }
    },
    required: ['items']
  },

  DestinationTemplate: {
    type: 'object',
    title: 'Destination template',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      destination_type: { $ref: '#/components/schemas/DestinationType' },
      connector_id: nullableString(),
      version: { type: 'string' },
      icon: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      defaults: { type: 'object', additionalProperties: true },
      secrets: {
        type: 'array',
        items: { $ref: '#/components/schemas/TemplateSecretRequirement' }
      },
      params_schema: {
        anyOf: [
          { type: 'object', additionalProperties: true },
          { type: 'null' }
        ]
      }
    },
    required: ['id', 'name', 'description', 'destination_type', 'version']
  },

  DestinationTemplateList: {
    type: 'object',
    title: 'Destination template list',
    properties: {
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/DestinationTemplate' }
      }
    },
    required: ['items']
  },

  ConnectorImage: {
    type: 'object',
    title: 'Connector image',
    properties: {
      id: { type: 'string' },
      account_id: { type: 'string' },
      package: {
        type: 'string',
        description: 'Image reference, e.g. `ghcr.io/acme/source-internal`.'
      },
      version: { type: 'string' },
      protocol: { type: 'string', enum: ['airbyte'], default: 'airbyte' },
      status: { type: 'string', enum: ['pending', 'ready', 'failed'] },
      error: nullableString(),
      created_at: timestamp()
    },
    required: ['id', 'account_id', 'package', 'version', 'status', 'created_at']
  },

  Page_ConnectorImage_: page(
    'ConnectorImage',
    'A page of custom connector images.'
  ),

  ConnectorImageCreate: {
    type: 'object',
    title: 'Connector image create',
    properties: {
      package: { type: 'string' },
      version: { type: 'string' },
      credentials: {
        anyOf: [
          { type: 'object', additionalProperties: true },
          { type: 'null' }
        ],
        writeOnly: true,
        description: 'Registry pull credentials, if the image is private.'
      }
    },
    required: ['package', 'version']
  },

  // -- Destination config, typed ---------------------------------------------
  //
  // Shipped `Destination.config` is an open blob and `DestinationConfig` covers
  // ClickHouse only, so nothing describes what a Meta or S3 destination needs.
  // Jitsu types 30-odd variants; the nine here are the ones the product
  // actually offers (public/data/destination-templates.json) plus the
  // warehouses the Warehouse module needs. Adding a tenth means adding a
  // connector, so the two changes belong together.

  DestinationType: {
    type: 'string',
    title: 'Destination type',
    description:
      'Selects which `AnyDestinationConfig` variant applies. Extend this and the union together.',
    enum: [
      'clickhouse',
      'postgres',
      'bigquery',
      'snowflake',
      'meta-conversions-api',
      'tiktok-events-api',
      'google-ads',
      'webhook',
      's3'
    ]
  },

  AnyDestinationConfig: {
    title: 'Any destination config',
    description:
      'The config for a destination, selected by its `destination_type`. Every credential field is write-only: sent on create or update, returned as `"***"`.\n\n`DestinationConfig` (the ClickHouse variant) is the shipped shape and is referenced rather than restated.',
    oneOf: [
      { $ref: '#/components/schemas/DestinationConfig' },
      { $ref: '#/components/schemas/PostgresDestinationConfig' },
      { $ref: '#/components/schemas/BigqueryDestinationConfig' },
      { $ref: '#/components/schemas/SnowflakeDestinationConfig' },
      { $ref: '#/components/schemas/MetaConversionsDestinationConfig' },
      { $ref: '#/components/schemas/TiktokEventsDestinationConfig' },
      { $ref: '#/components/schemas/GoogleAdsDestinationConfig' },
      { $ref: '#/components/schemas/WebhookDestinationConfig' },
      { $ref: '#/components/schemas/S3DestinationConfig' }
    ]
  },

  PostgresDestinationConfig: {
    type: 'object',
    title: 'Postgres destination config',
    properties: {
      host: { type: 'string' },
      port: { type: 'integer', default: 5432 },
      database: { type: 'string' },
      schema: { type: 'string', default: 'public' },
      username: { type: 'string' },
      password: { type: 'string', writeOnly: true },
      ssl: { type: 'boolean', default: true }
    },
    required: ['host', 'database', 'username', 'password']
  },

  BigqueryDestinationConfig: {
    type: 'object',
    title: 'BigQuery destination config',
    properties: {
      project_id: { type: 'string' },
      dataset: { type: 'string' },
      location: { type: 'string', default: 'US' },
      service_account_key: {
        type: 'string',
        writeOnly: true,
        description:
          'Service-account JSON key. Held by the backend; never returned.'
      }
    },
    required: ['project_id', 'dataset', 'service_account_key']
  },

  SnowflakeDestinationConfig: {
    type: 'object',
    title: 'Snowflake destination config',
    properties: {
      account: {
        type: 'string',
        description: 'Snowflake account identifier, e.g. `xy12345.eu-west-1`.'
      },
      warehouse: { type: 'string' },
      database: { type: 'string' },
      schema: { type: 'string', default: 'PUBLIC' },
      role: nullableString(),
      username: { type: 'string' },
      password: { type: 'string', writeOnly: true }
    },
    required: ['account', 'warehouse', 'database', 'username', 'password']
  },

  MetaConversionsDestinationConfig: {
    type: 'object',
    title: 'Meta Conversions API destination config',
    properties: {
      pixel_id: { type: 'string', description: 'Pixel or dataset id.' },
      access_token: {
        type: 'string',
        writeOnly: true,
        description: 'System-user token with `ads_management`.'
      },
      test_event_code: nullableString(
        'Routes events to the Events Manager test tool instead of counting them.'
      ),
      log_request: { type: 'boolean', default: false }
    },
    required: ['pixel_id', 'access_token']
  },

  TiktokEventsDestinationConfig: {
    type: 'object',
    title: 'TikTok Events API destination config',
    properties: {
      event_source_id: {
        type: 'string',
        description: 'Pixel or offline event set id.'
      },
      access_token: { type: 'string', writeOnly: true },
      test_event_code: nullableString()
    },
    required: ['event_source_id', 'access_token']
  },

  GoogleAdsDestinationConfig: {
    type: 'object',
    title: 'Google Ads destination config',
    properties: {
      customer_id: {
        type: 'string',
        description: 'Ads customer id, digits only.'
      },
      login_customer_id: nullableString(
        'Manager account id, when access is via an MCC.'
      ),
      conversion_action_id: { type: 'string' },
      oauth_authorization_id: {
        type: 'string',
        description:
          'The grant to send under. Google Ads authorizes via OAuth, not a static token — see Authorizations.'
      }
    },
    required: ['customer_id', 'conversion_action_id', 'oauth_authorization_id']
  },

  WebhookDestinationConfig: {
    type: 'object',
    title: 'Webhook destination config',
    properties: {
      url: { type: 'string', format: 'uri' },
      method: { type: 'string', enum: ['POST', 'PUT'], default: 'POST' },
      headers: {
        type: 'object',
        additionalProperties: { type: 'string' },
        writeOnly: true,
        description:
          'Sent with every request. Write-only, because these routinely carry an authorization header.'
      },
      batch_size: { type: 'integer', minimum: 1, maximum: 1000, default: 1 },
      timeout_ms: {
        type: 'integer',
        minimum: 100,
        maximum: 30000,
        default: 5000
      }
    },
    required: ['url']
  },

  S3DestinationConfig: {
    type: 'object',
    title: 'S3 destination config',
    properties: {
      bucket: { type: 'string' },
      region: { type: 'string' },
      prefix: {
        type: 'string',
        default: '',
        description: 'Key prefix. Supports `{date}` and `{table}` placeholders.'
      },
      access_key_id: { type: 'string', writeOnly: true },
      secret_access_key: { type: 'string', writeOnly: true },
      format: {
        type: 'string',
        enum: ['ndjson', 'parquet', 'csv'],
        default: 'ndjson'
      },
      compression: { type: 'string', enum: ['none', 'gzip'], default: 'gzip' }
    },
    required: ['bucket', 'region', 'access_key_id', 'secret_access_key']
  },

  // -- Functions -------------------------------------------------------------

  FunctionDefinition: {
    type: 'object',
    title: 'Function',
    description:
      'A transform in the account library. `PipelineFunction` is an *instance* of one attached to a pipeline — this is the definition behind it.',
    properties: {
      id: { type: 'string' },
      account_id: { type: 'string' },
      name: { type: 'string' },
      slug: { type: 'string' },
      description: nullableString(),
      kind: {
        type: 'string',
        enum: ['transform', 'filter', 'enrich'],
        description:
          'What it does to an event: reshape it, drop it, or add to it.'
      },
      code: {
        type: 'string',
        description: 'TypeScript, run in the backend sandbox.'
      },
      version: { type: 'integer', minimum: 1 },
      template: nullableString('Platform template this came from, if any.'),
      template_version: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
      latest_template_version: {
        anyOf: [{ type: 'integer' }, { type: 'null' }],
        description: 'Above `template_version` means an upgrade is available.'
      },
      attached_pipeline_ids: { type: 'array', items: { type: 'string' } },
      created_at: timestamp(),
      updated_at: timestamp()
    },
    required: [
      'id',
      'account_id',
      'name',
      'slug',
      'kind',
      'code',
      'version',
      'created_at',
      'updated_at'
    ]
  },

  Page_FunctionDefinition_: page('FunctionDefinition', 'A page of functions.'),

  FunctionCreate: {
    type: 'object',
    title: 'Function create',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      slug: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$' },
      description: { type: 'string' },
      kind: {
        type: 'string',
        enum: ['transform', 'filter', 'enrich'],
        default: 'transform'
      },
      code: { type: 'string' },
      template: {
        type: 'string',
        description: 'Instantiate from this template instead of sending `code`.'
      }
    },
    required: ['name', 'slug']
  },

  FunctionUpdate: {
    type: 'object',
    title: 'Function update',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string' },
      code: { type: 'string' }
    }
  },

  FunctionTestRequest: {
    type: 'object',
    title: 'Function test request',
    properties: {
      event: {
        type: 'object',
        additionalProperties: true,
        description: 'A sample event to run the function on.'
      },
      code: {
        type: 'string',
        description:
          'Unsaved code to run instead of the stored version, so the editor can test before saving.'
      }
    },
    required: ['event']
  },

  FunctionTestResult: {
    type: 'object',
    title: 'Function test result',
    description:
      'A function that throws is a `200` with `ok: false` — the run happened, and the editor needs the error to display.',
    properties: {
      ok: { type: 'boolean' },
      result: {
        anyOf: [
          { type: 'object', additionalProperties: true },
          { type: 'null' }
        ],
        description:
          'The event as it came out. Null means the function dropped it — which is success for a filter.'
      },
      dropped: { type: 'boolean', default: false },
      error: nullableString(),
      logs: {
        type: 'array',
        items: { $ref: '#/components/schemas/SyncRunLogEntry' }
      },
      duration_ms: { type: 'integer' }
    },
    required: ['ok', 'dropped', 'logs']
  },

  PipelineFunctionAttach: {
    type: 'object',
    title: 'Pipeline function attach',
    properties: {
      function_id: { type: 'string' },
      position: {
        anyOf: [{ type: 'integer', minimum: 0 }, { type: 'null' }],
        description: 'Zero-based insertion point. Omit to append.'
      }
    },
    required: ['function_id']
  },

  PipelineFunctionOrder: {
    type: 'object',
    title: 'Pipeline function order',
    properties: {
      function_ids: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Every attached function id, in execution order. Omitting one is a `422`, not a detach.'
      }
    },
    required: ['function_ids']
  },

  // -- Pipeline diagram ------------------------------------------------------

  PipelineDiagram: {
    type: 'object',
    title: 'Pipeline diagram',
    properties: {
      nodes: {
        type: 'array',
        items: { $ref: '#/components/schemas/PipelineDiagramNode' }
      },
      edges: {
        type: 'array',
        items: { $ref: '#/components/schemas/PipelineDiagramEdge' }
      },
      window_minutes: { type: 'integer' },
      generated_at: timestamp()
    },
    required: ['nodes', 'edges', 'window_minutes', 'generated_at']
  },

  PipelineDiagramNode: {
    type: 'object',
    title: 'Pipeline diagram node',
    properties: {
      id: { type: 'string' },
      kind: { type: 'string', enum: ['source', 'destination'] },
      name: { type: 'string' },
      subtype: {
        type: 'string',
        description:
          '`source_type` or `destination_type`, for picking the icon.'
      },
      is_enabled: { type: 'boolean' },
      status: {
        type: 'string',
        enum: ['healthy', 'degraded', 'failing', 'idle']
      },
      events_in_window: { type: 'integer', minimum: 0 }
    },
    required: ['id', 'kind', 'name', 'is_enabled', 'status', 'events_in_window']
  },

  PipelineDiagramEdge: {
    type: 'object',
    title: 'Pipeline diagram edge',
    description:
      'One pipeline, drawn from its source node to its destination node.',
    properties: {
      id: { type: 'string', description: 'The pipeline id.' },
      source_id: { type: 'string' },
      destination_id: { type: 'string' },
      name: { type: 'string' },
      is_enabled: { type: 'boolean' },
      status: {
        type: 'string',
        enum: ['healthy', 'degraded', 'failing', 'idle']
      },
      events_in_window: { type: 'integer', minimum: 0 },
      errors_in_window: { type: 'integer', minimum: 0 },
      function_count: { type: 'integer', minimum: 0 }
    },
    required: [
      'id',
      'source_id',
      'destination_id',
      'name',
      'is_enabled',
      'status',
      'events_in_window',
      'errors_in_window'
    ]
  },

  // -- Metrics ---------------------------------------------------------------

  MetricsResult: {
    type: 'object',
    title: 'Metrics result',
    description:
      'One series per group when `group_by` is set, otherwise a single series.',
    properties: {
      start: timestamp(),
      end: timestamp(),
      granularity: { type: 'string', enum: ['minute', 'hour', 'day'] },
      group_by: {
        type: 'string',
        enum: ['none', 'source', 'destination', 'pipeline', 'status']
      },
      series: {
        type: 'array',
        items: { $ref: '#/components/schemas/MetricsSeries' }
      }
    },
    required: ['start', 'end', 'granularity', 'group_by', 'series']
  },

  MetricsSeries: {
    type: 'object',
    title: 'Metrics series',
    properties: {
      key: {
        type: 'string',
        description: 'The group this series covers; `all` when ungrouped.'
      },
      label: { type: 'string' },
      points: {
        type: 'array',
        items: { $ref: '#/components/schemas/MetricsPoint' }
      }
    },
    required: ['key', 'label', 'points']
  },

  MetricsPoint: {
    type: 'object',
    title: 'Metrics point',
    description:
      'A bucket. Buckets with no events are still returned with zeros, so a chart shows the gap rather than interpolating over it.',
    properties: {
      bucket: timestamp('Start of the bucket.'),
      events: { type: 'integer', minimum: 0 },
      errors: { type: 'integer', minimum: 0 },
      bytes: { anyOf: [{ type: 'integer', minimum: 0 }, { type: 'null' }] }
    },
    required: ['bucket', 'events', 'errors']
  },

  // -- Profiles --------------------------------------------------------------

  ProfileBuilder: {
    type: 'object',
    title: 'Profile builder',
    properties: {
      id: { type: 'string' },
      account_id: { type: 'string' },
      name: { type: 'string' },
      slug: { type: 'string' },
      is_enabled: { type: 'boolean' },
      destination_id: nullableString(
        'Where built profiles are written. Null keeps them queryable through this API only.'
      ),
      identifier_types: {
        type: 'array',
        items: { type: 'string' },
        description: 'Identifiers to stitch on, most trusted first.'
      },
      code: nullableString(
        'Optional TypeScript computing derived traits, run per profile.'
      ),
      cron: nullableString('When it runs. Null means on demand.'),
      last_run_at: nullableTimestamp(),
      profile_count: {
        anyOf: [{ type: 'integer', minimum: 0 }, { type: 'null' }]
      },
      created_at: timestamp(),
      updated_at: timestamp()
    },
    required: [
      'id',
      'account_id',
      'name',
      'slug',
      'is_enabled',
      'identifier_types',
      'created_at',
      'updated_at'
    ]
  },

  Page_ProfileBuilder_: page('ProfileBuilder', 'A page of profile builders.'),

  ProfileBuilderCreate: {
    type: 'object',
    title: 'Profile builder create',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      slug: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$' },
      destination_id: { type: 'string' },
      identifier_types: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1
      },
      code: { type: 'string' },
      cron: { type: 'string' }
    },
    required: ['name', 'slug', 'identifier_types']
  },

  ProfileBuilderUpdate: {
    type: 'object',
    title: 'Profile builder update',
    properties: {
      name: { type: 'string' },
      is_enabled: { type: 'boolean' },
      destination_id: nullableString(),
      identifier_types: { type: 'array', items: { type: 'string' } },
      code: nullableString(),
      cron: nullableString()
    }
  },

  Profile: {
    type: 'object',
    title: 'Profile',
    description:
      'One person, stitched from every identifier that resolved to them.',
    properties: {
      id: { type: 'string' },
      account_id: { type: 'string' },
      profile_builder_id: { type: 'string' },
      identifiers: {
        type: 'array',
        items: { $ref: '#/components/schemas/ProfileIdentifier' }
      },
      traits: {
        type: 'object',
        additionalProperties: true,
        description:
          "Computed traits. Shape is the builder's business, not this API's."
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description:
          'How sure the stitch is. Below 1 means at least one identifier matched probabilistically.'
      },
      first_seen_at: timestamp(),
      last_seen_at: timestamp(),
      event_count: { type: 'integer', minimum: 0 },
      updated_at: timestamp()
    },
    required: [
      'id',
      'account_id',
      'profile_builder_id',
      'identifiers',
      'traits',
      'confidence',
      'first_seen_at',
      'last_seen_at',
      'event_count',
      'updated_at'
    ]
  },

  Page_Profile_: page('Profile', 'A page of profiles.'),

  ProfileIdentifier: {
    type: 'object',
    title: 'Profile identifier',
    properties: {
      type: {
        type: 'string',
        description:
          'Identifier type key, e.g. `email`, `user_id`, `anonymous_id`.'
      },
      value: {
        type: 'string',
        description:
          'Masked for identifier types marked `is_pii`, unless the caller holds the role to see it.'
      },
      first_seen_at: timestamp(),
      last_seen_at: timestamp(),
      match: {
        type: 'string',
        enum: ['deterministic', 'probabilistic'],
        description:
          'How this identifier joined the profile — an exact match on a unique field, or a scored one.'
      }
    },
    required: ['type', 'value', 'first_seen_at', 'last_seen_at', 'match']
  },

  IdentifierType: {
    type: 'object',
    title: 'Identifier type',
    properties: {
      key: { type: 'string' },
      name: { type: 'string' },
      is_unique: {
        type: 'boolean',
        description:
          'Safe to stitch on deterministically. A shared device id is not.'
      },
      is_pii: {
        type: 'boolean',
        description:
          "Masked on read unless the caller's role permits otherwise."
      },
      distinct_count: { type: 'integer', minimum: 0 },
      coverage: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description:
          'Share of events carrying it. A rare identifier is a poor thing to stitch on.'
      }
    },
    required: ['key', 'name', 'is_unique', 'is_pii']
  },

  IdentifierTypeList: {
    type: 'object',
    title: 'Identifier type list',
    properties: {
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/IdentifierType' }
      }
    },
    required: ['items']
  },

  // -- Domains ---------------------------------------------------------------

  IngestDomain: {
    type: 'object',
    title: 'Ingest domain',
    properties: {
      id: { type: 'string' },
      account_id: { type: 'string' },
      domain: {
        type: 'string',
        description: 'Fully-qualified, e.g. `events.acme.com`.'
      },
      status: { type: 'string', enum: ['pending', 'verified', 'failed'] },
      certificate_status: {
        type: 'string',
        enum: ['pending', 'issued', 'failed']
      },
      dns_records: {
        type: 'array',
        items: { $ref: '#/components/schemas/DnsRecord' },
        description:
          'What the customer has to create. Returned on create and while `pending`.'
      },
      error: nullableString(),
      verified_at: nullableTimestamp(),
      created_at: timestamp()
    },
    required: [
      'id',
      'account_id',
      'domain',
      'status',
      'certificate_status',
      'created_at'
    ]
  },

  DnsRecord: {
    type: 'object',
    title: 'DNS record',
    properties: {
      type: { type: 'string', enum: ['CNAME', 'TXT', 'A'] },
      name: { type: 'string' },
      value: { type: 'string' },
      ttl: { type: 'integer' }
    },
    required: ['type', 'name', 'value']
  },

  Page_IngestDomain_: page('IngestDomain', 'A page of ingest domains.'),

  IngestDomainCreate: {
    type: 'object',
    title: 'Ingest domain create',
    properties: { domain: { type: 'string' } },
    required: ['domain']
  },

  // -- Notifications ---------------------------------------------------------
  //
  // Field-for-field Jitsu's NotificationChannel, snake_cased. This is the one
  // domain where Jitsu's model needed no reshaping at all.

  NotificationChannel: {
    type: 'object',
    title: 'Notification channel',
    properties: {
      id: { type: 'string' },
      account_id: { type: 'string' },
      name: { type: 'string' },
      channel: { type: 'string', enum: ['email', 'slack'], default: 'slack' },
      events: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['all', 'sync', 'batch', 'dead', 'account']
        },
        default: ['all'],
        description:
          '`dead` covers events that failed every retry and were dropped.'
      },
      slack_webhook_url: nullableString(
        'Write-only in practice — returned masked.'
      ),
      emails: { type: 'array', items: { type: 'string', format: 'email' } },
      recurring_alerts_period_hours: {
        type: 'integer',
        minimum: 0,
        maximum: 720,
        default: 168,
        description:
          'How long to wait before re-alerting on a condition that is still failing. 0 alerts every time.'
      },
      summarize_batch_notifications_by_table: {
        type: 'boolean',
        default: true
      },
      is_enabled: { type: 'boolean', default: true },
      created_at: timestamp(),
      updated_at: timestamp()
    },
    required: [
      'id',
      'account_id',
      'name',
      'channel',
      'events',
      'is_enabled',
      'created_at',
      'updated_at'
    ]
  },

  Page_NotificationChannel_: page(
    'NotificationChannel',
    'A page of notification channels.'
  ),

  NotificationChannelCreate: {
    type: 'object',
    title: 'Notification channel create',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      channel: { type: 'string', enum: ['email', 'slack'], default: 'slack' },
      events: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['all', 'sync', 'batch', 'dead', 'account']
        }
      },
      slack_webhook_url: {
        type: 'string',
        writeOnly: true,
        description: 'Required when `channel` is `slack`.'
      },
      emails: {
        type: 'array',
        items: { type: 'string', format: 'email' },
        description: 'Required when `channel` is `email`.'
      },
      recurring_alerts_period_hours: {
        type: 'integer',
        minimum: 0,
        maximum: 720
      },
      summarize_batch_notifications_by_table: { type: 'boolean' }
    },
    required: ['name', 'channel']
  },

  NotificationChannelUpdate: {
    type: 'object',
    title: 'Notification channel update',
    properties: {
      name: { type: 'string' },
      events: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['all', 'sync', 'batch', 'dead', 'account']
        }
      },
      slack_webhook_url: { type: 'string', writeOnly: true },
      emails: { type: 'array', items: { type: 'string', format: 'email' } },
      recurring_alerts_period_hours: {
        type: 'integer',
        minimum: 0,
        maximum: 720
      },
      summarize_batch_notifications_by_table: { type: 'boolean' },
      is_enabled: { type: 'boolean' }
    }
  },

  // -- Warehouse -------------------------------------------------------------

  WarehouseConnection: {
    type: 'object',
    title: 'Warehouse connection',
    description:
      'A warehouse the customer owns, which Sfere reads from or writes to. Distinct from a `Destination`, which Sfere provisions and manages — different lifecycle, so a separate resource rather than a flag on one.',
    properties: {
      id: { type: 'string' },
      account_id: { type: 'string' },
      name: { type: 'string' },
      slug: { type: 'string' },
      warehouse_type: {
        type: 'string',
        enum: ['clickhouse', 'postgres', 'bigquery', 'snowflake']
      },
      config: { $ref: '#/components/schemas/AnyDestinationConfig' },
      direction: {
        type: 'string',
        enum: ['read', 'write', 'both'],
        default: 'write',
        description:
          "`read` powers reverse ETL out of the customer's warehouse; `write` lands Sfere data in it."
      },
      is_enabled: { type: 'boolean' },
      last_test_at: nullableTimestamp(),
      last_test_ok: { anyOf: [{ type: 'boolean' }, { type: 'null' }] },
      created_at: timestamp(),
      updated_at: timestamp()
    },
    required: [
      'id',
      'account_id',
      'name',
      'slug',
      'warehouse_type',
      'direction',
      'is_enabled',
      'created_at',
      'updated_at'
    ]
  },

  Page_WarehouseConnection_: page(
    'WarehouseConnection',
    'A page of warehouse connections.'
  ),

  WarehouseConnectionCreate: {
    type: 'object',
    title: 'Warehouse connection create',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      slug: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$' },
      warehouse_type: {
        type: 'string',
        enum: ['clickhouse', 'postgres', 'bigquery', 'snowflake']
      },
      config: { $ref: '#/components/schemas/AnyDestinationConfig' },
      direction: {
        type: 'string',
        enum: ['read', 'write', 'both'],
        default: 'write'
      }
    },
    required: ['name', 'slug', 'warehouse_type', 'config']
  },

  WarehouseConnectionUpdate: {
    type: 'object',
    title: 'Warehouse connection update',
    properties: {
      name: { type: 'string' },
      config: { $ref: '#/components/schemas/AnyDestinationConfig' },
      direction: { type: 'string', enum: ['read', 'write', 'both'] },
      is_enabled: { type: 'boolean' }
    }
  },

  // -- Monitoring ------------------------------------------------------------

  DeliveryError: {
    type: 'object',
    title: 'Delivery error',
    properties: {
      id: { type: 'string' },
      account_id: { type: 'string' },
      occurred_at: timestamp(),
      severity: { type: 'string', enum: ['warning', 'error'] },
      source_id: nullableString(),
      destination_id: nullableString(),
      pipeline_id: nullableString(),
      function_id: nullableString(
        'Set when a function threw rather than the destination rejecting the event.'
      ),
      message: {
        type: 'string',
        description:
          'Safe to show a user. Credentials are redacted by the backend.'
      },
      code: nullableString(
        'Stable machine code for grouping, e.g. `destination_timeout`.'
      ),
      retry_count: { type: 'integer', minimum: 0 },
      is_retryable: {
        type: 'boolean',
        description:
          'False for a permanent failure — a rejected schema will fail identically forever.'
      },
      event_id: nullableString(),
      payload: {
        anyOf: [
          { type: 'object', additionalProperties: true },
          { type: 'null' }
        ],
        description:
          'The event that failed, kept for the retention window so a retry has something to send. Null once it expires.'
      }
    },
    required: [
      'id',
      'account_id',
      'occurred_at',
      'severity',
      'message',
      'retry_count',
      'is_retryable'
    ]
  },

  Page_DeliveryError_: page('DeliveryError', 'A page of delivery errors.'),

  ErrorStats: {
    type: 'object',
    title: 'Error stats',
    properties: {
      start: timestamp(),
      end: timestamp(),
      total: { type: 'integer', minimum: 0 },
      retryable: { type: 'integer', minimum: 0 },
      by_code: {
        type: 'array',
        items: { $ref: '#/components/schemas/ErrorStatsBucket' }
      },
      by_pipeline: {
        type: 'array',
        items: { $ref: '#/components/schemas/ErrorStatsBucket' }
      }
    },
    required: ['start', 'end', 'total', 'retryable', 'by_code', 'by_pipeline']
  },

  ErrorStatsBucket: {
    type: 'object',
    title: 'Error stats bucket',
    properties: {
      key: { type: 'string' },
      label: { type: 'string' },
      count: { type: 'integer', minimum: 0 }
    },
    required: ['key', 'label', 'count']
  },

  HealthReport: {
    type: 'object',
    title: 'Health report',
    description:
      "Whether this account's data is actually flowing. Not the same question as `/healthz`, which is about the service.",
    properties: {
      status: { type: 'string', enum: ['healthy', 'degraded', 'failing'] },
      generated_at: timestamp(),
      queues: {
        type: 'array',
        items: { $ref: '#/components/schemas/QueueHealth' }
      }
    },
    required: ['status', 'generated_at', 'queues']
  },

  QueueHealth: {
    type: 'object',
    title: 'Queue health',
    properties: {
      name: { type: 'string' },
      depth: {
        type: 'integer',
        minimum: 0,
        description:
          'Events waiting. A depth that only grows is the signal worth alerting on.'
      },
      lag_seconds: {
        type: 'integer',
        minimum: 0,
        description: 'Age of the oldest waiting event.'
      },
      throughput_per_minute: { type: 'number', minimum: 0 },
      status: { type: 'string', enum: ['healthy', 'degraded', 'failing'] }
    },
    required: [
      'name',
      'depth',
      'lag_seconds',
      'throughput_per_minute',
      'status'
    ]
  },

  // -- Trash -----------------------------------------------------------------

  TrashResource: {
    type: 'string',
    title: 'Trash resource',
    description:
      'Which kind of resource a trash entry holds. Only these three are soft-deletable.',
    enum: ['sources', 'destinations', 'pipelines']
  },

  TrashItem: {
    type: 'object',
    title: 'Trash item',
    properties: {
      id: { type: 'string' },
      account_id: { type: 'string' },
      resource: { $ref: '#/components/schemas/TrashResource' },
      resource_id: { type: 'string' },
      name: {
        type: 'string',
        description:
          "The resource's name at deletion, so the list reads without resolving each one."
      },
      deleted_at: timestamp(),
      deleted_by: nullableString('User id, or null when a cascade deleted it.'),
      purge_at: timestamp(
        'When the restore window closes and it goes for good.'
      ),
      restorable: {
        type: 'boolean',
        description:
          'False when something blocks restore — the slug was reused, or the parent is gone too.'
      },
      restore_blocked_reason: nullableString()
    },
    required: [
      'id',
      'account_id',
      'resource',
      'resource_id',
      'name',
      'deleted_at',
      'purge_at',
      'restorable'
    ]
  },

  Page_TrashItem_: page('TrashItem', 'A page of soft-deleted resources.'),

  // -- Secrets ---------------------------------------------------------------

  Secret: {
    type: 'object',
    title: 'Secret',
    description:
      'Metadata about a stored credential. The value is never returned — not masked, absent.',
    properties: {
      id: { type: 'string' },
      account_id: { type: 'string' },
      name: {
        type: 'string',
        description: 'Referenced from a config as `secret://NAME`.'
      },
      description: nullableString(),
      hint: {
        type: 'string',
        description: 'Last four characters, so a user can tell two keys apart.'
      },
      used_by: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Destination and source ids referring to it. What makes a delete safe to refuse.'
      },
      expires_at: nullableTimestamp(),
      created_at: timestamp(),
      updated_at: timestamp()
    },
    required: [
      'id',
      'account_id',
      'name',
      'hint',
      'used_by',
      'created_at',
      'updated_at'
    ]
  },

  Page_Secret_: page('Secret', 'A page of secrets.'),

  SecretCreate: {
    type: 'object',
    title: 'Secret create',
    properties: {
      name: {
        type: 'string',
        pattern: '^[A-Z][A-Z0-9_]*$',
        description: "Screaming snake case, matching a template's `key_prefix`."
      },
      value: { type: 'string', writeOnly: true },
      description: { type: 'string' },
      expires_at: nullableTimestamp()
    },
    required: ['name', 'value']
  },

  SecretUpdate: {
    type: 'object',
    title: 'Secret update',
    properties: {
      value: { type: 'string', writeOnly: true },
      description: { type: 'string' },
      expires_at: nullableTimestamp()
    }
  },

  // -- OAuth authorizations --------------------------------------------------

  OauthProvider: {
    type: 'object',
    title: 'OAuth provider',
    properties: {
      id: {
        type: 'string',
        description: 'e.g. `zid`, `google-ads`, `shopify`.'
      },
      name: { type: 'string' },
      scopes: {
        type: 'array',
        items: { type: 'string' },
        description: 'What the grant will ask for.'
      },
      connector_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Connectors this provider authorizes.'
      },
      icon: { type: 'string' }
    },
    required: ['id', 'name', 'scopes']
  },

  OauthProviderList: {
    type: 'object',
    title: 'OAuth provider list',
    properties: {
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/OauthProvider' }
      }
    },
    required: ['items']
  },

  OauthAuthorization: {
    type: 'object',
    title: 'OAuth authorization',
    description:
      "A grant the backend holds on the account's behalf. Tokens live in the backend; none of them appear here.",
    properties: {
      id: { type: 'string' },
      account_id: { type: 'string' },
      provider_id: { type: 'string' },
      status: {
        type: 'string',
        enum: ['pending', 'active', 'expired', 'revoked']
      },
      external_account_label: nullableString(
        'What the provider calls the authorized account, e.g. a store name.'
      ),
      scopes: { type: 'array', items: { type: 'string' } },
      used_by_source_ids: { type: 'array', items: { type: 'string' } },
      authorized_at: nullableTimestamp(),
      expires_at: nullableTimestamp(),
      created_at: timestamp()
    },
    required: [
      'id',
      'account_id',
      'provider_id',
      'status',
      'scopes',
      'created_at'
    ]
  },

  Page_OauthAuthorization_: page(
    'OauthAuthorization',
    'A page of OAuth authorizations.'
  ),

  OauthAuthorizationCreate: {
    type: 'object',
    title: 'OAuth authorization create',
    properties: {
      provider_id: { type: 'string' },
      source_id: {
        type: 'string',
        description:
          'Attach the resulting grant to this source once it completes.'
      },
      redirect_uri: {
        type: 'string',
        format: 'uri',
        description:
          'Where to send the user after the provider is done. Must be an allowlisted dashboard origin.'
      }
    },
    required: ['provider_id']
  },

  OauthAuthorizationStart: {
    type: 'object',
    title: 'OAuth authorization start',
    properties: {
      authorization: { $ref: '#/components/schemas/OauthAuthorization' },
      authorize_url: {
        type: 'string',
        format: 'uri',
        description: 'Send the user here. The backend handles the callback.'
      },
      state: {
        type: 'string',
        description: 'Opaque value to match the callback against.'
      }
    },
    required: ['authorization', 'authorize_url', 'state']
  },

  // -- API tokens ------------------------------------------------------------

  ApiToken: {
    type: 'object',
    title: 'API token',
    properties: {
      id: { type: 'string' },
      account_id: { type: 'string' },
      name: { type: 'string' },
      hint: { type: 'string', description: 'Last four characters.' },
      scopes: {
        type: 'array',
        items: { $ref: '#/components/schemas/ApiTokenScope' }
      },
      created_by: {
        type: 'string',
        description: 'User id of the member who minted it.'
      },
      created_at: timestamp(),
      last_used_at: nullableTimestamp(),
      expires_at: nullableTimestamp()
    },
    required: [
      'id',
      'account_id',
      'name',
      'hint',
      'scopes',
      'created_by',
      'created_at'
    ]
  },

  ApiTokenScope: {
    type: 'string',
    title: 'API token scope',
    description:
      'Coarse on purpose: a token holds fewer permissions than a role, not a different set.',
    enum: ['read', 'write', 'admin']
  },

  Page_ApiToken_: page('ApiToken', 'A page of API tokens.'),

  ApiTokenCreate: {
    type: 'object',
    title: 'API token create',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      scopes: {
        type: 'array',
        items: { $ref: '#/components/schemas/ApiTokenScope' },
        minItems: 1
      },
      expires_at: nullableTimestamp('Omit for a token that does not expire.')
    },
    required: ['name', 'scopes']
  },

  ApiTokenCreated: {
    type: 'object',
    title: 'API token created',
    properties: {
      token: { $ref: '#/components/schemas/ApiToken' },
      plaintext: {
        type: 'string',
        description: 'The token. Shown once; not retrievable afterwards.'
      }
    },
    required: ['token', 'plaintext']
  }
}
