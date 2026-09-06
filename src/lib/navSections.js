// Sidebar sectioning: the flat authoring list split into captioned sections and
// flattened back again.
//
// Lives here rather than in src/layouts/MainLayout.vue because that file already
// carries the nav authoring list and the feature gate, and because this is the
// half worth reading on its own.
//
// WHY SECTIONS EXIST AT ALL: the sidebar is authored as one flat array, and a
// section's caption ('COLLECT', 'FANS', 'ACCOUNT') is a FIELD ON THE FIRST GROUP
// of that section rather than a wrapper around it. So any pass that removes or
// moves rows can strand a caption on the wrong one — filter out `audiences` and
// 'ACTIVATE' goes with it, leaving Campaigns absorbed into the section above.
// Parsing into sections, operating within them, and flattening with each caption
// re-attached to whichever group now leads is what keeps that from happening.
//
// THIS FILE USED TO BE src/lib/navOrder.js AND USED TO DO MORE. It held
// `orderNavGroups(groups, persona.nav)`, which front-loaded the rows a chosen
// role cared about — a `lead`/`sections`/`first` triple read off
// src/config/personas.js. The role question is gone (see CLAUDE.md), so the
// ordering it drove is gone with it and the rail is the authored order for
// everybody. The name changed with the contents so the file stops promising an
// ordering nothing performs.
//
// `orderFront` SURVIVED THAT, deliberately, and it is the one thing here with a
// rule attached: it front-loads the keys it recognises and appends everything
// else in its authored position, so an unknown key degrades to "in the wrong
// place" and never to "missing". If a future ordering comes back — a workspace
// preference, a drag-to-reorder rail — it belongs on top of this function rather
// than beside it, and a `filter` in this file would turn a data typo into a
// support ticket reading "Pipes has disappeared from my sidebar".

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
 * objects would leak one pass's result into the next.
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
