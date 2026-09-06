# UI conventions

Everything under `src/components/ui/` is the house style. 54 screens are being
built in parallel; these primitives exist so all 54 look like one product and so
the smoke test can assert on a single selector across every route.

**Read this before writing a screen.**

---

## Hard rules

1. **Never write a `<style>` block.** There is not one in the entire repo, and
   there must never be. Tailwind utility classes only. If you think you need
   custom CSS, you need a different composition of utilities.

2. **The Tailwind v4 important modifier is a _suffix_.** `text-2xl!`, not
   `!text-2xl`. The prefix form is Tailwind v3 syntax and silently does nothing
   in v4. You need the suffix wherever Quasar ships its own rule for the element
   — headings (`h1`–`h6`), `q-skeleton` border radius, `q-btn` internals.

   ```html
   <h1 class="text-2xl! font-semibold! tracking-[-0.5px]! text-ink">Title</h1>
   <q-skeleton height="74px" class="rounded-xl!" />
   ```

3. **Every `<h1>`–`<h6>` needs the important suffix on size, weight _and_
   leading.** This is rule 2's single most expensive case, so it gets its own
   rule. Quasar's base stylesheet styles bare heading elements — `font-size`,
   `font-weight`, `line-height`, `letter-spacing` — and those rules beat an
   un-suffixed utility. A heading that looks fine in isolation renders at
   Quasar's scale inside the app. `PipelineFlowPanel.vue` shipped a section
   label at roughly 4× its intended size for exactly this reason.

   The suffix is needed on `text-*`, `font-*` and `leading-*`. It is **not**
   needed on colour, margin or padding — Quasar does not set those on headings.

   **A `<button>` is the same problem in a place nobody looks**, and the whole
   of rule 2 applies to it: Quasar ships unlayered
   `button, input, optgroup, select, textarea { font: inherit }`, and because
   that is the `font` **shorthand** it resets size, line height _and_ weight in
   one declaration. So a `<button class="text-sfere-sm font-semibold">` renders
   at whatever its container inherits. What makes it expensive is that the same
   component can disagree with itself: `SfereButton` renders an `<a>` when it
   carries `to` and a `<button>` when it does not, and an `<a>` is not in that
   selector list — measured, one class string drew 600 weight / 13px as the
   link and 400 / 14px as the button, which is a `Refresh` and a
   `Connect a source` in one header row looking like two different controls.
   Use the suffix on any `<button>` that states its own type: `text-sfere-sm!`,
   `font-semibold!`, `leading-none!`. `SfereButton` and `TabNav` carry it.

   ```html
   <!-- WRONG: Quasar wins; this renders at heading scale -->
   <h3 class="text-[11px] font-semibold uppercase leading-4 text-subtle">
     Sources
   </h3>

   <!-- RIGHT -->
   <h3
     class="text-[11px]! font-semibold! uppercase leading-4! tracking-[0.4px]! text-subtle"
   >
     Sources
   </h3>
   ```

   `PageHeader` and `FormSection` already do this for you — prefer them over a
   bare heading. When you do need one (a section label inside a card), copy the
   `text-sm! font-semibold! tracking-[-0.35px]! text-ink` string the detail
   screens use.

4. **Design tokens only.** Defined in `src/css/tailwind.css` under `@theme`:

   Each one is an alias for a token in `src/css/sfere.css`, so the hexes below
   are the resolved value, not the source of truth — change the brand in
   `tailwind.css` and this table follows.

   | Token          | Hex       | Use                                        |
   | -------------- | --------- | ------------------------------------------ |
   | `brand`        | `#854dff` | accent, active nav, primary buttons, links |
   | `ink`          | `#0a0a0a` | primary text                               |
   | `muted`        | `#737373` | body / secondary text, table cell text     |
   | `subtle`       | `#737373` | placeholders, column headers, hints        |
   | `sidebar`      | `#f7f8fa` | sidebar bg, table row hover                |
   | `fill`         | `#f5f5f5` | chip bg, button hover                      |
   | `line`         | `#e5e5e5` | dividers (table rows, card header/footer)  |
   | `line2`        | `#e5e5e5` | control + card borders                     |
   | `success`      | `#059669` | success text                               |
   | `success-bg`   | `#ecfdf5` | success chip bg                            |
   | `success-line` | `#a7f3d0` | success chip border                        |

   Two pairs now resolve to the same value — `line`/`line2`, and
   `muted`/`subtle`. Both names in each pair are kept so no markup has to
   change, but there is no longer a visual difference between them. Do not
   reach for one over the other expecting contrast; if you need a third level
   of text hierarchy, get it from weight or size.

   `subtle` collapsing into `muted` is forced by contrast, not laziness: on
   this neutral ramp grey-on-white reaches the 4.5:1 AA floor at about
   `#767676`, so no value both separates from `muted` and stays legible.
   `#a1a1a1` — the obvious next step up — is 2.6:1.

   Opacity variants of `brand` are in play too: `border-brand/30`, `bg-brand/5`,
   `bg-brand/10`.

   Stock Tailwind colours are allowed **only** for semantic states, and only
   these ramps: **amber** (warning), **rose** (error/danger/destructive),
   **violet** (anonymous/unknown). Never introduce a fourth.

5. **Tables are hand-rolled.** Never `q-table`. Use `DataTable.vue`. If a screen
   needs a shape `DataTable` cannot express, drop to `SfereTable.vue` — the
   presentational `<table>` `DataTable` is itself built on — and own the four
   states yourself. Do not reach for Quasar, and do not copy class strings out of
   `DataTable.vue`: it holds no `<table>` of its own any more.

6. **Change a primitive deliberately, not mid-screen.** `src/components/ui/` is
   imported by ~104 files, so an edit here is never local. If a primitive is
   inadequate for the one screen you are on, compose raw Tailwind inside one of
   its slots — every primitive has an escape hatch — and **report the gap**. If
   the same gap shows up on several screens, that is the case for changing the
   primitive, and it should land as its own change with its own reasoning rather
   than buried in a story.

   The point is not that the folder is sacred; it is that fifty-four screens
   changing shape as a side effect of one of them is how a design system rots.

   Changes so far: the original thirteen; a post-wave-1 pass that added
   `DefinitionList`, `SelectableCard` and `NoticeBanner` and extended
   `DataTable`, `EmptyState` and `StatCard`; and the Sfere migration, which
   replaced all sixteen implementations and added twenty-three more.

7. **Primitives are dumb.** Props in, slots out. No `useRouter`, no `useRoute`,
   no composables, no `fetch`. Pages own all data and navigation; primitives own
   only appearance.

   The one carve-out is a **declarative** `<router-link :to="…">` driven
   entirely by a prop — `DataTable`'s `emptyCtaTo` uses one. That is still dumb:
   the component renders what it is handed and never reads router state.
   Imperative `router.push` stays in the page.

8. **`data-smoke="error"` lives on `ErrorState` and nowhere else.** It is the one
   hook `scripts/smoke.mjs` uses to detect a broken screen on every route. Never
   put that attribute on another element, and never render a bespoke error card
   instead of `ErrorState`. `EmptyState` carries `data-smoke="empty"` for the
   same reason — an intentionally-empty screen must be distinguishable from a
   broken one. That is also why a nested "nothing here" hint should be
   `EmptyState variant="inline"` rather than a hand-rolled `<p>`: the hint keeps
   the smoke hook.

9. **Every screen renders all four states**: loading, error, empty, populated.
   `DataTable` does this for you. A form or detail page must do it by hand with
   `LoadingState` / `ErrorState` / `EmptyState`.

