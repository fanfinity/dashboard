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
 *
 * EVERY VARIANT DECLARES A BORDER, and the transparent ones are load-bearing
 * rather than tidiness. SfereButton is padding-sized with no fixed height, so a
 * 1px border is 2px of height and 2px of width that the borderless variants do
 * not have: a `secondary` Refresh beside a `primary` Connect a source drew 2px
 * taller and hung over it top and bottom in the same `items-center` row — which
 * reads as two different controls, and was reported as exactly that on the
 * Dashboard header. Reserving the border in every variant makes the two boxes
 * identical. The width is declared per variant, not once in the base class
 * list: a base `border-transparent` and a variant `border-sfere-line` are two
 * border-COLOR utilities in one Tailwind layer, so which one wins is Tailwind's
 * own ordering rather than the order written here (the same trap the
 * `font-medium` note in PageHeader.vue records). One colour per variant is the
 * only form of this that is deterministic — so a new variant owes a border,
 * `border-transparent` if it is meant to look like it has none.
 */
export const SFERE_BUTTON_VARIANTS = {
  primary:
    'border border-transparent bg-sfere-brand-fill text-white shadow-sfere-btn hover:bg-sfere-brand-text focus-visible:ring-sfere-500/60',
  secondary:
    'border border-sfere-line bg-sfere-surface text-sfere-fg hover:border-sfere-300 hover:text-sfere-brand-text focus-visible:ring-sfere-500/60',
  ghost:
    'border border-transparent text-sfere-fg hover:bg-sfere-fill focus-visible:ring-sfere-500/60',
  danger:
    'border border-transparent bg-sfere-danger text-white hover:bg-rose-700 focus-visible:ring-rose-500/60',
  // On-ink pair. `white` is the primary action on a dark section.
  white:
    'border border-transparent bg-white text-sfere-plum hover:bg-sfere-50 focus-visible:ring-white/70 focus-visible:ring-offset-transparent',
  outlineLight:
    'border border-sfere-hairline-strong text-white hover:bg-white/10 focus-visible:ring-white/70 focus-visible:ring-offset-transparent'
}

export const SFERE_BUTTON_VARIANT_NAMES = Object.keys(SFERE_BUTTON_VARIANTS)
