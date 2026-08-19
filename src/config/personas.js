// Who the person using this dashboard is — the onboarding fork.
//
// PURE DATA ON PURPOSE, the same idiom as src/config/features.js: no imports, no
// Vue, so it stays readable from plain Node and adding a persona is a data edit.
//
// The three keys are derived from our own screen list rather than from onboarding
// literature: each persona owns a cluster of the 54 screens and the clusters
// barely overlap, which is what makes one question worth asking at all. The full
// derivation is in todos/site-overhaul-plan.md §3.
//
// WHAT A PERSONA IS ALLOWED TO DO, once the tour is built: pick which onboarding
// script runs, which act card on Home is expanded, which nav section starts open,
// and where sign-in lands. WHAT IT MUST NEVER DO: change what exists in the
// sidebar. A nav that hides rows by role means support and documentation can no
// longer say "click Pipes" and be sure it is there, and a marketer who needs
// Secrets once a quarter concludes the feature does not exist. Persona reorders
// and pre-expands; only entitlements remove.
//
// Deliberately NOT transcribed here: §3's "their screens" and "proof they trust"
// columns. Nothing reads them yet, and config nobody reads goes stale silently.
export const PERSONAS = [
  {
    key: 'engineer',
    // `label` is the third-person name (Settings, later analytics); `cardTitle`
    // is what the person reads about themselves in the question. Both exist
    // because "Engineer" is the wrong voice in a question and "I build the
    // pipes" is the wrong length in a badge.
    label: 'Engineer',
    cardTitle: 'I build the pipes',
    job: 'Get data in, correct, routed and observable.',
    outcome: 'Fire a real event and follow it all the way to delivery.',
    // Stated on the card because a time expectation is most of what makes an
    // onboarding safe to start. Update it when the script in §6 changes length.
    estimate: '~10 min · 5 steps'
  },
  {
    key: 'marketer',
    label: 'Marketer',
    cardTitle: 'I run the campaigns',
    job: 'Turn fans into audiences and messages.',
    outcome: 'Meet one fan, build an audience, send one message.',
    estimate: '~10 min · 5 steps'
  },
  {
    key: 'analyst',
    label: 'Analyst or exec',
    cardTitle: 'I answer for the numbers',
    job: 'Trust the numbers, and get them out.',
    outcome:
      'See what the club knows, where it came from, and how to get it into your BI.',
    estimate: '~8 min · 4 steps'
  }
]

// There is deliberately no fourth "not sure" card. Three cards is already at the
// limit of a question someone will answer in two seconds, and a fourth undermines
// the routing it exists to do — Skip is the escape hatch instead.

// Every key that exists, for the validation in useOnboarding.js.
export const PERSONA_KEYS = PERSONAS.map(p => p.key)

export default PERSONAS