10. **`class="flex"` wraps, and plain `flex-nowrap` cannot stop it.** Quasar ships an
    unlayered `.flex { display: flex; flex-wrap: wrap }`, so every `flex` in this
    repo is a _wrapping_ flex container, and Tailwind's layered `flex-nowrap`
    loses to it the same way a layered `text-2xl` loses to Quasar's `h2`. The
    symptom is a `justify-between` row where the label suddenly sits **above**
    the control instead of beside it — and it only appears once the text is long
    enough, which is why it usually ships.

    Give the child that should absorb the slack `min-w-0 flex-1`. That sets
    `flex-basis: 0`, which removes the wrap decision entirely rather than
    fighting the cascade:

    ```html
    <!-- wrong: wraps as soon as the paragraph is wide -->
    <div class="flex items-start justify-between gap-4">
      <div><p>A long explanation of what this toggle does…</p></div>
      <SfereToggle v-model="on" />
    </div>

    <!-- right -->
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0 flex-1"><p>A long explanation…</p></div>
      <SfereToggle v-model="on" />
    </div>
    ```

    `flex-nowrap!` would also work, but `min-w-0 flex-1` is what you want anyway:
    it makes `truncate` behave on the child, and it says which side is meant to
    give way. Use `shrink-0` on the side that must keep its intrinsic width.

    **In a column under a height cap, the child-side fix does not apply and the
    important suffix is the answer.** A `flex flex-col` with a `max-h-*` does not
    scroll when its content overflows — it wraps into a **second column**, which
    is a different bug wearing the same cause. The
    `New notification channel` dialog put its header in column one and its whole
    scrollable form in column two, past the card's right edge and clipped by
    `overflow-hidden`; it reads as "the dialog is cut in half", not as a wrap.
    The tell is a header `border-b` that stops mid-card instead of spanning it.
    Measured on the real cascade, the three children sat at `offsetLeft`
    `0 / 600 / 674` inside a 600px card. There is no slack for a child to absorb
    here — the scrolling body already had `min-h-0 flex-1` — so put
    `flex-nowrap!` on the container, which restores `0 / 0 / 0`. Every
    viewport-capped dialog and overlay card carries it:
    `SettingsNotificationChannelDialog`, `ProfileBuilderEditDialog`,
    `SourceSyncRunLogsDialog`. A new one needs it too. (`FirstRunOverlay` was on this list
    until it became a `maximized` dialog, where Quasar imposes no height cap to overflow.)

11. **`mt-*` on a `<p>` does nothing, so space cards with `gap`, not margins.**
    Quasar's unlayered paragraph rule wins twice over: every `<p>` in this repo
    carries `margin-bottom: 16px`, and a layered `mt-3` on it computes to
    `margin-top: 0`. A card written as `icon` / `mt-3 title` / `mt-1.5 body` /
    `mt-3 footer` therefore renders as a flat 16px rhythm that ignores all three
    values — **including sixteen pixels of dead space under the last line**,
    which is what knocks a card's footer off the baseline its neighbours sit on.
    It ships looking merely loose, and the next person edits `mt-3` to `mt-4` and
    sees nothing change.

    Lay the card out with a grid instead. Grid `gap` has no Quasar counterpart, so
    it applies, and it is also how you pin a footer:

    ```html
    <!-- wrong: none of these margins are the ones that render -->
    <SelectableCard>
      <span class="chip">…</span>
      <p class="mt-3 text-sm">Title</p>
      <p class="mt-1.5 text-xs">Body copy of any length.</p>
      <p class="mt-3 text-xs">Outcome →</p>
    </SelectableCard>

    <!-- right: gap for rhythm, `1fr auto` for the footer, and `sfere-flush` on
         the wrapper so the inert margin stops adding itself to the gap -->
    <SelectableCard>
      <div class="grid h-full w-full grid-rows-[1fr_auto] gap-5">
        <div class="grid content-start gap-3.5">
          <span class="chip">…</span>
          <div class="sfere-flush grid min-w-0 gap-1.5">
            <p class="text-sm">Title</p>
            <p class="text-xs">Body copy of any length.</p>
          </div>
        </div>
        <div class="border-t border-sfere-line pt-4">Outcome →</div>
      </div>
    </SelectableCard>
    ```

    Reach for the grid row rather than `mt-auto!`: `SelectableCard`'s own `flex`
    is Quasar's _wrapping_ flex (rule 10), and auto margins in a wrapping column
    container resolve per flex line. `grid-rows-[1fr_auto]` puts the footer on the
    bottom edge by construction, so a row of cards stays aligned through any copy
    edit. `SourceIntentPicker.vue` is the worked example.

    **Three of the worst cases are now handled centrally, in `src/css/sfere.css`,
    so you do not have to spot them.** They are the ones where the phantom margin
    can never be what the author meant:

    | Rule                                                 | Fixes                                                                                                 |
    | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
    | `[class~='items-center'] > p` (and `items-baseline`) | a `<p>` sharing a row with a control: `items-center` centres the MARGIN box, so the text sat 8px high |
    | `p:last-child`                                       | the 16px of dead space under a card's last line                                                       |
    | `.sfere-flush > p` (opt-in class)                    | a container that already spaces its children with grid/flex `gap`                                     |

    That row case is what QA reported as "text not vertically centred": "Pick one
    to continue." floated above its Continue button, the setup strip's line above
    "See full setup progress", and `SourceCreatePage`'s "Setting up …" above
    Change. All three were the same 8px, and all three are fixed by the first rule
    without touching the screens.

    There is deliberately **no blanket `p { margin: 0 }`**. Stacked prose still
    wants its rhythm, and a global reset would retighten every screen at once with
    no gate able to see it — `pnpm smoke:dist` checks console errors and `<h1>`s,
    not spacing. Where a parent owns the spacing, say so with `sfere-flush` (see
    `NoticeBanner.vue`) or kill the margin per element with `m-0!`.

12. **Do not size a card grid with `auto-fit`.** `grid-cols-1 sm:grid-cols-2` and
    friends expand to `repeat(N, minmax(0, 1fr))`, which is safe.
    `grid-cols-[repeat(auto-fit,minmax(260px,1fr))]` is not: an `auto-fit` track
    is min-content-sized in the first pass, the min-content height of a
    `SelectableCard` (a Quasar wrapping flex, rule 10) at that width is enormous,
    and the row keeps the tall measurement. Measured on `/sources/new`: 219px
    cards became **637px at every viewport**, columns still resolving to a
    perfectly normal 328px, so nothing about the width looks wrong.

    When a viewport breakpoint is the wrong question — `MainLayout`'s sidebar
    collapses without changing the viewport width, so the same 1024px window has
    two very different content widths — use a **container query** over explicit
    tracks:

    ```html
    <div class="@container">
      <div
        class="grid grid-cols-1 gap-5 @min-[34rem]:grid-cols-2 @min-[52rem]:grid-cols-3"
      ></div
    ></div>
    ```

    For a picker whose card count is data-driven and small, a growing flex row
    (`flex flex-wrap gap-5` + `max-w-full grow basis-64` on each card) beats fixed
    tracks: two cards take half the row each instead of two thirds with a hole
    beside them. `SourceTemplatePicker.vue` is the worked example.

    One thing the gutter owes the card: **match it to the card's own padding.**
    `gap-3` against `p-5` is what makes a grid read as crowded rather than as a
    set of choices.

13. **Never put an `@container` inside `class="flex flex-col"`.** Rule 10's
    collision has a second, worse form. Quasar's unlayered `.flex` sets
    `flex-wrap: wrap`, so `flex flex-col` is a _wrapping column_ flex — and a
    child carrying `container-type: inline-size` inside one is measured at
    min-content height and keeps the answer, exactly as rule 12's `auto-fit`
    track does. Measured on `/sources/new`: the 458px intent-card grid rendered
    as a **2314px** block, i.e. roughly 1850px of blank page under step 1, with
    the cards themselves at a perfectly correct 219px. Setting
    `flex-wrap: nowrap` on the parent alone collapsed it to 458px and the
    document from 2762px to 906px.

    Use `grid gap-N` for the wrapper instead. Grid `gap` has no Quasar
    counterpart so it applies (rule 11), and a grid parent measures the
    container child at its content height. `SourceIntentPicker.vue` is the
    worked example.

    The tell is a page that scrolls far past its content with nothing in the
    gap, where every individual element measures correctly. Check the ancestor
    chain of the `@container`, not the cards.

