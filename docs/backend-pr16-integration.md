# Backend PR #16 — review + action points

Review of [fanfinity/backend#16 `feat: jitsu proxy`](https://github.com/fanfinity/backend/pull/16)
for the dashboard PR that lands alongside it.
97 files, +35,645 / −3,633, `feature/jitsu-proxy` → `main`.

Written against dashboard branch `reported-enhancments-fixes` (HEAD `2e12664`).

**Ground truth is the router source** (`app/api/routes/*.py`), not the spec's `x-sfere-status`
labels — those are stale, see [Problem 1](#problem-1-55-live-endpoints-are-labelled-proposed).

---

## TL;DR

The backend adopted our CDP contract document as its `spec/openapi.yml` and then **built most of
the proposed half**. 93 net-new operations. Nothing existing broke.

|                                                  |                                         |
| ------------------------------------------------ | --------------------------------------- |
| Operations live on `main` today                  | 44 (49 in the deployed `/openapi.json`) |
| Operations after this PR                         | 137 in spec, **93 net new**             |
| Live endpoints that were "proposed" a week ago   | **55**                                  |
| Still genuinely unbuilt                          | 27                                      |
| **Breaking changes to anything we already call** | **0**                                   |
| Spectral findings on the new spec                | 5 errors, 4 warnings                    |

**You do not need to land both PRs together.** See [Downtime](#downtime-there-is-none-to-coordinate).

---

## Downtime: there is none to coordinate

I diffed the branch spec against **`openapi/fanfinity-api.json`** — the file orval actually
generates our shipping client from, not a spec-to-spec proxy. All 48 shared operations, field by
field, across parameters, request bodies, response schemas, enum members and status codes:

- 0 removed operations
- 0 removed or renamed request/response fields
- 0 new required request fields or parameters
- 0 removed enum members
- 0 removed status codes
- 0 changed `operationId`s

Cross-checked at the router level too: `git diff origin/main...HEAD` over the ten pre-existing
route files shows **no `response_model=` removed or changed** — only additions for new routes.

Changes to existing operations, all additive:

| Operation                                   | Change                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `PATCH …/destinations/{id}`                 | `is_enabled` no longer required; now accepts `name` and `config`; can return `409` |
| `POST …/sources`                            | accepts optional `write_keys[]`                                                    |
| `POST …/sources/{id}/sync`, `…/connect-zid` | can return `502`                                                                   |
| 11 others                                   | declare a `422`/`409` they always could return                                     |

One operation is in the deployed `/openapi.json` but absent from the branch spec:
`POST /api/zid/install-report`. It is **still implemented** (`internal_router` in `sources.py`) —
it's a spec gap, not a removal. See [Problem 2](#problem-2-apizidinstall-report-is-in-the-app-but-not-the-spec).

**Safe order:** merge backend → staging deploys → `pnpm openapi` here → merge dashboard.
The current build keeps working against the new backend throughout. Simultaneous merge is fine
too, it just isn't buying anything.

---

## The main event: mocks you can now delete

Most screens on this branch read `public/data/*.json` through `useMockResource(...)`. Here is
which of those now have a real endpoint behind them.

### ✅ Swap now — endpoint is live

| Mock file               | Composable                                                                                                                                                                     | Real endpoint(s)                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `connectors.json`       | `useConnectorCatalog.js`                                                                                                                                                       | `GET /v1/connectors`, `GET /v1/connectors/{id}`, `GET /v1/connectors/{id}/spec` |
| `identifier-types.json` | `useProfilesIdentityResolution.js`, `useAttributes.js`, `useProfileApi.js`, `useProfileDwhSyncs.js`, `useWarehouseModels.js`, `useLiveProfileSyncs.js`, `useProfilesSearch.js` | `GET …/identifier-types`                                                        |
| `health-queues.json`    | `useMonitoringHealth.js`                                                                                                                                                       | `GET …/health`                                                                  |
| `pipes-diagram.json`    | `useDiagram.js`                                                                                                                                                                | `GET …/pipelines/diagram`                                                       |
| `api-tokens.json`       | `useSettingsWorkspace.js`, `useProfileApi.js`                                                                                                                                  | `GET/POST …/api-tokens`, `DELETE …/api-tokens/{id}`                             |

`identifier-types.json` is the highest-leverage one — seven composables read it.

### 🚫 Keep the mock — still unbuilt

| Mock file                                                                                                                                                                                                                                                                                                                                          | Composable                                                                                                        | Status                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `error-logs.json`, `error-stats.json`                                                                                                                                                                                                                                                                                                              | `useMonitoringErrors.js`, `useDashboardHome.js`                                                                   | proposed only                                                |
| `secrets.json`                                                                                                                                                                                                                                                                                                                                     | `useSettingsSecrets.js`                                                                                           | proposed only                                                |
| `oauth-authorizations.json`                                                                                                                                                                                                                                                                                                                        | `useSettingsAuthorizations.js`                                                                                    | proposed only                                                |
| `dwh-connections.json`                                                                                                                                                                                                                                                                                                                             | `useDwhConnections.js`, `useDwhSyncs.js`, `useWarehouseModels.js`, `useProfileDwhSyncs.js`, `useEngageContent.js` | proposed only                                                |
| `trash.json`                                                                                                                                                                                                                                                                                                                                       | 9 `*Trash.js` composables                                                                                         | proposed only                                                |
| `profiles.json`                                                                                                                                                                                                                                                                                                                                    | `useProfilesIdentityResolution.js`, `useProfilesSearch.js`                                                        | `listProfiles` unbuilt (but `profile-builders` **is** built) |
| `source-templates.json`                                                                                                                                                                                                                                                                                                                            | `useSources.js`                                                                                                   | proposed only                                                |
| `destination-templates.json`                                                                                                                                                                                                                                                                                                                       | —                                                                                                                 | proposed only                                                |
| `reporting.json`, `attributes.json`, `audiences.json`, `goals.json`, `journeys.json`, `surveys.json`, `assets.json`, `catalogs.json`, `channel-campaigns.json`, `engage-*.json`, `billing.json`, `entitlements.json`, `warehouse-models.json`, `dwh-syncs.json`, `profile-dwh-syncs.json`, `live-profile-syncs.json`, `profile-api-endpoints.json` | Engage / Warehouse / Profiles modules                                                                             | no backend surface at all                                    |

Note **Monitoring is now half-served**: queue health is real, delivery errors are not.

### 🆕 New capability with no mock and no screen yet

These are live and have nothing in `public/data/` — new screens or new tabs:

- **Functions** — full CRUD + test + attach/detach/reorder on a pipeline
- **Ingest domains** — custom event-collection domains with DNS verification
- **Notification channels** — Slack/email alerting with a test button
- **Profile builders** — identity-stitching config (distinct from `profiles.json` search)
- **Connector images** — bring-your-own Airbyte image
- **Source write keys** — mint/revoke, with one-time plaintext
- **Source catalog + discovery + sync schedule + ingest settings**
- **Destination tables / row browser / SQL console**
- **Destination connection testing** (before and after saving)
- **Zid connections list + authorize URL**

---

## What this closes from the four backend asks

`todos/backend-ask-*.md` holds four drafted asks. Checked against the router source at PR head
`11acd93`, not against the spec's `x-sfere-status` labels: **one is partly closed, three are
untouched.**

| Ask                                 | Status                  | Detail                                                                                                                                                                                           |
| ----------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `backend-ask-source-settings.md`    | **3 of 5 items closed** | Rotation, server-to-server keys and strict mode all shipped. Rename (`SourceUpdate`) and `template_id` still open — see Problems 4–6                                                             |
| `backend-ask-source-trash.md`       | untouched               | No trash router exists, and `Source` has no `deleted_at`. The spec drafts a **generic** `/trash/{resource}/{resource_id}` instead of the `/sources/trash` the ask requests                       |
| `backend-ask-account-clickhouse.md` | untouched               | `Account` is still `{id, name, slug, created_at, jitsu_workspace_id}`. `…/warehouse/connections` is **not** this ask — those are customer-owned connections, this is infrastructure we provision |
| `backend-ask-auth-onboarding.md`    | untouched               | `register.py` is a one-line diff in this PR. No password rule, no email verification, no reset, no domain matching                                                                               |

Two side answers this PR's source settles for free:

- **`/members` is real** — `listMembers`, `invite_member_route` and `remove_member_route` are
  implemented in `app/api/routes/members.py`, untouched by this PR. There is **no
  pending/approval state**, so the roster half of the domain-matching ask is buildable now and
  the approval-queue half is not. `/team` can stop reading a fixture whenever we want.
- **Rotation semantics**: revocation takes effect immediately and there is no overlap window —
  but rotation is two-step (mint, paste, revoke), so the user creates their own window. That is
  a better answer than the single `rotate-write-key` route the ask asked for.

---

## Full list of what shipped

### Sources (`sources.py` +1169)

| Method   | Path                                            | operationId                                              |
| -------- | ----------------------------------------------- | -------------------------------------------------------- |
| POST     | `…/sources/provisioned`                         | `createProvisionedSource`                                |
| GET/PUT  | `…/sources/{id}/ingest-settings`                | `getSourceIngestSettings` / `updateSourceIngestSettings` |
| GET/POST | `…/sources/{id}/write-keys`                     | `listSourceWriteKeys` / `createSourceWriteKey`           |
| DELETE   | `…/sources/{id}/write-keys/{write_key_id}`      | `revokeSourceWriteKey`                                   |
| POST     | `…/sources/{id}/test`                           | `testSource`                                             |
| POST     | `…/sources/{id}/discover`                       | `discoverSourceCatalog`                                  |
| GET/PUT  | `…/sources/{id}/catalog`                        | `getSourceCatalog` / `updateSourceCatalogSelection`      |
| GET/PUT  | `…/sources/{id}/sync-schedule`                  | `getSourceSyncSchedule` / `updateSourceSyncSchedule`     |
| GET      | `…/sources/{id}/sync-runs/{sync_run_id}`        | `getSourceSyncRun`                                       |
| GET      | `…/sources/{id}/sync-runs/{sync_run_id}/logs`   | `listSourceSyncRunLogs`                                  |
| POST     | `…/sources/{id}/sync-runs/{sync_run_id}/cancel` | `cancelSourceSyncRun`                                    |
| GET      | `…/sources/{id}/zid-status`                     | `getZidConnectStatus`                                    |

### Destinations + SQL console (`destinations.py` +449)

| Method | Path                                           | operationId                                           |
| ------ | ---------------------------------------------- | ----------------------------------------------------- |
| POST   | `…/destinations/test`                          | `testDestinationConfig` (test a config before saving) |
| POST   | `…/destinations/{id}/test`                     | `testDestination` (test a saved one)                  |
| GET    | `…/destinations/{id}/tables`                   | `listDestinationTables`                               |
| GET    | `…/destinations/{id}/tables/{table_name}/rows` | `getDestinationTableRows`                             |
| POST   | `…/destinations/{id}/query`                    | `queryDestination`                                    |

### Functions & pipeline editor

| Method         | Path                                             | operationId                                           |
| -------------- | ------------------------------------------------ | ----------------------------------------------------- |
| GET/POST       | `…/functions`                                    | `listFunctions` / `createFunction`                    |
| GET/PUT/DELETE | `…/functions/{id}`                               | `getFunction` / `updateFunction` / `deleteFunction`   |
| POST           | `…/functions/{id}/test`                          | `testFunction`                                        |
| GET            | `…/pipelines/{id}/functions`                     | `listPipelineFunctions`                               |
| POST/PUT       | `…/pipelines/{id}/functions`                     | `attachPipelineFunction` / `reorderPipelineFunctions` |
| PUT/DELETE     | `…/pipelines/{id}/functions/{function_id}`       | `updatePipelineFunction` / `detachPipelineFunction`   |
| POST           | `…/pipelines/{id}/functions/{function_id}/reset` | `resetPipelineFunction`                               |
| GET            | `…/pipelines/diagram`                            | `getPipelineDiagram`                                  |

### Catalog, domains, notifications, profiles, tokens, insights

- Connectors: `GET /v1/connectors`, `GET /v1/connectors/{id}`, `GET /v1/connectors/{id}/spec`
- Connector images: `GET/POST …/connector-images`, `DELETE …/connector-images/{id}`
- Ingest domains: `GET/POST …/domains`, `GET/DELETE …/domains/{id}`, `POST …/domains/{id}/verify`
- Notification channels: full CRUD + `POST …/notification-channels/{id}/test`
- Profile builders: full CRUD (`…/profile-builders`)
- API tokens: `GET/POST …/api-tokens`, `DELETE …/api-tokens/{id}`
- Insights: `GET …/health`, `GET …/identifier-types`
- Zid: `GET …/zid-connections`, `GET …/zid-authorize`

### Admin console — different credential, read this before wiring it

`GET /v1/admin/accounts`, `POST /v1/admin/support-sessions`, `POST /v1/admin/account-users`.

These use **`AdminKeyAuth`, not `HTTPBearer`**. `src/api/mutator.js` attaches the Identity
Platform bearer to everything, so calling these through the generated client sends the wrong
credential and gets a 401. If the dashboard has no admin console, don't wire them at all.

---

## The 27 operations still unbuilt

In the spec, will appear in generated types, **no router implements them — they 404**:

- **Secrets** — `…/secrets` (5 ops)
- **Warehouse connections** — `…/warehouse/connections` (6 ops)
- **Trash / restore** — `…/trash` (3 ops)
- **OAuth authorizations** — `…/oauth-authorizations` (4) + `GET /v1/oauth-providers`
- **Delivery errors** — `…/errors`, `…/errors/{id}/retry`, `…/error-stats` (3)
- **Profiles** — `…/profiles`, `…/profiles/{id}` (2)
- **Metrics** — `…/metrics`
- **Templates** — `GET /v1/source-templates`, `GET /v1/destination-templates`

> ⚠️ Because they're in the spec, orval will generate hooks for them. Anything you call from that
> set fails at runtime with no type error. Worth a comment in the composables that touch them.

---

## Shapes orval won't explain

Everything is snake_case (camelized at the edge by `src/lib/apiShape.js`), errors are RFC 9457
`application/problem+json`, lists are `{items, total, page, size, pages}`. Beyond that:

### Write-once secrets — the UI has to handle "shown once"

```
WriteKeyCreated  { key: WriteKey, plaintext: string }
ApiTokenCreated  { token: ApiToken, plaintext: string }
WriteKey   { id, source_id, kind: 'public'|'private', name?, hint, created_at, last_used_at?, expires_at? }
ApiToken   { id, account_id, name, hint, scopes: ('read'|'write'|'admin')[], created_by, created_at, last_used_at?, expires_at? }
```

`plaintext` is never returned again — later reads give you only `hint` (last four chars). Needs a
copy-it-now modal, not a detail page you can navigate back to.

`SourceWriteKeyInput` on `POST …/sources` is the reverse: **the browser mints `id` and `secret`**
(Jitsu-console style) and stages them with the source. If you use it, you hold the only copy.

### `AnyDestinationConfig` is an untagged union

`anyOf` over nine shapes with **no discriminator inside the union** — the discriminator is the
sibling `destination_type` on the parent. Orval hands you a bare union and TypeScript will not
narrow it. Narrow manually on `destination.destination_type`.

`DestinationConfig` (unprefixed) is the **ClickHouse** one. The others are
`Postgres…`, `Bigquery…`, `Snowflake…`, `MetaConversions…`, `TiktokEvents…`, `GoogleAds…`,
`Webhook…`, `S3DestinationConfig`.

`destination_type`: `clickhouse | postgres | bigquery | snowflake | meta-conversions-api |
tiktok-events-api | google-ads | webhook | s3`.

Credential fields are `writeOnly` (kept out of response types; masked to `"***"` on read). For
ClickHouse, `username`/`password` are **ignored** (server-managed) and `database` is
auto-provisioned when omitted — supplying an existing name is a `409`.

### Enum vocabularies you'll render

| Where                                                      | Values                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `FunctionDefinition.kind`                                  | `transform` `filter` `enrich`                                                       |
| `SyncSchedule.mode`, `SourceCatalogEntity.supported_modes` | `full` `incremental` `date_range`                                                   |
| `IngestDomain.status`                                      | `pending` `verified` `failed` (+ `certificate_status`: `pending` `issued` `failed`) |
| `NotificationChannel.channel`                              | `email` `slack`; `.events`: `all` `sync` `batch` `dead` `account`                   |
| `PipelineDiagram*.status`                                  | `healthy` `degraded` `failing` `idle`                                               |
| `HealthReport.status`, `QueueHealth.status`                | `healthy` `degraded` `failing`                                                      |
| `Connector.status`                                         | `available` `beta` `coming_soon` (show `coming_soon`, don't let them pick it)       |
| `Connector.protocol`                                       | `native` `airbyte`                                                                  |
| `SyncRunLogEntry.level`                                    | `info` `warn` `error`                                                               |
| `DnsRecord.type`                                           | `CNAME` `TXT` `A`                                                                   |
| `ApiTokenScope`                                            | `read` `write` `admin`                                                              |
| `WriteKey.kind`                                            | `public` `private`                                                                  |

### Async responses — three things carry `pending`

- `ConnectorSpec.pending` — spec being fetched from the connector image
- `SourceCatalog.pending` — discovery running; poll after `POST …/discover`
- `ConnectorImage.status` — `pending` → `ready` \| `failed`

Each also has `error?`. Treat `pending: true` as a loading state with a poll, not an empty state.

### Small things that will bite

- `PUT …/pipelines/{id}/functions` (`reorderPipelineFunctions`) takes **every** attached function
  id. Omitting one is a `422`, not a detach — use `DELETE` to detach.
- `FunctionTestResult.result: null` with `dropped: true` is **success** for a `filter` function.
- `POST …/functions/{id}/test` accepts an optional `code` to run _unsaved_ editor content.
- `getDestinationTableRows` returns `DestinationRowsPage` — `{columns, rows, total, page, size, pages}`,
  **not** a standard `Page_*` (it carries `columns` too).
- `queryDestination` is one read-only `SELECT`; result has `truncated`, `elapsed_ms`, `offset`, `limit`.
- `Destination.clickhouse_database` is null while provisioning is pending.
- `ProfileBuilder.identifier_types` is **ordered** — most trusted first.
- `NotificationChannel.slack_webhook_url` comes back masked; `writeOnly` on create/update.
- `listDestinationTables` returns columns too, so one call feeds both the tables tab and the SQL
  console's table tree.

---

## Problems to raise on the backend PR

### Problem 1: 55 live endpoints are labelled `proposed`

**55 operations are implemented but still carry `x-sfere-status: proposed` in `spec/openapi.yml`.**

This costs twice:

1. **For us** — in the contract, `proposed` means "do not call this". Functions, domains,
   notification channels, profile builders, API tokens, connector images, source catalog, sync
   schedule, write keys, destination testing, the pipeline diagram and both Zid endpoints are all
   live and all mislabelled. Anyone reading the spec to decide what to build gets the wrong answer.
2. **For their CI** — `tests/test_contract.py::_shipped_operations()` explicitly skips anything
   marked `proposed`. The contract test — the thing that catches route/spec drift — therefore
   **passes vacuously over most of the new surface**. 55 of 93 new operations are unguarded.

Fix: flip those to `shipped`. Worth doing **in this PR**, because flipping them later may surface
real drift the test should have caught the first time.

### Problem 2: `/api/zid/install-report` is in the app but not the spec

`internal_router` (in `app/api/routes/sources.py`) has no `include_in_schema=False`, so both its
routes land in `/openapi.json`. `/api/sources/by-store` is in the spec; `/api/zid/install-report`
is not. Either add it to the spec or mark the router out of schema.

### Problem 3: tag casing is inconsistent

The spec declares 24 title-case tags but uses `Admin` (never declared) and a lowercase `sources`
on `/api/sources/by-store`. Fires `operation-tag-defined` ×4.

### Problem 4: `template_id` is written, mapped, and then silently dropped

**This one is already built and the response does not carry it.** Three facts that only make
sense together:

- `app/db/models.py:276` — the ORM model has a `template_id` column.
- `app/api/routes/_mappers.py:234` — `to_source_out()` passes `template_id=source.template_id`.
- `spec/openapi.yml` — the `Source` schema has **no `template_id` property**. `SourceCreate`
  does; `Source` does not.

Because `make gen` builds `app/generated/models.py` from that spec, the generated
`class Source(BaseModel)` has no such field and does not set `extra="allow"` (only two schemas
in the file do). Pydantic's default is `extra="ignore"`, so the mapper's keyword argument is
**discarded without an error**. The value is stored, retrieved, passed to the response model,
and thrown away one layer from the wire.

Adding the property to the `Source` schema is the entire fix. It is worth doing in this PR
because it costs one line and it is the **highest-leverage field in the whole diff for us**:
`SourceCreate` has accepted `template_id` all along, so today it is write-only. Without it a
re-read carries only `source_type`, and `event_stream` covers `ios-sdk`, `android-sdk` and
`http-api` — indistinguishable — so `SourceInstallGuide` has to show all five method tabs on a
source detail page instead of the one that fits. `methodsForSource()` in
`src/lib/sourceInstallSnippets.js` already prefers `templateId` and only falls back because the
field is absent, so this closes a QA finding with **zero frontend change**.

It is also the failure mode this repo's `CLAUDE.md` singles out as the expensive one: a silent
drop nobody reports, rather than a visible `vundefined` somebody files.

### Problem 5: `WriteKey.last_used_at` is always `null`

`stream_write_keys()` (`app/services/sources.py`) hardcodes `last_used_at=None` on the branch
that merges the local `write_keys` row — which is the branch every key created through
`POST …/write-keys` takes. So the field is in the schema and never populated.

That field is the one that makes revocation safe: with it, "revoke this key" is a decision;
without it, a list of four keys all reading "never used" is a guess. Until it is real the
dashboard has to print `NOT_KNOWN` rather than "Never" — asserting a key is unused when it may
be serving production traffic is exactly the confident-lie class above.

### Problem 6: `is_event_stream()` excludes `source_type == "event_stream"`

`app/services/sources.py:228` is:

```python
def is_event_stream(source: Source) -> bool:
    """Event-stream sources (Web SDK) are the ones with ingest settings."""
    return source.source_type == "web"
```

So `GET/PUT …/sources/{id}/ingest-settings` `404`s for `zid`, `cloud_app`, **and** for sources
whose `source_type` is literally `event_stream`. If the scope is deliberate — only a Web SDK
site has browser origins to authorize — that is fine and we will gate the strict-mode control
on `web`. But the predicate's name says the opposite of what it does, and the docstring's
parenthetical is the only thing that resolves it. Worth a rename or a comment before the next
reader trusts the name.

Related, not a bug, just undocumented: `…/write-keys` answers **`400`**, not `404`, when a
source has no `jitsu_site_id`. That is a real branch for us ("no Jitsu site provisioned yet")
rather than an `apiMissing` read, so it is worth keeping.

One stale docstring in the same file, same silent-mismatch class as Problem 4 and free to fix:
`create_source_write_key_route` says the optional `name` label "is echoed in this response but
not persisted", but the handler calls `record_write_key(..., name=body.name)` two lines later
and `listSourceWriteKeys` merges that local row back in — so the name **does** survive a
re-read. The code is right and the docstring is wrong. We would have built a UI that refuses to
show key names on the strength of that sentence.

---

## Spectral

`.spectral.yaml` now lives in **`backend/`** (untracked). It was never committed in this repo — it
only ever existed on branch commit `8068ac1`, which this branch doesn't contain. So there is
nothing in this repo currently referencing it and nothing here to fix.

### Result: `scalar document lint backend/spec/openapi.yml -r backend/.spectral.yaml`

**5 errors, 4 warnings.** That is the complete list:

| Rule                         | Count      | Where                                                                         |
| ---------------------------- | ---------- | ----------------------------------------------------------------------------- |
| `sfere-account-scoped-paths` | 3 errors   | `/v1/admin/accounts`, `/v1/admin/support-sessions`, `/v1/admin/account-users` |
| `sfere-status-required`      | 1 error    | `/api/sources/by-store`                                                       |
| `sfere-security-explicit`    | 1 error    | `/api/sources/by-store`                                                       |
| `operation-description`      | 1 error    | `/api/sources/by-store`                                                       |
| `operation-tag-defined`      | 4 warnings | tag `Admin` (×3, undeclared), tag `sources` (×1, lowercase)                   |

Rules that could plausibly have fired and **did not** — the spec is in genuinely good shape:

- `sfere-snake-case-properties` — 0 findings across all 119 new schemas. No camelCase leaked in
  from Jitsu.
- `sfere-config-secrets-write-only` — all 7 credential fields across the `*Config` schemas are
  correctly `writeOnly`.
- `sfere-page-envelope-shape` — all 21 `Page_*` schemas carry the full envelope.
- `sfere-problem-json-errors` — every 4xx/5xx across all 137 operations is `application/problem+json`.
- `sfere-operation-id-camel-case` — every operationId is explicit and camelCase.
- `sfere-sfere-hosts-only` — servers are the two Sfere hosts plus `localhost:8080`.

### Fixes

1. **`/v1/admin/*`** — the rule's own message says "if it really is global, add it to this rule
   with a reason." Admin is genuinely cross-account/staff-scoped. Amend the `notMatch` allowlist
   to include `admin/`, with a comment saying admin is staff-scoped and authenticates with
   `AdminKeyAuth`.
2. **`/api/sources/by-store`** — cleanest fix is to **exclude `/api/**`from the ruleset**. Both`/api/\*` routes are internal (a store lookup and a Zid webhook), not dashboard calls, and
that's how our old contract builder handled them (`INTERNAL_PATHS`). The alternative is adding
`description`, `x-sfere-status: shipped`and a`security`entry — but note that route validates`settings.zid_app_api_key`, which is **not** the same credential as the admin routes, so let the
backend author name the scheme rather than pasting `AdminKeyAuth` in.
3. **`Admin` tag** — add it to the spec's top-level `tags:` list.
4. **`sources` → `Sources`** on `/api/sources/by-store` (moot if you take fix 2 as an exclusion).

### One thing to be clear about

This ruleset cannot lint the **raw `/openapi.json` pulled from staging**, ever. FastAPI emits no
`x-sfere-status`, so `sfere-status-required` fires on all ~120 operations, and
`sfere-security-explicit` fires on every unauthenticated route. It was written for a document a
builder produces, or for the hand-written `spec/openapi.yml`. If the intent is to gate the pulled
JSON, the ruleset needs a stripped-down variant.

---

## Action points

### Backend (ask on the PR)

- [ ] Flip the 55 stale `x-sfere-status: proposed` → `shipped` **(highest value — it un-vacuums the contract test)**
- [ ] Amend `sfere-account-scoped-paths` to allow `/v1/admin/` with a reason comment
- [ ] Exclude `/api/**` from the Spectral ruleset (or fill in the three missing fields)
- [ ] Add `Admin` to the spec's top-level `tags:` list
- [ ] Fix the lowercase `sources` tag on `/api/sources/by-store`
- [ ] Decide `/api/zid/install-report`: add to spec, or `include_in_schema=False` on `internal_router`
- [ ] Commit `.spectral.yaml` (currently untracked in the backend) and wire it into `make check` / CI, or it lints nothing
- [ ] **Add `template_id` to the `Source` schema** (Problem 4) — one line, already mapped and
      currently discarded; closes a QA finding with no frontend change
- [ ] Populate `WriteKey.last_used_at` (Problem 5), or tell us it is not coming so we print
      `NOT_KNOWN` rather than "Never"
- [ ] Rename or comment `is_event_stream()` (Problem 6), and confirm ingest settings are
      `web`-only by design
- [ ] Widen `SourceUpdate` to accept optional `name` and `description` — still exactly
      `{is_enabled}`, required, so a source cannot be renamed. Tracked in
      `todos/backend-ask-source-settings.md`

### Dashboard (this PR)

- [ ] Wait for backend merge + staging deploy (`openapi:pull` reads `api-staging.sfere.io`)
- [ ] `pnpm openapi` — re-pull `openapi/fanfinity-api.json` + regenerate `src/api/`
- [ ] Swap `identifier-types.json` → `GET …/identifier-types` (7 composables — do this first)
- [ ] Swap `connectors.json` → `GET /v1/connectors` in `useConnectorCatalog.js`
- [ ] Swap `health-queues.json` → `GET …/health` in `useMonitoringHealth.js`
- [ ] Swap `pipes-diagram.json` → `GET …/pipelines/diagram` in `useDiagram.js`
- [ ] Swap `api-tokens.json` → `…/api-tokens` in `useSettingsWorkspace.js` + `useProfileApi.js`
- [ ] Add the write-once copy-modal pattern for `WriteKeyCreated` / `ApiTokenCreated`
- [ ] Add narrowing helpers for `AnyDestinationConfig` keyed on `destination_type`
- [ ] Un-disable three of the five controls on `SourceSettingsPanel.vue` — but **not as a
      straight un-disable**, the shapes changed: write keys are a collection read from
      `GET …/write-keys` (browser and server keys in one list, discriminated by `kind`), rotation
      is two controls and two confirms rather than one, strict mode has to be gated on
      `source_type === 'web'`, and `PUT …/ingest-settings` is a full replacement so the panel must
      read current settings before writing or a strict toggle silently clears the domain
      allowlists. Detail in `todos/backend-ask-source-settings.md`
- [ ] Leave the 🚫 mocks alone; add a note in those composables that the endpoint is spec-only
- [ ] Decide whether to build any of the 🆕 no-mock modules in this PR or a follow-up

### Decisions I need from you

- [ ] **Is the contract pipeline (`build-cdp-contract.mjs`, `cdp-proposals.mjs`, `.spectral.yaml`,
      `pnpm contract:*`) from commit `8068ac1` coming forward onto this branch, or is it retired?**
      If it comes forward, ~53 proposals and most of their ~95 schemas have to be deleted (the
      builder hard-fails on a proposal colliding with a shipped operation), `TAG_MAP` needs 10 new
      entries, and 93 shipped operations need `SHIPPED_DOCS` prose or `operation-description`
      fires 93 times. If it's retired, none of that matters and this section is dead.
- [ ] **Does the dashboard need the three `/v1/admin/*` endpoints?** They need a separate auth
      path from `src/api/mutator.js`.
- [ ] **Which of the 🆕 modules is in scope for this PR?** Functions and the destination SQL
      console are the two biggest new surfaces and each is a screen of its own.
