// The four words the diagram endpoint uses for how a node or an edge is doing,
// and what each one looks like on screen.
//
// PURE DATA, NO IMPORTS, same idiom as src/config/features.js: three components
// render a status chip (FlowNode, FlowTopology's legend, the pipes list row) and
// a fourth reads the tone to tint a connector line. A `status === 'failing'`
// branch written four times is four places to disagree about whether `idle`
// is a warning.
//
// The vocabulary is the backend's — `Status5` in openapi/fanfinity-api.json is
// exactly `healthy | degraded | failing | idle` — so this maps rather than
// invents. An unknown string falls through to `idle`, which says "nothing is
// moving" rather than asserting a health nobody reported.

export const FLOW_STATUSES = {
  healthy: {
    key: 'healthy',
    label: 'Active',
    // StatusBadge tones, so the chip in the diagram and the chip in the table
    // beside it are the same green.
    tone: 'success',
    // Whether this status should draw a moving particle on its connector.
    // Only `healthy` does: a degraded pipe is delivering some events and a
    // failing one is delivering none, and animating either would be the
    // loudest claim on the screen and the least true.
    flowing: true
  },
  degraded: {
    key: 'degraded',
    label: 'Degraded',
    tone: 'warn',
    flowing: false
  },
  failing: {
    key: 'failing',
    label: 'Failing',
    tone: 'danger',
    flowing: false
  },
  idle: {
    key: 'idle',
    label: 'Idle',
    tone: 'neutral',
    flowing: false
  }
}

export const FLOW_STATUS_KEYS = Object.keys(FLOW_STATUSES)

/**
 * The presentation for a status string.
 *
 * `isEnabled: false` wins over whatever the status says, and that precedence is
 * the point rather than a detail. A paused pipe reports `idle` — which is true
 * and also indistinguishable from "switched on and receiving nothing", the one
 * state somebody needs to act on. Naming the pause is what separates the two.
 *
 * @param {string} status One of FLOW_STATUS_KEYS.
 * @param {boolean} [isEnabled] Pass the record's own flag where there is one.
 */
export function flowStatus(status, isEnabled = true) {
  if (isEnabled === false) {
    return { key: 'paused', label: 'Paused', tone: 'neutral', flowing: false }
  }
  return FLOW_STATUSES[status] ?? FLOW_STATUSES.idle
}

/** True when at least one edge is genuinely moving events right now. */
export function anyFlowing(edges) {
  return (edges || []).some(e => flowStatus(e.status, e.isEnabled).flowing)
}

export default FLOW_STATUSES
