<template>
  <div ref="root" class="@container relative">
    <svg
      v-if="wires.length || guides.length"
      class="pointer-events-none absolute inset-0 h-full w-full @max-[52rem]:hidden"
      :viewBox="`0 0 ${box.w} ${box.h}`"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <!-- THE PLACEHOLDER RAILS ARE MEASURED WIRES, not a rule at the hub's
           height, and that is the whole of the alignment fix. They used to be
           one absolutely-positioned CSS line drawn through the middle of the
           hub's own cell, which put them at the centre of the WHOLE box —
           column headings included — while the cards they were supposed to
           join sat lower and at two different heights. Three separate
           mid-lines, none of them touching anything. Drawn from the real
           bounding boxes they land on the cards by construction, whatever the
           copy does to either one's height.

           Dashed, hairline and particle-free, because nothing is connected:
           the rail says "a connection would run here", which is a different
           claim from the solid `wires` below it. -->
      <path
        v-for="guide in guides"
        :key="guide.key"
        :d="guide.d"
        fill="none"
        class="stroke-sfere-line"
        stroke-width="1.5"
        stroke-dasharray="4 5"
        stroke-linecap="round"
      />

      <path
        v-for="wire in wires"
        :key="wire.key"
        :d="wire.d"
        fill="none"
        :class="wire.klass"
        stroke-width="1.5"
      />
      <!-- Particles only on connectors whose pipe is genuinely healthy, and
           never under `prefers-reduced-motion`. A degraded pipe is delivering
           some events and a failing one is delivering none; animating either
           would be the loudest thing on the screen and the least true. -->
      <template v-if="!reducedMotion">
        <circle
          v-for="wire in flowingWires"
          :key="`p-${wire.key}`"
          r="3"
          class="fill-sfere-brand"
        >
          <animateMotion
            :dur="wire.dur"
            :begin="wire.begin"
            repeatCount="indefinite"
            :path="wire.d"
          />
        </circle>
      </template>
    </svg>

    <div :class="gridClasses">
      <!-- SOURCES.

           `@min-[52rem]:contents!` DISSOLVES THE SECTION INTO THE GRID, which is
           what puts the two headings in one row and the two card stacks plus the
           hub in another. It has to be a real second row rather than a centred
           circle floating over one: the hub is 128px and a column holding a
           single 79px card is not, so with everything in one row the circle can
           only be centred by taking it out of flow — which is exactly what the
           `translateY` this replaced did, and why the halo hung out of the
           bottom of the card that was supposed to contain it. In a row of its
           own it contributes its own height, so the card grows to fit it.

           Narrow layout keeps the section as an ordinary block, so the stack is
           still heading → cards → hub → heading → cards in DOM order.

           THE IMPORTANT SUFFIX IS LOAD-BEARING, and it is cascade collision #2
           in a form that list did not cover. Quasar ships the HTML5 normalize
           line — `article, aside, details, figcaption, figure, footer, header,
           main, menu, nav, section, summary { display: block }` — UNLAYERED, and
           unlayered beats layered whatever the specificity, so a layered
           `contents` on a `<section>` computes to `block` and the two sections
           stay grid items. It fails silently and it fails as a LAYOUT: the
           headings and cards land in whatever columns auto-placement gives them,
           which is a diagram with its destinations column squeezed into the
           hub's 10.5rem track. Any display utility on one of those eleven tags
           owes the same suffix. -->
      <section class="@min-[52rem]:contents!">
        <header
          class="mb-3 flex min-w-0 flex-nowrap items-end justify-between gap-3 @min-[52rem]:col-start-1 @min-[52rem]:row-start-1 @min-[52rem]:mb-0"
        >
          <div class="min-w-0">
            <h3 :class="columnTitleClasses">{{ sourcesTitle }}</h3>
            <p :class="columnSubClasses">{{ sourcesSubtitle }}</p>
          </div>
          <SfereLinkArrow
            v-if="sourcesTo && sources.length"
            :to="sourcesTo"
            label="View all"
            class="shrink-0"
          />
        </header>

        <!-- `self-center` on all three row-two cells is the whole alignment
             rule: the hub and both card stacks share one row and are centred in
             it, so their midpoints are equal by construction rather than by a
             measurement that has to be kept true. -->
        <div
          ref="sourcesBody"
          class="grid min-w-0 gap-3 @min-[52rem]:col-start-1 @min-[52rem]:row-start-2 @min-[52rem]:self-center"
        >
          <div
            v-for="node in sources"
            :key="node.id"
            :ref="el => setAnchor('s', node.id, el)"
          >
            <FlowNode
              kind="source"
              :subtype="node.subtype"
              :name="node.name"
              :hint="node.hint"
              :status="node.status"
              :is-enabled="node.isEnabled !== false"
              :status-label="node.statusLabel"
              :status-tone="node.statusTone"
              :attention="node.attention"
              :to="node.to"
              :on-dark="onDark"
            />
          </div>

          <!-- The placeholder is an anchor like any node, so the rail into the
               hub leaves its edge rather than a guessed height. -->
          <div v-if="!sources.length" :ref="el => setAnchor('s', EMPTY, el)">
            <slot name="sources-empty" />
          </div>
        </div>
      </section>

      <!-- HUB.

           `py-4` IS THE HALO'S OWN SIZE, and it is here so the glow is inside
           the layout rather than hanging off it. FlowHub draws the halo as
           absolutely-positioned siblings at `-inset-4`, i.e. 16px past the
           circle, which contributes no height — so on a diagram where the hub is
           the tallest thing in its row (any short one: a single card each side)
           the row ended flush with the circle and the glow spent the card's
           whole bottom padding, leaving about 5px to the border where the
           headings above had 20. Reserving it here means the card's own uniform
           padding reads as uniform. Keep the two numbers in step. -->
      <div
        class="relative grid place-items-center py-4 @min-[52rem]:col-start-2 @min-[52rem]:row-start-2 @min-[52rem]:self-center"
      >
        <div ref="hubEl">
          <FlowHub
            size="lg"
            variant="lockup"
            :label="hubLabel"
            :on-dark="onDark"
          />
        </div>
      </div>

      <!-- DESTINATIONS. See the sources section for why this is `contents`. -->
      <section class="@min-[52rem]:contents!">
        <header
          class="mb-3 flex min-w-0 flex-nowrap items-end justify-between gap-3 @min-[52rem]:col-start-3 @min-[52rem]:row-start-1 @min-[52rem]:mb-0"
        >
          <div class="min-w-0">
            <h3 :class="columnTitleClasses">{{ destinationsTitle }}</h3>
            <p :class="columnSubClasses">{{ destinationsSubtitle }}</p>
          </div>
          <SfereLinkArrow
            v-if="destinationsTo && destinations.length"
            :to="destinationsTo"
            label="View all"
            class="shrink-0"
          />
        </header>

        <div
          ref="destinationsBody"
          class="grid min-w-0 gap-3 @min-[52rem]:col-start-3 @min-[52rem]:row-start-2 @min-[52rem]:self-center"
        >
          <div
            v-for="node in destinations"
            :key="node.id"
            :ref="el => setAnchor('d', node.id, el)"
          >
            <FlowNode
              kind="destination"
              :subtype="node.subtype"
              :name="node.name"
              :hint="node.hint"
              :note="node.note"
              :status="node.status"
              :is-enabled="node.isEnabled !== false"
              :status-label="node.statusLabel"
              :status-tone="node.statusTone"
              :to="node.to"
              :on-dark="onDark"
            />
          </div>

          <div
            v-if="!destinations.length"
            :ref="el => setAnchor('d', EMPTY, el)"
          >
            <slot name="destinations-empty" />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import SfereLinkArrow from '@/components/ui/SfereLinkArrow.vue'
