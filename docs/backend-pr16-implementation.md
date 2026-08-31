# Backend PR #16 — what the dashboard now implements

Companion to [`backend-pr16-integration.md`](./backend-pr16-integration.md), which is the
review of [fanfinity/backend#16 `feat: jitsu proxy`](https://github.com/fanfinity/backend/pull/16).
That file says what the backend built. This one says what this repo now does about it.

Written against dashboard branch `reported-enhancments-fixes`, backend PR head `11acd93`.

---

## TL;DR

|                                                |                                               |
| ---------------------------------------------- | --------------------------------------------- |
| Operations the PR implements                   | **110** — 137 in the spec, 27 with no router  |
| Endpoint families the dashboard now reaches    | **17** (enumerated below)                     |
| Existing routes gaining live data              | **16**                                        |
| New screens                                    | **4**                                         |
| New tabs on existing screens                   | **6**                                         |
| New composables                                | **12**                                        |
| New fixtures                                   | **6**                                         |
| `pnpm smoke:dist` (default local `mock` mode)  | **60/60 routes clean** (was 56 routes)        |
| `SMOKE_DATA_SOURCE=real` against staging today | **44/60** — 16 routes, 10 missing endpoints   |
| Same run at branch HEAD, without this wiring   | **56/56 clean** — every failure above is ours |
| `pnpm lint:check` / `pnpm build`               | clean                                         |

Every number there is defined rather than eyeballed, because two of them were wrong on the first
pass. **110** is `137 − 27`: the PR's spec carries 137 operations and 27 have no router behind
them, which is the review doc's count. A straight grep of `app/api/routes/*.py` at head `11acd93`
finds **108** handlers instead, and neither figure is a mistake — `/healthz`, `/readyz` and
`/version` are declared at app level rather than in `routes/`, and `reportZidInstall` is a handler
with no spec entry at all. **17** counts endpoint families (one per resource, so
`…/sync-runs`, `…/sync-runs/{id}/logs` and `…/cancel` are one), not method+path pairs — those land
near 60 and cannot be counted from this document, so the document does not claim a figure for them.
**16** is existing routes; the 4 new screens are the row below rather than folded in.

**The orval client was not regenerated, deliberately** — see [Why `src/api/` is
untouched](#why-srcapi-is-untouched).

**One thing to decide before merging** — see
[The merge order is not optional any more](#the-merge-order-is-not-optional-any-more).

---

## The merge order is not optional any more

The review doc said "You do not need to land both PRs together… Simultaneous merge is fine
too, it just isn't buying anything." **That is no longer true, and the reason is the smoke
gate.**

`deploy-staging.yml` runs `scripts/smoke.mjs` against `https://app-staging.sfere.io`. Against a
deployed origin the run is in **real** data-source mode and `IGNORED_CONSOLE` is empty by
design, so any console error fails the step. A wired endpoint that does not exist yet answers
`404`, and Chromium logs `Failed to load resource: the server responded with a status of 404`
whether or not the app handles it — which it does, as `apiMissing`.

Measured, not assumed. `SMOKE_DATA_SOURCE=real` locally, against `api-staging` as it stands
today:

```
smoke: 44/60 routes clean

/settings                      404 …/api-tokens, …/domains,
                                   …/notification-channels, …/connector-images
/functions                     404 …/functions
/functions/fn_drop_internal    404 …/functions
/pipes/pipe_web_to_snowflake   404 …/functions          (the attach picker's library)
/pipes                         404 …/pipelines/diagram
/health                        404 …/health
/destinations/dst_snowflake    404 …/destinations/{id}/tables
/profile-builders              404 …/profile-builders, …/identifier-types
/profile-api                   404 …/identifier-types
/warehouse-models              404 …/identifier-types
/profiles/search               404 …/identifier-types
/profiles/identity-resolution  404 …/identifier-types
/attributes/new                404 …/identifier-types
/profile-api-endpoints/new     404 …/identifier-types
/profile-dwh-syncs/new         404 …/identifier-types
/live-profile-syncs/new        404 …/identifier-types
```

**Sixteen routes, ten endpoints.** Nine of the sixteen are the one reader that replaced seven
copies (`GET …/identifier-types`, via `useIdentifierTypes`) — seven call sites, nine routes,
which is why a single missing endpoint accounts for more than half the list.

### The gate was measuring this wrongly, and that is now fixed

The first real-mode run of this reported **57/60 — two routes, one endpoint**, and repeat runs
of the same nine-route subset returned anywhere between one and seven failures on identical
code. The cause is in `scripts/smoke.mjs`, not in the app: it asserted after a single
`waitForLoadState('networkidle')`, and almost every composable here awaits `waitForAccount()`
before it can build an account-scoped URL — so its fetch is issued only after `GET /v1/me`
settles, and the first `networkidle` resolves inside that gap. The route was being asserted
before the request that should have failed it had been sent.

`scripts/smoke.mjs` now idles, pauses 400ms, and idles again (`settle()`). The nine-route subset
is byte-identical across repeat runs, and the numbers above are that. A gate that fails a random
subset also **passes** a random subset, which is the half that matters — this was not a cosmetic
flake.

**Every one of those sixteen is ours, and that is measured too.** `settle()` surfaces errors that
were previously invisible, so it could in principle have exposed a pre-existing failure and
bundled an unrelated red CI into this PR. It did not: the same real-mode run at branch HEAD —
this branch's last commit, with `settle()` copied in and none of the wiring — is **56/56 clean**.
So the red staging deploy really does clear itself the moment the backend lands, rather than
leaving a residue somebody has to chase.

**So: merge the backend PR first, let staging deploy, then merge this.** That is the order the
review doc already recommends for other reasons; it is now load-bearing. Merging this first
gives a red staging deploy that goes green on its own the moment the backend lands — which is
a confusing thing to leave for someone else to find.

The gate was **not** weakened to paper over this. Adding a `404` pattern to `IGNORED_CONSOLE`
would buy a green run at the cost of permanent blindness to every genuinely-missing resource,
and that list is deliberately short.

In the default local mode (`mock`) the full walk is clean: **60/60**.

---

## Why `src/api/` is untouched

No `pnpm openapi`, no regenerated `src/api/fanfinity.ts`, no new orval hooks. Three reasons:

1. **Nothing needs it.** `useMockResource()`, `fetchCollection()` and `sendMutation()` all go
   through `customFetch` with raw path strings, so every one of the 62 endpoints below is
   reachable without generated code. That is the house pattern for reads and flat writes.
2. **Regenerating from an unmerged branch commits a lie.** The generated client would describe
   137 operations while `api-staging` serves 49, and the next `pnpm openapi` — which pulls from
   staging — would silently revert it.
3. **It would emit hooks for the 27 unbuilt operations**, which is the footgun the review doc
   flags: they type-check and 404 at runtime.

Run `pnpm openapi` **after** the backend merges. It should be a no-op for everything here.

---

## What went live, screen by screen

### Mocks replaced by real endpoints

| Screen                                | Endpoint                                             | What changed beyond the wiring                                                                                |
| ------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Nine profile routes, seven call sites | `GET …/identifier-types`                             | Seven copies of `useMockResource('identifier-types')` became one `useIdentifierTypes()`                       |
| `/health`                             | `GET …/health`                                       | Reports which half is measured — see [Honesty gaps](#honesty-gaps-the-backend-admits-in-its-own-source)       |
| `/pipes` topology, `/pipes/:id`       | `GET …/pipelines/diagram`                            | Per-window counters deliberately not mapped                                                                   |
| `/sources?tab=connectors`             | `GET /v1/connectors`, `GET /v1/connectors/{id}/spec` | `spec` now leads and `connectorCredentials.js` stays as the fallback and the help text — merged, not replaced |
| Settings → API tokens, `/profile-api` | `GET/POST …/api-tokens`, `DELETE …/api-tokens/{id}`  | Create is now a copy-it-once moment; revoke deletes the row                                                   |
| `/team`                               | `GET/POST …/members`, `DELETE …/members/{user_id}`   | Roster and add/remove are real; role change and the approval queue are not                                    |

### New tabs and panels on screens that already existed

| Where                                                      | Endpoints                                                                                                                                                                         |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source detail → Settings                                   | `GET/POST …/write-keys`, `DELETE …/write-keys/{id}`, `GET/PUT …/ingest-settings`                                                                                                  |
| Source detail → Syncs                                      | `POST …/test`, `POST …/discover`, `GET/PUT …/catalog`, `GET/PUT …/sync-schedule`, `GET …/sync-runs/{id}`, `…/logs`, `…/cancel`                                                    |
| Destination detail → Tables, SQL console                   | `GET …/tables`, `GET …/tables/{table}/rows`, `POST …/query`, `POST …/test`                                                                                                        |
| Pipe detail → Functions                                    | `POST/PUT …/pipelines/{id}/functions`, `DELETE …/functions/{function_id}`                                                                                                         |
| `/sources?tab=zid`                                         | `GET …/zid-connections`, `GET …/zid-authorize`                                                                                                                                    |
| Settings → Ingest domains, Notifications, Connector images | Domains: `GET/POST`, `DELETE`, `POST …/{id}/verify` — there is no update path. Images: `GET/POST`, `DELETE`. Notification channels are the only one of the three with a full CRUD |

### New screens

`/functions`, `/functions/new`, `/functions/:id` (feature key `functions`, sidebar row after
Pipes) and `/profile-builders` (under Profiles, key `profile-builders`). Both keys are
`enabled: true`; `functions` was added to `CORE_KEYS` in `SettingsFeaturePanel.vue`, which
`CLAUDE.md` warns has to be kept in step by hand.

### The seventeen endpoint families

`…/identifier-types` · `…/health` · `…/pipelines/diagram` · `/v1/connectors` (+ `/{id}/spec`) ·
`…/api-tokens` · `…/members` · `…/sources/{id}/write-keys` · `…/sources/{id}/ingest-settings` ·
`…/sources/{id}/sync*` (test, discover, catalog, sync-schedule, sync-runs, logs, cancel) ·
`…/destinations/{id}/tables|rows|query|test` · `…/pipelines/{id}/functions` (attach, detach,
reorder) · `…/zid-connections` (+ `…/zid-authorize`) · `…/domains` · `…/notification-channels` ·
`…/connector-images` · `…/functions` · `…/profile-builders`.

---

## Demo mode was verified by content, not by the gate

The scope decision was **live-wired plus a mock fixture**, so "the fixture renders" is part of the
deliverable — and `pnpm smoke:dist` cannot see it. `EmptyState` is not a failure and neither is a
row of blank cells, so a fixture whose field names do not match what the page reads passes 60/60
while showing nothing. That is the silent-degradation class `CLAUDE.md` keeps flagging, so it was
measured separately, in Demo mode, by counting rendered rows:

| Surface                       | Rows | `EmptyState` | `ErrorState` |
| ----------------------------- | ---- | ------------ | ------------ |
| `/functions`                  | 3    | 0            | 0            |
| `/functions/fn_drop_internal` | —    | 0            | 0            |
| `/profile-builders`           | 2    | 0            | 0            |
| Settings → Ingest domains     | 3    | 0            | 0            |
| Settings → Notifications      | 3    | 0            | 0            |
| Settings → Connector images   | 3    | 0            | 0            |
| Settings → API tokens         | 4    | 0            | 0            |
| `/sources` → Zid stores       | 2    | 0            | 0            |

**The three panels with no fixture say so, in Demo mode, in their own words** — they are the Tier-1
panels whose endpoints had no fixture to model because there was no endpoint when the fixtures were
written. Destination → Tables, Source → Syncs and Source → Settings' write-key list each render a
sentence naming the switch to flip (`Settings → Data source`), not an empty table. An empty table
would be the lie: it asserts that the destination has no tables and the source has never synced.

---

## Honesty gaps the backend admits in its own source

These are not in the review doc, and they are the most valuable thing found while implementing.
`app/services/account_insights.py` documents its own placeholders, and wiring the endpoints
without reading it would have shipped three confident lies.

**`GET …/health` returns `queues: []` on every response.** Its docstring: _"queue depth/lag
telemetry is not collected yet, so `queues` is empty."_ So on `/health`:

- the per-stage `QueueStepCard` list would have rendered **zero** cards under "No pipeline stages
  are reporting", which blames the account for a gap in the backend;
- of the four `StatCard`s above it, "Waiting across all stages" would have summed an empty list to
  a measured-looking **0**, and "Processed" and "Oldest item" the same.

`useMonitoringHealth` now reports `queuesMeasured` and `heartbeatMeasured`, every count falls
back to `NOT_KNOWN`, and one banner says which half is dark. The overall `status` **is** real
(derived from the latest sync run per source) and now leads the stat row.

**`GET …/pipelines/diagram` returns `events_in_window: 0` and `errors_in_window: 0` always** —
_"per-window event/error counts require ClickHouse and are reported as `0`"_. Those two fields
are **not mapped** onto `eventCountLastHour` / `deliveryCountLastHour`. Copying them would have
put a measured-looking "0 events / hr" under every live source — the same confident zero the
pipes work already removed once. `PipeTopology`'s source line is now guarded the way its pipe
line already was.

**`ApiToken.last_used_at` is in the schema and nothing ever writes it.** No router or service
assigns it, so it is null on every response. The column reads `NOT_KNOWN`, not "Never": telling
someone a token is unused when it may be serving production traffic is the one answer that makes
a revoke decision worse. Same class as `WriteKey.last_used_at` (the review doc's Problem 5), and
handled the same way.

---

## Endpoint behaviours that shaped the UI rather than just the wiring

**`…/write-keys` answers `400`, not `404`, on a source with no Jitsu site.** The shared read gate
treats any non-404 `ApiError` as a real failure, so this would have rendered a red `ErrorState`
for a perfectly ordinary state. `useSourceWriteKeys` does its own fetching and reports it as
`noSite`, rendered as a sentence.

**`PUT …/functions/{id}` persists only `code`.** The handler says so: name and description are
_"echoed back from the request but are not persisted upstream"_. So a rename would report success
and vanish on the next read. `update()` sends only `code` and the detail page's banner says why
the name cannot be changed.

**`DELETE …/functions/{id}` answers `409` while attached to any pipeline**, with the ids in the
message. Both delete confirms name the attachments up front instead of letting the rejection be
the first anyone hears of it.

**`reorderPipelineFunctions` takes every attached id.** Omitting one is a `422`, _not_ a detach.
`usePipelineFunctions` exposes `move()`, which builds the complete list, rather than a swap a
caller could get wrong.

**`is_event_stream()` returns `source_type == "web"`** despite its name, so ingest settings 404
for `zid`, `cloud_app` and literal `event_stream` sources. Strict mode is gated on `web`, and the
section is hidden rather than disabled for the rest — the setting does not exist for them, which
is different from being unbuilt.

**`SourceCatalog.pending` and `ConnectorSpec.pending` are loading states.** Both are polled. An
empty entity list under a true `pending` would have told someone their store has no tables.

**`ConnectorImage.status: 'pending'`** is likewise work in progress, not a broken row.

**Two write-once secrets.** `ApiTokenCreated.plaintext` and `WriteKeyCreated.plaintext` are
returned once and never again — the backend stores a SHA-256 hash and a four-character hint. New
`SecretRevealDialog` handles both: `persistent`, no Cancel, no backdrop dismissal, and the value
selectable as text for when the clipboard API is refused.

**`slack_webhook_url` is write-only and comes back masked.** An edit form pre-filled from a read
would save the mask over the real webhook and silently stop every alert. `webhookIsMasked()`
decides, and the composable omits the field rather than sending it.

**`events: ['all']` is a real enum member, not a shorthand.** Ticking all five boxes is _not_
equivalent: `all` also covers alert kinds added later. The picker treats it as exclusive.

**Three `PUT`s replace rather than patch** — ingest settings, profile builders, notification
channels. Every enable/pause re-sends the whole record; a body carrying only the flag would blank
the configuration.

**`getDestinationTableRows` is not a `Page_*`** — it carries `columns` alongside the envelope, so
`pageItems` would throw the headers away. `queryDestination`'s `truncated` is surfaced as a badge,
because a result the backend cut short and one that genuinely had that many rows look identical
otherwise.

---

## What is still not wired, and why

| Domain                                                                                                                                        | Reason                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secrets, warehouse connections, trash/restore, OAuth authorizations, delivery errors, `GET …/profiles`, metrics, source/destination templates | The 27 operations in the spec with **no router behind them**. They 404 today and will keep 404ing after the merge.                                                                                                               |
| `/v1/admin/*`                                                                                                                                 | `AdminKeyAuth`, not `HTTPBearer`. `src/api/mutator.js` attaches the Identity Platform bearer to everything, so calling these through the normal client sends the wrong credential. There is no admin console; nothing was wired. |
| Member role change                                                                                                                            | No `PATCH …/members/{id}` exists — only add and remove. The control is disabled with a sentence.                                                                                                                                 |
| Domain-match approval queue                                                                                                                   | Nothing on the backend records a pending member. `/team` reports `NOT_KNOWN` rather than a confident `0`.                                                                                                                        |
| Source rename / description                                                                                                                   | `SourceUpdate` is still one field, `is_enabled`, and `Source` has no `description`. The banner's claim was narrowed, not dropped.                                                                                                |
| `template_id` on `Source`                                                                                                                     | Still the one-line backend fix worth most to us (review doc, Problem 4). No frontend workaround was added.                                                                                                                       |

---

## Files

**New composables (12)** — `useIdentifierTypes`, `useApiTokens`, `useSourceWriteKeys`,
`useSourceIngestSettings`, `useSourceCatalogAPI`, `useDestinationBrowser`, `useFunctions`,
`useProfileBuilders`, `useIngestDomains`, `useNotificationChannels`, `useConnectorImages`,
`useZidConnections`.

**Extended** — `useConnectorCatalog` (+ `useConnectorSpec`), `useMonitoringHealth`, `useDiagram`,
`useSourceSyncAPI`, `usePipelineFunctions`, `useTeam`, `useProfileApi`, `useProfileDwhSyncs`,
`useLiveProfileSyncs`, `useProfilesSearch`, `useProfilesIdentityResolution`, `useWarehouseModels`,
`useSettingsWorkspace` (`useSettingsApiTokens` is now a deprecated alias).

**New libs** — `src/lib/jsonSchemaFields.js` (connector `config_schema` → form fields).

**New kit component** — `src/components/ui/SecretRevealDialog.vue`.

**New fixtures** — `functions.json`, `profile-builders.json`, `ingest-domains.json`,
`notification-channels.json`, `connector-images.json`, `zid-connections.json`. One record added to
`sources.json` (`src_zid_flagship`, a `zid` source with a `storeId`) so the Zid stores tab has
something to join against; no existing id was renamed or renumbered.

**Load-bearing files touched** — `src/router/screens.js` (four entries),
`src/config/features.js` (two keys), `src/layouts/MainLayout.vue` (two nav rows),
`src/components/settings/SettingsFeaturePanel.vue` (`CORE_KEYS`),
`src/composables/useMockResource.js` (docblock only: `PUT` is now a documented method),
`scripts/smoke.mjs` (the `settle()` fix above — the only behaviour change outside `src/`).

**Docs updated in the same change**, because a stale one is treated as a bug here — `CLAUDE.md`
(the 60-screen manifest, the fourteenth feature key, the PR-16 endpoint list and its merge-order
constraint, the narrowed source-Settings claim, the `settle()` rule, `SecretRevealDialog`),
`docs/sfere-design-system.md` (43 components, and the named Quasar carve-out is now **two**
`q-dialog` wrappers rather than one — `SecretRevealDialog` is the second), and
`done-features-tasks.md`.
