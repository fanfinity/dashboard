# Sfere Dashboard

## Install the dependencies

```bash
pnpm install
# or: yarn/npm/bun install
```

### Start the app in development mode (HMR, error reporting, etc.)

```bash
pnpm dev
```

### What this app connects to

**The Fanfinity backend, and nothing else.** Every live call goes to that API
(`VITE_API_BASE`), plus Google Identity Platform for sign-in. There are no direct
connections to event collectors, vendor consoles or third-party catalogs, and no dev-only
proxy standing in for one — `pnpm dev` and a production build reach exactly the same hosts.

That includes the **Live Events** page, which reads `GET /v1/events` like every other
screen. Where events are actually collected is the backend's concern; this app never holds
an ingest key and cannot send an event. The CSP in `index.html` enforces it: `img-src` is
`'self'` and `connect-src` names only the API hosts and Identity Platform, so a call to
anywhere else is blocked by the browser rather than caught in review.

Configuration lives in a gitignored `.env` — see `.env.example`. If a feature seems to need
a credential for an outside system, that credential belongs in the backend.

Parts of that API are still proposed rather than built. `openapi/sfere-cdp-contract.yaml`
is the contract covering both halves — every operation says which it is via
`x-sfere-status` — and `pnpm docs:cdp` browses it. A screen whose endpoint does not exist
yet renders "No API yet" rather than an empty list.
**Settings → Data source** switches the whole app between the real API (the default) and the
mock JSON in `public/data/`, which is what makes a backend-free demo possible.

### Build the app for production

```bash
pnpm build
```
