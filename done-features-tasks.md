# Done / features / tasks log

Reverse-chronological, one line per entry: `- YYYY-MM-DD: <concise description>`. Append
whenever a feature or task is added, finished, or stopped — see CLAUDE.md's "Done-features log"
section for the full convention. Cleared weekly after being shared to Slack.

- 2026-08-25: rebased the data-source work onto the real account-scoped sources/destinations/pipelines API, dropped the local Scalar mock-server mode, and made "real" the default data source.
- 2026-08-25: cut the dashboard over to talking only to the backend — deleted the browser events SDK, its consent banner, the /events-demo page and the /japi dev proxy, and rewired Live Events and the connector catalog onto new drafted /v1/events, /v1/event-streams and /v1/connectors endpoints.
- 2026-08-25: moved every toast notification from a bottom banner to a stacking top-right panel, restyled to the Sfere ink/shadow/motion tokens.
