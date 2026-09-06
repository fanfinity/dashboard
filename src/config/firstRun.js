// What the first-run onboarding says, as data.
//
// PURE DATA, NO IMPORTS, the same idiom as src/config/features.js and
// src/config/sourceIntents.js: this is the first paragraph the product says to
// anybody, and changing a word in it should not mean reading a component.
//
// IT REPLACED src/config/personas.js. That registry existed to answer "what do
// you do?" and then reorder the sidebar and the dashboard from the answer — a
// role picked in the first ten seconds, driving an ordering nobody could see the
// effect of, on a rail where every row stayed anyway. The ordering is gone and
// so is the question; what a new account actually needs first is not a role, it
// is the one thing only they can supply: where their customer activity happens.
//
// THE CATEGORIES ARE NOT HERE, DELIBERATELY. They are SOURCE_INTENTS in
// src/config/sourceIntents.js, which is the same list `/sources/new` step 1
// renders. Two taxonomies would be two things to keep in step, and they would
// drift the first time a connector shipped — onboarding would offer a category
// the create flow could not receive. Onboarding picks a subset by key and hands
// that key over in the URL; `PICKER_INTENTS` below is that subset.
//
// SEVEN BEATS, AND THAT IS A REVERSAL OF WHAT THIS FILE USED TO SAY. It used to
// hold three — welcome → category → platform — and hand off to `/sources/new`
// for install → verify → provision → ready, on the grounds that those four
// already existed there wired to real endpoints and a second copy would have to
// be kept in agreement with the first. The cost of that hand-off was the thing
// it was defending: a new account was walked through two screens of orientation
// and then dropped onto a create form with a stepper of its own, a details form
// nobody had been prepared for, and a different visual grammar — the arrival
// stopped mid-sentence.
//
// The flow now runs welcome → category → platform → (authorize) → connect →
// verify → setup → ready, which is the prototype's, and the duplication the old
// rule feared is avoided by REUSING the real components rather than by stopping
// early: the connect beat renders `SourceInstallGuide`, the verify beat calls the
// same `listSourceEvents`, and the setup beat reads `useSourceProvisioning`. One
// install guide, three entry points.
//
// WHAT IS DELIBERATELY NOT PORTED is the prototype's eighth beat, "Waiting for
// your first event". The verify beat already proves an event arrived — it is
// what unlocks the rest — so a screen afterwards waiting for one asks the reader
// to wait for something that has happened.

/** The headline beat: what Sfere is for, before it asks for anything. */
export const FIRST_RUN_WELCOME = {
  eyebrow: 'Getting started',
  headline:
    'Bring your customer data into one place without building the plumbing yourself.',
  lede: 'Connect where your customer activity happens. Sfere will capture the events, prepare storage, and create the data flow for you, so you can start seeing what your customers are doing instead of configuring infrastructure.',
  cta: 'Start connecting my data →',
  // The claim that does most of the work on this screen, and the one most likely
  // to be disbelieved — so it gets its own band rather than a bullet.
  warehouse: {
    title: 'Your data warehouse is included from day one.',
    body: 'Sfere provides the warehouse for you, powered by ClickHouse, and we cover the warehouse cost so you can start without setting up or paying for a separate data warehouse.'
  },
  // Three steps, numbered, because the sequence is the reassurance: the reader
  // does one thing and the product does the other two.
  steps: [
    {
      key: 'connect',
      number: '01',
      mark: 'web',
      title: 'Connect your customer touchpoints',
      body: 'Website, online store, mobile app, and more.'
    },
    {
      key: 'prepare',
      number: '02',
      mark: 'warehouse',
      title: 'Sfere prepares your data layer',
      body: 'Your included storage and first pipeline are prepared automatically.'
    },
    {
      key: 'observe',
      number: '03',
      mark: 'analytics',
      title: 'Start seeing customer activity',
      body: 'Events begin flowing into one place, ready for you to explore.'
    }
  ]
}

