<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="size-5"
  >
    <!-- A website: a globe, meridian closed rather than left as two arcs. -->
    <template v-if="intent === 'website'">
      <circle cx="12" cy="12" r="8.75" />
      <path d="M3.25 12h17.5" />
      <path
        d="M12 3.25c2.4 2.45 3.75 5.55 3.75 8.75S14.4 18.3 12 20.75c-2.4-2.45-3.75-5.55-3.75-8.75S9.6 5.7 12 3.25Z"
      />
    </template>

    <!-- A mobile app: a handset, with the earpiece and home bar that keep it
         from reading as an empty rectangle. -->
    <template v-else-if="intent === 'app'">
      <rect x="6.75" y="2.75" width="10.5" height="18.5" rx="2.25" />
      <path d="M10.5 5.75h3" />
      <path d="M10.75 18.25h2.5" />
    </template>

    <!-- My own backend: two rack units. The dot and the two ports are what
         separate this from a hamburger menu at 20px. -->
    <template v-else-if="intent === 'backend'">
      <rect x="3.25" y="4.25" width="17.5" height="6" rx="1.75" />
      <rect x="3.25" y="13.75" width="17.5" height="6" rx="1.75" />
      <path d="M6.75 7.25h.01M6.75 16.75h.01" />
      <path d="M13.75 7.25h3.5M13.75 16.75h3.5" />
    </template>

    <!-- An online store: a shopping bag. The handle rises ABOVE the bag's top
         edge; drawn inside it, the same arc reads as a smile. -->
    <template v-else-if="intent === 'store'">
      <path
        d="M4.4 8.25h15.2l-1.05 11.05a2 2 0 0 1-2 1.8H7.45a2 2 0 0 1-2-1.8Z"
      />
      <path d="M8.75 8.25V6.5a3.25 3.25 0 0 1 6.5 0v1.75" />
    </template>

    <!-- Payments: a card, magnetic stripe and one number block. -->
    <template v-else-if="intent === 'payments'">
      <rect x="2.75" y="5.25" width="18.5" height="13.5" rx="2.25" />
      <path d="M2.75 9.75h18.5" />
      <path d="M6.25 14.75h3.75" />
    </template>

    <!-- Something else: a plug, body closed so it stops reading as a bulb. -->
    <template v-else>
      <path d="M9 3.25v4.5M15 3.25v4.5" />
      <path d="M5.75 7.75h12.5v3a6.25 6.25 0 0 1-12.5 0Z" />
      <path d="M12 16.9v3.85" />
    </template>
  </svg>
</template>

<script setup>
// Six marks for the six source intents, drawn here rather than carried as `d`
// strings in src/config/sourceIntents.js.
//
// WHY THEY MOVED: a single path per intent is only enough for a mark that is one
// stroke. Five of the six are not — a phone needs an earpiece, a server needs
// ports, a bag needs a handle that rises above the bag — so they were being
// crammed into one `d` with subpaths that never closed. The server rack rendered
// as a hamburger menu and the plug rendered as a light bulb. Multi-element SVG
// is the fix, and multi-element SVG does not fit in a pure-data registry.
//
// Same construction as PersonaIcon.vue: 24px grid, stroke-based, `currentColor`,
// stroke-width 1.75, sized here rather than by the caller so the mark inside the
// chip never drifts between surfaces. Not vendor logos — the CSP is
// `img-src 'self'`, and half of these intents name no vendor.
defineProps({
  intent: { type: String, required: true }
})
</script>
