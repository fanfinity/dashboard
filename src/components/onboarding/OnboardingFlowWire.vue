<template>
  <!-- One connector in OnboardingFlowDiagram: a hairline with two dots
       travelling it.

       TWO DOTS, THE SECOND HALF-LIT AND DELAYED, which is the prototype's
       reading and the right one: one dot on a 200px wire spends most of its
       cycle off-screen at the ends, so the wire looks dead more often than it
       looks alive. The delay is a little over half the period so the pair is
       never evenly spaced, which is what stops it reading as a marquee.

       `animate-sfere-travel` is the app's own keyframe, not a local one. It
       animates `left`, and `sfere.css`'s reduced-motion block therefore HIDES
       the dot rather than parking it — a dot frozen mid-wire reads as a stalled
       delivery, which on this screen would be a claim about an account that does
       not exist yet. The wire itself stays, and it is the wire that says the two
       ends are joined.

       Horizontal on a wide container, vertical on a narrow one, because the
       diagram stacks. A 2px-tall rule in a stacked column would be invisible,
       and the wire is the only thing tying the three blocks together once they
       are no longer side by side.

       THE DOTS ARE DROPPED IN THE STACKED FORM, not rotated: `sfere-travel`
       animates `left`, so on a 2px-wide vertical rule it would slide the dot
       sideways off the wire rather than down it. A second keyframe for one
       narrow-container case is more surface than the cue is worth, and the
       reduced-motion branch already proves the picture reads without it.

       `@max-[46rem]:hidden`, NEVER `hidden @min-[46rem]:block`. Quasar ships an
       unlayered `.hidden { display: none !important }`, so a bare `hidden` can
       never be turned back on at any breakpoint — collision #2 in CLAUDE.md. The
       inverse variant generates a class name Quasar does not define. -->
  <div
    class="relative mx-auto h-8 w-0.5 rounded-full bg-sfere-line @min-[46rem]:mx-0 @min-[46rem]:h-0.5 @min-[46rem]:w-auto"
  >
    <span
      v-for="dot in DOTS"
      :key="dot.key"
      :class="dot.class"
      class="animate-sfere-travel absolute left-0 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sfere-brand @max-[46rem]:hidden"
    ></span>
  </div>
</template>

<script setup>
// The dots are a static two-item list rather than two hand-written spans so the
// delay and the opacity sit beside each other and cannot drift.
//
// THE CLASSES ARE LITERAL STRINGS, not interpolated from a number. Tailwind v4
// extracts class names from source text, so a built `[animation-delay:${n}ms]`
// is never generated and the second dot would ride on top of the first.
const DOTS = [
  { key: 'lead', class: '' },
  { key: 'trail', class: 'opacity-55 [animation-delay:1.35s]' }
]
</script>
