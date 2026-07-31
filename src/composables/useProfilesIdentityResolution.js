import { computed } from 'vue'
import { useMockResource } from '@/composables/useMockResource'
import {
  formatDate,
  formatDateTime,
  formatGap,
  formatNumber,
  timeOf
} from '@/composables/useProfilesFormat'

/**
 * Identity resolution for the resolved fan graph: the **rules** that decide
 * when two identifiers belong to the same fan, and the **evidence** behind each
 * stitch those rules produced.
 *
 * NOT `useIdentityResolution` (`/identity-resolution`, the Fan CDP page). That
 * one scores *pairs of live Jitsu contacts* against each other from device,
 * geo, behavioural and temporal event signals, to guess that two anonymous
 * visitors are one person. This one explains the identifier-type rules a
 * resolved profile was actually built with, one merge at a time. The scoring
 * *idea* is deliberately shared — a rarity/strength-weighted sum whose
 * arithmetic is shown in full, so nobody has to take a confidence number on
 * trust — but the inputs, the subject and the data source are different.
 *
 * Sources, both mock JSON through `useMockResource`:
 *
 * - `data/identifier-types.json`  the rules. **Primary**: without them the
 *   screen has nothing to say, so its failure is the page-level `ErrorState`.
 * - `data/profiles.json`          the evidence. **Secondary**: it degrades in
 *   place inside the merges table, which keeps its own retry.
 *
 * @example
 * const ir = useProfilesIdentityResolution()
 * onMounted(ir.load)
 */

// Dimension weights for the confidence sum. They total 1, so a merge scoring
// full marks everywhere is exactly 100.
const WEIGHTS = {
  rule: 0.35,
  uniqueness: 0.25,
  corroboration: 0.25,
  proximity: 0.15
}

// Timing decay: a join half this far out still scores ~0.5. Identifiers that
// arrive months after the profile was seeded are weaker evidence than ones that
// arrive in the same session — weaker, not wrong, which is why this is one
// dimension of four rather than a veto.
const HALF_LIFE_DAYS = 45
const DAY = 86400000

/**
 * How an identifier gets onto a profile.
 *
 * Deterministic: the fan (or a system of record) *declared* the value — it has
 * a warehouse column behind it, or a hard per-fan limit, both of which mean the
 * platform treats it as a key. Probabilistic: an unlimited device-scoped signal
 * like a browser cookie, which one fan can hold many of and two fans can share.
 */
function methodOf(type) {
  const declared =
    (type.dataModels ?? []).length > 0 || type.maxIdentifiers !== null
  return declared
    ? {
        method: 'Deterministic',
        variant: 'brand',
        reason: 'Joined on a declared key — an exact match, not an inference.'
      }
    : {
        method: 'Probabilistic',
        variant: 'neutral',
        reason:
          'Joined on a device-scoped signal. One fan can hold many, and two ' +
          'fans on a shared device can look like one.'
      }
}

function verdictOf(confidence) {
  if (confidence >= 75)
    return { verdict: 'High confidence', variant: 'success' }
  if (confidence >= 60) return { verdict: 'Medium confidence', variant: 'warn' }
  return { verdict: 'Low confidence', variant: 'neutral' }
}

/** `null` priority sorts last rather than as a strong `0`. */
function priorityOf(type, fallback) {
  return Number.isFinite(type.priority) ? type.priority : fallback
}

/**
 * How strongly the identifier's own limit implies "one fan, one value".
 * A type capped at one per fan is a key; an uncapped one is a hint.
 */
function uniquenessOf(max) {
  if (max === 1) return { score: 1, reason: 'One per fan — a unique key.' }
  if (max === null || max === undefined) {
    return {
      score: 0.3,
      reason: 'No per-fan limit, so one value can span many fans and devices.'
    }
  }
  if (max <= 3) return { score: 0.85, reason: `At most ${max} per fan.` }
  return { score: 0.7, reason: `Up to ${max} per fan.` }
}