14. **A form's submit row is `StickyActionBar`, not a bare `<div class="flex">`.**
    House rule, not a per-screen choice: a long create form used to hide its own
    Create button below the fold, so submitting meant scrolling to the end and
    hoping. The bar is `sticky bottom-[var(--app-footer-h,0px)]` — pulled up into
    view while its natural position is below the fold, settling exactly at the
    end of the form once you reach it.

    Three things it needs from the screen:

    - **Put it last in the `<form>`.** Sticky resolves against the parent's
      padding box, so the form is the travel range. A trailing "nothing is
      persisted yet" note goes _inside_ the bar (`min-w-0 flex-1`), not after it.
    - **The form container must be `grid`, not `flex flex-col`** — same reason as
      rule 13, and a wrapping column flex resolves the bar's position per flex
      line.
    - **`align="end"`** for the single-Continue step of a guided flow;
      the default `start` for the usual primary-then-secondary row.

    The offset is a variable rather than `0` because `DemoModeBanner` is a
    `q-footer` fixed to the viewport bottom, and sticky offsets resolve against
    the viewport, not against the padding `q-page-container` reserves for it.
    `MainLayout` publishes the banner's height on `.q-layout` as
    `--app-footer-h`; it is `0px` in real-data mode.

    Not every `type="submit"` wants this. `/login` is a centred card outside
    `MainLayout`, Profile search is a filter row rather than a create, and the
    Settings panels each hold several independent forms — stacking a sticky bar
    per panel would dock several of them at once.

15. **A control inside `q-header` inherits white text, and a layered `text-*`
    cannot stop it.** Quasar ships an unlayered `.q-header { color: #fff }` and an
    unlayered `.q-btn { color: inherit }`. A layered `text-ink` on the header does
    not match the button at all, and the one on the header loses to Quasar's own
    rule, so every child that does not set its own colour renders white — on a
    `bg-white!` bar, invisible.

    This is not hypothetical: it is how the responsive nav toggle disappeared.
    The hamburger was present, focusable and clickable at every width under
    1024px; it was drawn in white on white, so the app looked like it had no
    navigation at all below that breakpoint. It reads as a missing feature and was
    filed as one.

    Two halves to the fix, and both are needed:

    ```html
    <!-- 1. the important SUFFIX on the header's own colour -->
    <q-header class="bg-white! text-ink! border-b border-line">
      <!-- 2. a control that carries its own colour rather than inheriting -->
      <SfereIconButton label="Open navigation" icon="menu" variant="ghost" />
    </q-header>
    ```

    The same trap sits on `lg:hidden`: `.q-btn`'s unlayered `display: inline-flex`
    beats a layered `hidden`, so a `q-btn` marked `lg:hidden` stays visible on
    desktop. Write `lg:hidden!`. A kit component whose root is a plain `<span>`
    (`SfereIconButton`, via `SfereTooltip`) has no unlayered competitor and does
    not need the suffix — it carries it anyway, so the class survives a later swap
    back to a Quasar control.

16. **Repeated row actions collapse into one `RowActionsMenu`, not into bare
    glyphs.** A list row used to carry its verbs as two or three bordered text
    buttons in the last cell. That costs a 120–230px column on every screen and
    keeps a Delete nobody clicks in permanent competition with the data beside
    it. The kebab spends one 36px cell and shows the verbs when asked.

    ```html
    <!-- inside <template #cell-actions="{ row }"> -->
    <RowActionsMenu
      :label="`Actions for ${row.name}`"
      :actions="rowActions(row)"
      @select="onRowAction(row, $event)"
    />
    ```

    `actions` is `[{ key, label, icon?, tone? }]` and `select` emits the key.
    Build it in a **function** where a label depends on the row (`Pause` vs
    `Enable`), and a module constant where it does not.

    **It opens nothing and confirms nothing.** The page keeps its own
    `ConfirmDialog`s, its own separate `toggleTarget` and `target` refs, and its
    own per-screen copy, so an icon-only control inherits both halves of the
    house rule below unchanged: a name a screen reader can read, and a confirm
    that states the consequence. A menu item's label should be word-for-word the
    confirm button it opens — "Move to trash", not "Delete", if that is what the
    dialog says.

    Five things a caller gets wrong once:

    - **`label` is required and is the row's noun.** It is both the
      `aria-label` on the trigger and the accessible name of the `role="menu"`.
      A teleported menu is the one control where "which row is this?" cannot be
      answered by looking.
    - **No tooltip**, unlike `SfereIconButton`. A `SfereTooltip` bubble is
      clipped by the same table scroller the menu teleports out of, and a native
      `title` on top of an `aria-label` is announced as the description — the
      same sentence twice.
    - **An empty `actions` array is a dead control.** `openMenu()` returns early
      on `[]`, so a page whose only action is conditional renders **no trigger**
      (`v-if="!row.isManaged"`), never an empty menu.
    - **Icons are per-menu, not per-app.** An item lays out as
      `flex items-center gap-2`, so one icon-less entry beside iconed ones
      starts its label a glyph's width to the left, and every item is on screen
      at once. All of a menu's items carry a glyph or none do — and none is
      right when `sfereIcons.js` has no honest mark for the verb ("Send test",
      "Sync now", "Test connection").
    - **No page-level `@click.stop`.** See the carve-out under the `@click.stop`
      house rule below.

    The actions column becomes 72px wide — a 36px trigger plus the cell's
    `px-4` on each side — declared as
    `{ key: 'actions', label: '', align: 'right', width: '72px' }`. No
    wrapper element around the component: `align: 'right'` already puts
    `text-right` on the `<td>` and the menu's root is `inline-grid`, so a
    `flex items-center justify-end` wrapper would only re-open one more of
    Quasar's unlayered wrapping `.flex` containers (rule 10).

    **A kebab is not automatic.** One action with no second reading keeps its
    labelled button — a one-item menu costs a click and shows no verb. The
    exception is consistency across a set of sibling screens: `/destinations`
    and `/pipes` carry one-item kebabs so the last column means the same thing
    on all three live domains, and each file says not to simplify it back
    without changing all three.

17. **A back control is bordered and filled at rest, not a ghost.**
    `PageHeader`'s manifest-driven back link is `variant="secondary"`. It shipped
    as `variant="ghost"`, which is bare text on the page background that only
    grows a surface on hover — so on all 15 sub-screens the one way back out of a
    drill-down did not look pressable until the pointer happened to be over it,
    and on touch there is no "happened to be over it".

    Two details that look like tidying and are not:

    - **No `-ml-4`.** That negative margin existed to pull _ghost padding_ off
      the left so the link's text lined up with the `<h1>`. A bordered pill has a
      visible edge, so the same margin hangs the border into the gutter. It is
      `mb-2` and nothing else.
    - **No instance class softening weight or colour.** `font-medium` against the
      variant's own `font-semibold` is two layered utilities in one layer, so
      which one wins is Tailwind's output ordering, not the order written in the
      template. At 13px beside a 24px display `<h1>` there is nothing to soften.

    The rule generalises: a navigation control that is the only way out of a
    screen states itself at rest. Hover-revealed affordance is for a control the
    reader can already see they do not need.

---

## House rules for screens

Rules 1–17 are about the primitives. These are about how a screen uses them, and
every one of them is a bug wave 1 hit or narrowly avoided.

### A missing `:id` is empty, not an error

A detail route whose record does not exist renders `EmptyState`. **Never**
`ErrorState`. The fetch succeeded — the answer was "no such record", which is
information, not failure. `ErrorState` carries `data-smoke="error"`, so getting
this wrong makes the smoke gate report a perfectly working screen as broken.

```vue
<!-- WRONG: the load worked; there is just no record with that id -->
<ErrorState v-else-if="!source" title="Source not found" />

<!-- RIGHT -->
<EmptyState
  v-else-if="!source"
  title="Source not found"
  description="It may have been deleted. Check the trash, or pick another from the list."
>
  <template #cta>
    <button
      class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
      @click="router.push({ name: 'sources' })"
      >All sources</button
    >
  </template>
</EmptyState>
```

`ErrorState` is for a request that **failed** — network error, non-2xx, bad
payload. Nothing else.

### Two distinct empty states per list

A list that renders no rows is in one of two situations, and they need different
copy and different CTAs:

| Situation             | Title                    | CTA                |
| --------------------- | ------------------------ | ------------------ |
| Filters matched none  | "No X match your search" | **Clear filters**  |
| Nothing exists at all | "No X yet"               | primary create CTA |

Offering "Create your first source" to someone who has forty sources and a typo
in the search box is the failure mode. Both branches go through `EmptyState`, so
the smoke run still sees `data-smoke="empty"` either way.

