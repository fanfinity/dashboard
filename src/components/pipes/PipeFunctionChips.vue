<template>
  <span v-if="names.length" class="flex flex-wrap items-center gap-1.5">
    <span v-for="name in shown" :key="name" :class="CHIP">
      <span aria-hidden="true" class="font-sfere-mono text-sfere-brand-text"
        >ƒ</span
      >
      <span class="truncate">{{ name }}</span>
    </span>

    <!-- The overflow chip carries the rest as a native `title`. Not a
         SfereTooltip: this sits inside DataTable's horizontal scroller, which
         clips an absolutely-positioned bubble, and the chip has no other
         accessible name for the title to compete with. -->
    <span v-if="rest.length" :class="CHIP" :title="rest.join(', ')"
      >+{{ rest.length }}</span
    >
  </span>

  <!-- `known` is the honesty gate. An empty list means "no function is attached"
       only when the function library was actually read; when that read is
       missing or failed, the row says nothing rather than claiming a pipe runs
       nothing. -->
  <span v-else-if="known" class="text-sfere-xs text-sfere-fg-muted"
    >No functions</span
  >
</template>

<script setup>
import { computed } from 'vue'

// The functions attached to one pipe, as `ƒ Name` pills with a `+N` overflow.
//
// The names come from ONE account-level read, not one read per row.
// `FunctionDefinition.attached_pipeline_ids` is a real backend field, so the
// Pipes list inverts `useFunctions()` into pipe → names and passes the slice
// here. The per-pipe endpoint (`…/pipelines/{id}/functions`) would be one
// request per row, and the pipe's own screen is where that detail belongs.
const props = defineProps({
  names: { type: Array, default: () => [] },
  // Whether the function library was read at all. False = unknown, and unknown
  // prints nothing.
  known: { type: Boolean, default: false },
  max: { type: Number, default: 2 }
})

const CHIP =
  'inline-flex max-w-[13rem] flex-nowrap items-center gap-1 rounded-full border border-sfere-line bg-sfere-fill px-2 py-0.5 text-sfere-xs text-sfere-fg-muted'

const shown = computed(() => props.names.slice(0, props.max))
const rest = computed(() => props.names.slice(props.max))
</script>