/** The distinct sources whose event rules can emit this identifier. */
function emittersOf(type) {
  const seen = new Map()
  for (const e of type.eventTypes ?? []) {
    if (e.sourceId && !seen.has(e.sourceId)) seen.set(e.sourceId, e.sourceName)
  }
  return seen
}

/**
 * Does the profile actually carry the sources this rule collects from? A rule
 * that fires on the Web SDK is much better evidence for a fan whose events came
 * from the Web SDK than for one whose did not.
 */
function corroborationOf(type, profile) {
  const emitters = emittersOf(type)
  const models = type.dataModels ?? []
  const sourceIds = profile.sourceIds ?? []

  if (!emitters.size) {
    return models.length
      ? {
          score: 0.6,
          reason: `Supplied by the ${models[0].dataModelName} model rather than a live event stream.`
        }
      : {
          score: 0.3,
          reason: 'No rule declares where this identifier is collected from.'
        }
  }

  const matched = [...emitters.entries()].filter(([id]) =>
    sourceIds.includes(id)
  )
  const ratio = matched.length / emitters.size
  const score = Math.min(1, 0.35 + 0.65 * ratio + (models.length ? 0.1 : 0))

  if (!matched.length) {
    return {
      score,
      reason: `None of the ${emitters.size} source(s) that emit it appear on this fan.`
    }
  }
  const names = matched.map(([, name]) => name).join(', ')
  return {
    score,
    reason: `Seen on ${matched.length} of ${emitters.size} source(s) that emit it — ${names}.`
  }
}

/** Exponential decay on the gap between the anchor and the joined identifier. */
function proximityOf(anchor, joined) {
  const from = timeOf(anchor.firstSeenAt)
  const to = timeOf(joined.firstSeenAt)
  const gap = formatGap(anchor.firstSeenAt, joined.firstSeenAt)
  if (from === null || to === null) {
    return { score: 0.3, reason: 'One side has no first-seen timestamp.' }
  }
  const days = Math.max(0, to - from) / DAY
  return {
    score: Math.exp(-days / HALF_LIFE_DAYS),
    reason: `Joined ${gap} after the anchoring identifier was first seen.`
  }
}

