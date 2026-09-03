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
// WHAT A PERSONA IS ALLOWED TO DO: pick which onboarding script runs, the ORDER
// of the sidebar (`nav`), which nav group starts expanded, the ORDER and
// emphasis of the Dashboard's blocks (`home`), and the WORDING of the arrival's
// second beat (`onboarding`). WHAT IT MUST NEVER DO: change
// what exists in the sidebar. A nav that hides rows by role means support and
// documentation can no longer say "click Pipes" and be sure it is there, and a
// marketer who needs Secrets once a quarter concludes the feature does not
// exist. Persona reorders and pre-expands; only entitlements remove.
//
// THAT INVARIANT IS ENFORCED BY THE SHAPE OF THE DATA BELOW, not by review.
// Every list here is a FRONT-LOADING order, never a whitelist: MainLayout and
// DashboardHomePage hoist the keys they recognise and append everything else in
// its authored position. So a typo, a renamed key or a nav group added later
// degrades to "in the wrong place" and never to "missing". Do not change either
// consumer to `filter` on these lists.
//
// Deliberately NOT transcribed here: §3's "their screens" and "proof they trust"
// columns, and the per-persona tour length that used to sit on each card as
// `estimate`. Nothing reads them — the tour itself is a later phase — and config
// nobody reads goes stale silently.
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

    // The arrival's second beat, in this reader's own terms. See the note under
    // DEFAULT_HOME for why this one is authored per persona with no default.
    onboarding: {
      headline: "Let's build your first pipeline",
      lede: 'Connect a source and we provision its warehouse and the pipe feeding it in the same call. There is no glue to write between them.',
      payoff:
        'You end up with an ingest endpoint, a write key, and a delivery path you can watch.'
    },

    // BOTH null, which means "as authored" — see DEFAULT_HOME below. The
    // sidebar and the Dashboard were designed for this reader, so engineer is
    // the identity ordering; spelling it out as a list that happens to match
    // the authored one would be two places to keep in agreement for no gain.
    // It also makes engineer byte-identical to an unanswered or skipped
    // question, which is the only path scripts/smoke.mjs can walk.
    nav: null,
    home: null
  },
  {
    key: 'marketer',
    label: 'Marketer',
    cardTitle: 'I run the campaigns',
    job: 'Turn fans into audiences and messages.',

    onboarding: {
      headline: "Let's get your fans flowing in",
      lede: 'Campaigns need fans, and fans come from events. Connect the place they happen — your website or your store — and we set up where that data lands.',
      payoff:
        'Every visit and purchase then starts building the profiles you will segment.'
    },

    nav: {
      // Profiles is promoted out of FANS and up next to Dashboard: it is this
      // reader's home screen, and it was three sections down behind a collapsed
      // group. FANS then has no members left, so the caption goes with it.
      lead: ['dashboard', 'profiles', 'live-events'],
      // Who and how much comes before the plumbing. ACTIVATE and ENGAGE are
      // this persona's natural sections and are deliberately NOT hoisted:
      // Audiences, Campaigns and Engage are all switched off in features.js, so
      // leading with them would put a wall of `Soon` pills above every live row
      // — the exact failure the ACCOUNT placement in MainLayout guards against.
      sections: ['ACCOUNT', 'COLLECT'],
      // Landing with the profile screens already listed is most of the point of
      // hoisting the group.
      expand: ['profiles']
    },
    home: {
      // Fans first, plumbing last. `flow` (the source → pipe → destination
      // diagram) is the most engineer-shaped block on the page, so it goes to
      // the bottom rather than away: it is still the answer to "why did this
      // audience stop growing?".
      blocks: ['profiles', 'throughput', ['errors', 'events'], 'flow'],
      subtitle: 'Fans and delivery',
      primaryAction: 'search-profiles',
      // A one-line count that expands on click. A marketer reading "Enabled,
      // but no events received in the last hour" about four sources has been
      // handed someone else's job; the count is the part they need, and the
      // detail is one click away for when they take it to whoever owns it.
      collapseAttention: true,
      // "Connect a source" and the three-step tracker are the setup story, and
      // they stop being this reader's business the moment setup is done. While
      // it is NOT done they both stay: a workspace with no data has nothing
      // else worth saying.
      hideSetupWhenComplete: true
    }
  },
  {
    key: 'analyst',
    label: 'Analyst or exec',
    cardTitle: 'I answer for the numbers',
    job: 'Trust the numbers, and get them out.',

    onboarding: {
      headline: "Let's get numbers you can stand behind",
      lede: 'Nothing can be measured until something is collected. Connect a source and we provision its warehouse and the pipe feeding it in the same call.',
      payoff:
        'The dashboard then has something behind its counts, and your warehouse has a table to query.'
    },

    nav: {
      // Watching the stream is this reader's first move, so it leads.
      lead: ['live-events', 'dashboard'],
      // COLLECT is already the first captioned section; what is wrong for an
      // analyst is the order INSIDE it — Warehouse and Monitoring are where
      // "can I trust this, and how do I get it out?" is answered, and they sat
      // below four screens about configuring ingestion. Keyed by caption, so a
      // section that gets renamed simply stops matching and keeps its authored
      // order.
      first: { COLLECT: ['warehouse', 'monitoring'] },
      expand: ['warehouse', 'monitoring']
    },
    home: {
      // The record first, then the shape of it, then where it goes.
      blocks: [
        'events',
        'throughput',
        'warehouse-handoff',
        ['errors', 'profiles'],
        'flow'
      ],
      subtitle: 'Events and delivery',
      primaryAction: 'live-events',
      collapseAttention: true,
      hideSetupWhenComplete: true
    }
  }
]