If the screen only ever has the second case, skip the slot entirely and use
`DataTable`'s `empty-cta-label` / `empty-cta-to` props.

### Every H1 owes a purpose line

`PageHeader` / `SferePageHeader` take a `subtitle`, and on a screen it is not
optional: **one plain sentence saying what this section is for**, under every
`<h1>`, no exceptions. It is the cheapest documentation in the product and the
only one that is guaranteed to be read.

A purpose line is a sentence, not a label. It says what the thing is for and who
would want it — not what the page is called again in other words:

```vue
<!-- WRONG: a label wearing a sentence's clothes -->
<PageHeader title="Pipes" subtitle="Manage your pipes" />

<!-- RIGHT -->
<PageHeader
  title="Pipes"
  subtitle="A pipe takes events from one source, reshapes them, and delivers them to one destination."
/>
```

Two tests it has to pass. It names the object in plain words rather than
repeating the nav label, and someone who has never seen the screen could say
what it is for after reading it once.

### Dependent empty states explain the dependency

Some screens cannot have any rows until something else exists first. `/pipes`
needs a source and a destination; `/journeys` and `/audiences` need a fan
population. On those screens the "nothing exists yet" empty state must **name
the dependency and link to it** — never offer a create CTA that leads to a form
the user cannot complete.

```vue
<!-- WRONG: the button opens a form with two empty required pickers -->
<EmptyState title="No pipes yet" description="Create your first pipe.">

<!-- RIGHT -->
<EmptyState
  title="No pipes yet"
  description="A pipe connects one source to one destination, so you need both before you can build one."
>
  <template #cta>…Connect a source…</template>
</EmptyState>
```

A dead CTA is worse than no CTA: it costs the user a page load, a form and a
guess before the product admits the answer is somewhere else.

### Secondary resources degrade in place

A screen usually loads one **primary** resource (the thing the route is named
for) and zero or more **secondary** ones (a template catalog, a related list,
counters). Only the primary resource's failure escalates to a page-level
`ErrorState`. A secondary failure renders its own small `ErrorState` inside the
panel it belongs to, with its own retry, and the rest of the screen keeps
working.

`SourceDetailPage` is the reference: the source itself failing is a page-level
error, but the template catalog failing only breaks the Template tab.

### `@click.stop` on row actions

When `clickable-rows` is set, `DataTable` fires `row-click` from the `<tr>`.
A button inside a `cell-*` slot sits inside that `<tr>`, so its click bubbles and
you navigate away instead of pausing the row.

```html
<!-- inside <template #cell-actions="{ row }"> on a clickable-rows table -->
<button @click.stop="toggle(row)">Pause</button>
```

The modifier is harmless on a non-clickable table, so add it to every row action
button and stop thinking about it.

**`RowActionsMenu` is the one carve-out, and adding `.stop` to it is not wrong,
just redundant.** It stops its own trigger click and its own menu root, and its
items are teleported to `<body>`, so nothing it fires passes through the `<tr>`.
`select` is a component emit, which does not bubble at all. Every list screen
that swapped its buttons for the menu passes no modifier.

### Dates: pinned locale, `timeZone: 'UTC'`

`toLocaleDateString()` with no arguments renders differently on the smoke
runner, on a dev box in another region, and in CI. Every formatter pins both the
locale and the zone, so the same ISO string always produces the same characters:

```js
const DATE = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
})
```

Numbers are the same story: `Number(n).toLocaleString('en-GB')`. Formatting
lives in the composable, never in the component — `StatCard`, `DefinitionList`
and `DataTable` all render whatever string you hand them.

---

## Component reference

All components live in `src/components/ui/` and are imported by path:

```js
import DataTable from '@/components/ui/DataTable.vue'
```

**These are Sfere components.** The originals were replaced in place by
implementations built on the Sfere token layer, keeping their filenames so no
screen had to change its imports. Two props were renamed in that swap and the
tables below reflect the current API: `StatusBadge` takes **`tone`**, not
`variant`, and has no `enabled`; `FormField` takes **`for-id`**, not `for`.

The folder also holds twenty-three components with `Sfere*` names —
`SfereButton`, `SfereInput`, `SfereTable`, `SfereSection` and friends — which
have no pre-Sfere counterpart. They are documented in
`docs/sfere-design-system.md` and rendered at `#/design-system`.

### PageHeader.vue

Page title block. Sits at the top of every `q-page`.

| Prop       | Type    | Default | Notes                                                |
| ---------- | ------- | ------- | ---------------------------------------------------- |
| `title`    | String  | `''`    | the `<h1>` — 24px, display face                      |
| `subtitle` | String  | `''`    | **the purpose line.** One sentence, on every screen  |
| `eyebrow`  | String  | `''`    | section label above the title — `Collect`, `Act`     |
| `onDark`   | Boolean | `false` | only for a header inside a `SfereSection tone="ink"` |
| `back`     | Object  | —       | back target override; see below. `null` suppresses   |

| Slot       | Scope | Notes                                          |
| ---------- | ----- | ---------------------------------------------- |
| `title`    | —     | overrides the `title` prop for rich content    |
| `subtitle` | —     | overrides the `subtitle` prop for rich content |
| `eyebrow`  | —     | replaces the `eyebrow` prop's `SfereEyebrow`   |
| `actions`  | —     | right-hand buttons / search box                |

No events.

**Reach for the `#eyebrow` slot only when the line is not a section label.** The
prop is the normal way in and renders `SfereEyebrow`, which is mono, uppercase
and 0.18em-tracked by design and deliberately exposes no way to soften that — the
wide tracking is the whole effect. One line in the app is not that: the
Dashboard's `Hello Anas 👋`, which through the prop would be shouted in the voice
reserved for `COLLECT` and `ACT`. Whatever goes in the slot stays a `<p>`, above
the `<h1>`, for the reason the back link does: `scripts/smoke.mjs` asserts on the
first heading and that belongs to the page.

**The back link is not something a page passes.** `PageHeader` reads
`route.meta.parent` — the `parent: { name, label }` field on the screen's entry
in `src/router/screens.js` — and renders `← <label>` above the `<h1>` on every
screen that has one. Give a sub-screen its back link by declaring the parent in
the manifest, not by adding a button to the header's `#actions`; a page that does
both ships two ways back on one row, which is what the seven hand-rolled
"All sources" / "All pipes" buttons were.

Three consequences worth keeping:

- **Top-level screens get no back link, on purpose.** The sidebar is their nav
  and their row is already highlighted. An arrow there points nowhere.
- **It is a `router-link`, above the title, never beside it.** Beside it would
  have to align a control against an `items-start` row whose first text is a 24px
  cap height, and it would compete with `#actions` on the same line. Above it,
  the `<h1>` is still the first heading on the page — which is what
  `scripts/smoke.mjs` asserts on.
- **It is not `router.back()`.** History is empty on a cold load, which is every
  deep link and every route the smoke run visits, so the case where the control
  matters most is the case history cannot answer.

Pass `back` only to override the manifest — an object to point somewhere else,
`null` to suppress it on a screen that has a parent but should not offer the trip
back mid-flow.

**The link is `variant="secondary"`, bordered and filled at rest.** Rule 17 has
the reasoning and the two things not to undo (`-ml-4` is gone with the ghost, and
no instance class softens the weight). Appearance only — the props, the slots and
the `back` override are unchanged.

### EmptyState.vue

"Nothing here yet" panel. Renders `data-smoke="empty"` **in both variants**.

| Prop          | Type                 | Default  | Notes     |
| ------------- | -------------------- | -------- | --------- |
| `title`       | String               | —        | required  |
| `description` | String               | `''`     |           |
| `variant`     | `'card' \| 'inline'` | `'card'` | see below |
| `onDark`      | Boolean              | `false`  |           |

| Slot   | Scope | Notes                                                 |
| ------ | ----- | ----------------------------------------------------- |
| `icon` | —     | inline SVG, rendered in a tinted chip. **Not a prop** |
| `cta`  | —     |                                                       |

No events.

The icon is a **slot taking inline SVG**, not a URL prop as it once was: the CSP
is `default-src 'self'` and `assetsInlineLimit` is `0`, so an inline glyph is
the only form that costs no extra request.

