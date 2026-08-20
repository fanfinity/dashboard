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
an Environment variable. Everything else (`VITE_FIREBASE_*`, `VITE_JITSU_*`,
`VITE_EVENTS_*`) is identical everywhere and lives at repository level — there is one
Identity Platform tenant and one Jitsu workspace.

`EVENTS_API_KEY` is deliberately **not** in CI. It is read server-side by
`quasar.config.js` for the `/japi` dev proxy and belongs in a local `.env` only.

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

There is no `/japi` proxy outside `pnpm dev`, so the Jitsu console read path
(`/live-events`) does not work on any deployed host. It never did on GitHub Pages
either. That is also why `firebase.json` has **no** catch-all rewrite to
`index.html`: a rewrite would answer `/japi/*` with a 200 HTML body and turn a loud
404 into a silent parse failure. Fixing it needs a real reverse proxy.
