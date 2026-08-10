# design-sync notes — Sfere

Repo-specific gotchas for anyone re-running the claude.ai/design sync.

## This repo does NOT use the bundled converter

- **`/design-sync`'s converter targets React design systems only** (stated in
  `non-storybook/SKILL.md`: "a non-React DS has nothing for the claude.ai/design
  agent to build with"). Sfere is 30 Vue SFCs on Quasar and the repo has zero
  React, so `package-build.mjs` is not runnable here and never will be.
- The bundle is produced by **`tools/build-design-sync-bundle.mjs`** instead,
  which emits the same output contract by hand. It lives in `tools/` because
  `scripts/**` is a frozen path.
- `.ds-sync/package-validate.mjs` **is** used — it is the real gate, and it
  passes (exit 0, render check 4/4). Re-stage it with the `cp -r` line in the
  skill before re-validating; a stale `.ds-sync/` runs an old validator.
- Re-run order: `node tools/build-design-sync-bundle.mjs` →
  `node .ds-sync/package-validate.mjs ./ds-bundle` → upload.

## What ships, and what deliberately does not

- **Ships**: 96 brand tokens + 21 product aliases, 20 woff2 files (Bricolage
  Grotesque Variable, Inter 400/500/600/700, Geist Mono 400/500/600, Plus Jakarta
  Sans 600/700), 7 surface-treatment classes + 4 animation classes, 4 foundation
  specimen cards.
- **Does not ship**: any importable component. `window.Sfere` is an empty
  namespace and `_ds_bundle.js` declares `components: []`. This is the honest
  state, not a bug — say so in any status report, because the foundation cards
  make the project look populated and hide the omission.

## Traps this build exists to avoid

- **`src/css/sfere.css` is Tailwind v4 SOURCE, not shippable CSS.** It uses
  `@theme`, `@utility` and bare `@fontsource/...` imports. A browser ignores
  `@theme` as an unknown at-rule and cannot resolve a bare specifier, so shipping
  it raw renders every design with **no tokens and no fonts, silently**. Only
  compiled/extracted output is shippable.
- **Tokens are parsed from the `@theme` source block, not from a compile.**
  Tailwind v4 tree-shakes theme variables no utility references, so a compile
  would silently drop tokens the design agent still needs to name. The parse
  yields all 96.
- **Utilities come from a real Tailwind compile, not hand transcription.**
  `sfere-gradient-border` uses a nested `&::after` and the fade utilities use
  multi-line masks — both are easy to get subtly wrong by hand.
- **`sfere-flow-line-y` is absent from `dist/spa/assets/*.css`** because the app
  never uses it. Scraping the app's compiled CSS as a shortcut would therefore
  ship 6 of 7 treatments. The dedicated compile is what catches this.
- **The animation classes must ship with the tokens.** `--animate-sfere-*` are
  theme vars; the `.animate-sfere-*` classes Tailwind generates from them are
  separate. The `prefers-reduced-motion` guard in `sfere.css` targets the class
  names, so shipping tokens alone would leave that guard pointing at nothing.

## Known warns (expected — not new)

- `! _ds_sync.json absent` — **deliberate.** The sidecar's hash recipe assumes
  the converter's own pipeline; computing one by hand would mint an anchor
  vouching for a shape it doesn't describe. Consequence: every re-sync
  re-verifies from scratch. That is cheap here (4 cards) and correct. Do not
  "fix" this warning.
- `(.d.ts parse check skipped — typescript not in node_modules)` — expected.
  There are no `.d.ts` files to parse; this DS has no component API.

## Font decisions

- `--font-sfere-display` names `'Plus Jakarta Sans'` as its second-position
  fallback. `sfere.css` doesn't import it, so the first build raised
  `[FONT_MISSING]`. Resolved by shipping PJS 600/700 (already a `package.json`
  dependency) rather than accepting a substitute — a design system that ships a
  family string it can't honour is a lie the browser resolves silently.
- Only `latin` and `latin-ext` subsets ship. The `@fontsource` packages also
  carry cyrillic, greek and vietnamese; shipping all of them roughly quadruples
  the bundle for coverage the Design pane will not exercise.
- Family strings verified against the packages: `'Bricolage Grotesque Variable'`
  (note "Variable" — a mismatch here would silently fall back), `'Inter'`,
  `'Geist Mono'`.

## Card layout

- The claude.ai/design pane is ~680px wide, narrower than the 1200px the render
  check screenshots at. All card grids use `repeat(auto-fit, minmax(…, 1fr))`
  and were verified at 680px with zero horizontal overflow. **Do not switch them
  to fixed column counts** — the render check will not catch the regression,
  because these cards do not use the `.ds-grid`/`.ds-cell` markup that the
  `[GRID_OVERFLOW]` check inspects.

## Frozen files

- `.gitignore` was edited (build-output entries) with the user's explicit
  approval. It has since been removed from CLAUDE.md's frozen list.

## Re-sync risks — what can silently go stale

- **The conventions header is hand-maintained.** `.design-sync/conventions.md`
  enumerates 52 token names and 11 class names, and it is inlined into the design
  agent's system prompt. If `src/css/sfere.css` renames or drops a token, the
  header keeps naming it and the agent will write vocabulary that resolves to
  nothing — producing silently unstyled designs that nothing downstream catches.
  **Run this after every build, before uploading** (must print `unverified: none`
  twice):

  ```bash
  node -e '
  const fs=require("fs");
  const conv=fs.readFileSync(".design-sync/conventions.md","utf8");
  const css=["tokens/sfere-tokens.css","tokens/app-aliases.css","_ds_bundle.css"]
    .map(f=>fs.readFileSync("ds-bundle/"+f,"utf8")).join("\n");
  // Ignore pure-hyphen runs (markdown table rules) and the documented wildcard.
  const vars=[...new Set([...conv.matchAll(/--[a-z0-9-]+(?:--[a-z-]+)?/g)].map(m=>m[0]))]
    .filter(v=>/[a-z]/.test(v) && v!=="--color-sfere-dark-");
  const classes=[...new Set([...conv.matchAll(/\.(sfere-[a-z-]+|animate-sfere-[a-z-]+)\b/g)].map(m=>m[1]))];
  const badV=vars.filter(v=>!new RegExp("\\"+v+"\\s*:").test(css));
  const badC=classes.filter(c=>!css.includes("."+c));
  console.log("tokens checked:",vars.length,"| unverified:",badV.length?badV.join(", "):"none");
  console.log("classes checked:",classes.length,"| unverified:",badC.length?badC.join(", "):"none");
  process.exit(badV.length+badC.length?1:0);
  '
  ```

  Run it **after** `pnpm lint`, not before: oxfmt reflows the header's markdown
  tables, so a check run before formatting describes a file you did not upload.

- **Card copy is duplicated from source comments.** The specimen cards restate
  reasoning from `sfere.css` ("500 is the identity colour", "don't tighten the
  eyebrow tracking"). Those strings live in
  `tools/build-design-sync-bundle.mjs`, not in the CSS, so a change to the
  reasoning in `sfere.css` will not propagate. Re-read both when tokens change.
- **`shape: "package"` in config.json is nominal.** It satisfies the config
  schema; nothing in this repo runs the package pipeline. Don't let it lure a
  future run into `package-build.mjs`.
- **If the Sfere kit is ever ported to React**, this whole approach is
  superseded — delete `tools/build-design-sync-bundle.mjs` and run the real
  converter. The hosting option (serving `#/design-system` for colleagues) was
  offered and declined on 2026-08-10; it remains the only way to give the company
  the actual Vue components.
