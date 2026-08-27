# Building the Sfere CDP contract

What was built, what it decides, and what the backend team needs to weigh in on.
The artefact itself is `openapi/sfere-cdp-contract.yaml`; browse it with
`pnpm docs:cdp` on <http://localhost:3001>.

## What it is

One OpenAPI 3.1 document covering both what the backend serves today and what the
dashboard still needs. It replaces `openapi/cdp-api-draft.yaml`, which is deleted.

|                                         |                                       |
| --------------------------------------- | ------------------------------------- |
| Paths                                   | 87                                    |
| Operations                              | 127 — **47 shipped**, **80 proposed** |
| Schemas                                 | 155 — 59 shipped, 96 proposed         |
| Tags                                    | 24                                    |
| Operations mapped to a Jitsu equivalent | 53                                    |

**Every operation carries `x-sfere-status: shipped | proposed`.** That is the
whole point of the document, and the thing the old draft lacked:

- **`shipped`** — live now. Generated from the backend's own OpenAPI output, so
  these agree with the running service by construction. Fixed; the dashboard
  already calls them.
- **`proposed`** — not built. A proposal for the backend team, derived from what
  the dashboard's screens need and from how Jitsu models the same domain. **This
  is the half to argue with.**

An operation with a Jitsu counterpart also names it in `x-jitsu-equivalent`, so
the two can be read side by side.

## Why the old draft drifted, and what stops it now

`cdp-api-draft.yaml` drafted `/v1/dashboard` and `/v1/errors` as flat paths.
Both shipped account-scoped. Nothing in the file distinguished "we propose this"
from "this exists", so the disagreement was only discovered mid-implementation.

Three things prevent a repeat:

1. **`x-sfere-status` on every operation** — drift is greppable.
2. **The shipped half is generated, not written.** It is lifted out of
   `openapi/sfere-api.json`, so it cannot disagree with the backend.
3. **`pnpm contract:check` fails the build** if the committed file is stale, if
   the YAML does not round-trip, or if any `shipped` operation has drifted.

## How it is built

```
openapi/sfere-api.json          what the backend serves     ->  shipped half
openapi/cdp-proposals.mjs           hand-written proposals      ->  proposed half
openapi/jitsu-openapi-schema.json   payload shapes + tag prose
                    |
                    v
        scripts/build-cdp-contract.mjs
                    |
                    v
      openapi/sfere-cdp-contract.yaml   (generated — never edit)
```

```bash
pnpm openapi:pull     # refresh the backend spec from staging
pnpm contract:build   # regenerate the contract
pnpm contract:lint    # Spectral: spectral:oas + our own conventions
pnpm contract:check   # validate + lint + staleness + round-trip + shipped fidelity
pnpm contract:json    # throwaway JSON export (gitignored — do not commit)
pnpm docs:cdp         # browse it on :3001
```

**Edit `openapi/cdp-proposals.mjs`, never the YAML.** Edits to the generated file
are lost on the next build.

## The Jitsu relationship

The backend runs Jitsu underneath — `Account.jitsu_workspace_id`,
`Source.jitsu_site_id`, `Destination.jitsu_destination_id` and
`Pipeline.jitsu_link_id` are all provisioned there. So Jitsu's model informs the
payload shapes and much of the vocabulary in the proposed half.

It informs **nothing** about the surface:

| Jitsu                              | Sfere                                     |
| ---------------------------------- | ----------------------------------------- |
| `/api/{workspaceId}/config/stream` | `/v1/accounts/{account_id}/sources`       |
| workspace                          | account                                   |
| stream, service                    | source (`source_type` distinguishes them) |
| link, connection                   | pipeline (the dashboard says "pipe")      |
| `camelCase`                        | `snake_case`                              |
| bare arrays                        | `{items, total, page, size, pages}`       |
| `keyId:secret` bearer              | Identity Platform bearer token            |

Jitsu is an implementation detail of the backend, not a host the dashboard knows.
The dashboard's CSP names only the Sfere API hosts, so anything in this document
is served by Sfere or it cannot be called at all.

Jitsu's own spec is loose in places — several of its endpoints declare bodies and
responses as untyped `{"nullable": true}`. Where that happened, the proposal here
is a tighter shape informed by Jitsu's field names rather than a copy of them.

## Coverage by tag

| Tag            | Shipped | Proposed |
| -------------- | ------- | -------- |
| Identity       | 4       | 0        |
| Accounts       | 3       | 0        |
| Members        | 3       | 0        |
| Support        | 3       | 0        |
| Customers      | 5       | 0        |
| Sources        | 7       | 6        |
| Destinations   | 5       | 2        |
| Pipelines      | 5       | 1        |
| Functions      | 3       | 9        |
| Syncs          | 2       | 8        |
| Events         | 3       | 0        |
| Dashboard      | 1       | 0        |
| Metrics        | 0       | 1        |
| Connectors     | 0       | 8        |
| Profiles       | 0       | 8        |
| Domains        | 0       | 5        |
| Notifications  | 0       | 6        |
| Warehouse      | 0       | 6        |
| Monitoring     | 0       | 4        |
| Trash          | 0       | 3        |
| Secrets        | 0       | 5        |
| Authorizations | 0       | 5        |
| API tokens     | 0       | 3        |
| Health         | 3       | 0        |

