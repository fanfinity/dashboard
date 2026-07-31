# Competitor reference — Meiro Pipes

Screenshots and API notes captured from **Meiro Pipes** (`app.pipes.meiro.io`), a competitor
product, on a trial tenant we registered ourselves. Captured 2026-07-30/31.

## What this is for

These images are linked from the rebuild issues in this repo so an implementer can see what a
screen is _for_ — its information density, states and controls — without having to sign up for
the competitor product.

## What this is not

**Not a design target.** Do not copy layout, styling, iconography or copy from these images.
The issues specify behaviour and API contracts; the Fanfinity UI should be our own, built from
Quasar + Tailwind like the rest of this app. Matching capability is the goal, not appearance.

## Provenance

Recorded with a Chrome DevTools Protocol harness (`fanfinity/merio/`), which captured every
request and response the SPA made. Raw evidence lives outside this repo, on the capture machine:

| File                                    | Contents                                    |
| --------------------------------------- | ------------------------------------------- |
| `capture/meiro-app/exchanges.jsonl`     | 711 exchanges, full request/response bodies |
| `capture/meiro-app/session.har`         | HAR 1.2, importable into DevTools/Insomnia  |
| `capture/meiro-app/api-surface.md`      | Endpoint table + per-screen call breakdown  |
| `capture/meiro-app/backend-coverage.md` | 80 observed + 225 code-referenced endpoints |
| `capture/meiro-forms/formspec.json`     | Per-form field rules read from the live DOM |

The captures contain live session cookies and are **not** committed anywhere.

## Notes

- The product publishes no OpenAPI/Swagger document; the endpoint map was reconstructed from
  observed traffic plus endpoint strings mined from the shipped JS bundle.
- The tenant had the `engage` entitlement disabled, so Engage screens (audiences, journeys,
  goals, surveys, channels) render but their data is gated — those issues are labelled
  `area/engage` and are lower confidence.