// The picture under the welcome copy: touchpoints on the left, the Sfere mark in
// the middle, the outcome on the right, with a wire and a travelling dot between
// each pair.
//
// COPY ONLY. The geometry is OnboardingFlowDiagram.vue's, for the reason
// sourceIntents.js gives about its own marks: a shape that needs two elements
// cannot live in a config file. `mark` names a FlowNodeIcon glyph.
//
// IT IS NOT A FlowTopology. That component draws MEASURED curves between real
// records and reports a per-node status out of `flowStatus.js`; this is an
// illustration of a product with no account behind it yet, where every node is
// hypothetical and a status would be a claim about nothing. Sharing the
// component would mean teaching it to render nodes that do not exist.
export const FIRST_RUN_FLOW = {
  touchpoints: [
    { key: 'web', mark: 'web', label: 'Website' },
    { key: 'store', mark: 'store', label: 'Online store' },
    { key: 'app', mark: 'app', label: 'Mobile app' }
  ],
  capabilities: ['Capture', 'Connect', 'Deliver'],
  result: {
    kicker: 'Your data flow',
    title: 'Customer activity',
    body: 'Connected and ready to explore'
  }
}

/** The question beat. */
export const FIRST_RUN_CATEGORY = {
  eyebrow: 'Step 1',
  headline: 'Where does your customer activity happen?',
  lede: 'Choose the closest match. We will ask for the specific platform on the next screen.',
  hint: 'You can connect more sources later.'
}

/** The narrowing beat, for the two categories that cover several platforms. */
export const FIRST_RUN_PLATFORM = {
  eyebrow: 'Step 2',
  hint: 'Don’t see yours? You’ll be able to browse every other source.'
}

// The one control that leaves the flow, and the only one on the arrival that is
// not an answer.
export const FIRST_RUN_SKIP = 'Skip setup · Go to dashboard →'

// Which SOURCE_INTENTS keys the category beat offers, in this order.
//
// FOUR, NOT SIX, and the two that are missing are the point. `/sources/new`
// offers all six because somebody on that screen has already decided to add a
// source and is choosing between real options. This screen is the first thing a
// new account sees, and "Payments" and "My own backend" are the long tail: six
// equal cards on an arrival screen says all six are equally likely, which is a
// layout asserting something untrue about the product. Both remain one click
// away — "Something else" leads to the connector catalog.
//
// A key that no longer resolves is dropped by the consumer rather than
// rendering an empty card, so removing an intent from sourceIntents.js cannot
// break this screen.
export const PICKER_INTENTS = ['website', 'store', 'app', 'connector']

// What each card says HERE, which is not what it says on `/sources/new`.
//
// The create flow's copy is comparative — it is helping somebody choose between
// six options they are already committed to browsing, so it leads with proper
// nouns ("Zid, Salla or Shopify"). This is orientation: the reader may not yet
// know that a website and a store are different answers. So the body names the
// thing rather than the vendors, and the vendors move to a quieter second line.
//
// Keyed by intent key, and a key with no entry falls back to the intent's own
// `title` with no body — an intent added to sourceIntents.js and forgotten here
// degrades to a plainer card, never to a blank one.
export const PICKER_COPY = {
  website: {
    title: 'Website',
    body: 'Capture visits, page views, clicks, and other actions on your site.',
    examples: 'For any website or web application'
  },
  store: {
    title: 'Online store',
    body: 'Bring in shopping activity, customers, carts, orders, and more.',
    examples: 'For example: Zid, Salla, Shopify'
  },
  app: {
    title: 'Mobile app',
    body: 'Capture the actions customers take inside your mobile experience.',
    examples: 'iOS or Android'
  },
  connector: {
    title: 'Something else',
    body: 'Explore other ways to bring data into Sfere.',
    examples: 'Browse all supported sources'
  }
}

