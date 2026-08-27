# Done / features / tasks log

Reverse-chronological, one line per entry: `- YYYY-MM-DD: <concise description>`. Append
whenever a feature or task is added, finished, or stopped — see CLAUDE.md's "Done-features log"
section for the full convention. Cleared weekly after being shared to Slack.

- 2026-08-27: built the screens from the onboarding proposal — Team & roles (with the domain-match approval queue) and Billing as a new ACCOUNT sidebar section, a guided three-step source flow (intent picker → details → multi-platform install & confirm), a derived setup tracker on the Dashboard with one-line reminders on Sources/Destinations/Pipes, source-detail Settings and Destinations & pipes tabs, a 29-template destinations catalog grouped by category with Included/Add-on marks, a redesigned login and an animated post-auth "setting up your account" transition.
- 2026-08-27: made the connector catalog connectable — picking a card now opens a real credentials form (named fields for Firebase, MongoDB, Shopify, Stripe and GA4, generic JSON otherwise) with a sync schedule and working validation, instead of a "coming soon" toast.
- 2026-08-27: fixed PageHeader and ToolbarSearch so the actions row stops wrapping onto a second line on all 56 screens, and PipeFlow's arrows so they point right instead of down.
- 2026-08-27: found and documented a fourth Quasar/Tailwind cascade collision — Quasar's unlayered `.flex` sets `flex-wrap: wrap`, so `flex-nowrap` never wins and `justify-between` rows silently stack once the copy gets long.
- 2026-08-25: rebased the data-source work onto the real account-scoped sources/destinations/pipelines API, dropped the local Scalar mock-server mode, and made "real" the default data source.
- 2026-08-25: cut the dashboard over to talking only to the backend — deleted the browser events SDK, its consent banner, the /events-demo page and the /japi dev proxy, and rewired Live Events and the connector catalog onto new drafted /v1/events, /v1/event-streams and /v1/connectors endpoints.
- 2026-08-25: moved every toast notification from a bottom banner to a stacking top-right panel, restyled to the Sfere ink/shadow/motion tokens.
