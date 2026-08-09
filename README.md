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

### Live Events page

The **Live Events** page reads incoming events from the backend
(`console.fanfinity.io`). That endpoint requires authentication and is not
CORS-enabled, so the dev server proxies `/japi/*` → `https://console.fanfinity.io/api/*`
and attaches an API key as a Bearer token. Configure the key in a `.env` file at the
project root (gitignored):

```bash
# .env
EVENTS_API_KEY=<keyId>:<secret>

# optional non-secret overrides
VITE_EVENTS_WORKSPACE_ID=<workspaceId>
VITE_EVENTS_ACTOR_ID=<siteId>
```

Create the key in the console under **Settings → API Keys** (format `keyId:secret`).

> Note: this proxy only runs in development (`pnpm dev`). A static production build
> has no proxy, so the real events API requires an equivalent reverse proxy in front
> of it.

### Build the app for production

```bash
pnpm build
```