// The third beat, keyed by the category that leads to it.
//
// A CATEGORY WITH NO ENTRY HERE SKIPS THIS BEAT ENTIRELY, which is what makes
// "Website" one click from the create form: `web-sdk` is the only template
// behind it, so asking "which website platform?" would be a screen with one
// answer. The same is true of `connector`, which is not a template at all.
//
// `templateId` is an id in public/data/source-templates.json, and it is what
// travels to `/sources/new` as `?template=`. An entry with no `templateId` is a
// deliberate "let the create form ask" — "Both" covers iOS and Android, which
// are two sources rather than one, and the create form is where that gets
// settled.
//
// SHOPIFY IS LISTED AND WILL RENDER GREYED. `COMING_SOON_TEMPLATE_IDS` in
// sourceIntents.js is the single switch, the picker reads it, and listing the
// card is the point: "where is Shopify?" is answered by a card that says
// `Coming soon`, not by an absence. Deleting the id from that array is the whole
// of switching it on here too.
export const PLATFORM_CHOICES = {
  store: {
    headline: 'Which online store do you use?',
    lede: 'Choose your platform and we will guide you through the right connection.',
    options: [
      {
        key: 'zid',
        templateId: 'zid',
        title: 'Zid',
        body: 'Connect your Zid store and bring shopping activity into Sfere.'
      },
      {
        key: 'salla',
        templateId: 'salla',
        title: 'Salla',
        body: 'Connect your Salla store and bring orders and customers into Sfere.'
      },
      {
        key: 'shopify',
        templateId: 'shopify',
        title: 'Shopify',
        body: 'Connect Shopify customers, orders, carts, and store activity.'
      }
    ]
  },
  app: {
    headline: 'Which mobile platform are you using?',
    lede: 'Choose the platform you want to connect first.',
    options: [
      {
        key: 'ios',
        templateId: 'ios-sdk',
        title: 'iOS',
        body: 'Connect your iOS application with the Sfere SDK.'
      },
      {
        key: 'android',
        templateId: 'android-sdk',
        title: 'Android',
        body: 'Connect your Android application with the Sfere SDK.'
      },
      {
        key: 'both',
        templateId: '',
        title: 'Both',
        // ONE SOURCE, NOT TWO, and the copy has to say so because the behaviour
        // changed under it. This card used to hand off to the create form with
        // nothing pre-selected, so "add the second as its own source" described
        // what happened next. The arrival creates the source itself now, and for
        // this card it creates a single `event_stream` source that both apps
        // write to — one write key, one install, and the same native snippet the
        // iOS and Android cards get, because `methodsForSource` narrows both to
        // the same method.
        body: 'One source that both your iOS and Android apps send to, with a single install.'
      }
    ]
  }
}

/** Whether picking this category needs the platform beat at all. */
export function needsPlatformStep(intentKey) {
  return Boolean(PLATFORM_CHOICES[intentKey])
}

// ---------------------------------------------------------------------------
// BEATS FOUR TO SEVEN: connect, verify, setup, ready.
//
// The prototype writes every one of these for a website and only for a website
// ("Connect your website", "Make sure Sfere is actually receiving an event from
// your website"). Onboarding reaches them for a store and a mobile app too, so
// the one word that changes is factored out as a NOUN per category rather than
// three near-copies of each paragraph. Everything else is the prototype's copy
// verbatim.
// ---------------------------------------------------------------------------

// What the category is called mid-sentence. Keyed by SOURCE_INTENTS key.
//
// `possessive` reads "…receiving an event from your website"; `subject` reads
// "Your website is connected". Both are needed because English does not let one
// string do both jobs, and a sentence assembled out of the wrong one ("Your your
// website") is the sort of thing that ships.
export const SETUP_NOUNS = {
  website: {
    possessive: 'your website',
    subject: 'Your website',
    short: 'Website'
  },
  store: {
    possessive: 'your online store',
    subject: 'Your online store',
    short: 'Online store'
  },
  app: {
    possessive: 'your mobile app',
    subject: 'Your mobile app',
    short: 'Mobile app'
  }
}

/** The mid-sentence noun for a category, falling back to a neutral one. */
export function setupNoun(intentKey) {
  return (
    SETUP_NOUNS[intentKey] ?? {
      possessive: 'your source',
      subject: 'Your source',
      short: 'Source'
    }
  )
}

// The authorization beat, for the two store platforms that need a grant before a
// source can exist at all.
//
// IT IS A BEAT HERE AND A FIELD ON `/sources/new`, and that is not an
// inconsistency to tidy. On the create form the template is settled halfway down
// step 2, so growing a rung the moment somebody picks Zid would be a wizard
// changing shape under them — CLAUDE.md says so and it is still true there. Here
// the platform is settled a whole beat earlier, by a click that has already
// happened, so the grant is simply the next thing to do and has a screen of its
// own. It also has to: the backend refuses a Zid source without a `store_id`, so
// there is nothing to create and therefore no install guide to show until the
// merchant has granted access.
export const FIRST_RUN_AUTHORIZE = {
  eyebrow: 'Authorize your store',
  headline: 'Connect your store to Sfere',
  lede: 'Grant Sfere access to your store so it can read orders, customers and cart activity. You will sign in on your store platform, then come back here.',
  hint: 'We only read the activity needed to build your customer data.'
}

