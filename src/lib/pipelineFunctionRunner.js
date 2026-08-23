/**
 * Local runner for pipeline (Jitsu) functions — powers the "test" playground
 * so users can try their code against a sample event without touching Jitsu.
 *
 * The function runs in the browser with the same contract Jitsu uses:
 *   export default async function transform(event, { log, fetch, store, props })
 * Returning an object delivers it, returning null/undefined drops the event,
 * returning an array delivers several events.
 */

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

function render(arg) {
  if (typeof arg === 'string') return arg
  try {
    return JSON.stringify(arg)
  } catch {
    return String(arg)
  }
}

/** Turn the ES-module default export into a callable function. */
function compile(code) {
  if (!/export\s+default\s+/.test(code)) {
    throw new Error('The function must have an `export default` entrypoint.')
  }
  const body = `"use strict";\n${code.replace(/export\s+default\s+/, 'return ')}`
  // new Function is eval-like, but this is the user's own code in their own
  // browser — the same trust level as pasting it into the Jitsu console.
  const fn = new Function(body)()
  if (typeof fn !== 'function') {
    throw new Error('The default export is not a function.')
  }
  return fn
}

function buildContext(logs) {
  const log = {}
  for (const level of ['debug', 'info', 'warn', 'error']) {
    log[level] = (...args) =>
      logs.push({ level, message: args.map(render).join(' ') })
  }
  // In-memory stand-in for Jitsu's per-function key-value store.
  const map = new Map()
  const store = {
    get: async key => (map.has(key) ? map.get(key) : undefined),
    set: async (key, value) => map.set(key, value),
    del: async key => map.delete(key)
  }
  return { log, fetch: globalThis.fetch?.bind(globalThis), store, props: {} }
}

/**
 * Run `code` against `event`. Never throws — the outcome field says what
 * happened: 'delivered' | 'dropped' | 'error' | 'timeout'.
 */
export async function runPipelineFunction(
  code,
  event,
  { timeoutMs = 5000 } = {}
) {
  const logs = []
  const startedAt = performance.now()
  let fn
  try {
    fn = compile(code)
  } catch (e) {
    return {
      outcome: 'error',
      error: e.message,
      logs,
      result: null,
      durationMs: 0
    }
  }

  const input = clone(event)
  const run = Promise.resolve().then(() => fn(input, buildContext(logs)))
  const timeout = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`Timed out after ${timeoutMs} ms`)),
      timeoutMs
    )
  )

  try {
    const result = await Promise.race([run, timeout])
    const durationMs = Math.round(performance.now() - startedAt)
    if (result === null || result === undefined) {
      return { outcome: 'dropped', result: null, logs, durationMs }
    }
    return { outcome: 'delivered', result, logs, durationMs }
  } catch (e) {
    const durationMs = Math.round(performance.now() - startedAt)
    const timedOut = /Timed out/.test(e.message)
    return {
      outcome: timedOut ? 'timeout' : 'error',
      error: e.message,
      logs,
      result: null,
      durationMs
    }
  }
}
