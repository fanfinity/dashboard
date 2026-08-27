# What the dashboard actually needs from the contract

A read of `openapi/sfere-cdp-contract.yaml` (127 operations, 12,805 lines) against every
screen, composable and fixture in `src/` and `public/data/`, to answer one question: **what
can come out so the backend team has a smaller first target?**

Written 2026-08-27, against the contract dated `2026-08-26`.

---

## First: the shipped half is not yours to cut

`scripts/build-cdp-contract.mjs` lifts the **shipped** half straight out of
`openapi/sfere-api.json` — every path, unfiltered (`for (const [path, item] of
Object.entries(shipped.paths))`). Those 47 operations are in the document because the backend
serves them today. Deleting one from the YAML would be undone by the next
`pnpm contract:build`, and the file is generated anyway.

**So "omitting" only ever means editing `openapi/cdp-proposals.mjs`** — the 80 proposed
operations. Everything below is about those.

---

## The cut list — 30 operations, ~2,750 lines, nothing in the app touches them

These have **no screen, no composable, no mock fixture, and no live call**. Not "waiting on
the backend" — not built into the product at all. Each was checked by grepping `src/` and
`public/data/` for the resource name, not just by looking for a network call.

| Group                                                                                                    | Ops | ~YAML lines | Why it can go                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------- | --: | ----------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ingestion domains** — `/domains`, `/domains/{id}`, `/domains/{id}/verify`                              |   5 |         426 | No domains screen, no `domains.json`, no reference anywhere. This is custom-domain ingest (`events.customer.com` with a DNS `TXT` check) — a feature the product has not started. Drags 4 schemas with it, including `DnsRecord`. |
| **Profile builders** — `/profile-builders`, `/profile-builders/{id}`                                     |   5 |         465 | Zero hits for `profile-builder` in the entire repo. Profile _search_ is real (kept below); the builder-definition CRUD is not. Heaviest single group per operation.                                                               |
| **Custom connector images** — `/connector-images`, `/connector-images/{id}`                              |   3 |         292 | Bring-your-own-Docker-image connectors. Nothing in the repo mentions it. The connector _catalog_ stays.                                                                                                                           |
| **Source write keys** — `/sources/{id}/write-keys`, `/write-keys/{id}`                                   |   3 |         283 | Verified: `SourceIngestPanel.vue` and `WebSdkSetupPanel.vue` both read `source.writeKey` off the `Source` object. There is no key-rotation or multi-key UI, so the collection endpoints have no caller.                           |
| **Source catalog** — `GET`/`PUT` `/sources/{id}/catalog`, `POST` `/sources/{id}/discover`                |   3 |         284 | Stream/table selection for pull connectors. `SourceSyncPanel.vue` has no catalog picker.                                                                                                                                          |
| **Sync-run detail** — `/sync-runs/{id}`, `/{id}/cancel`, `/{id}/logs`                                    |   3 |         262 | `useSourceSyncAPI` calls `POST /sync` and `GET /sync-runs` (both shipped) and stops there. No run-detail drawer, no cancel button, no log viewer.                                                                                 |
| **Source ingest settings** — `GET`/`PUT` `/sources/{id}/ingest-settings`                                 |   2 |         180 | No hits for `ingest-settings`. The ingest panel is display-only.                                                                                                                                                                  |
| **Sync schedule** — `GET`/`PUT` `/sources/{id}/sync-schedule`                                            |   2 |         171 | No hits for `sync-schedule`. (The `sync-schedule` grep hits in `src/` are all DWH-sync screens, which are a different resource.)                                                                                                  |
| **Account metrics** — `GET` `/metrics`                                                                   |   1 |         178 | Event-volume time series. The home screen gets its numbers from the shipped `GET /dashboard` aggregate instead. Three schemas exist only for this one operation.                                                                  |
| **Test-before-save trio** — `POST` `/sources/{id}/test`, `/destinations/test`, `/destinations/{id}/test` |   3 |         202 | No "Test connection" button on the source or destination create/detail pages. The _warehouse_ test is kept — see below, it has a real button.                                                                                     |

**Total: 30 operations, 27 schemas that nothing else references, ~2,750 lines — roughly 21%
of the document, and 38% of the proposed half.**

None of these groups cross-reference the ones you keep. I checked the `$ref` graph: no
`*Config` schema reaches a secret or a warehouse connection, and the only near-miss is
`SyncRunLogEntry`, which is shared with `FunctionTestResult` — so it stays when the sync-run
group goes, and that is correct.

---

## Keep — you said so