// The install beat. `headline` and `lede` are the prototype's, with the noun
// swapped per category.
export const FIRST_RUN_CONNECT = {
  eyebrow: 'Connect your source',
  cta: 'I’ve installed Sfere →',
  // The store platforms install nothing — the grant on the beat before is the
  // install — so their CTA cannot claim a snippet was pasted.
  ctaConnected: 'Continue →',
  lede: 'Choose the setup that matches your setup. You only need to install Sfere once.',
  // The one paragraph on this beat that is not about a control, and the most
  // useful thing on the screen for the reader who cannot act on it themselves.
  devNote: {
    title: 'Not the person who manages your website?',
    body: 'Copy the setup instructions and share them with your developer. You can come back here anytime to confirm the connection.'
  },
  // Shown while the source row is being created, which is a real request and
  // therefore a real wait. The prototype has no such state because it creates
  // nothing.
  preparing: 'Preparing your source…'
}

/**
 * The paragraph under the install card, for the reader who cannot act on it.
 *
 * THE PROTOTYPE WRITES IT FOR A WEBSITE ("Not the person who manages your
 * website?") and it is the single most useful sentence on the beat, because the
 * person who signs up for a CDP is frequently not the person with commit access.
 * A store installs nothing — the grant on the beat before was the install — so
 * that path has no such sentence rather than a reworded one that asks the reader
 * to forward instructions that do not exist.
 */
export function devNoteFor(intentKey) {
  if (intentKey === 'store') return null
  if (intentKey === 'app') {
    return {
      title: 'Not the person who builds your app?',
      body: 'Copy the setup instructions and share them with your developer. You can come back here anytime to confirm the connection.'
    }
  }
  return {
    title: 'Not the person who manages your website?',
    body: 'Copy the setup instructions and share them with your developer. You can come back here anytime to confirm the connection.'
  }
}

/** The install beat's headline and lede for a category. */
export function connectCopyFor(intentKey) {
  const noun = setupNoun(intentKey)
  if (intentKey === 'store') {
    return {
      headline: `Connect ${noun.possessive}`,
      lede: 'Your store is authorized. Register the webhooks and run a first sync so Sfere starts receiving activity.'
    }
  }
  if (intentKey === 'app') {
    return {
      headline: `Connect ${noun.possessive}`,
      lede: 'Add the Sfere SDK to your app once. You only need to install it a single time.'
    }
  }
  return {
    headline: `Connect ${noun.possessive}`,
    lede: 'Choose the setup that matches your website. You only need to install Sfere once.'
  }
}

// The verification beat.
//
// "SEND A TEST EVENT" IS NOT HERE FOR EVERY CATEGORY, AND THAT IS A DELIBERATE
// GAP RATHER THAN AN OMISSION. The prototype pairs "Check for events" with
// "Send a test event", and the dashboard cannot send an event: writing to a
// collector is the backend's job and the CSP names no collector host (CLAUDE.md,
// "Data architecture" — it is a hard rule, not a preference). A button that
// reported a test event it had not sent would be the worst kind of green tick.
// What a STORE source has instead is real: `POST …/sources/{id}/test` asks the
// backend whether it can reach the upstream platform, which is the honest half
// of the same reassurance, so that button appears only where it does something.
export const FIRST_RUN_VERIFY = {
  eyebrow: 'Confirm installation',
  headline: 'Confirm it’s working',
  cardTitle: 'Check your connection',
  statusWaiting: 'Waiting for first event',
  statusChecking: 'Checking for events…',
  statusFound: 'Event received',
  check: 'Check for events',
  testConnection: 'Test connection',
  back: '← Back to installation',
  cta: 'Continue setup →',
  // Shown beside the forward control when a check has run and found nothing. The
  // reader is let through — see `canContinue` in FirstRunVerify for why — and
  // this is what stops that reading as the check having been waived.
  continueWithout: 'You can continue and check again later.',
  confirmed: {
    title: 'Installation confirmed.',
    body: 'Sfere received an event from this source and can start collecting activity.'
  },
  // Nothing arrived. Not an error — an install that has not been exercised yet
  // is the ordinary case on this screen — so it reads as "not yet", never as a
  // failure.
  notYet: {
    title: 'No events yet.',
    body: 'Nothing has reached this source so far. Open a page where Sfere is installed, interact with it, then check again.'
  }
}

