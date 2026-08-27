# Done / features / tasks log

Reverse-chronological, one line per entry: `- YYYY-MM-DD: <concise description>`. Append
whenever a feature or task is added, finished, or stopped — see CLAUDE.md's "Done-features log"
section for the full convention. Cleared weekly after being shared to Slack.

- 2026-08-27: Fixed ~1850px of dead space under step 1 of /sources/new — a `@container` inside a Quasar wrapping column flex was measured at min-content height.
- 2026-08-27: Submit rows across the create forms are now sticky to the bottom of the viewport via a new `StickyActionBar` primitive.
- 2026-08-27: replaced the header account chip's bundled photo — which showed the same stranger's face to every signed-in user — with a stroke-drawn person mark on the brand tint.
- 2026-08-27: fixed the spacing, alignment and icons on the source intent picker — redrew the six marks as real multi-element SVGs (the server rack read as a hamburger menu, the plug as a light bulb), and found two more Quasar/Tailwind cascade collisions doing it: `mt-*` on a `<p>` computes to zero so the cards' whole spacing rhythm had never rendered, and an `auto-fit` grid inflated 219px cards to 637px.
- 2026-08-27: made the post-auth "setting up your account" transition a fixed 2.5s instead of a random 1.1–2s, so it is long enough to read rather than flashing past.
- 2026-08-27: fixed the Pipes screens rendering fixture-only fields against the real pipeline API — the backend's Pipeline record has no `version`, no end names and no delivery counter, so `usePipes` now joins each pipe's source and destination in from the live Sources/Destinations collections, the "vundefined" Version card is gone, and the fabricated "0 deliveries" and "Pass-through" now read as unknown, and the Sources list's events/hour column no longer reports a measured 0 for a counter the backend never sends.
- 2026-08-27: built the screens from the onboarding proposal — Team & roles (with the domain-match approval queue) and Billing as a new ACCOUNT sidebar section, a guided three-step source flow (intent picker → details → multi-platform install & confirm), a derived setup tracker on the Dashboard with one-line reminders on Sources/Destinations/Pipes, source-detail Settings and Destinations & pipes tabs, a 29-template destinations catalog grouped by category with Included/Add-on marks, a redesigned login and an animated post-auth "setting up your account" transition.
- 2026-08-27: made the connector catalog connectable — picking a card now opens a real credentials form (named fields for Firebase, MongoDB, Shopify, Stripe and GA4, generic JSON otherwise) with a sync schedule and working validation, instead of a "coming soon" toast.
- 2026-08-27: fixed PageHeader and ToolbarSearch so the actions row stops wrapping onto a second line on all 56 screens, and PipeFlow's arrows so they point right instead of down.
- 2026-08-27: found and documented a fourth Quasar/Tailwind cascade collision — Quasar's unlayered `.flex` sets `flex-wrap: wrap`, so `flex-nowrap` never wins and `justify-between` rows silently stack once the copy gets long.
- 2026-08-25: rebased the data-source work onto the real account-scoped sources/destinations/pipelines API, dropped the local Scalar mock-server mode, and made "real" the default data source.
- 2026-08-25: cut the dashboard over to talking only to the backend — deleted the browser events SDK, its consent banner, the /events-demo page and the /japi dev proxy, and rewired Live Events and the connector catalog onto new drafted /v1/events, /v1/event-streams and /v1/connectors endpoints.
- 2026-08-25: moved every toast notification from a bottom banner to a stacking top-right panel, restyled to the Sfere ink/shadow/motion tokens.
