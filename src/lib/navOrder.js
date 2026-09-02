// Persona-driven sidebar ordering.
//
// Lives here rather than in src/layouts/MainLayout.vue because that file already
// carries the nav authoring list and the feature gate, and because this is the
// half worth reading on its own: it is what makes "a persona reorders, only
// entitlements remove" true mechanically instead of by convention.
//
// THE ONE INVARIANT: nothing in here can drop a row. Every function front-loads
// the keys it recognises and appends everything else in its authored position, so
// a typo in src/config/personas.js, a renamed nav key or a group added later
// degrades to "in the wrong place" — never to "missing". A `filter` anywhere in
// this file would turn a data typo into a support ticket that reads "Pipes has
// disappeared from my sidebar".
//
// WHY SECTIONS EXIST HERE AT ALL: the sidebar is authored as one flat array and a
// section's caption ('COLLECT', 'FANS', 'ACCOUNT') is a field on the FIRST group
// of that section. Permuting the flat list therefore moves the captions with the
// wrong rows — hoist Profiles for a marketer and 'FANS' travels up with it while
// Team & roles is left captionless. So the list is parsed into sections, reordered
// as sections, and flattened again with each caption re-attached to whichever
// group now leads its section.

/**
 * `keys` moved to the front in the order given; everything unlisted keeps its
 * authored order behind them. A key that matches nothing is skipped.
 *
 * @param {Array<object>} items
 * @param {Array<string>|undefined} keys
 * @param {(item: object) => string|null} keyOf
 * @returns {Array<object>}
 */
export function orderFront(items, keys, keyOf = item => item.key) {
  if (!Array.isArray(keys) || !keys.length) return items
  const rest = [...items]
  const front = []
  for (const key of keys) {
    const index = rest.findIndex(item => keyOf(item) === key)
    if (index !== -1) front.push(...rest.splice(index, 1))
  }
  return [...front, ...rest]
}

/**
 * The flat authoring list split into sections. A group carrying a `caption`
 * starts a new one; the rows above the first caption become a leading section
 * whose caption is null.
 *
 * @param {Array<object>} groups
 * @returns {Array<{caption: string|null, groups: Array<object>}>}
 */
export function toSections(groups) {
  const sections = []
  for (const group of groups) {
    if (group.caption || !sections.length) {
      sections.push({ caption: group.caption ?? null, groups: [] })
    }
    sections[sections.length - 1].groups.push(group)
  }
  return sections
}

/**
 * Sections back to the flat list the sidebar template renders, with each
 * caption re-attached to the group that now leads its section.
 *
 * Returns SHALLOW COPIES rather than mutating: the authoring array is a module
 * constant shared across every render, and writing a caption onto one of its
 * objects would leak one persona's ordering into the next.
 *
 * @param {Array<{caption: string|null, groups: Array<object>}>} sections
 * @returns {Array<object>}
 */
export function toFlat(sections) {
  return sections.flatMap(section =>
    section.groups.map((group, index) => ({
      ...group,
      caption: index === 0 ? (section.caption ?? undefined) : undefined
    }))
  )
}

/**
 * The sidebar in this persona's order.
 *
 * `nav` is the `nav` object from src/config/personas.js, or null/undefined for
 * the authored order — which is what an unanswered question, a skipped one and
 * the engineer persona all get, and what scripts/smoke.mjs walks.
 *
 * Applied in three passes, in this order:
 *   1. `lead`    group keys pulled out of wherever they sit and pinned to the
 *                uncaptioned rows at the top. A section emptied by this loses
 *                its caption with it, since the caption described the rows.
 *   2. `sections` captions front-loaded, so a persona's own part of the product
 *                comes first.
 *   3. `first`   group keys front-loaded WITHIN one section, keyed by caption.
 *
 * @param {Array<object>} groups authored order, already entitlement-filtered
 * @param {object|null|undefined} nav
 * @returns {Array<object>}
 */
export function orderNavGroups(groups, nav) {
  if (!nav) return groups

  const sections = toSections(groups)

  // Where `lead` promotes into. Normally the rows above the first caption
  // (Dashboard, Live events); a fresh empty section if the authoring list ever
  // starts with a captioned group, so promotion never lands under a caption
  // that does not describe it.
  const head =
    sections.length && sections[0].caption === null
      ? sections.shift()
      : { caption: null, groups: [] }

  for (const key of nav.lead ?? []) {
    for (const section of sections) {
      const index = section.groups.findIndex(group => group.key === key)
      if (index === -1) continue
      head.groups.push(...section.groups.splice(index, 1))
      break
    }
  }
  head.groups = orderFront(head.groups, nav.lead)

  const ordered = orderFront(
    // An emptied section is dropped rather than rendered as a caption with
    // nothing under it.
    sections.filter(section => section.groups.length),
    nav.sections,
    section => section.caption
  ).map(section => ({
    ...section,
    groups: orderFront(section.groups, nav.first?.[section.caption])
  }))

  return toFlat([...(head.groups.length ? [head] : []), ...ordered])
}
