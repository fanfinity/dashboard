/**
 * Template-version helpers.
 *
 * Sources, destinations and pipes all carry the same three template fields —
 * `templateId`, `templateVersion`, `latestTemplateVersion` — and every list and
 * detail screen has to answer the same two questions from them: is this record
 * behind its template, and what should the badge say. Both answers live here so
 * 54 screens cannot each invent their own rule.
 *
 * Versions in this product are date strings (`"2026-06-25"`), so a plain string
 * comparison orders them correctly. Nothing is parsed as a Date: an unexpected
 * format would silently become NaN and compare false, whereas string inequality
 * still flags "these differ".
 *
 * A record with no `templateId` (hand-configured, not created from a template)
 * never has an upgrade and has no template label.
 */

/**
 * Is `record` running an older template than the one available?
 *
 * @param {{templateId?: string|null, templateVersion?: string|null, latestTemplateVersion?: string|null}|null|undefined} record
 * @returns {boolean}
 *
 * @example
 * hasUpgrade({ templateId: 'ios-sdk', templateVersion: '2026-03-14', latestTemplateVersion: '2026-06-25' }) // true
 * hasUpgrade({ templateId: 'web-sdk', templateVersion: '2026-06-25', latestTemplateVersion: '2026-06-25' }) // false
 * hasUpgrade({ templateId: null })                                                                          // false
 */
export function hasUpgrade(record) {
  if (!record || !record.templateId) return false
  const current = record.templateVersion
  const latest = record.latestTemplateVersion
  if (!current || !latest) return false
  return String(latest) > String(current)
}

/**
 * Human label for the template a record was created from.
 *
 * @param {{templateId?: string|null, templateVersion?: string|null}|null|undefined} record
 * @returns {string} `''` when the record was not created from a template.
 *
 * @example
 * templateLabel({ templateId: 'web-sdk', templateVersion: '2026-06-25' }) // 'web-sdk · 2026-06-25'
 * templateLabel({ templateId: 'web-sdk' })                                // 'web-sdk'
 * templateLabel({ templateId: null })                                     // ''
 */
export function templateLabel(record) {
  if (!record || !record.templateId) return ''
  return record.templateVersion
    ? `${record.templateId} · ${record.templateVersion}`
    : String(record.templateId)
}

/**
 * Badge text for the upgrade state, or `''` when there is nothing to show.
 *
 * @param {object|null|undefined} record
 * @returns {string}
 *
 * @example
 * upgradeLabel({ templateId: 'ios-sdk', templateVersion: '2026-03-14', latestTemplateVersion: '2026-06-25' })
 * // 'Upgrade available · 2026-06-25'
 */
export function upgradeLabel(record) {
  if (!hasUpgrade(record)) return ''
  return `Upgrade available · ${record.latestTemplateVersion}`
}

/**
 * The same three helpers as a composable, for screens that prefer to destructure
 * one call rather than import three names.
 *
 * @returns {{ hasUpgrade: typeof hasUpgrade, templateLabel: typeof templateLabel, upgradeLabel: typeof upgradeLabel }}
 *
 * @example
 * const { hasUpgrade, templateLabel } = useTemplates()
 */
export function useTemplates() {
  return { hasUpgrade, templateLabel, upgradeLabel }
}