## Things the backend team should look at

These came out of building the document. They are ordered by how much they matter.

### 1. `/v1/customers` requires no authentication

`listCustomers`, `getCustomer` and `listCustomerEvents` carry no `security` in
`openapi/sfere-api.json`, which means a cross-account customer index — and
per-customer event history — is reachable without a token.

The contract records this faithfully, because that is what the backend serves,
and says so in each operation's description. **Nothing in the dashboard relies on
these being open**, so closing them looks safe. Worth confirming it was
deliberate rather than a missing dependency on the route.

### 2. Shipped writes are thinner than the screens need

- `SourceUpdate` and `PipelineUpdate` accept only `is_enabled`. There is no way
  to rename a source or change how it accepts events, so the proposal splits
  ingest configuration into `.../sources/{id}/ingest-settings`.
- `Source.write_key` is a single string, which cannot express rotation — you
  need the new key live before retiring the old one, or every SDK still holding
  the old one breaks. The proposal models write keys as a collection, split
  public/private, following Jitsu.
- `Destination.test_connection_error` exists on the response but no endpoint
  sets it. The proposal adds the test endpoints that would.
- Deletes are hard. The dashboard has a Trash screen with a restore window and
  nothing behind it, so a mis-click on a pipeline is currently unrecoverable.

### 3. `Destination.config` is an open blob

`destination_type` is a free string and `DestinationConfig` describes ClickHouse
only, so nothing states what a Meta, TikTok, webhook or S3 destination needs.

The contract types the nine the product actually offers — the five in
`public/data/destination-templates.json` plus Postgres, BigQuery, Snowflake and
ClickHouse for the Warehouse module — as `AnyDestinationConfig`, a `oneOf`
selected by `destination_type`. Jitsu types 30-odd variants; the other 21
describe products Sfere does not sell, and importing them would make the
document harder to read for no gain.

### 4. `DestinationConfig.password` is documented as masked but not marked so

Its description says `Always "***" in API responses`, which is exactly what
`writeOnly: true` means in machine-readable form. The builder adds that flag
(`SHIPPED_SCHEMA_PATCHES` in `scripts/build-cdp-contract.mjs`) — it records the
behaviour the backend already has rather than asking for a new one. Adding it in
the backend spec would let the patch go away.

### 5. There is no account-level function library

Shipped functions exist only as instances attached to a pipeline, each
instantiated from a `template` the API never exposes. There is no way to attach
or detach one either — only to list, update and reset. The proposal adds the
library behind `PipelineFunction.template`, plus attach/detach/reorder and a
`POST .../functions/{id}/test` that runs a transform against a sample event.
Without that last one the only way to test a function is to ship it and watch
the error log.

### 6. Zid is hardcoded where OAuth would generalise

`connect-zid` and `zid-status` work because Zid is the first cloud app to ship.
A second one should not need a second pair of endpoints, so the proposal has a
generic Authorizations flow — the backend handles the callback and token
exchange, and the browser never sees either.

## Decisions taken, and the reasoning

Push back on any of these.

| Decision                                                           | Why                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sfere's vocabulary wins over Jitsu's                               | The dashboard, its routes and the shipped API all say sources/destinations/pipes. "Stream" survives only as the Live-events screen's word for a source.                                                                                                    |
| Scoping follows ownership, not uniformity                          | Account-owned resources are under `/v1/accounts/{account_id}/`; identity, the customer index, support sessions and the global catalogs stay flat. A new flat path is nearly always a scoping mistake — the lint enforces this.                             |
| The document is generated                                          | The shipped half has to agree with the running service. A contract that disagrees with a live endpoint is worse than no contract.                                                                                                                          |
| Shipped prose is rewritten, shipped shapes are not                 | FastAPI's "List Sources Route" is noise in Scalar's sidebar. Paths, parameters, bodies, responses, `operationId` and `security` are copied verbatim and diffed by `contract:check`.                                                                        |
| The `Problem` schema is hoisted to one component                   | The backend inlines the full RFC 9457 shape into every error response — about a kilobyte, over 600 times. The resolved contract is identical; the file is ~120KB smaller and Scalar renders briskly.                                                       |
| `/api/sources/by-store` and `/api/zid/install-report` are excluded | Untagged, unversioned, and not dashboard calls — one is an internal lookup, the other a Zid webhook.                                                                                                                                                       |
| Only 9 destination config variants, not Jitsu's 30+                | See §3 above.                                                                                                                                                                                                                                              |
| Every operation states `security` explicitly                       | The document declares a global bearer requirement, so an absent key would _inherit_ it and mean the same thing — but a reader cannot tell a considered decision from an oversight. `security: []` is the explicit opt-out; nine shipped operations use it. |
| `OAuth*` identifiers are spelled `Oauth*`                          | Consecutive capitals break strict camelCase, and it matches `Bigquery`/`Tiktok`/`Clickhouse` already used in the schema names. Prose still reads "OAuth".                                                                                                  |
| Schema _names_ are not case-normalised                             | `Page_Source_` and `Body_login` are FastAPI's own names, kept so this document and the orval-generated client in `src/api/` agree on what each schema is called. An underscore beats a contract that disagrees with the client.                            |