`card` is the full bordered surface — the default, and what a whole screen or a
`DataTable` empty state uses. `inline` is a compact centred hint with no border
and no background, for an empty state **nested inside** a `CardPanel` (a column
of `PipelineFlowPanel`, a short list like `ActivityList`), where a bordered card
inside a bordered card reads as a rendering bug. Reach for `inline` instead of
hand-rolling a `<p class="py-2 text-sm text-subtle">`: the hand-rolled version
loses `data-smoke="empty"`.

```html
<EmptyState
  v-if="!column.items.length"
  variant="inline"
  title="Connect a source to start collecting fan signals."
/>
```

### CardPanel.vue

The surface everything else sits on. 16px radius, hairline border, and **no
shadow at rest** — elevation is reserved for things that float, so a grid of
cards reads as one plane. (It is `SfereCard` under the filename.)

| Prop             | Type                           | Default     | Notes                                                |
| ---------------- | ------------------------------ | ----------- | ---------------------------------------------------- |
| `tone`           | `'surface' \| 'soft' \| 'ink'` | `'surface'` | `ink` belongs inside a dark section and nowhere else |
| `padded`         | Boolean                        | `true`      | `false` for full-bleed content (e.g. a table)        |
| `interactive`    | Boolean                        | `false`     | lifts and warms the border on hover — links only     |
| `gradientBorder` | Boolean                        | `false`     | the brand corner fade. At most one card per view     |

| Slot     | Scope | Notes                              |
| -------- | ----- | ---------------------------------- |
| default  | —     | body                               |
| `header` | —     | adds a bordered bar above the body |
| `footer` | —     | adds a bordered bar below it       |

No events.

### ErrorState.vue

The failure surface. **Renders `data-smoke="error"` on its root.**

| Prop         | Type    | Default                   |
| ------------ | ------- | ------------------------- |
| `title`      | String  | `'Something went wrong'`  |
| `message`    | String  | `''` — the raw error text |
| `retryLabel` | String  | `'Retry'`                 |
| `onDark`     | Boolean | `false`                   |

| Event   | Payload                                |
| ------- | -------------------------------------- |
| `retry` | — (fired by the built-in Retry button) |

No slots.

### LoadingState.vue

Skeleton placeholder.

| Prop      | Type                          | Default   | Notes                                     |
| --------- | ----------------------------- | --------- | ----------------------------------------- |
| `variant` | `'table' \| 'grid' \| 'form'` | `'table'` |                                           |
| `rows`    | Number                        | `6`       | bars for `table`/`form`, cards for `grid` |
| `onDark`  | Boolean                       | `false`   |                                           |

No slots, no events.

Bar heights track the kit's own controls — 40px for a field, 32px for a table
row — so nothing jumps when the data lands.

### DataTable.vue

The list-screen workhorse. Owns sorting, paging and all three non-populated
states, and renders the rows through `SfereTable` rather than carrying a second
`<table>` of its own.

| Prop               | Type             | Default              | Notes                                                                                                                   |
| ------------------ | ---------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `columns`          | Array            | `[]`                 | `{ key, label, sortable?, align?, width? }`; `align` is `'left' \| 'center' \| 'right'`, `width` is a CSS length string |
| `rows`             | Array            | `[]`                 | the **full** set — the component slices it                                                                              |
| `loading`          | Boolean          | `false`              | renders `LoadingState variant="table"`                                                                                  |
| `error`            | String \| null   | `null`               | renders `ErrorState`                                                                                                    |
| `rowKey`           | String           | `'id'`               | falls back to array index                                                                                               |
| `emptyTitle`       | String           | `'Nothing here yet'` |                                                                                                                         |
| `emptyDescription` | String           | `''`                 |                                                                                                                         |
| `emptyCtaLabel`    | String           | `''`                 | button text on the default empty state                                                                                  |
| `emptyCtaTo`       | Object \| String | `null`               | router location, e.g. `{ name: 'sources-new' }`                                                                         |
| `perPage`          | Number           | `25`                 |                                                                                                                         |
| `clickableRows`    | Boolean          | `false`              | adds `cursor-pointer` and enables `row-click`                                                                           |
| `onDark`           | Boolean          | `false`              | for a table inside a dark section                                                                                       |

| Slot         | Scope            | Notes                                                 |
| ------------ | ---------------- | ----------------------------------------------------- |
| `cell-<key>` | `{ row, value }` | one per column key; default renders `row[key]`        |
| `toolbar`    | —                | search / filter chips, above the card, in every state |
| `empty`      | —                | replaces the default `EmptyState` entirely            |
| `empty-cta`  | —                | replaces just the CTA inside the default `EmptyState` |

| Event       | Payload                           |
| ----------- | --------------------------------- |
| `row-click` | `row` (only when `clickableRows`) |
| `retry`     | — (forwarded from `ErrorState`)   |

State precedence: `loading` → `error` → empty → populated.

**Empty-state CTA.** There are three levels, in order of how much you need:

1. `empty-cta-label` + `empty-cta-to` — the common case. Both must be set;
   renders the primary button as a `<router-link>`. No slot needed.
2. `#empty-cta` — a CTA the props cannot express (a `@click` handler, two
   buttons, a `:disabled`). The title and description still come from
   `empty-title` / `empty-description`.
3. `#empty` — you own the whole empty state. This is the level the two-case
   pattern needs, because the title and description differ per branch too.

```html
<!-- 1. one CTA, no slot -->
<DataTable
  :rows="rows"
  empty-title="No sources yet"
  empty-description="Connect a source to start collecting fan signals."
  empty-cta-label="New source"
  :empty-cta-to="{ name: 'sources-new' }"
/>

<!-- 3. the two-case pattern (see the house rules above) -->
<template #empty>
  <EmptyState
    v-if="sources.length"
    title="No sources match your filters"
    description="Nothing matched that search or tab."
  >
    <template #cta>
      <button class="…tertiary…" @click="clearFilters">Clear filters</button>
    </template>
  </EmptyState>

  <EmptyState v-else title="No sources yet" description="…">
    <template #cta>
      <button class="…primary…" @click="router.push({ name: 'sources-new' })"
        >Connect your first source</button
      >
    </template>
  </EmptyState>
</template>
```

### StatusBadge.vue

| Prop    | Type                                                                  | Default   | Notes                              |
| ------- | --------------------------------------------------------------------- | --------- | ---------------------------------- |
| `tone`  | `'brand' \| 'neutral' \| 'success' \| 'warn' \| 'danger' \| 'onDark'` | `'brand'` | **not `variant`**                  |
| `label` | String                                                                | `''`      |                                    |
| `dot`   | Boolean                                                               | `false`   | leading status dot in the same hue |

| Slot    | Scope                     |
| ------- | ------------------------- |
| default | — (falls back to `label`) |

No events.

**Two things changed when the Sfere kit replaced this**, and both bite from
memory:

- The prop is **`tone`**, not `variant`.
- There is **no `enabled` shorthand.** Write the ternary out:
  `:tone="row.isEnabled ? 'success' : 'neutral'"`. `enabled` read as on/off next
  to a prop called `variant`; next to `tone` it looks like it might tint rather
  than switch.

The default is also `brand`, where this used to default to `neutral` — every
call site in the repo passes a tone, but a bare `<StatusBadge>` comes out
purple.

### StatCard.vue

| Prop        | Type                                         | Default      | Notes                                         |
| ----------- | -------------------------------------------- | ------------ | --------------------------------------------- |
| `label`     | String                                       | — (required) |                                               |
| `value`     | String \| Number                             | `''`         | pre-formatted — the card does no formatting   |
| `delta`     | String                                       | `''`         | e.g. `'4%'`; hidden when empty                |
| `direction` | `'up' \| 'down' \| 'flat'`                   | `'up'`       | **not `deltaDirection`**                      |
| `hint`      | String                                       | `''`         | muted caption line under the value            |
| `tone`      | `'neutral' \| 'warn' \| 'danger' \| 'brand'` | `'neutral'`  | tints the whole card                          |
| `bare`      | Boolean                                      | `false`      | drops the border and padding to sit in a card |
| `onDark`    | Boolean                                      | `false`      |                                               |

| Slot    | Scope | Notes                                          |
| ------- | ----- | ---------------------------------------------- |
| default | —     | the **value**, for rich content — not the hint |
| `hint`  | —     | rich `hint`; wins over the prop when present   |