import FlowHub from './FlowHub.vue'
import FlowNode from './FlowNode.vue'
import { flowStatus } from './flowStatus'

// Sources on the left, the Sfere mark in the middle, destinations on the right,
// and a curve for every pipe that joins one to the other. The Dashboard's
// topology and the Pipes screen's Visual view are the same picture of the same
// data, so they are the same component.
//
// THE WIRES ARE MEASURED, NOT LAID OUT. Each node registers its own element and
// the curves are computed from real bounding boxes, which is what lets a column
// hold one node or six, with names that wrap, and still have every line land on
// the right box. The alternative — fixed offsets per row index — breaks the
// moment a name wraps to two lines, and that is a copy edit rather than a code
// change.
//
// IT IS NOT ANIMATED ON POSITION. The SVG has no CSS transition on `d`: the
// boxes are re-measured on resize and on data change, and a transition on top of
// that is the wobbling-line bug every diagram library eventually files. The
// motion here is one particle travelling a healthy connector, and it stops dead
// under `prefers-reduced-motion`.
//
// THE BREAKPOINT IS A CONTAINER QUERY, NOT `lg:`. The sidebar collapses without
// changing the viewport, so one 1024px window has two content widths — a
// viewport breakpoint answers the wrong question and would stack the columns on
// a wide window with the rail collapsed. CLAUDE.md collision #6.
//
// AND THE NARROW HALF IS `@max-[52rem]:`, NEVER `max-@min-[52rem]:`. The second
// spelling looks like the composition of `max-*` and `@min-*` and Tailwind
// silently emits NOTHING for it — no `@container not (width>=52rem)` block is
// generated, so every utility written that way is a dead class. This file,
// FlowChain and FlowWire all carried it, which is why a stacked chain's
// connector stayed horizontal and this diagram drew its wires diagonally across
// the stack instead of hiding them. Checked against the built CSS, not assumed:
// the `@max-[46rem]:` form the onboarding screens use does emit its block.
const props = defineProps({
  // [{ id, name, hint, subtype, status, isEnabled, statusLabel, attention, to }]
  sources: { type: Array, default: () => [] },
  // [{ id, name, hint, note, subtype, status, isEnabled, statusLabel, to }]
  destinations: { type: Array, default: () => [] },
  // [{ id, sourceId, destinationId, status, isEnabled }] — one per pipe.
  links: { type: Array, default: () => [] },
  sourcesTitle: { type: String, default: 'Sources' },
  sourcesSubtitle: { type: String, default: 'Where activity enters Sfere' },
  destinationsTitle: { type: String, default: 'Destinations' },
  destinationsSubtitle: {
    type: String,
    default: 'Where your data is stored or delivered'
  },
  sourcesTo: { type: [String, Object], default: null },
  destinationsTo: { type: [String, Object], default: null },
  hubLabel: { type: String, default: '' },
  onDark: { type: Boolean, default: false }
})

