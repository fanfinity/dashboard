# Done / features / tasks log

Reverse-chronological, one line per entry: `- YYYY-MM-DD: <concise description>`. Append
whenever a feature or task is added, finished, or stopped — see CLAUDE.md's "Done-features log"
section for the full convention. Cleared weekly after being shared to Slack.

- 2026-08-27: audited the CDP contract against every screen and fixture and wrote docs/contract-trimming.md, naming the 30 proposed operations (~2,750 lines) nothing in the app touches and the ones to keep.
- 2026-08-26: renamed the pulled backend spec `openapi/fanfinity-api.json` to `openapi/sfere-api.json` and updated every reference, so the contract inputs all read as Sfere files.
- 2026-08-26: added `pnpm contract:json` to export the CDP contract as JSON on demand, gitignored rather than committed so the YAML stays the one reviewable artefact.
- 2026-08-26: added .spectral.yaml (spectral:oas plus ten sfere-\* convention rules), fixed every finding it raised so the CDP contract lints clean, and wrote docs/contract-building.md as the handover for the backend team.
- 2026-08-26: replaced the drifted CDP draft spec with a generated contract document (openapi/sfere-cdp-contract.yaml) that merges the live backend endpoints with a Jitsu-derived proposal for everything still unbuilt, and marks which is which.
- 2026-08-25: rebased the data-source work onto the real account-scoped sources/destinations/pipelines API, dropped the local Scalar mock-server mode, and made "real" the default data source.
- 2026-08-25: cut the dashboard over to talking only to the backend — deleted the browser events SDK, its consent banner, the /events-demo page and the /japi dev proxy, and rewired Live Events and the connector catalog onto new drafted /v1/events, /v1/event-streams and /v1/connectors endpoints.
- 2026-08-25: moved every toast notification from a bottom banner to a stacking top-right panel, restyled to the Sfere ink/shadow/motion tokens.