| Group                                                          |                                Ops | Note                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------- | ---------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Functions** — `/functions*` and `/pipelines/{id}/functions*` | 12 (9 proposed, 3 already shipped) | You want these. Worth knowing the backend already serves `GET /pipelines/{id}/functions`, `PUT .../{function_id}` and `POST .../{function_id}/reset` — `usePipelineFunctions.js` calls all three today. What is missing is the function _library_ (`/functions` CRUD), attach/detach/reorder, and `POST /functions/{id}/test`. That is the real ask, and it is 9 operations, not 12. |
| **Notification channels** — `/notification-channels*`          |                                  6 | This is your Slack notifications. Nothing in the app references it yet — no screen, no fixture — so it is a genuine greenfield build, not a rewire. If you want the smallest useful version, `POST` + `GET list` + `POST /{id}/test` is 3 operations and gets you "add a Slack webhook, send a test alert"; `GET /{id}`, `PUT` and `DELETE` can follow.                              |

---

## Keep — the screen exists, only the backend is missing

These read mock JSON through `useMockResource()` today and report "No API yet" in real mode.
Cutting them from the contract would delete the roadmap, not simplify it — the UI is already
built and waiting.

| Group                                                                                                              | Ops | The surface that is waiting                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------ | --: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secrets                                                                                                            |   5 | `/secrets` screen, `SettingsSecretForm.vue`, `secrets.json`                                                                                                                                                       |
| Warehouse connections                                                                                              |   6 | `/dwh-connections` + create page (**which has a live "Test connection" button** — that is why `POST /warehouse/connections/{id}/test` is kept while the source/destination tests are cut), `dwh-connections.json` |
| Connector catalog — `/connectors`, `/connectors/{id}`, `/{id}/spec`, `/source-templates`, `/destination-templates` |   5 | `ConnectorCatalog.vue` **already live-calls `GET /v1/connectors`** and renders "not built yet" when it 404s. Closest to done of anything here.                                                                    |
| OAuth authorizations + `/v1/oauth-providers`                                                                       |   5 | `/authorizations` screen, `SettingsOauthProvidersPanel.vue`, `oauth-authorizations.json`                                                                                                                          |
| Monitoring — `/errors`, `/errors/{id}/retry`, `/error-stats`, `/health`                                            |   4 | `/errors` and `/health` screens, three fixtures                                                                                                                                                                   |
| Profiles — `/profiles`, `/profiles/{id}`, `/identifier-types`                                                      |   3 | `/profiles/search`, and `useProfileApi.js` reads `identifier-types.json`                                                                                                                                          |
| Trash — `/trash`, restore, purge                                                                                   |   3 | Six `*/trash` screens, `trash.json`. Restore/purge are local-only today.                                                                                                                                          |
| API tokens                                                                                                         |   3 | `SettingsApiTokensPanel.vue`, `api-tokens.json`                                                                                                                                                                   |
| Pipeline diagram — `GET /pipelines/diagram`                                                                        |   1 | `useDiagram.js`, `pipes-diagram.json`, `PipeTopology.vue`                                                                                                                                                         |

That is **35 proposed operations you should not touch**, plus the 15 you are keeping
deliberately (Functions + Notifications) = 50. Cut 30 of 80, keep 50.

---

## Shipped, but the dashboard never calls it

Informational only — these come from `sfere-api.json` and cannot be removed here. Worth
raising with the backend team separately if they are dead on their side too:

- `GET /v1/customers`, `/v1/customers/{id}`, `/v1/customers/{id}/events` — there is no
  Customers screen. The _source-scoped_ equivalents (`/sources/{id}/customers`, `/orders`)
  **are** used, by `useSourceDataAPI.js`.
- `GET /v1/accounts/{id}/destinations/{id}/events` — no destination-events panel exists.
- Support sessions (3 ops) — no surface in the dashboard at all.
- `POST /v1/accounts`, `GET /v1/accounts` — the app resolves its account from `GET /v1/me`
  and never lists or creates one.
- `/healthz`, `/readyz`, `/version` — infrastructure probes, not dashboard calls. Harmless.

---

## How to actually make the cut

Do not edit the YAML. The sequence is:

1. Delete the path entries from `proposedPaths` in `openapi/cdp-proposals.mjs`
   (starts line 173).
2. Delete the matching schemas from `proposedSchemas` in the same file (starts line 1499) —
   the 27 named above.
3. `pnpm contract:build`
4. `pnpm contract:lint` — **this is the step that catches a missed schema.** `.spectral.yaml`
   promotes `oas3-unused-component` to `error`, so a schema left behind with no operation
   referencing it fails the lint rather than sitting there quietly.
5. `pnpm contract:check` — the real gate: staleness, round-trip, and shipped-half drift.

Each group is independent, so this can be done one row of the cut table at a time.

---

## The one thing worth reconsidering

Of the 30, the group I would think twice about is **sync-run detail / cancel / logs**. A
sync-run list with no way to see why a run failed is the first thing anyone will ask for once
sources are pulling real data, and `GET /sync-runs` is already shipped — the detail view is
the natural next step rather than a new feature. The other nine groups are genuinely
unstarted product surface.
