import { ref } from 'vue'

/**
 * The app-wide "that worked" burst.
 *
 * MODULE SINGLETON, the same idiom as useOnboarding/useFeatures and for the same
 * reason: the thing that knows a pipeline just went live (a create page, an
 * install guide, anything later) is never the thing that owns the canvas. One
 * renderer is mounted once in MainLayout; every caller anywhere below it says
 * `fire()` and is done. No prop threading, no per-screen canvas, no second
 * instance to keep in step.
 *
 * A QUEUE RATHER THAN A REF, and that is not fussiness: two `fire()` calls in
 * one tick would both write a single ref and the watcher would see one value,
 * so the second burst would vanish. `take()` drains, which also means two
 * renderers mounted at once (a page that mounts its own beside the layout's)
 * split the queue instead of each drawing every burst twice.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: decide whether a celebration is earned. That
 * judgement belongs at the call site next to the state that justifies it — see
 * SourceCreatePage (fires on `state === 'found'`, never on "a source was
 * created") and SourceInstallGuide (fires on a real event count, never on the
 * preview-mode branch that reports success without a backend). A confetti burst
 * is the loudest claim a screen can make, and this repo's whole posture is not
 * claiming more than the backend did.
 *
 * Reduced motion is handled in the renderer, not here, so a caller never has to
 * ask: `fire()` under `prefers-reduced-motion: reduce` draws nothing at all —
 * not a slower burst — and every one of these moments already states its result
 * in words beside the animation.
 */

// Each entry is one burst: `{ id, ...options }`. Options are the renderer's —
// `origin`, `count`, `spread`, `delay` — and all of them are optional.
const pending = ref([])

let seq = 0

/**
 * Ask for a burst. Safe to call from anywhere, including before any renderer has
 * mounted — the queue simply waits.
 *
 * @param {{
 *   origin?: { x: number, y: number },
 *   count?: number,
 *   spread?: number,
 *   delay?: number
 * }} [options] Fractions of the viewport for `origin` (default centre-ish),
 *   a piece count, the cone width in degrees, and a millisecond delay for
 *   landing the burst on a beat that has not happened yet.
 * @returns {number} The burst id, for a caller that wants to log it.
 */
function fire(options = {}) {
  seq += 1
  pending.value = [...pending.value, { id: seq, ...options }]
  return seq
}

/**
 * Drain the queue. The renderer's half of the contract; nothing else calls it.
 *
 * @returns {Array<object>} Every burst asked for since the last drain.
 */
function take() {
  if (!pending.value.length) return []
  const out = pending.value
  pending.value = []
  return out
}

export function useConfetti() {
  return { pending, fire, take }
}

export default useConfetti
