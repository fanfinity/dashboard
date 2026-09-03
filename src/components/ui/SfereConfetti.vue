<template>
  <!-- TELEPORTED TO BODY, for the same reason SourceProvisionedOverlay is:
       `fixed` resolves against the nearest transformed ancestor rather than the
       viewport, and the screens that celebrate are full of animated cards — so
       an in-place canvas would be clipped into whichever panel happened to
       contain it.

       `aria-hidden` and `pointer-events-none` are the whole accessibility
       contract here, and they are enough because the burst is never the
       message. Every call site says what happened in words that stay on screen
       — "Your pipeline is live", "Events are arriving" — and this is the
       flourish over them. A live region announcing "confetti" would be noise
       read out in place of the sentence that matters.

       NOT A MODAL, so it needs no q-dialog and is not a third entry against the
       kit's two-Quasar-dependency rule: no focus trap, no Escape, no scroll
       lock, nothing to dismiss. It is the RowActionsMenu precedent — teleport
       plus a plain element — rather than the ConfirmDialog one.

       z-9999 sits one above SourceProvisionedOverlay's z-9998 deliberately: the
       burst reads over the dark overlay it accompanies, and because the canvas
       ignores pointer events it still cannot eat that overlay's
       click-to-dismiss. -->
  <Teleport to="body">
    <canvas
      v-if="active"
      ref="canvasEl"
      class="pointer-events-none fixed inset-0 z-[9999]"
      aria-hidden="true"
    ></canvas>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useConfetti } from '@/composables/useConfetti'

// The one renderer behind `useConfetti().fire()`. Mounted once in MainLayout, so
// every screen under it celebrates without owning a canvas; mountable locally
// too (the /design-system specimen does, since that route is outside the
// layout), in which case `fire()` is also exposed directly.
//
// HAND-ROLLED RATHER THAN A DEPENDENCY, and that is the CSP rather than
// not-invented-here: `index.html` is `default-src 'self'` with
// `assetsInlineLimit: 0`, so a CDN script is blocked outright and the usual
// canvas-confetti packages want a worker or a data URI. Ninety lines of
// requestAnimationFrame is the cheaper half of that trade.
//
// COLOURS COME OUT OF THE TOKEN LAYER AT RUNTIME. A canvas cannot take a
// Tailwind class, and hardcoding the palette is what broke last time the brand
// changed — so the hexes are read off `:root` with getComputedStyle. Only the
// hex-valued tokens are used: several of the greys are `oklch()`, which not
// every engine accepts as a canvas `fillStyle`.
const { pending, take } = useConfetti()

const PALETTE_TOKENS = [
  '--color-sfere-300',
  '--color-sfere-400',
  '--color-sfere-500',
  '--color-sfere-600',
  '--color-sfere-700',
  '--color-sfere-success-on-ink'
]

// px/s². Heavier than real paper on purpose: the burst has to clear the screen
// in a couple of seconds, because it is standing over a write key.
const GRAVITY = 1500
// Per-frame velocity retention at 60fps, applied time-corrected so the motion is
// the same on a 120Hz display.
const DRAG = 0.985
const DEFAULT_COUNT = 90
const DEFAULT_SPREAD = 70
const MAX_COUNT = 400

const canvasEl = ref(null)
// Drives the `v-if`: the canvas is in the DOM only while something is falling,
// so a signed-in session that never celebrates carries no extra layer at all.
const active = ref(false)

const particles = []
const timers = []
let ctx = null
let raf = 0
let lastT = 0

// Checked at fire time rather than captured at import, so someone who turns the
// system setting on mid-session is honoured without a reload.
function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function palette() {
  const styles = getComputedStyle(document.documentElement)
  const resolved = PALETTE_TOKENS.map(t =>
    styles.getPropertyValue(t).trim()
  ).filter(Boolean)
  // White is the last resort rather than a duplicated brand hex: if the token
  // names ever change, a colourless burst is a visible prompt to fix them and a
  // stale purple pasted in here would not be.
  return resolved.length ? resolved : ['#ffffff']
}