export function useProfilesIdentityResolution() {
  const {
    data: identifierTypes,
    loading: typesLoading,
    error: typesError,
    load: loadTypes
  } = useMockResource('identifier-types')

  const {
    data: profiles,
    loading: profilesLoading,
    error: profilesError,
    load: loadProfiles
  } = useMockResource('profiles')

  const loading = computed(() => typesLoading.value || profilesLoading.value)

  async function load() {
    await Promise.all([loadTypes(), loadProfiles()])
  }

  // ------------------------------------------------------------------- rules

  /** typeId -> { profiles, identifiers } actually observed on the fan graph. */
  const coverage = computed(() => {
    const map = new Map()
    for (const p of profiles.value) {
      const seen = new Set()
      for (const i of p.identifiers ?? []) {
        const entry = map.get(i.typeId) ?? { profiles: 0, identifiers: 0 }
        entry.identifiers += 1
        if (!seen.has(i.typeId)) {
          entry.profiles += 1
          seen.add(i.typeId)
        }
        map.set(i.typeId, entry)
      }
    }
    return map
  })

  const rules = computed(() => {
    const types = identifierTypes.value
    if (!types.length) return []

    const worst = types.reduce(
      (m, t) => Math.max(m, Number.isFinite(t.priority) ? t.priority : 0),
      0
    )
    const total = types.length
    const fanCount = profiles.value.length

    return [...types]
      .sort((a, b) => priorityOf(a, worst + 1) - priorityOf(b, worst + 1))
      .map((t, index) => {
        const priority = priorityOf(t, worst + 1)
        const { method, variant, reason } = methodOf(t)
        const unique = uniquenessOf(t.maxIdentifiers)
        const carried = coverage.value.get(t.id) ?? {
          profiles: 0,
          identifiers: 0
        }

        const eventRules = (t.eventTypes ?? []).map(e => ({
          id: `evt-${t.id}-${e.eventTypeId}-${e.sourceId}`,
          kind: 'Event stream',
          matchesOn: `${e.eventTypeName} event`,
          from: e.sourceName
        }))
        const modelRules = (t.dataModels ?? []).map(m => ({
          id: `dm-${t.id}-${m.dataModelId}`,
          kind: 'Warehouse model',
          matchesOn: `${m.column} column`,
          from: m.dataModelName
        }))

        return {
          id: t.id,
          name: t.name,
          displayName: t.displayName || t.name,
          priority,
          rank: index + 1,
          precedenceLabel: `${index + 1} of ${total}`,
          strength: 1 - priority / (worst + 1),
          limitLabel:
            t.maxIdentifiers === null || t.maxIdentifiers === undefined
              ? 'No limit'
              : `${t.maxIdentifiers} per fan`,
          uniquenessReason: unique.reason,
          method,
          methodVariant: variant,
          methodReason: reason,
          rules: [...eventRules, ...modelRules],
          ruleCount: eventRules.length + modelRules.length,
          eventRuleCount: eventRules.length,
          modelRuleCount: modelRules.length,
          coverageLabel: fanCount ? `${carried.profiles} of ${fanCount}` : '—',
          identifierCount: carried.identifiers,
          version: t.version,
          createdAt: formatDate(t.createdAt),
          updatedAt: formatDateTime(t.updatedAt)
        }
      })
  })

  const ruleIndex = computed(() => new Map(rules.value.map(r => [r.id, r])))

  function findRule(id) {
    return ruleIndex.value.get(id) ?? null
  }

  /** DefinitionList rows for one rule. */
  function ruleFacts(rule) {
    if (!rule) return []
    return [
      { label: 'Identifier key', value: rule.name },
      {
        label: 'Precedence',
        value: rule.precedenceLabel,
        hint: 'Lower wins when two rules disagree about the same fan.'
      },
      {
        label: 'Limit per fan',
        value: rule.limitLabel,
        hint: rule.uniquenessReason
      },
      { label: 'Matching', value: rule.method, hint: rule.methodReason },
      {
        label: 'Carried by',
        value: `${rule.coverageLabel} fans`,
        hint: `${formatNumber(rule.identifierCount)} identifier(s) on the graph.`
      },
      {
        label: 'Collection rules',
        value: formatNumber(rule.ruleCount),
        hint: `${rule.eventRuleCount} from events, ${rule.modelRuleCount} from warehouse models.`
      },
      { label: 'Version', value: `v${rule.version}` },
      { label: 'Rule updated', value: rule.updatedAt }
    ]
  }

  // ------------------------------------------------------------------ merges

  /**
   * One merge per identifier that joined a profile *after* its anchor — the
   * anchor being whichever identifier was seen first. A profile with a single
   * identifier was never stitched and contributes nothing here.
   */
  const merges = computed(() => {
    const index = ruleIndex.value
    if (!index.size) return []
    const types = new Map(identifierTypes.value.map(t => [t.id, t]))

    const out = []
    for (const profile of profiles.value) {
      const identifiers = [...(profile.identifiers ?? [])].sort(
        (a, b) => (timeOf(a.firstSeenAt) ?? 0) - (timeOf(b.firstSeenAt) ?? 0)
      )
      if (identifiers.length < 2) continue

      const anchor = identifiers[0]
      const anchorRule = index.get(anchor.typeId)

      for (const joined of identifiers.slice(1)) {
        const rule = index.get(joined.typeId)
        const type = types.get(joined.typeId)
        if (!rule || !type) continue
        out.push(buildMerge(profile, anchor, anchorRule, joined, rule, type))
      }
    }
    return out.sort((a, b) => b.confidence - a.confidence)
  })

  function buildMerge(profile, anchor, anchorRule, joined, rule, type) {
    const unique = uniquenessOf(type.maxIdentifiers ?? null)
    const corroboration = corroborationOf(type, profile)
    const proximity = proximityOf(anchor, joined)

    const signals = [
      {
        key: 'rule',
        label: 'Rule precedence',
        score: rule.strength,
        reason: `Matched by the ${rule.displayName} rule, precedence ${rule.precedenceLabel}.`
      },
      {
        key: 'uniqueness',
        label: 'Identifier uniqueness',
        score: unique.score,
        reason: unique.reason
      },
      {
        key: 'corroboration',
        label: 'Source corroboration',
        score: corroboration.score,
        reason: corroboration.reason
      },
      {
        key: 'proximity',
        label: 'Timing',
        score: proximity.score,
        reason: proximity.reason
      }
    ].map(s => ({
      ...s,
      score: clamp(s.score),
      weight: WEIGHTS[s.key],
      percent: Math.round(clamp(s.score) * 100),
      // In points of the final 0–100 confidence, so the breakdown adds up to
      // the number printed at the top of the panel.
      contribution: clamp(s.score) * WEIGHTS[s.key] * 100
    }))

    const points = signals.reduce((sum, s) => sum + s.contribution, 0)
    const confidence = Math.round(points)
    const { verdict, variant } = verdictOf(confidence)
    const anchorLabel = anchorRule?.displayName ?? anchor.type

    return {
      id: `${profile.id}__${joined.typeId}__${joined.value}`,
      profileId: profile.id,
      profileName: profile.displayName,
      profileIsAnonymous: !profile.primaryEmail,
      anchorLabel,
      anchorValue: anchor.value,
      anchorAt: formatDateTime(anchor.firstSeenAt),
      typeId: rule.id,
      joinedLabel: rule.displayName,
      joinedValue: joined.value,
      joinedAtIso: joined.firstSeenAt,
      joinedAt: formatDateTime(joined.firstSeenAt),
      joinedOn: formatDate(joined.firstSeenAt),
      method: rule.method,
      methodVariant: rule.methodVariant,
      methodReason: rule.methodReason,
      confidence,
      points,
      verdict,
      verdictVariant: variant,
      signals
    }
  }

  function findMerge(id) {
    return merges.value.find(m => m.id === id) ?? null
  }

  // ------------------------------------------------------------------- stats

  const probabilisticMerges = computed(
    () => merges.value.filter(m => m.method === 'Probabilistic').length
  )

  const unstitchedFans = computed(
    () => profiles.value.filter(p => (p.identifiers ?? []).length < 2).length
  )

  const stats = computed(() => {
    const ruleCount = rules.value.reduce((sum, r) => sum + r.ruleCount, 0)
    const fans = profiles.value.length
    return [
      {
        label: 'Identifier types',
        value: formatNumber(rules.value.length),
        hint: 'Ranked by precedence — lower wins a conflict.'
      },
      {
        label: 'Collection rules',
        value: formatNumber(ruleCount),
        hint: 'Ways an identifier can reach the fan graph.'
      },
      {
        label: 'Fans resolved',
        value: formatNumber(fans),
        hint: unstitchedFans.value
          ? `${unstitchedFans.value} of them still on one identifier.`
          : 'Every fan carries more than one identifier.'
      },
      {
        label: 'Identifiers stitched',
        value: formatNumber(merges.value.length),
        hint: probabilisticMerges.value
          ? `${probabilisticMerges.value} joined probabilistically.`
          : 'All joined on a declared key.'
      }
    ]
  })

  /** No rules configured at all — a first run, not a fault. */
  const isEmpty = computed(
    () => !typesLoading.value && !typesError.value && !rules.value.length
  )

  return {
    identifierTypes,
    profiles,
    loading,
    // The rules are the primary resource: their failure is the page error.
    error: typesError,
    load,
    // The fan graph is secondary — the merges table owns this one, with its
    // own retry, so a profiles outage leaves the rules readable.
    profilesError,
    loadProfiles,
    rules,
    ruleFacts,
    findRule,
    merges,
    findMerge,
    stats,
    probabilisticMerges,
    isEmpty
  }
}

function clamp(score) {
  if (!Number.isFinite(score)) return 0
  return Math.max(0, Math.min(1, score))
}
