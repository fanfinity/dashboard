# Deployment

The dashboard is a static SPA on **Firebase Hosting**, in the `koratona-9791a` GCP
project — the same project and the same pattern as the marketing site at
`../../marketing/website`. It is **not** on GitHub Pages any more; `public/CNAME`
and `deploy-pages.yml` are gone, and `ci.yml` fails the build if either comes back.

## Environments

| Trigger           | Workflow                | GitHub environment | Hosting site                    | URL                                        | API                    |
| ----------------- | ----------------------- | ------------------ | ------------------------------- | ------------------------------------------ | ---------------------- |
| Pull request      | `deploy-preview.yml`    | `preview`          | channel `pr-<N>` on `sfere-stg` | `https://sfere-stg--pr-<N>-<hash>.web.app` | `api-staging.sfere.io` |
| Push to `main`    | `deploy-staging.yml`    | `staging`          | `sfere-stg`                     | <https://app-staging.sfere.io>             | `api-staging.sfere.io` |
| Push tag `vX.Y.Z` | `deploy-production.yml` | `production`       | `sfere-app`                     | <https://app.sfere.io>                     | `api.sfere.io`         |

`production` carries a **required reviewer**, so a tag push pauses until someone
approves it. Preview channels expire after 7 days.

## Each environment builds its own bundle

Vite inlines `import.meta.env.VITE_*` at build time, and `VITE_API_BASE` is read in
`src/api/mutator.js`. Staging and production are therefore genuinely different
bytes — there is no "build once, deploy twice" artifact to share, and folding the
three workflows into one build job would ship the staging API host to production.

`VITE_API_BASE` is the **only** value that differs between environments; it lives as
an Environment variable. Everything else (`VITE_FIREBASE_*`) is identical everywhere
and lives at repository level — there is one Identity Platform tenant.

There are no event-collector credentials in CI, and none in `.env` either. The
dashboard reads events from the backend (`GET /v1/events`) like every other screen,
so there is no ingest host, no write key, and no server-side key for a dev proxy to
inject.

## Auth is keyless

No service-account JSON exists in this repo or in GitHub secrets. Workload Identity
Federation mints a short-lived token for `gh-deployer-dashboard`:

| Thing           | Value                                                          |
| --------------- | -------------------------------------------------------------- |
| Pool / provider | `github-dashboard` / `github-dashboard-oidc`                   |
| Condition       | `assertion.repository=='fanfinity/dashboard'`                  |
| Deploy SA       | `gh-deployer-dashboard@koratona-9791a.iam.gserviceaccount.com` |
| Roles           | `firebasehosting.admin`, `serviceusage.serviceUsageConsumer`   |

One pool per repo is the house convention — `fanfinity/website` and
`fanfinity/sfere-demo-store` have their own.

## Production is deliberately not live yet (2026-08-20)

`app.sfere.io` exists as a Hosting site with an attached domain and a valid
certificate, and it has **zero releases**. That is on purpose, not an unfinished
step.

The blocker is the backend, not the dashboard: `../../backend/k8s/overlays/production/`
has never been applied and still carries three `REPLACE_` placeholders. Production
needs a database, and the two available options were both judged wrong for now — a
Cloud SQL instance would add recurring spend to a billing account nobody at Sfere
can currently administer, and the in-cluster Postgres that staging borrows is a
single unbacked pod in a cluster that scales to zero overnight.

So `deploy-production.yml` **preflights `${VITE_API_BASE}/healthz` and hard-fails**
if it does not answer. Running `pnpm release` today will tag correctly, pause for
review, and then stop at that check with a message naming the overlay. That is the
intended behaviour — it is much better than shipping a dashboard that renders fine
and whose every screen is silently empty.

To bring production up, in order: settle the database, fill the overlay, create the
`fanfinity-api-prod` namespace and its `backend-secrets`, tag the backend `vX.Y.Z`,
confirm `https://api.sfere.io/healthz` answers, then `pnpm release` here.

**Do not "unblock" this by pointing production's `VITE_API_BASE` at
`api-staging.sfere.io`.** A public production dashboard silently reading and writing
the staging database is the worst of the available outcomes, and it would not be
noticed for months.

## Releasing

```bash
pnpm release patch|minor|major   # bumps package.json, commits, tags
git push origin main --follow-tags
```

`scripts/release.mjs` refuses on a dirty tree, off `main`, out of sync with origin,
or on a tag that already exists. It prints the push command rather than running it —
one deliberate keystroke to start a production pipeline. `--follow-tags` matters: a
plain `git push` sends the commit and silently drops the tag, and then nothing
deploys.

Never tag by hand. `deploy-production.yml` re-checks that the tag matches
`package.json`, because otherwise the version the app displays is not the version
that was released. That version is stamped into the bundle as `VITE_APP_VERSION` and
shown in the account menu — `sha-<short>` on staging, `vX.Y.Z` in production,
`pr-<N>` on a preview, `dev` locally.

## Site IDs are short on purpose

A preview channel is served from `<site>--<channel>-<hash>.web.app`, and Firebase
**truncates the site id** once that label passes 30 characters. A truncated host
would silently stop matching the staging backend's `CORS_ALLOW_ORIGIN_REGEX`, so the
sites are `sfere-app` and `sfere-stg` rather than anything more descriptive. The
`.web.app` names only ever show up in preview URLs.

## CORS

The backend allows origins exactly, from `CORS_ALLOW_ORIGINS`. Preview channels
cannot be enumerated ahead of time, so **staging additionally sets
`CORS_ALLOW_ORIGIN_REGEX`** (`^https://sfere-stg--[a-z0-9-]+\.web\.app$`), anchored to
the staging site id. Production sets no regex at all, so no preview channel can ever
reach the live API. Both live in `../../backend/k8s/overlays/*/patch-env.yaml`.

Adding a new deployed origin means editing that overlay **and** the `connect-src`
list in `index.html` — the CSP blocks an unlisted API host, and the failure looks
exactly like a CORS error in the console, so you will debug the wrong system.

## Rolling back

Firebase keeps every release per site. There is no `hosting:rollback` command —
use the console's Rollback button, or:

```bash
npx --yes firebase-tools@15.24.0 hosting:clone sfere-stg:<versionId> sfere-stg:live \
  --project koratona-9791a
```

## What the deployed build cannot do

Nothing, as far as data goes: every screen reads the same `VITE_API_BASE` host in a
deployed build as it does in `pnpm dev`, and there is no dev-only proxy any more.
`/live-events` used to be the exception — it read a third-party console through a
`/japi` proxy that only existed in `pnpm dev` — and is not any more.

`firebase.json` still has **no** catch-all rewrite to `index.html`, for the reason it
always did: the router is in hash mode, so a rewrite buys nothing and would answer a
mistyped `/data/*.json` with a 200 HTML body, turning a loud 404 into a silent parse
failure.