function sizeCanvas() {
  const canvas = canvasEl.value
  if (!canvas) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.floor(window.innerWidth * dpr)
  canvas.height = Math.floor(window.innerHeight * dpr)
  ctx = canvas.getContext('2d')
  // Everything below is in CSS pixels; the transform is the only place the
  // device ratio appears.
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function spawn(options) {
  const colors = palette()
  const w = window.innerWidth
  const h = window.innerHeight
  const origin = { x: 0.5, y: 0.42, ...options.origin }
  const count = Math.max(
    1,
    Math.min(Math.round(options.count ?? DEFAULT_COUNT), MAX_COUNT)
  )
  const spread = options.spread ?? DEFAULT_SPREAD
  const ox = origin.x * w
  const oy = origin.y * h

  for (let i = 0; i < count; i += 1) {
    // A cone pointing up, `spread` degrees wide. -90° is straight up in canvas
    // coordinates, where y grows downwards.
    const angle = ((-90 + (Math.random() - 0.5) * spread) * Math.PI) / 180
    const speed = 480 + Math.random() * 460
    particles.push({
      x: ox + (Math.random() - 0.5) * 24,
      y: oy + (Math.random() - 0.5) * 24,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 14,
      // Paper strips, with roughly one in five a round piece for texture.
      w: 6 + Math.random() * 6,
      h: 9 + Math.random() * 7,
      round: Math.random() < 0.2,
      color: colors[i % colors.length],
      // The flutter is a horizontal scale oscillation — the cheap trick that
      // reads as a strip of paper turning edge-on rather than a falling brick.
      flutter: Math.random() * Math.PI * 2,
      flutterSpeed: 6 + Math.random() * 6,
      life: 0,
      ttl: 2.2 + Math.random()
    })
  }
}

function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
  for (const p of particles) {
    // Fade over the last quarter of a piece's life, so nothing blinks out.
    const remaining = 1 - p.life / p.ttl
    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, remaining / 0.25))
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.scale(Math.cos(p.flutter + p.life * p.flutterSpeed), 1)
    ctx.fillStyle = p.color
    if (p.round) {
      ctx.beginPath()
      ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
    }
    ctx.restore()
  }
}

function stop() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
  ctx = null
  particles.length = 0
  active.value = false
  window.removeEventListener('resize', sizeCanvas)
}

function step(t) {
  // Clamped: a backgrounded tab resumes with a multi-second gap, and an
  // unclamped dt would teleport every piece off screen in one frame.
  const dt = Math.min((t - lastT) / 1000, 0.05)
  lastT = t
  const floor = window.innerHeight + 60
  const decay = DRAG ** (dt * 60)

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i]
    p.vy += GRAVITY * dt
    p.vx *= decay
    p.vy *= decay
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.rot += p.spin * dt
    p.life += dt
    if (p.life >= p.ttl || p.y > floor) particles.splice(i, 1)
  }

  draw()

  if (!particles.length) {
    stop()
    return
  }
  raf = requestAnimationFrame(step)
}

async function launch(options) {
  active.value = true
  // The canvas is behind a `v-if`, so on the first burst it does not exist yet.
  // Keyed off the element rather than off `active`, because two bursts fired in
  // one tick both see `active` already true and the second would otherwise skip
  // the wait and find nothing to draw on.
  if (!canvasEl.value) await nextTick()
  if (!canvasEl.value) return
  if (!ctx) {
    sizeCanvas()
    window.addEventListener('resize', sizeCanvas)
  }
  spawn(options)
  if (!raf) {
    lastT = performance.now()
    raf = requestAnimationFrame(step)
  }
}

/**
 * Draw one burst. Called for every queued request and exposed for a local mount.
 *
 * UNDER REDUCED MOTION THIS DRAWS NOTHING — not a gentler burst, not a static
 * spray. There is no quiet version of confetti that is still confetti, and every
 * moment that fires one also states its result in words that stay on screen, so
 * the information is not carried by the animation.
 */
function request(options = {}) {
  if (prefersReducedMotion()) return
  const delay = Number(options.delay) || 0
  if (delay > 0) {
    timers.push(setTimeout(() => launch(options), delay))
    return
  }
  launch(options)
}

// `pending` is replaced rather than mutated on every fire, so a shallow watch
// sees each one. Draining it here is also what stops two mounted renderers from
// drawing the same burst twice.
watch(pending, queued => {
  if (!queued.length) return
  take().forEach(request)
})

onBeforeUnmount(() => {
  timers.forEach(clearTimeout)
  timers.length = 0
  stop()
})

defineExpose({ fire: request })
</script>