## The gates

`pnpm contract:check` runs four things. All four currently pass.

1. **`scalar document validate`** — is it valid OpenAPI 3.1.
2. **`pnpm contract:lint`** — Spectral: `spectral:oas` plus ten `sfere-*`
   convention rules. **Zero findings.**
3. **Staleness + round-trip** (`scripts/check-cdp-contract.mjs`) — the committed
   YAML is what the inputs produce, and it parses back to exactly the object the
   builder emitted. The emitter is hand-rolled (neither `yaml` nor `js-yaml` is
   installed), so "it validates" is not the same as "it says what was meant".
   This check caught a real bug: `|-` was stripping trailing newlines that
   several backend descriptions actually carry, silently rewriting them.
   `scalar document validate` passed that happily.
4. **Shipped fidelity** — all 47 shipped operations still match
   `sfere-api.json` on `operationId`, `parameters`, `requestBody`,
   `responses` and `security`.

### The lint ruleset

`.spectral.yaml`. Two halves: `spectral:oas` for standard OpenAPI style, and ten
`sfere-*` rules for this contract's own conventions — which are the valuable
half, because the shipped operations cannot drift but the hand-written proposals
can.

| Rule                                           | Catches                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `sfere-status-required` / `sfere-status-valid` | An operation with no `x-sfere-status`, which looks documented but says nothing about whether it exists |
| `sfere-security-explicit`                      | An operation that silently inherits the global bearer requirement                                      |
| `sfere-operation-id-camel-case`                | A snake_case `operationId`, which becomes an odd function name in every generated client               |
| `sfere-snake-case-properties`                  | A camelCase field — the dashboard camelizes at the edge, so the wire stays snake_case                  |
| `sfere-problem-json-errors`                    | An error response that is not RFC 9457                                                                 |
| `sfere-page-envelope-shape`                    | A `Page_*` schema missing part of `{items, total, page, size, pages}`                                  |
| `sfere-account-scoped-paths`                   | A new flat `/v1/…` path — exactly how the old draft's `/v1/dashboard` went wrong                       |
| `sfere-config-secrets-write-only`              | A credential in a round-tripping `*Config` schema not marked `writeOnly`                               |
| `sfere-sfere-hosts-only`                       | A server on any host but the Sfere API                                                                 |
| `oas3-unused-component`                        | An orphaned schema nothing references                                                                  |

**Two things to know about running it.**

`scalar document lint` does **not** auto-discover `.spectral.yaml` the way the
standalone Spectral CLI does — it must be passed with `-r`. Running
`scalar document lint <file>` bare silently uses Spectral's defaults and checks
none of the `sfere-*` rules, which looks like a clean lint. Use
`pnpm contract:lint`.

It also **exits 0 on warnings**, so a warning is invisible to CI. Everything in
the ruleset that should block is therefore `error`, including
`operation-description`, which was promoted from its default warning.

Each of the twelve rules above was verified to actually fire, by mutating a copy
of the contract so exactly one rule should trip and confirming it did. A rule
whose selector matches nothing passes silently, which is worse than no rule.

## What is deliberately not enforced

- **Descriptions on schemas.** 60 of 155 have one where there is something to
  explain. Requiring it everywhere would mean writing "An account." under
  `Account`, and most shipped schemas are the backend's to describe.
- **Alphabetical tags.** They are ordered as a reader should meet them —
  identity, then accounts, then the pipeline in the order data flows through it.
  Scalar renders them in declared order.
- **Operation descriptions that restate the summary.** The rule is an error, but
  the fix is a real sentence — what happens to dependents, when it 409s, what is
  returned once and never again. If an operation has nothing to add, the summary
  is too vague.

## Related constraints worth not tripping over

- **Do not point orval at this file.** `orval.config.js` reads
  `sfere-api.json`. Generating from the contract would produce typed fetchers
  for endpoints that 404.
- **`pnpm openapi:pull` overwrites `sfere-api.json`** — that is the intended
  way to refresh the shipped half. Run `pnpm contract:build` after.
- **The emitter writes single-quoted YAML on purpose.** `oxfmt` formats YAML
  repo-wide; if the generated style disagrees, `pnpm lint` reformats the file and
  `pnpm contract:build` puts it back, and CI fails whichever ran last.
- **An operation the backend already serves must never be marked `proposed`.**
  The builder exits non-zero rather than allow it.