No events.

Note the default slot: it fills `value`, not `hint`. A rich hint goes in the
named `#hint` slot.

`delta` is a **trend** — "this moved by X since last period" — and always draws
an arrow in a trend colour. Anything that is not a trend goes in `hint`.
`'1.65× fan-out'` and `'37 errors'` are captions, and pushing them through
`delta` gets them a red down-arrow they did not earn.

`tone` is the other half of that rule. It tints the SURFACE and leaves the
figure alone, for the one card in a row that is a problem rather than a
measurement — "1 needs attention" beside three neutral counts. Use it on at most
one card per row: three tinted cards tint nothing.

```html
<StatCard label="Events delivered (last hour)" value="1.2M" delta="4%" />
<StatCard label="Error rate (last hour)" value="0.31%" hint="37 errors" />
<StatCard
  label="Needs attention"
  value="1"
  hint="One thing to check"
  tone="warn"
/>
```

### DefinitionList.vue

The label → value read-out for detail screens. Use this instead of hand-rolling
a `<dl>` — before it existed, four screens each carried their own copy.

| Prop      | Type     | Default | Notes                                    |
| --------- | -------- | ------- | ---------------------------------------- |
| `items`   | Array    | `[]`    | `{ label, value, hint? }`                |
| `columns` | `1 \| 2` | `2`     | `2` is responsive: one column below `sm` |
| `onDark`  | Boolean  | `false` |                                          |

| Slot                 | Scope                   | Notes                              |
| -------------------- | ----------------------- | ---------------------------------- |
| `value-<label-slug>` | `{ item, value, slug }` | replaces one row's value rendering |

No events.

`value` is pre-formatted — the component does no date or number formatting, same
as `StatCard`. `null`, `undefined` and `''` render as an em dash in `text-subtle`
rather than as a blank line, so a "not set" row still reads as a row.

The slot name is the label lowercased with every run of non-alphanumerics
collapsed to a hyphen: `"Pipe ID"` → `#value-pipe-id`, `"Source type"` →
`#value-source-type`. Use it to put a `StatusBadge`, a link or a copy button in
a row.

`columns=1` is the stacked shape — label left, value right, `divide-y` between
rows — and suits a narrow sidebar card. `columns=2` is the wide grid — label
above value, two per row from `sm` up — and suits a full-width panel.

```vue
<DefinitionList :items="facts" :columns="1">
  <template #value-source="{ item }">
    <router-link
      :to="{ name: 'sources-detail', params: { id: item.value.id } }"
      class="font-medium text-brand hover:underline"
      >{{ item.value.name }}</router-link
    >
  </template>

  <template #value-status>
    <StatusBadge
      :tone="pipe.isEnabled ? 'success' : 'neutral'"
      :label="pipe.isEnabled ? 'Enabled' : 'Paused'"
    />
  </template>
</DefinitionList>

<script setup>
const facts = computed(() => [
  { label: 'Pipe ID', value: pipe.value.id },
  { label: 'Status', value: pipe.value.isEnabled },
  {
    label: 'Source',
    value: { id: pipe.value.sourceId, name: pipe.value.sourceName }
  },
  { label: 'Created', value: formatDateTime(pipe.value.createdAt) },
  {
    label: 'Batch size',
    value: pipe.value.batchSize,
    hint: 'Events per delivery'
  }
])
</script>
```

### SelectableCard.vue

A picker card that is a real `<button type="button">` — focusable, keyboard
activatable, and carrying `aria-pressed`. Template pickers recur across the
create screens; this is the one that is accessible without wrapping `CardPanel`
in a button by hand.

| Prop       | Type    | Default | Notes                                          |
| ---------- | ------- | ------- | ---------------------------------------------- |
| `selected` | Boolean | `false` | draws `ring-2 ring-brand`, sets `aria-pressed` |
| `disabled` | Boolean | `false` | suppresses hover and the `select` event        |
| `onDark`   | Boolean | `false` |                                                |

| Slot    | Scope                    |
| ------- | ------------------------ |
| default | `{ selected, disabled }` |

| Event    | Payload |
| -------- | ------- |
| `select` | —       |

No payload on `select` — the parent already knows which card it rendered. The
focus ring is an `outline`, not a `ring`, because `ring` is spent on the selected
state; a selected card would otherwise show no focus at all.

```html
<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
  <SelectableCard
    v-for="t in templates"
    :key="t.id"
    :selected="modelValue === t.id"
    @select="emit('update:modelValue', t.id)"
  >
    <div class="flex w-full items-start justify-between gap-2">
      <span class="text-sm font-medium text-ink">{{ t.name }}</span>
      <StatusBadge v-if="modelValue === t.id" tone="brand" label="Selected" />
    </div>
    <p class="mt-1.5 text-xs leading-5 text-muted">{{ t.description }}</p>
  </SelectableCard>
</div>
```

### NoticeBanner.vue

An inline notice for "the screen worked, but there is something you should
know" — the cascade warning on a trash screen, a degraded check on a health
screen. It deliberately carries **no** `data-smoke` attribute: a notice is not a
failure, and it must not trip the smoke gate.

| Prop          | Type                                        | Default  | Notes             |
| ------------- | ------------------------------------------- | -------- | ----------------- |
| `tone`        | `'info' \| 'success' \| 'warn' \| 'danger'` | `'info'` | **not `variant`** |
| `title`       | String                                      | `''`     |                   |
| `message`     | String                                      | `''`     |                   |
| `dismissible` | Boolean                                     | `false`  | adds a close ×    |
| `collapsible` | Boolean                                     | `false`  | see below         |

| Slot    | Scope | Notes                                         |
| ------- | ----- | --------------------------------------------- |
| default | —     | actions or rich body, under `title`/`message` |

| Event     | Payload                                     |
| --------- | ------------------------------------------- |
| `dismiss` | — (only when `dismissible`; you own hiding) |

Its text block is a `sfere-flush grid gap-1`, not a stack of `mt-*` paragraphs.
That is rule 11 in miniature: the `mt-0.5` it used to carry computed to zero, so
title and message rendered on Quasar's flat 16px rhythm with another 16px of dead
space under the last line — which is what pushed the copy to the top of the
banner and read as "text not vertically centred".

`collapsible` turns the title into a real `<button type="button">` carrying
`aria-expanded` and `aria-controls`, and hides the default slot behind it until
clicked. It is **default off**, which is what makes it a safe addition to a file
every screen renders: not one existing banner changes. Three notes.

It only does anything with slot content — a banner whose whole payload is `title`
has nothing to disclose, so the branch is guarded on `$slots.default` too. Its
chevron uses a conditional class (`:class="expanded ? 'rotate-90' : ''"`), never
a `rotate-0` variant, because Quasar's unlayered `.rotate-90` means a layered
utility can turn the rotation on and can never turn it off — rule 2's collision,
and the same pattern `MainLayout` uses. And it is for a list that is a
distraction to one reader and the point of the screen to another — the Dashboard's
needs-attention list, which an engineer wants open and a marketer wants as a
count. It is **not** a way to make a long banner shorter: if the detail is not
worth a click, it is not worth the banner.

Use this rather than stretching a `StatusBadge` — a badge is a pill sized for one
or two words, and a whole sentence in one looks like a bug. `info` is brand,
`warn` is amber, `danger` is rose; a genuine load failure is still `ErrorState`,
not `NoticeBanner tone="danger"`.

```html
<NoticeBanner
  v-if="cascadeCount"
  tone="warn"
  title="Some of these cannot be restored on their own"
  :message="`${cascadeCount} reference a source or destination that was deleted too.`"
/>
```

### IntroBand.vue

| Prop         | Type                 | Default   | Notes                                          |
| ------------ | -------------------- | --------- | ---------------------------------------------- |
| `title`      | String               | — (req.)  |                                                |
| `storageKey` | String               | `''`      | stable id for the dismissal; omit ⇒ no dismiss |
| `eyebrow`    | String               | `''`      | mono uppercase label above the title           |
| `body`       | String               | `''`      | one sentence; capped at 62ch                   |
| `points`     | Array&lt;String&gt;  | `[]`      | short ticked assurances on one wrapping row    |
| `tone`       | `'plain' \| 'brand'` | `'plain'` | `brand` for a value claim, not a definition    |

