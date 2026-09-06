<template>
  <!-- The `@container` element and the element reading the query have to be two
       different nodes: a container query is answered by a container's
       DESCENDANTS, never by the container itself, so `@container` and
       `max-@min-[52rem]:flex-col` on one div would silently never stack. -->
  <div class="@container">
    <div :class="rootClasses">
      <div class="min-w-0 flex-1">
        <FlowNode
          kind="source"
          :subtype="source.subtype"
          :name="source.name"
          :hint="source.hint"
          :status="source.status"
          :is-enabled="source.isEnabled !== false"
          :to="source.to"
          :on-dark="onDark"
        />
      </div>

      <FlowWire :flowing="flowing" :tone="tone" :on-dark="onDark" />

      <FlowHub size="sm" :on-dark="onDark" />

      <FlowWire :flowing="flowing" :tone="tone" :on-dark="onDark" />

      <div class="min-w-0 flex-1">
        <FlowNode
          kind="destination"
          :subtype="destination.subtype"
          :name="destination.name"
          :hint="destination.hint"
          :note="destination.note"
          :status="destination.status"
          :is-enabled="destination.isEnabled !== false"
          :to="destination.to"
          :on-dark="onDark"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import FlowHub from './FlowHub.vue'
import FlowNode from './FlowNode.vue'
import FlowWire from './FlowWire.vue'
import { flowStatus } from './flowStatus'

// One pipe, drawn as a row: source → Sfere → destination. The pipe detail
// screen's header strip and the create form's route preview.
//
// A SEPARATE COMPONENT FROM FlowTopology RATHER THAN A ONE-LINK CASE OF IT, and
// the reason is measurement. The topology computes curves from bounding boxes
// because its columns hold an unknown number of boxes at unknown heights; a
// chain is three items in a row at one height, where the connector is a rule
// with a travelling dot and no geometry to solve. Running the measuring version
// for a fixed row would mean a ResizeObserver and a re-measure watcher to draw
// two straight lines.
//
// It stacks below `52rem` on a CONTAINER query, not `lg:` — the sidebar
// collapses without changing the viewport, so one 1024px window has two content
// widths. CLAUDE.md collision #6.
const props = defineProps({
  // { name, hint, subtype, status, isEnabled, to }
  source: { type: Object, required: true },
  // { name, hint, note, subtype, status, isEnabled, to }
  destination: { type: Object, required: true },
  // The pipe's own status, which is what the connector reports — not the two
  // ends'. A live source and a live destination with a paused pipe between them
  // is exactly the case a chain has to be able to draw.
  status: { type: String, default: '' },
  isEnabled: { type: Boolean, default: true },
  onDark: { type: Boolean, default: false }
})

const meta = computed(() => flowStatus(props.status, props.isEnabled))
const tone = computed(() => meta.value.tone)

// Only a healthy pipe animates. Same rule as the topology: a degraded pipe is
// delivering some events and a failing one none, so motion on either is a claim
// the data does not support.
const flowing = computed(() => meta.value.flowing)

const rootClasses = computed(() => [
  'flex flex-nowrap items-center gap-3',
  'max-@min-[52rem]:flex-col max-@min-[52rem]:items-stretch'
])
</script>
