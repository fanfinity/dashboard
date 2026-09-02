# Checking 45edb4f against the agreed Sfere CDP contract

Source of the contract: `Sfere-CDP-OpenAPI.json` from backend PR #16
(<https://github.com/fanfinity/backend/pull/16>), installed at
`openapi/fanfinity-api.json` on 2026-09-02 and used to regenerate `src/api/`.

**Provenance matters here.** That file is normally curled from
`api-staging.sfere.io/openapi.json` by `pnpm openapi:pull`, and staging does not
serve PR #16 yet. So until the PR is deployed, run **`pnpm openapi:generate`
only** — a bare `pnpm openapi` re-pulls staging and silently reverts the
contract, taking the generated client with it.

## Verdict

The wiring in `45edb4f` holds. The contract is a **strict superset** of
the spec the dashboard was generated from: 79 paths against 37, 163 schemas
against 60, **nothing removed and no property dropped**. Every path any
composable calls resolves. The two endpoints CLAUDE.md recorded as "not in the
merged spec" (`…/zid-connections`, `…/zid-authorize`) and the one recorded as
"drafted, does not exist" (`/v1/connectors`) are all in it.

One behavioural change does affect a shipped screen, and no gate can see it —
see "The one real break" below.

## What was actually tested

### 1. Path resolution

Every `/v1/...` path built by any composable exists in the contract. `/v1/errors`
is not in the contract and is not called by anything.

### 2. Field drift on the 18 PR-#16-wired composables

The endpoints those composables read were **absent** from the old spec, so a
schema-to-schema diff structurally cannot see drift in them — they were written
against PR #16's branch, and a field the contract does not carry renders as a
confident `0` or a false "Pass-through", which is the failure class
`CLAUDE.md` warns about.

So: camelize every property reachable from each endpoint's `200`/`201` schema,
collect every identifier each composable reads off a record, and diff.
Script kept at `tools/contract-field-drift.mjs` — one-off contract maintenance, not a
gate, so it lives in `tools/` per CLAUDE.md.

Result: **no drift.** Twelve identifiers flagged, all four groups benign:

| Composable            | Flagged                                                    | Verdict                                                                  |
| --------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `useApiTokens`        | `isRevoked`                                                | hardcoded `false` locally, already documented in the file                |
| `useMonitoringHealth` | `statusLabel`                                              | derived locally from `status`                                            |
| `useDiagram`          | `sources`, `eventDestinations`, `pipes`                    | the **mock fixture** shape; `api.select` adapts the real payload into it |
| `useTeam`             | `getTime`, `toLocaleDateString`                            | `Date` methods                                                           |
| `useConnectorCatalog` | `iconUrl`, `meta`, `packageId`, `packageType`, `sortIndex` | the **fixture** adapter; the real one reads contract names               |

The two real-payload adapters match the contract field for field:

- `adaptPipelineDiagram` reads `nodes`/`edges`/`kind`/`subtype`/`is_enabled`/
  `status`/`function_count`/`window_minutes`/`generated_at` — exactly
  `PipelineDiagram`.
- `adaptConnector` reads `package`/`icon`/`protocol`/`status`/`requires_oauth`/
  `tags`/`version`/`kind`/`source_type`/`destination_type` — exactly `Connector`.

### 3. The three spots where a mismatch would be unrecoverable or mislabelling

- **Write-once plaintexts.** Contract has `ApiTokenCreated {token, plaintext}`
  and `WriteKeyCreated {key, plaintext}`. Both composables read those names, and
  both still route through `SecretRevealDialog`. Intact.
- **`usePipelineFunctions().reorder()`.** Sends `PUT …/functions` with
  `{function_ids: [...]}` — matches `PipelineFunctionOrder`. `attach()` sends
  `POST` with an optional `position` — matches `PipelineFunctionAttach`. The
  contract's new `PUT …/functions/{id}` and `…/functions/{id}/reset` are
  additions the app does not call, so the bulk reorder is unaffected.
- **`useSourceWriteKeys()`'s `400` → `noSite` branch.** Still correct, but see
  the backend note below.

### 4. Gates

| Gate              | Result                                |
| ----------------- | ------------------------------------- |
| `pnpm build`      | passes                                |
| `pnpm lint:check` | passes (1180 files, formatting clean) |
| `pnpm smoke:dist` | **60/60 routes clean** (mock mode)    |

`pnpm build` is not a contract gate: Vite transpiles `src/api/fanfinity.ts`
without typechecking, so `AnyDestinationConfig` replacing `DestinationConfig`
on `Destination.config` could not have failed it. Section 2 is the real check.

**Nor is smoke a gate on the create-path fix below.** Smoke runs in mock mode,
which never issues a `POST`, so `/sources/new` rendering clean says nothing
about step 3's reveal — that depends on a real create returning a pipeline. The
fix is verified **correct against the contract**, not verified **working**, and
it cannot be verified locally: staging does not serve PR #16 yet. First thing to
check on the PR preview channel once the backend lands.

## The one real break: `POST …/sources` no longer provisions the chain

The contract splits source creation in two:

- `POST …/sources` — "Create a source alone: the row, its Jitsu site, and a
  first write key. **No destination, pipeline, or ClickHouse database** — Zid and
  Web SDK sources start here and connect later."
- `POST …/sources/provisioned` — "**The legacy full-stack create**: source + site
  - key + ClickHouse database + destination + pipeline + push link, in one call."

`useSourcesAPI().create()` calls `createSource`, i.e. the bare one. Under this
contract a `web` or `zid` create no longer yields a pipeline, so on
`/sources/new` step 3 `useSourceProvisioning()` finds none, settles on
`state: 'none'`, and **`ProvisionedPipePanel` and `SourceProvisionedOverlay`
simply do not render** — the step-3 CTA falls back to "Add a destination".

That is the exact thing step 3 was built to eliminate, and **it fails silently**:
no console error, no unresolved route, no `ErrorState`, so `pnpm smoke:dist`
would stay green and only a human reading step 3 would notice. The measured
provisioning table in `CLAUDE.md` describes the `provisioned` endpoint's
behaviour, not the bare one's.

**Resolved: `create()` now posts to `…/sources/provisioned`.** That preserves the
shipped step-3 flow exactly — `useSourceProvisioning()` finds the pipeline,
`ProvisionedPipePanel` and `SourceProvisionedOverlay` render, and the primary
action stays "Open this source". The reasoning and the exit condition are in
`useSourcesAPI.js`'s `create()` doc comment: if the backend retires the legacy
endpoint, step 3 needs a real answer (create then provision in two calls, or a
narrowed reveal) before anything drops back to the plain create.

For the record, the alternatives and why they lose:

- **`web`** — bare create means there really is no destination or pipeline, so
  "add a destination by hand" becomes true again.
- **`zid`** — bare create plus "connect later" is arguably _more_ honest, since
  the provisioned chain is dry anyway until the merchant authorises on Zid's
  domain.

The cost of the chosen path is that `/sources/provisioned` is labelled **legacy**,
so this buys time rather than settling it. Worth raising in the PR review: ask
whether the full-stack create is actually going away, and if so what replaces it.

## Smaller honesty gaps the contract newly documents

Three contract notes describe fields that are echoed but not stored. Two reach
wired UI today:

- **`PUT …/sync-schedule`** — "Jitsu stores only the schedule expression:
  `timezone` and `mode` are echoed back but not persisted."
  `SourceSyncSetupPanel.vue` has a timezone input bound to `scheduleDraft.timezone`,
  so a saved timezone silently reverts on reload.
- **`POST …/write-keys`** — "the optional `name` label is echoed in this response
  but not persisted; Jitsu write keys carry no labels." `SourceWriteKeysPanel.vue`
  renders `key.name || 'Unnamed key'`, so a named key reads as "Unnamed key"
  after a reload.
- **`POST …/sync-runs/{id}/cancel`** — "Jitsu exposes no cancel-task API, so
  cancellation is recorded locally." Already handled honestly:
  `useSourceSyncAPI` re-reads rather than assuming, and says so in a comment.

## One thing to raise on the backend PR

`…/write-keys` documents its `400` as "Malformed request body" on both `GET` and
`POST`. But the no-site case — ordinary for three of the seven templates — is
also a `400`, and that is what `useSourceWriteKeys()` branches on to report
`noSite` instead of a red `ErrorState`. A `GET` has no body to malform, so the
description is shared boilerplate rather than the real semantics. **Ask for the
no-site `400` to be documented per-endpoint**, so the branch rests on a
documented contract rather than on observed behaviour.

## Newly possible, not built

- `DestinationUpdate` now takes `name` and `config`, so **renaming a destination
  is newly possible**. `SourceUpdate` is unchanged, so the source Settings tab's
  "Renaming a source is not available yet" banner stays accurate.
- `SourceCreate.write_keys` lets the browser mint the `keyId:secret` pair and
  stage it at create time, Jitsu-console style.
- `DestinationConfig` gains `cluster` and `parameters`, and `config` is now the
  `AnyDestinationConfig` union (ClickHouse, Postgres, BigQuery, Snowflake,
  Meta CAPI, TikTok, Google Ads, webhook, S3).