// Home as authored: what an UNANSWERED question, a SKIPPED one and the engineer
// persona all render. It lives here rather than in DashboardHomePage so there is
// one definition of "the default layout" and `home: null` above can mean it,
// instead of a second copy in the page drifting from this one.
//
// `blocks` is the render order, and a nested array is one row of side-by-side
// blocks. The ids are matched by name in the page's template; an id nothing
// matches renders nothing, which is why this is a layout list and not a place to
// invent a block.
//
// NOTE THE ASYMMETRY WITH `nav`: this list is an ENUMERATION, not a front-load.
// The nav lists cannot drop a row on a typo; these can — omit a block and it
// does not render. That is deliberate, and it is what lets engineer and marketer
// leave `warehouse-handoff` out. The cost is that a seventh block added later
// has to be added to each persona that wants it, and a misspelled id disappears
// silently. Do not "fix" this by appending unlisted ids: an unordered block
// landing at the bottom of somebody's Home is not obviously better than an
// absent one, and it would make the three lists stop describing the page.
export const DEFAULT_HOME = {
  blocks: ['throughput', 'flow', ['errors', 'events'], 'profiles'],
  subtitle: 'Fan data pipeline',
  primaryAction: 'connect-source',
  // The needs-attention list stays open: this reader came to find out what is
  // broken, so hiding it behind a click would cost them the click.
  collapseAttention: false,
  // Setup progress stays visible even once all three steps are done, until it
  // is dismissed — it is this reader's own checklist.
  hideSetupWhenComplete: false
}

// `onboarding` HAS NO DEFAULT, and that asymmetry with `nav` and `home` is the
// point rather than an oversight. Those two describe surfaces every reader sees,
// so an unanswered or skipped question needs something to fall back to. The
// arrival's second beat is the opposite: it exists only because a role was just
// chosen, and MainLayout never opens it without one — skipping goes straight
// back to Home, which is the whole meaning of skipping. So there is no reader a
// DEFAULT_ONBOARDING would ever speak for, and engineer is authored in full here
// rather than left `null` like its `nav`/`home`.
//
// All three say the same thing in three vocabularies: connect one source, and
// the warehouse and the pipe come with it. That is deliberate and it is a
// constraint, not a lack of imagination — the marketer and analyst chapter
// scripts in todos/site-overhaul-plan.md §6 route through /audiences,
// /journeys and /reporting, every one of which is switched off in features.js.
// Three roles pointed at the one path that actually works today beats three
// roles pointed at two dead ends.

// There is deliberately no fourth "not sure" card. Three cards is already at the
// limit of a question someone will answer in two seconds, and a fourth undermines
// the routing it exists to do — Skip is the escape hatch instead.

// Every key that exists, for the validation in useOnboarding.js.
export const PERSONA_KEYS = PERSONAS.map(p => p.key)

export default PERSONAS
