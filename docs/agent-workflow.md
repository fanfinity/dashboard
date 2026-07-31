# Parallel agent workflow

How the 54-screen build is split across many agents without them standing on each
other. Read this before starting a story.

## The shape of it

```
main
└── feat/pipes-rebuild                 integration branch, primary checkout
     ├── tag phase0-baseline           every story branch forks from HERE
     ├── story/sources    (worktree)
     ├── story/pipes      (worktree)
     └── …
```

Phase 0 already landed everything shared: the route table, the navigation, the UI
primitives, and all mock data. That is deliberate — it means a story agent never
has a reason to edit a file another agent is also editing.

Story branches fork from the **tag**, not from the integration branch's moving
HEAD, so every branch in a wave has an identical base and merges stay textually
trivial.

## Creating a worktree

```bash
pnpm worktree sources        # -> .claude/worktrees/sources on branch story/sources
```

Always use this script. `git worktree add` copies **tracked files only**, and
`.env` is gitignored — a hand-made worktree has no Firebase config, so sign-in
fails and the router's auth guard bounces every route to `/login`. That looks
like a broken app and tempts agents into editing frozen router files. The script
copies `.env` across and runs `pnpm install` (needed: `postinstall` runs
`quasar prepare`, without which the build fails).

## File ownership

An agent may create or modify **only**:

```
src/pages/<domain>/**
src/components/<domain>/**
src/composables/use<Domain>*.js
public/data/<files named in its packet>
```

Everything else is read-only. Explicitly frozen:

| Path                                                                  | Why                                                    |
| --------------------------------------------------------------------- | ------------------------------------------------------ |
| `src/router/screens.js`                                               | route manifest; adding a screen is a foundation change |
| `src/router/routes.js`                                                | generated from the manifest                            |
| `src/router/index.js`                                                 | auth guard                                             |
| `src/layouts/MainLayout.vue`                                          | navigation                                             |
| `src/components/ui/**`                                                | shared primitives — see below                          |
| `src/composables/useMockResource.js` and the other shared composables | contract every page depends on                         |
| `package.json`, `quasar.config.js`, `index.html`, `.gitignore`        | build config                                           |
| `scripts/**`, `CLAUDE.md`, `docs/**`                                  | tooling and conventions                                |
| any `public/data/*.json` not in your packet                           | another packet owns it                                 |

**If you cannot finish without touching a read-only file: stop and report the
blocker.** Do not work around it, do not duplicate the file, do not inline a copy.
The integrator checks this mechanically:

```bash
git diff --name-only phase0-baseline..story/<slug> | grep -vE '<packet globs>'
```

That command must print nothing.

## Primitives are frozen

`src/components/ui/` is written once and consumed read-only. Importing a shared
component from 18 branches causes zero merge conflicts; _editing_ it from 18
branches causes 18. If a primitive is genuinely inadequate, compose raw Tailwind
inside one of its slots and say so in your final report — do not edit it.

There is exactly one **amendment window**, between wave 1 and wave 2, when
primitives may change: run with no branches in flight, then re-tagged.

## Mock data

All mock JSON was authored centrally in Phase 0 and is cross-referentially
consistent (`pipes[].sourceId` resolves in `sources.json`, and so on). You may
**add fields and add records**. You may **not** rename or renumber existing `id`
values — the manifest's `smokeParams` point at them, and a broken lookup renders
`undefined` silently.

## Verification

There is no test runner. Three gates, cheapest first:

```bash
./node_modules/.bin/oxfmt --check src/ && ./node_modules/.bin/oxlint
./node_modules/.bin/quasar build
SMOKE_ROUTES=/your,/routes pnpm smoke:dist
```

`pnpm lint:check` also works but triggers a dependency re-check that can prompt
interactively in some environments; the direct binaries are safer in an agent.

`smoke:dist` builds, serves `dist/spa`, signs in for real (Firebase persists to
IndexedDB, so a stored session cannot be injected), visits each route and fails
on any console error, uncaught error, rendered `ErrorState`, unresolved route, or
missing `<h1>`. Run it filtered while iterating, then unfiltered once to confirm
you broke nothing else.

Each worktree has its own `dist/`, so concurrent builds do not race.

**Never run `pnpm dev` / `quasar dev`.** The user runs one dev server themselves.

## Handing work back

Commit in your worktree and stop:

```bash
git add -A && git commit -m "feat(<domain>): <summary> (#<issues>)"
```

Do not merge, do not push, do not open a PR, do not remove your worktree. The
integrator merges serially into `feat/pipes-rebuild`, re-runs the gates, and
cleans up.

Your final message should list every file you touched, any read-only file you
wanted to change, any primitive you had to work around, and the gate output.
