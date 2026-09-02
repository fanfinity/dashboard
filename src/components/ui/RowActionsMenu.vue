<template>
  <!-- `inline-grid`, not `inline-flex`: Quasar ships an unlayered
       `.inline-flex { display: inline-flex; flex-wrap: wrap }` and the layered
       utility loses to it (cascade collision #4). `inline-grid` has no Quasar
       counterpart, and keeping the wrapper inline is what lets a right-aligned
       table cell push the trigger to its right edge. -->
  <div class="inline-grid">
    <button
      ref="triggerEl"
      type="button"
      :aria-label="label"
      aria-haspopup="menu"
      :aria-expanded="isOpen ? 'true' : 'false'"
      :class="triggerClasses"
      @click.stop="toggle"
      @keydown.down.stop.prevent="openMenu(0)"
      @keydown.up.stop.prevent="openMenu(actions.length - 1)"
    >
      <SfereIcon name="dots-vertical" size="lg" />
    </button>

    <!-- Teleported to <body> for two independent reasons, either of which alone
         would clip it: SfereTable's scroller is `overflow-x-auto`, and a
         computed `overflow-x: auto` forces `overflow-y: auto` too — so a menu
         absolutely positioned in the LAST row is cut off by the frame. And
         `position: fixed` resolves against a transformed ancestor rather than
         the viewport, which several page shells have. SourceProvisionedOverlay
         teleports for the same second reason.

         Tab closes and returns focus to the TRIGGER rather than falling through
         to the next tabbable. Letting the default run would work — focus moves
         synchronously, so sequential navigation resumes from the trigger — but
         the menu lives in a Teleport at the end of <body>, so a browser that
         resolved the default against the old focus would drop the user at the
         bottom of the document. One extra keypress buys certainty. -->
    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="menuEl"
        role="menu"
        :aria-label="label"
        :style="menuStyle"
        :class="menuClasses"
        @click.stop
        @keydown.esc.stop.prevent="close(true)"
        @keydown.down.stop.prevent="move(1)"
        @keydown.up.stop.prevent="move(-1)"
        @keydown.home.stop.prevent="focusItem(0)"
        @keydown.end.stop.prevent="focusItem(actions.length - 1)"
        @keydown.tab.stop.prevent="close(true)"
      >
        <button
          v-for="action in actions"
          :key="action.key"
          type="button"
          role="menuitem"
          tabindex="-1"
          :class="itemClasses(action)"
          @click.stop="choose(action)"
        >
          <SfereIcon v-if="action.icon" :name="action.icon" size="md" />
          <!-- `min-w-0 flex-1` on the label, `shrink-0` (SfereIcon's own) on
               the glyph: Quasar's unlayered `.flex` wraps, so without this a
               long label — "Pause syncing to Snowflake Production" — drops to a
               second flex line UNDER its icon. docs/ui-conventions.md rule 10.
               A <span>, not a <p>: every <p> carries Quasar's unlayered
               `margin: 0 0 16px` (collision #5). -->
          <span class="min-w-0 flex-1">{{ action.label }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import SfereIcon from './SfereIcon.vue'
import { SFERE_BUTTON_VARIANTS } from './sfereButtonVariants.js'

// The kebab that replaces a row's pair of full-width text buttons. Every list
// screen used to print "Pause"/"Enable" and "Delete" on all ten visible rows —
// twenty controls competing with the data they act on, and the widest column on
// the table for the two least-used actions.
//
// It REPORTS a choice and does nothing else: no dialog, no mutation, no target
// ref. That is deliberate rather than minimal. Each screen keeps its own
// ConfirmDialog and its own per-row target, because two dialogs reading one
// shared row is exactly how a confirm ends up acting on the wrong record — the
// reason the twelve list screens hold a separate `toggleTarget` from `target`.
//
// It is also NOT built on q-menu, and that is a house-rule call: the kit has
// exactly one Quasar dependency (ConfirmDialog wrapping q-dialog) and
// docs/sfere-design-system.md names it as a carve-out, not a precedent. So the
// popover is hand-rolled here — teleport, fixed placement, focus management —
// which costs ~80 lines and keeps the count at one.
const props = defineProps({
  // [{ key, label, icon?: a key from sfereIcons.js, tone?: 'default' |
  //   'destructive' }]. `key` is what comes back on `select`; the page maps it.
  actions: {
    type: Array,
    default: () => [],
    validator: list =>
      list.every(
        a =>
          a &&
          typeof a.key === 'string' &&
          typeof a.label === 'string' &&
          (!a.tone || ['default', 'destructive'].includes(a.tone))
      )
  },
  // Required. It is the trigger's aria-label AND the accessible name of the
  // menu. Pass the ROW's noun where the page has one — "Actions for Website
  // events" — because ten identical "Actions" buttons give a screen-reader user
  // no way to tell which row they are on.
  //
  // There is deliberately no tooltip, which is where this parts company with
  // SfereIconButton. A SfereTooltip bubble is absolutely positioned in the row
  // and would be clipped by the very scroller the menu teleports out of; and a
  // native `title` on top of an `aria-label` is not a synonym — the browser
  // hands it to assistive tech as the DESCRIPTION, so the same sentence gets
  // read twice. A kebab is the one glyph that needs no hover label.
  label: { type: String, required: true }
})

const emit = defineEmits(['select'])

const isOpen = ref(false)
const placed = ref(false)
const triggerEl = ref(null)
const menuEl = ref(null)
const menuStyle = ref({ top: '0px', left: '0px' })

// Items are read out of the DOM rather than collected through a `v-for` ref
// array: they only exist while the menu is open and the list never mutates
// mid-open, so a query is the whole of the bookkeeping.
function items() {
  return menuEl.value
    ? Array.from(menuEl.value.querySelectorAll('[role="menuitem"]'))
    : []
}

const activeIndex = ref(0)

function focusItem(i) {
  const list = items()
  if (!list.length) return
  const next = (i + list.length) % list.length
  activeIndex.value = next
  // `preventScroll`, or focusing the first item can fire a scroll event —
  // which the listener below reads as "the page moved" and closes the menu it
  // just opened.
  list[next].focus({ preventScroll: true })
}

function move(delta) {
  focusItem(activeIndex.value + delta)
}

// Measure, then place. The menu has to exist before its height is known, so it
// renders at opacity 0 for one frame rather than flashing in the wrong spot.
function place() {
  const trigger = triggerEl.value
  const menu = menuEl.value
  if (!trigger || !menu) return

  const r = trigger.getBoundingClientRect()
  const h = menu.offsetHeight
  const w = menu.offsetWidth
  const GAP = 6
  const MARGIN = 8

  // Flip above for the last row of a table, which is otherwise the one row
  // whose menu opens into the fold. Only flip when there is genuinely more room
  // up there — near the top of a short viewport, clipped-below still beats
  // clipped-above.
  const below = window.innerHeight - r.bottom - MARGIN
  const above = r.top - MARGIN
  const flip = below < h + GAP && above > below

  // Right edges aligned: the actions column is right-aligned, so a
  // left-anchored menu would hang off the table. Clamped horizontally only —
  // clamping the TOP would leave a menu floating in the middle of the viewport
  // pointing at a trigger that has scrolled away.
  const left = Math.min(
    Math.max(r.right - w, MARGIN),
    window.innerWidth - w - MARGIN
  )

  menuStyle.value = {
    top: `${flip ? r.top - h - GAP : r.bottom + GAP}px`,
    left: `${left}px`
  }
}

function onPointerDown(e) {
  if (menuEl.value?.contains(e.target)) return
  // The trigger is excluded because its own pointerdown reaches this listener
  // BEFORE its click handler: closing here and toggling there would make a
  // second click on an open menu close and immediately reopen it.
  if (triggerEl.value?.contains(e.target)) return
  close(false)
}

function onFocusIn(e) {
  if (menuEl.value?.contains(e.target)) return
  if (triggerEl.value?.contains(e.target)) return
  close(false)
}

// Close on any scroll rather than reposition. Repositioning needs a top clamp
// to stay on screen, and a clamped menu whose trigger has scrolled off is a
// panel attached to nothing — worse than a menu that dismissed itself.
// Capture phase, because the scroller is the table's own div, not the window.
function onScroll() {
  close(false)
}

function attach() {
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('focusin', onFocusIn, true)
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', place)
}

function detach() {
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('focusin', onFocusIn, true)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', place)
}

async function openMenu(index) {
  if (!props.actions.length) return
  isOpen.value = true
  placed.value = false
  await nextTick()
  // The page can unmount across that tick — a row-click navigation racing the
  // menu open. Bail rather than attaching document listeners that onBeforeUnmount
  // has already run past and will never remove.
  if (!menuEl.value) {
    isOpen.value = false
    return
  }
  place()
  placed.value = true
  attach()
  focusItem(index)
}

function close(returnFocus) {
  if (!isOpen.value) return
  isOpen.value = false
  placed.value = false
  // Detach before moving focus, or the focusin listener sees the trigger and
  // re-enters close().
  detach()
  if (returnFocus) triggerEl.value?.focus()
}

function toggle() {
  if (isOpen.value) close(true)
  else openMenu(0)
}

function choose(action) {
  emit('select', action.key)
  // Focus goes back to the trigger, not nowhere. The usual next thing is a
  // ConfirmDialog the page opens; if the user dismisses it, focus is on the row
  // they came from rather than on <body>.
  close(true)
}

// A route change unmounts the list page under it, which is what removes the
// teleported node — so there is no router import here, and PageHeader stays the
// one route-aware component in the kit.
onBeforeUnmount(detach)

// Composed from the shared palette rather than rendered as an SfereIconButton:
// that component's root is SfereTooltip's <span>, so `aria-haspopup` and
// `aria-expanded` would fall through onto the wrapper instead of the button,
// and `getBoundingClientRect` needs a ref on the real control. The tooltip goes
// with it — a CSS bubble is clipped by the same table scroller the menu escapes
// via Teleport — so the trigger carries a native `title` instead.
//
// `size-9` (36px), not SfereIconButton's 40px `md`: a table row is `py-3`
// around ~20px of text, so a 40px control grows every row it sits in.
const triggerClasses = computed(() => [
  'grid size-9 shrink-0 place-items-center rounded-full leading-none',
  'transition duration-200 ease-sfere-ui select-none',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  SFERE_BUTTON_VARIANTS.ghost,
  // Held open, the trigger keeps the hover fill: with the menu teleported to
  // <body> it is the only thing on screen saying which row it belongs to.
  isOpen.value && 'bg-sfere-fill text-sfere-brand-text'
])

// z-index sits above q-header (2000) and MainLayout's q-footer, and below
// q-dialog (6000): a menu that flips upward near the top of a scrolled page
// would otherwise slide under the app bar.
const menuClasses = computed(() => [
  'fixed z-[2500] min-w-44 rounded-sfere-lg border border-sfere-line',
  'bg-sfere-surface p-1 shadow-sfere-pop',
  'transition-opacity duration-150 ease-sfere-ui motion-reduce:transition-none',
  placed.value ? 'opacity-100' : 'opacity-0'
])

// The tone owns its own focus background. A generic `focus:bg-sfere-fill` in
// the base string plus a `focus:bg-sfere-danger-soft` in the branch is two
// layered utilities setting the same property — which of them wins is decided
// by Tailwind's internal ordering, not by the order they are written here.
function itemClasses(action) {
  return [
    'flex w-full items-center gap-2 rounded-sfere px-3 py-2 text-left',
    'text-sfere-sm transition-colors duration-150 ease-sfere-ui',
    'focus-visible:outline-none',
    action.tone === 'destructive'
      ? 'text-sfere-danger hover:bg-sfere-danger-soft focus:bg-sfere-danger-soft'
      : 'text-sfere-fg hover:bg-sfere-fill focus:bg-sfere-fill'
  ]
}
</script>
