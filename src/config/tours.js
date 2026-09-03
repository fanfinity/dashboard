// The guided walkthroughs — where the spotlight goes and what it says there.
//
// PURE DATA ON PURPOSE, the same idiom as features.js, personas.js and
// screens.js: no imports, no Vue, so a step is a copy edit rather than a code
// change and plain Node can read the file.
//
// ONE TOUR TODAY, and all three personas run it. The three chapter scripts in
// todos/site-overhaul-plan.md §6 route the marketer and analyst through
// /audiences, /journeys and /reporting, every one of which is dark in
// features.js — so a per-role script would spotlight two dead ends. What every
// role does need first is identical, and it is this: connect one source and the
// warehouse and the pipe come with it.
//
// A STEP IS SHOWN BY THE PAGE THAT OWNS THE STATE, never inferred by the tour.
// `SourceCreatePage` watches its own three-step flow and calls
// `useGuidedTour().show('source-configure')` when it advances; the tour renders
// whatever it was last told and knows nothing about routes or forms. That is
// what keeps a coachmark from surviving the thing it is pointing at — a tour
// that guesses is a tour that says "click Create" on a screen with no Create.
//
// `anchor` is a `data-tour` attribute value, and the two halves have to be kept
// in step by hand: a step whose anchor is not in the DOM renders NOTHING rather
// than a callout floating in the corner, which is the failure mode to prefer but
// also a silent one. The anchors live on:
//   source-intent   → the intent picker wrapper, SourceCreatePage step 1
//   source-template → the "Which one?" section, on a multi-template intent only
//   source-submit   → the StickyActionBar of SourceCreatePage step 2
//   source-verify   → the "Check for events" button, SourceInstallGuide
export const TOURS = {
  'source-setup': {
    id: 'source-setup',
    label: 'Connect your first source',
    // The step ids, in order, so a callout can say "1 of 3" without each step
    // carrying a number that goes stale when one is inserted.
    //
    // A NESTED ARRAY IS ONE RUNG WITH TWO POSSIBLE CALLOUTS, and rung 2 needs it.
    // "An online store" covers Zid and Shopify, so the form opens with a
    // "Which one?" picker and an outstanding decision — pointing at Create there
    // would ring a disabled button and dim the card that is actually the next
    // click. The page picks which of the two ids to show; the COUNT stays three
    // either way, because a walkthrough that grows a rung under you is the same
    // failure the source stepper refuses (see CLAUDE.md on Zid not being a
    // fourth step).
    steps: [
      'source-intent',
      ['source-template', 'source-configure'],
      'source-install'
    ]
  }
}

export const TOUR_STEPS = {
  'source-intent': {
    tour: 'source-setup',
    anchor: 'source-intent',
    title: 'Start here',
    // Says what the answer DOES, not what the control is. "Pick an option" is
    // information the cards already carry; that the answer settles the template
    // and shapes the next screen is not.
    body: 'Pick what you are connecting. Your answer chooses the template, names the source for you, and decides what the next step asks for.'
  },
  // Rung 2, when the chosen intent still covers more than one platform. The page
  // shows this instead of 'source-configure' while `form.templateId` is empty.
  'source-template': {
    tour: 'source-setup',
    anchor: 'source-template',
    title: 'Which platform?',
    body: 'What you picked covers more than one. Choose the platform you are actually wiring up — it settles the template, names the source, and decides what the rest of this form asks for.'
  },
  'source-configure': {
    tour: 'source-setup',
    anchor: 'source-submit',
    title: 'Then create it',
    // The spotlight sits on the action row rather than on the Create button
    // alone, deliberately: on a Zid source Create is disabled until the store
    // grants access, and the sentence explaining why is in that row. A ring
    // around a dead button with the reason outside it is worse than no ring.
    body: 'The details above are filled in from the template — change the name if you like. Create is here. For a website or an online store we set up the warehouse and the pipe in the same call.'
  },
  'source-install': {
    tour: 'source-setup',
    anchor: 'source-verify',
    title: 'Last step',
    body: 'Put the snippet on your site, then check here. We look for a real event that actually reached this source, not just whether the tag is on the page.'
  }
}

/**
 * @param {string} id A step id.
 * @returns {object|null} The step, or null for anything unknown — a renamed id
 *   must read as "no step" rather than resolving to a half-built callout.
 */
export function tourStep(id) {
  return TOUR_STEPS[id] ?? null
}

/**
 * Where a step sits in its tour, for the "2 of 3" line.
 *
 * @param {string} id A step id.
 * @returns {{ index: number, total: number }|null}
 */
export function tourPosition(id) {
  const step = TOUR_STEPS[id]
  const tour = step && TOURS[step.tour]
  if (!tour) return null
  // A rung may be a single id or a list of alternatives sharing one position.
  const index = tour.steps.findIndex(rung =>
    Array.isArray(rung) ? rung.includes(id) : rung === id
  )
  if (index < 0) return null
  return { index: index + 1, total: tour.steps.length }
}

export default TOURS
