/**
 * The action palette, shared by SfereButton and SfereIconButton.
 *
 * It lives outside both components because they are the same control with and
 * without a label: a toolbar that pairs an icon-only "New" with a worded
 * "Save" has to draw the same brand fill in both, and two copies of this map is
 * exactly how that drifts. Add a variant here, not in a component.
 *
 * `primary` and `white` are the two calls to action; `secondary`/`ghost` and
 * `outlineLight` are their quiet counterparts on light and dark surfaces
 * respectively. Pairing a light-surface variant with a dark section (or the
 * reverse) is the one way to get either component wrong.
 */
export const SFERE_BUTTON_VARIANTS = {
  primary:
    'bg-sfere-brand-fill text-white shadow-sfere-btn hover:bg-sfere-brand-text focus-visible:ring-sfere-500/60',
  secondary:
    'border border-sfere-line bg-sfere-surface text-sfere-fg hover:border-sfere-300 hover:text-sfere-brand-text focus-visible:ring-sfere-500/60',
  ghost: 'text-sfere-fg hover:bg-sfere-fill focus-visible:ring-sfere-500/60',
  danger:
    'bg-sfere-danger text-white hover:bg-rose-700 focus-visible:ring-rose-500/60',
  // On-ink pair. `white` is the primary action on a dark section.
  white:
    'bg-white text-sfere-plum hover:bg-sfere-50 focus-visible:ring-white/70 focus-visible:ring-offset-transparent',
  outlineLight:
    'border border-sfere-hairline-strong text-white hover:bg-white/10 focus-visible:ring-white/70 focus-visible:ring-offset-transparent'
}

export const SFERE_BUTTON_VARIANT_NAMES = Object.keys(SFERE_BUTTON_VARIANTS)