/** The verification beat's lede and instruction for a category. */
export function verifyCopyFor(intentKey) {
  const noun = setupNoun(intentKey)
  if (intentKey === 'store') {
    return {
      lede: `Make sure Sfere is actually receiving activity from ${noun.possessive} before we finish your setup.`,
      instruction:
        'Place a test order or update a product in your store, then come back and check. We look for a real event that reached this source, not only whether the connection exists.'
    }
  }
  if (intentKey === 'app') {
    return {
      lede: `Make sure Sfere is actually receiving an event from ${noun.possessive} before we finish your setup.`,
      instruction:
        'Run a build with the SDK installed and use the app for a moment, then come back and check. We look for a real event that reached this source, not only whether the SDK is present.'
    }
  }
  return {
    lede: `Make sure Sfere is actually receiving an event from ${noun.possessive} before we finish your setup.`,
    instruction:
      'Open a page where Sfere is installed and interact with it, then come back and check. We look for a real event that reached this source, not only whether the snippet exists on the page.'
  }
}

// The provisioning beat. Three rows, and only the first is true of every source.
//
// ROWS TWO AND THREE ARE NOT TRUE OF EVERY SOURCE TYPE, which is why this beat
// reads `useSourceProvisioning` instead of animating two timeouts the way the
// prototype does. `POST …/sources/provisioned` builds a ClickHouse database, a
// destination and a pipeline for a `web` or `zid` source and NOTHING for an
// `event_stream` one — so on an iOS source the prototype's checklist would tick
// "Preparing your included storage" over a warehouse that was never built. The
// beat has a second shape for that case (`unprovisioned` below) rather than a
// confident lie, and `SETUP_ROWS` is only the provisioned one.
export const FIRST_RUN_SETUP = {
  eyebrow: 'Almost there',
  headline: 'Your source is connected. We’re preparing the rest.',
  lede: 'You don’t need to create a destination or pipeline manually. Sfere is doing that for you now.',
  cta: 'Continue →',
  note: {
    title: 'What’s happening?',
    body: 'A pipeline is simply the route your data follows. Sfere creates the first one automatically so you can start with a working setup instead of an empty configuration screen.'
  },
  // The honest branch: the source is real and receiving, and the backend
  // provisioned no warehouse for this type. Says what exists and what does not,
  // and does not pretend a step is still running.
  unprovisioned: {
    headline: 'Your source is connected.',
    lede: 'This source type does not come with a warehouse of its own, so there is no destination or pipeline to prepare yet. You can add one whenever you are ready.',
    rowTitle: 'No destination yet',
    rowBody:
      'Nothing was provisioned for this source type. Add a destination from the Destinations screen when you want somewhere to deliver to.'
  },
  // The read failed. Distinguished from "nothing was provisioned" for the reason
  // `useSourceProvisioning` distinguishes them: one is a fact about the account
  // and the other is a fact about the request.
  unavailable: {
    rowTitle: 'Couldn’t confirm your data flow',
    rowBody:
      'Your source is connected. We could not read back what was provisioned for it just now — this does not affect the events already arriving.',
    retry: 'Check again'
  }
}

/** The provisioning checklist, for a source type the backend does provision. */
export function setupRowsFor(intentKey) {
  const noun = setupNoun(intentKey)
  return [
    {
      key: 'source',
      title: 'Source connected',
      body: `We can receive activity from ${noun.possessive}.`
    },
    {
      key: 'storage',
      title: 'Preparing your included storage',
      body: 'Setting up ClickHouse for your account.'
    },
    {
      key: 'flow',
      title: 'Connecting the data flow',
      body: `Creating the pipeline from ${noun.possessive} to ClickHouse.`
    }
  ]
}