// The anchor id a column's empty placeholder registers under. A string rather
// than a symbol because it goes into the same `side:id` key space as the nodes.
const EMPTY = '__empty'

const root = ref(null)
const hubEl = ref(null)
const sourcesBody = ref(null)
const destinationsBody = ref(null)
const box = ref({ w: 0, h: 0 })
const hub = ref({ x: 0, y: 0, r: 64 })
const anchors = ref({})

// Vue calls a function ref with `null` on unmount, which is how a node that has
// gone away is dropped rather than leaving a wire pointing at a stale box.
const elements = new Map()
function setAnchor(side, id, el) {
  const key = `${side}:${id}`
  if (el) elements.set(key, el)
  else elements.delete(key)
}

function measure() {
  const el = root.value
  if (!el) return
  const base = el.getBoundingClientRect()
  box.value = { w: base.width, h: base.height }

  // THE HUB IS MEASURED, ALL THREE NUMBERS. Its centre is wherever the grid put
  // the circle and its radius is whatever FlowHub rendered, so changing either
  // the column widths or the hub's size cannot leave the wires drawn under the
  // mark — a hardcoded radius did exactly that.
  //
  // An earlier pass DERIVED the y instead, because the circle's own transform
  // was computed from the same number and measuring it back would have been a
  // measure → move → measure loop. There is no transform now: the hub shares a
  // grid row with the two card stacks and all three are `self-center`, so the
  // browser does the alignment and this only reads the result.
  const h = hubEl.value?.getBoundingClientRect()
  hub.value = h
    ? {
        x: h.left - base.left + h.width / 2,
        y: h.top - base.top + h.height / 2,
        r: h.width / 2
      }
    : { x: base.width / 2, y: base.height / 2, r: 64 }

  const next = {}
  for (const [key, node] of elements) {
    const r = node.getBoundingClientRect()
    next[key] = {
      // Right edge for a source, left edge for a destination: the curve leaves
      // the box it belongs to rather than its centre, so a wide node does not
      // have a line crossing over it.
      x: key.startsWith('s:') ? r.right - base.left : r.left - base.left,
      y: r.top - base.top + r.height / 2
    }
  }
  anchors.value = next
}

