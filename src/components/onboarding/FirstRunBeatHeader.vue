<template>
  <!-- The three lines every beat of the arrival opens with: eyebrow, question,
       paragraph. Extracted because there are seven beats now and the prototype
       repeats this block on every one of them — as five copies it was five
       places to keep a heading level and an aria id in step.

       IT OWNS THE TWO ARIA IDS, and that is the load-bearing part rather than
       the markup. `FirstRunOverlay`'s surface is
       `role="dialog" aria-labelledby="first-run-title"
       aria-describedby="first-run-scope"`, so whichever beat is mounted has to
       be the thing carrying those ids or the modal announces itself as unlabelled.
       One component means a new beat cannot forget them. -->
  <div
    class="sfere-flush mx-auto grid max-w-[42.5rem] justify-items-center gap-3 text-center"
  >
    <p
      v-if="eyebrow"
      class="font-sfere-mono text-sfere-eyebrow font-semibold uppercase text-sfere-brand-text"
      >{{ eyebrow }}</p
    >

    <!-- An `h2`, never an `h1`, on every beat. `scripts/smoke.mjs` asserts on
         the FIRST `<h1>` of the route and Home's belongs to `PageHeader`; a
         second one here would make the gate read the arrival's headline as the
         page's title. The SIZE is the point on these screens, and the size is a
         token, so it comes from `text-sfere-h1!`/`text-sfere-h2!` rather than
         from the element. The important SUFFIX is required — Quasar's heading
         rules are unlayered, so `!text-sfere-h2` loses and `text-sfere-h2!`
         wins (CLAUDE.md collision #1). -->
    <h2
      id="first-run-title"
      class="text-balance text-sfere-fg"
      :class="
        size === 'lg'
          ? 'text-sfere-h2! sm:text-sfere-h1!'
          : 'text-sfere-h3! sm:text-sfere-h2!'
      "
    >
      {{ headline }}
    </h2>

    <p
      v-if="lede"
      id="first-run-scope"
      class="text-pretty text-sfere-body text-sfere-fg-muted"
    >
      {{ lede }}
    </p>
  </div>
</template>

<script setup>
defineProps({
  eyebrow: { type: String, default: '' },
  headline: { type: String, required: true },
  lede: { type: String, default: '' },
  // The welcome and the ready beat lead with a statement rather than a question,
  // and the prototype sets both a size larger than the question beats. `lg` is
  // that, and it is a step on the type scale rather than a free number.
  size: {
    type: String,
    default: 'md',
    validator: v => ['md', 'lg'].includes(v)
  }
})
</script>
