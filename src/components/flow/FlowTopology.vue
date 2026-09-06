<template>
  <div ref="root" class="@container relative">
    <svg
      v-if="wires.length"
      class="pointer-events-none absolute inset-0 h-full w-full max-@min-[52rem]:hidden"
      :viewBox="`0 0 ${box.w} ${box.h}`"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
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
      <!-- SOURCES -->
      <section class="min-w-0">
        <header class="mb-3 flex flex-nowrap items-end justify-between gap-3">
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

        <div class="grid gap-3">
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
              :attention="node.attention"
              :to="node.to"
              :on-dark="onDark"
            />
          </div>

          <slot v-if="!sources.length" name="sources-empty" />
        </div>
      </section>

      <!-- HUB -->
      <div
        class="grid place-items-center max-@min-[52rem]:py-2 @min-[52rem]:self-center"
      >
        <FlowHub :label="hubLabel" :on-dark="onDark" />
      </div>

      <!-- DESTINATIONS -->
      <section class="min-w-0">
        <header class="mb-3 flex flex-nowrap items-end justify-between gap-3">
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

        <div class="grid gap-3">
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
              :to="node.to"
              :on-dark="onDark"
            />
          </div>

          <slot v-if="!destinations.length" name="destinations-empty" />
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

const root = ref(null)
const box = ref({ w: 0, h: 0 })
const hub = ref({ x: 0, y: 0 })
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
  // The hub is centred in the middle column, which is the container's own
  // centre — measuring the circle would mean another ref for a value the grid
  // already guarantees.
  hub.value = { x: base.width / 2, y: base.height / 2 }

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

const HUB_R = 48

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
      { x: hub.value.x - HUB_R, y: hub.value.y }
    )
    const right = curve(
      { x: hub.value.x + HUB_R, y: hub.value.y },
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
const gridClasses = computed(() => [
  'relative grid gap-x-6 gap-y-4',
  '@min-[52rem]:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)]',
  '@min-[52rem]:items-start'
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