| Slot    | Notes                                              |
| ------- | -------------------------------------------------- |
| default | extra content under the copy                       |
| `aside` | a figure beside the copy — a card, a small diagram |

No events. Dismissal is written by the component through `useDismissed()`.

The teaching band at the top of a list screen: what this noun is, and why the
screen exists. **It is not a `NoticeBanner`, and the two must not be merged.** A
`NoticeBanner` reports a state of your account right now and goes away when the
state does, so it must NOT be dismissible. This is editorial — it says the same
thing on every visit and is true of every account — so it MUST be dismissible,
or it taxes the hundredth visit to pay for the first.

`storageKey` is what makes it dismissible, and omitting it is a real choice
rather than an oversight.

```html
<IntroBand
  storage-key="sources-intro"
  eyebrow="Start with where activity happens"
  title="A source connects customer activity to Sfere."
  body="Your website, online store, mobile app or your own backend can each be a source."
/>
```

### ToolbarSearch.vue

| Prop          | Type    | Default     | Notes                                          |
| ------------- | ------- | ----------- | ---------------------------------------------- |
| `modelValue`  | String  | `''`        |                                                |
| `placeholder` | String  | `'Search…'` |                                                |
| `id`          | String  | `''`        | pair with a `FormField` `for-id`               |
| `block`       | Boolean | `false`     | fill the cell instead of holding the 280px cap |
| `onDark`      | Boolean | `false`     |                                                |

| Event               | Payload |
| ------------------- | ------- |
| `update:modelValue` | String  |

Use with `v-model`. No slots. 40px tall, like every other control in the kit.

### FormSection.vue

A `CardPanel` with a heading, for grouping fields.

| Prop          | Type    | Default      |
| ------------- | ------- | ------------ |
| `title`       | String  | — (required) |
| `description` | String  | `''`         |
| `onDark`      | Boolean | `false`      |

| Slot      | Scope | Notes                              |
| --------- | ----- | ---------------------------------- |
| default   | —     | fields, in a `flex flex-col gap-4` |
| `actions` | —     | a footer bar under the fields      |

No events.

`onDark` reaches the card and its heading but **not** the fields inside it —
each `FormField` needs its own `on-dark`, or the labels stay black on black.

### FormField.vue

Label + control + hint/error. The control goes in the slot, so a page can use
`q-input`, `q-select` or a raw `<input>`.

| Prop       | Type    | Default | Notes                                  |
| ---------- | ------- | ------- | -------------------------------------- |
| `label`    | String  | `''`    |                                        |
| `hint`     | String  | `''`    | suppressed while `error` is set        |
| `error`    | String  | `''`    | replaces the hint rather than stacking |
| `required` | Boolean | `false` | **decorative** — see below             |
| `optional` | Boolean | `false` | marks the field optional instead       |
| `forId`    | String  | `''`    | **not `for`** — `for` is a JS keyword  |
| `onDark`   | Boolean | `false` |                                        |

| Slot    | Scope           |
| ------- | --------------- |
| default | — (the control) |

No events.

The control goes in the slot. Use `SfereInput`, `SfereSelect`, `SfereTextarea`,
`SfereToggle` or `SfereCheckbox` — all 40px, all sharing the same focus ring —
rather than a raw `<input>`:

```html
<FormField label="Name" for-id="pipe-name" required>
  <SfereInput id="pipe-name" v-model="name" placeholder="e.g. Club shop" />
</FormField>
```

**`required` draws an asterisk and validates nothing.** It never reaches the
control, and it cannot: `SfereInput` declares its props rather than letting
attributes fall through, so a `required` written on the component would land on
the positioning wrapper `<div>` and do nothing at all. A form that needs a value
has to check for one in JS and set `:error`. This is not a gap to be plugged
later — a native `required` raises an OS-styled bubble that vanishes on the next
keystroke, which is not the message any screen in this app wants to show.

The error and hint paragraphs are given ids derived from `for-id`
(`<for-id>-error`, `<for-id>-hint`), and the error carries `role="alert"` so a
message that appears after a failed submit is announced rather than silently
painted. Point the control at whichever is showing with `SfereInput`'s
`described-by`, which is what associates the two for a screen reader re-reading
the field later:

```html
<FormField label="Work email" for-id="login-email" :error="emailError">
  <SfereInput
    id="login-email"
    v-model="email"
    :invalid="Boolean(emailError)"
    :described-by="emailError ? 'login-email-error' : ''"
  />
</FormField>
```

`src/pages/LoginPage.vue` is the worked example: validate on submit, set the
error, focus the first field that failed, and clear the message the moment the
value it judged changes.

### ConfirmDialog.vue

| Prop           | Type    | Default           | Notes                                 |
| -------------- | ------- | ----------------- | ------------------------------------- |
| `modelValue`   | Boolean | `false`           |                                       |
| `title`        | String  | `'Are you sure?'` |                                       |
| `message`      | String  | `''`              |                                       |
| `confirmLabel` | String  | `'Confirm'`       |                                       |
| `cancelLabel`  | String  | `'Cancel'`        |                                       |
| `destructive`  | Boolean | `false`           | red confirm. Only for destroying data |
| `loading`      | Boolean | `false`           | spinner on confirm; blocks the click  |

Wraps `q-dialog` — one of the kit's two Quasar dependencies, both of them modals
(`SecretRevealDialog` is the other) — for the focus trap, Escape, scroll lock,
backdrop and teleport. Escape, the backdrop, Cancel and the × all dismiss it.
The carve-out is for a modal specifically: `RowActionsMenu` is a popover and is
hand-rolled rather than sat on `q-menu`.

| Slot    | Scope                                  |
| ------- | -------------------------------------- |
| default | — (extra body content under `message`) |

| Event               | Payload                             |
| ------------------- | ----------------------------------- |
| `update:modelValue` | Boolean                             |
| `confirm`           | — (dialog closes itself afterwards) |

### TabNav.vue

Underline tabs by default.

| Prop         | Type                    | Default       | Notes                                            |
| ------------ | ----------------------- | ------------- | ------------------------------------------------ |
| `modelValue` | String                  | `''`          | the active tab's `key`                           |
| `tabs`       | Array                   | `[]`          | `{ key, label, count? }`; `count` renders a pill |
| `variant`    | `'underline' \| 'pill'` | `'underline'` | see below                                        |
| `onDark`     | Boolean                 | `false`       |                                                  |

| Event               | Payload          |
| ------------------- | ---------------- |
| `update:modelValue` | String (tab key) |

No slots.

`underline` switches a page's primary content and carries its own `mb-4`.
`pill` is for filtering a list, sits in a tray, and carries no margin. Mixing
both on one screen makes them read as the same control.

---

## Buttons