// The last beat.
//
// `summary` IS FILLED FROM THE RECORDS, not from this file: the destination and
// pipeline names come out of the provisioning lookup, so the screen names the
// warehouse the backend actually built rather than the word "ClickHouse" over
// whatever happened. The labels are the prototype's.
export const FIRST_RUN_READY = {
  badge: '✓ Setup complete',
  headline: 'You’re ready to start receiving customer activity.',
  cta: 'Go to dashboard',
  labels: {
    source: 'Connected source',
    destination: 'Included destination',
    flow: 'Data flow'
  },
  flowValue: 'Created automatically',
  // Same two shapes as the setup beat, for the same reason.
  unprovisioned: {
    headline: 'Your source is connected.',
    destinationValue: 'Not set up yet',
    flowValue: 'Add one when you are ready'
  }
}

/**
 * The last beat's paragraph.
 *
 * IT TAKES `verified` AS WELL AS `provisioned`, because the two answer different
 * questions and only one of them is settled by the time somebody gets here.
 * `provisioned` is a fact about what the create call built, and it is always
 * known. `verified` is whether an event has actually arrived — and the beat
 * before this one lets a reader through on a check that found nothing, since the
 * usual reason is a snippet that has not been deployed yet rather than a broken
 * install. So the copy states the setup as done (it is) and is careful not to
 * assert traffic that has not been seen.
 */
export function readyLedeFor(intentKey, provisioned, verified = false) {
  const noun = setupNoun(intentKey)
  const arriving = verified
    ? 'Events are already arriving.'
    : 'As soon as activity happens, it will start arriving here.'

  if (!provisioned) {
    return `${noun.subject} is connected. ${arriving} There is no destination or pipeline yet — add one whenever you want to deliver this activity somewhere.`
  }
  return `${noun.subject} is connected, ClickHouse is ready, and Sfere has created the first pipeline between them. ${arriving} There’s nothing else you need to configure right now.`
}

// What a source created by the arrival is called, since the arrival never asks.
//
// THE PROTOTYPE ASKS FOR NEITHER A NAME NOR A SLUG and the backend requires
// both, so they are derived from the answer already given. Keyed by the
// `templateId` the platform beat hands back, with an entry per category for the
// paths that carry no template (`website` resolves `web-sdk` on its own, and the
// mobile "Both" card deliberately carries no id).
//
// A NAME CAN COLLIDE, and the creator handles it rather than this table: a
// second run of the arrival on an account that already has a "Website" source
// retries with a numeric suffix. Naming it "Website 2" is better than refusing
// to create it, and better than a name with a timestamp in it that the reader
// then has to live with.
export const SOURCE_NAMING = {
  'web-sdk': { name: 'Website', sourceType: 'web' },
  zid: { name: 'Zid store', sourceType: 'zid' },
  salla: { name: 'Salla store', sourceType: 'salla' },
  shopify: { name: 'Shopify store', sourceType: 'cloud_app' },
  'ios-sdk': { name: 'iOS app', sourceType: 'event_stream' },
  'android-sdk': { name: 'Android app', sourceType: 'event_stream' },
  'http-api': { name: 'HTTP API', sourceType: 'event_stream' }
}

// What the platform beat's own key renames the source to, where the template id
// would name it wrongly.
//
// ONE ENTRY, AND IT IS THE "BOTH" CARD. Picking Both resolves to the `ios-sdk`
// template because that is what narrows the install guide to the native method —
// the same method serves iOS and Android — but calling the source "iOS app" when
// the reader has just said they have both would be the record disagreeing with
// the answer. One `event_stream` source, one write key, two apps writing to it,
// named for what it is.
export const PLATFORM_NAME_OVERRIDES = {
  both: 'Mobile app'
}

// Where a category with no template of its own lands. `website` has exactly one
// template so it never reaches the platform beat, and the mobile "Both" card
// resolves to one `event_stream` source that both apps write to — one write key,
// two apps, which is what the prototype's "as part of the same onboarding
// journey" describes and what the install guide for that type already shows.
export const CATEGORY_DEFAULT_TEMPLATE = {
  website: 'web-sdk',
  app: 'ios-sdk'
}

export default FIRST_RUN_WELCOME
