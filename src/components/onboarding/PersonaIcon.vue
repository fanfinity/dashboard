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
    <!-- Engineer: a payload moving between two nodes. -->
    <template v-if="persona === 'engineer'">
      <circle cx="4.5" cy="12" r="2.5" />
      <circle cx="19.5" cy="12" r="2.5" />
      <path d="M7 12h2.5M14.5 12h2.5" />
      <path d="M9.5 8.75h5v6.5h-5z" />
    </template>

    <!-- Marketer: one message going out. -->
    <template v-else-if="persona === 'marketer'">
      <path d="M20.5 3.5 3.5 10.75l6.75 2.5 2.5 6.75 7.75-16.5Z" />
      <path d="M20.5 3.5l-10.25 9.75" />
    </template>

    <!-- Analyst: the number, and what it is made of. -->
    <template v-else>
      <path d="M3.5 20.5h17" />
      <path d="M7 20.5v-6.5M12 20.5v-13M17 20.5v-9" />
    </template>
  </svg>
</template>

<script setup>
// Three marks for the three personas, drawn here rather than imported from
// src/assets/dashboard/.
//
// The nav SVGs were the first instinct — same icon family, and the persona's
// section is where they will spend their month — but they are loaded as <img>
// with the brand purple baked into a `stroke` attribute, so they cannot take the
// colour of the chip they sit in, and the two closest matches were a wifi arc for
// "I build the pipes" and Dashboard's own house for "I answer for the numbers".
// A wrong mark costs more than a shared one gains.
//
// Stroke-based, 24px grid, `currentColor`: the same construction as the nav set,
// so they read as the same family without borrowing the wrong glyph.
// Sized here rather than by the caller: both surfaces put it in the same
// SfereIconChip, and a chip with a differently-sized mark in it is the kind of
// drift nobody notices until the two screens are side by side.
defineProps({
  persona: { type: String, required: true }
})
</script>