**Read this section as history, not as instruction.** It predates the kit:
`SfereButton` exists now, with `primary` / `secondary` / `ghost` / `danger`
variants, and rule 6 says not to paste a primitive's class string into a page.
Two of the strings below are also wrong on their own terms — `disabled:opacity-*`
is a dead class everywhere in this repo, because Quasar ships an unlayered
`[disabled] { opacity: .6 }` (CLAUDE.md collision #2), and `bg-rose-600` is a
hardcoded palette value where a token belongs. Reach for `SfereButton`. What
follows is kept because a hundred-odd pre-Sfere call sites still look like it and
you will meet them:

```html
<!-- primary -->
<button
  class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
>
  <!-- secondary -->
  <button
    class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
  >
    <!-- tertiary / inline -->
    <button
      class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
    >
      <!-- destructive -->
      <button
        class="rounded-lg bg-rose-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
      ></button></button></button
></button>
```

Add `disabled:opacity-50` (or `disabled:cursor-not-allowed disabled:opacity-40`
for pagination-style controls) wherever a button can be disabled.

---

## Worked example 1 — a list page

All four states, zero bespoke markup. `DataTable` selects between them.

```vue
<template>
  <q-page class="p-6">
    <PageHeader
      title="Destinations"
      subtitle="Where resolved fan data is sent."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search destinations..." />
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="router.push({ name: 'destinations-new' })"
        >
          New destination
        </button>
      </template>
    </PageHeader>

    <DataTable
      :columns="columns"
      :rows="filtered"
      :loading="loading"
      :error="error"
      row-key="id"
      clickable-rows
      empty-title="No destinations yet"
      empty-description="Connect a destination to start activating segments."
      @retry="load"
      @row-click="
        row =>
          router.push({ name: 'destinations-detail', params: { id: row.id } })
      "
    >
      <template #cell-name="{ row }">
        <p class="font-medium text-ink">{{ row.name }}</p>
        <p class="text-xs text-subtle">{{ row.packageId }}</p>
      </template>

      <template #cell-enabled="{ value }">
        <StatusBadge
          :tone="value ? 'success' : 'neutral'"
          :label="value ? 'Enabled' : 'Paused'"
        />
      </template>
    </DataTable>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataTable from '@/components/ui/DataTable.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import { useDestinations } from '@/composables/useDestinations'

const router = useRouter()
const { destinations, loading, error, load } = useDestinations()
const query = ref('')

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'type', label: 'Type', sortable: true },
  { key: 'enabled', label: 'Status' },
  { key: 'updatedAt', label: 'Updated', sortable: true, align: 'right' }
]

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return destinations.value
  return destinations.value.filter(d => d.name.toLowerCase().includes(q))
})

onMounted(load)
</script>
```

- **loading** → `DataTable` renders `LoadingState variant="table"`.
- **error** → `DataTable` renders `ErrorState` (`data-smoke="error"`), and its
  Retry button re-emits `retry` → `load()`.
- **empty** → `DataTable` renders `EmptyState` with the `empty*` props. Add
  `empty-cta-label` + `empty-cta-to` for a one-button call to action; reach for
  `#empty` only when the two-case pattern is needed.
- **populated** → the table, sorted and paged internally.

The header and its search box render in all four states, which is deliberate:
the user can always retry or navigate away.

## Worked example 2 — a create-form page

A form has no `DataTable` to lean on, so it switches on the states itself.

```vue
<template>
  <q-page class="p-6">
    <PageHeader
      title="New destination"
      subtitle="Pick a target and give it credentials."
    />

    <LoadingState v-if="loadingCatalog" variant="form" :rows="4" />

    <ErrorState
      v-else-if="catalogError"
      title="Couldn't load the destination catalog."
      :message="catalogError"
      @retry="loadCatalog"
    />

    <EmptyState
      v-else-if="!catalog.length"
      title="No destination types available"
      description="Your workspace has no destination packages enabled yet."
    />

    <form v-else class="flex max-w-2xl flex-col gap-4" @submit.prevent="submit">
      <FormSection
        title="Basics"
        description="How this destination appears in lists."
      >
        <FormField
          label="Name"
          required
          for-id="dest-name"
          :error="errors.name"
        >
          <SfereInput
            id="dest-name"
            v-model="formState.name"
            placeholder="e.g. Meta CAPI — production"
            :invalid="Boolean(errors.name)"
          />
        </FormField>

        <FormField
          label="Type"
          required
          hint="Determines which credentials are required."
          :error="errors.type"
        >
          <q-select
            v-model="formState.type"
            dense
            outlined
            emit-value
            map-options
            options-dense
            :options="catalog"
            class="bg-white"
          />
        </FormField>
      </FormSection>

      <FormSection title="Credentials">
        <FormField label="API key" required :error="errors.apiKey">
          <input
            v-model="formState.apiKey"
            type="password"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
          />
        </FormField>
      </FormSection>

      <div class="flex items-center gap-2">
        <button
          type="submit"
          :disabled="saving"
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          {{ saving ? 'Creating…' : 'Create destination' }}
        </button>
        <button
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.back()"
        >
          Cancel
        </button>
      </div>

      <!-- Submit failure reuses the same surface as a load failure. -->
      <ErrorState
        v-if="saveError"
        title="Couldn't create the destination."
        :message="saveError"
        @retry="submit"
      />
    </form>
  </q-page>
</template>
```

Note the two `ErrorState` usages: a whole-page failure (catalog didn't load) and
an inline failure (submit rejected). Both carry `data-smoke="error"`, which is
correct — either one means the screen did not do its job.

## Worked example 3 — a trash page

Trash is a list plus a destructive confirm, and its empty state is the _good_
outcome.

```vue
<template>
  <q-page class="p-6">
    <PageHeader title="Trash" subtitle="Restoring is not available yet.">
      <template #actions>
        <SfereButton
          variant="danger"
          size="sm"
          :disabled="!items.length"
          @click="confirmEmpty = true"
        >
          Empty trash
        </SfereButton>
      </template>
    </PageHeader>

    <TabNav v-model="tab" :tabs="tabs" />

    <DataTable
      :columns="columns"
      :rows="visible"
      :loading="loading"
      :error="error"
      row-key="id"
      empty-title="Trash is empty"
      empty-description="Nothing has been deleted."
      @retry="load"
    >
      <template #cell-kind="{ value }">
        <StatusBadge tone="neutral" :label="value" />
      </template>

      <template #cell-actions="{ row }">
        <RowActionsMenu
          :label="`Actions for ${row.name}`"
          :actions="ROW_ACTIONS"
          @select="onRowAction(row, $event)"
        />
      </template>
    </DataTable>

    <ConfirmDialog
      v-model="confirmOne"
      title="Delete forever?"
      :message="`“${target?.name}” will be permanently removed. This cannot be undone.`"
      confirm-label="Delete forever"
      destructive
      @confirm="purge(target)"
    />

    <ConfirmDialog
      v-model="confirmEmpty"
      title="Empty trash?"
      :message="`All ${items.length} items will be permanently removed.`"
      confirm-label="Empty trash"
      destructive
      @confirm="purgeAll"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import TabNav from '@/components/ui/TabNav.vue'
import DataTable from '@/components/ui/DataTable.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import { useTrash } from '@/composables/useTrash'

// `useTrash` is a stand-in so this example reads as one list. The real screen's
// reader is `useTrashCollections()`, which serves three tabs off one fetch —
// see src/composables/useTrashCollections.js.
const { items, loading, error, load, restore, purge, purgeAll } = useTrash()

const tab = ref('all')
const confirmOne = ref(false)
const confirmEmpty = ref(false)
const target = ref(null)

const tabs = computed(() => [
  { key: 'all', label: 'All', count: items.value.length },
  {
    key: 'segments',
    label: 'Segments',
    count: items.value.filter(i => i.kind === 'Segment').length
  },
  {
    key: 'destinations',
    label: 'Destinations',
    count: items.value.filter(i => i.kind === 'Destination').length
  }
])

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'kind', label: 'Type', sortable: true },
  { key: 'deletedAt', label: 'Deleted', sortable: true },
  { key: 'actions', label: '', align: 'right', width: '72px' }
]

// A module constant, not a function: neither label depends on the row.
const ROW_ACTIONS = [
  { key: 'restore', label: 'Restore' },
  { key: 'purge', label: 'Delete forever', tone: 'destructive' }
]

const visible = computed(() =>
  tab.value === 'all'
    ? items.value
    : items.value.filter(i =>
        i.kind.toLowerCase().startsWith(tab.value.slice(0, 4))
      )
)

function ask(row) {
  target.value = row
  confirmOne.value = true
}

// The menu emits a key; the page still owns the confirm. `target` is NOT nulled
// inside `purge()` — `deleteMessage` reads it, so clearing it there blanks the
// dialog's own sentence while the dialog is still fading out.
function onRowAction(row, key) {
  if (key === 'restore') restore(row)
  else ask(row)
}

onMounted(load)
</script>
```

Points worth copying: an action column is `{ key: 'actions', label: '', align:
'right', width: '72px' }` with a `cell-actions` slot holding one
`RowActionsMenu` (rule 16); destructive confirmation always goes through
`ConfirmDialog` with `destructive`; and the four states are still entirely
`DataTable`'s job.

**The subtitle and the empty description are deliberately shorter than they used
to be.** Both said "kept for 30 days", and there is no retention window anywhere
in the backend to keep them: `DELETE` on a source is a hard `204` with no soft
delete and no restore call. A retention promise is the easiest false claim to
leave sitting on a trash screen, so this example no longer carries one.
`src/pages/trash/TrashPage.vue` is the shipped screen — go there for the
three-tab shape, the `?tab=` query, and the pipes tab, which is a different list
with different rules and no Restore at all.