// One curve, source edge → hub → destination edge, as two cubics meeting at the
// circle. Horizontal control points, so the line leaves and arrives level and
// never loops back on itself when the two ends are at very different heights.
function curve(from, to) {
  const midX = (from.x + to.x) / 2
  return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`
}

const wires = computed(() => {
  if (!box.value.w) return []
  const out = []
  for (const [index, link] of props.links.entries()) {
    const from = anchors.value[`s:${link.sourceId}`]
    const to = anchors.value[`d:${link.destinationId}`]
    // A link whose end is not on screen draws nothing. That happens legitimately
    // — a dashboard showing the top few sources still lists every pipe — and a
    // line to a box that is not there is worse than no line.
    if (!from || !to) continue

    const meta = flowStatus(link.status, link.isEnabled)
    const left = curve(
      { x: from.x + 8, y: from.y },
      { x: hub.value.x - hub.value.r, y: hub.value.y }
    )
    const right = curve(
      { x: hub.value.x + hub.value.r, y: hub.value.y },
      { x: to.x - 8, y: to.y }
    )
    out.push({
      key: `${link.id ?? index}`,
      d: `${left} ${right}`,
      flowing: meta.flowing,
      klass: WIRE_TONES[meta.tone] ?? WIRE_TONES.neutral,
      // Staggered so several healthy pipes read as separate streams rather than
      // one pulse. Derived from the index, not from Math.random, so a re-render
      // does not reshuffle every particle.
      dur: `${2 + (index % 3) * 0.15}s`,
      begin: `${(index % 4) * 0.35}s`
    })
  }
  return out
})

const WIRE_TONES = {
  success: 'stroke-sfere-brand/45',
  warn: 'stroke-sfere-warn/60',
  danger: 'stroke-sfere-danger/55',
  neutral: 'stroke-sfere-line'
}

const flowingWires = computed(() => wires.value.filter(w => w.flowing))

/**
 * The dashed rails, for a diagram with a side that has nothing on it.
 *
 * ONLY WHEN A COLUMN IS EMPTY, which is narrower than "there are no pipes" and
 * deliberately so. A workspace with three sources, two destinations and no pipe
 * between them would need six rails to say the same thing, and six dashed lines
 * crossing a card is not a clearer picture than none — the needs-attention
 * banner is where that account is told what is wrong. An empty column has
 * exactly one placeholder, so this is one rail per node on the other side, or a
 * single rail when both sides are empty.
 */
const guides = computed(() => {
  if (!box.value.w) return []
  const sourcesEmpty = !props.sources.length
  const destinationsEmpty = !props.destinations.length
  if (!sourcesEmpty && !destinationsEmpty) return []

  const froms = sourcesEmpty
    ? [`s:${EMPTY}`]
    : props.sources.map(n => `s:${n.id}`)
  const tos = destinationsEmpty
    ? [`d:${EMPTY}`]
    : props.destinations.map(n => `d:${n.id}`)

  const out = []
  for (const fromKey of froms) {
    const from = anchors.value[fromKey]
    if (!from) continue
    for (const toKey of tos) {
      const to = anchors.value[toKey]
      if (!to) continue
      const left = curve(
        { x: from.x + 8, y: from.y },
        { x: hub.value.x - hub.value.r, y: hub.value.y }
      )
      const right = curve(
        { x: hub.value.x + hub.value.r, y: hub.value.y },
        { x: to.x - 8, y: to.y }
      )
      out.push({ key: `${fromKey}->${toKey}`, d: `${left} ${right}` })
    }
  }
  return out
})

// Read once and then watched: someone who turns motion off mid-session gets a
// still diagram without a reload, and the query is the same one the scoped
// reduced-motion rules elsewhere in the app answer to.
const reducedMotion = ref(false)
let motionQuery = null
function onMotionChange(event) {
  reducedMotion.value = event.matches
}

let observer = null

onMounted(async () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion.value = motionQuery.matches
    motionQuery.addEventListener('change', onMotionChange)
  }
  await nextTick()
  measure()
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    observer = new ResizeObserver(measure)
    observer.observe(root.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  motionQuery?.removeEventListener('change', onMotionChange)
})

// Data changes move boxes, and `nextTick` is what makes the measurement see the
// rendered result rather than the previous frame's.
watch(
  () => [props.sources, props.destinations, props.links],
  async () => {
    await nextTick()
    measure()
  },
  { deep: true }
)

// `items-start`, NOT `items-center`, and the hub centres itself instead.
// Centring the tracks looked right with equal columns and wrong the moment they
// differed: with three sources and two destinations the shorter column floated
// down and the two headings no longer shared a baseline, which reads as a
// misalignment rather than as a deliberate centring. The hub is the only thing
// that should sit in the middle, so it asks for that itself with `self-center`.
// Two rows on the wide layout: headings, then cards and hub. `gap-y-4` is the
// spacing between the stacked blocks on a narrow one; `gap-y-3` is the 12px the
// headers used to carry as `mb-3`, which they drop in the same breakpoint so the
// two do not add up.
const gridClasses = computed(() => [
  'relative grid gap-x-6 gap-y-4',
  '@min-[52rem]:grid-cols-[minmax(0,1fr)_10.5rem_minmax(0,1fr)]',
  '@min-[52rem]:grid-rows-[auto_auto]',
  '@min-[52rem]:items-start',
  '@min-[52rem]:gap-y-3'
])

const columnTitleClasses = computed(() => [
  'font-sfere-display text-sfere-h4! font-bold',
  props.onDark ? 'text-sfere-dark-fg' : 'text-sfere-fg'
])

const columnSubClasses = computed(() => [
  'text-sfere-xs',
  props.onDark ? 'text-sfere-dark-fg-muted' : 'text-sfere-fg-muted'
])
</script>
