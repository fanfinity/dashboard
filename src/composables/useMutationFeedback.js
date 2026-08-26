/**
 * One toast shape for the result of `sendMutation()` (useMockResource.js),
 * shared across every domain wired to it (Sources, Destinations, Pipes) so
 * "deleted", "no live endpoint yet" and "the request failed" read the same
 * way everywhere rather than each page inventing its own copy.
 *
 * Every toast in this app uses `color: 'dark'` — there is no red/negative
 * toast convention here (real failures get an `ErrorState`/`NoticeBanner`,
 * toasts are lightweight confirmations) — so this keeps that rather than
 * introducing a new style just because this particular toast can now fail.
 *
 * @param {import('quasar').QVueGlobals} $q
 * @param {Awaited<ReturnType<typeof import('./useMockResource').sendMutation>>} result
 * @param {{ success: string, apiMissing?: string }} copy
 *   `success` is shown on `ok: true` (mock or live). `apiMissing` overrides
 *   the default "nothing was saved" line for `apiMissing: true`.
 *
 * @example
 * const res = await removeSource(row.id)
 * notifyMutationResult($q, res, { success: `${row.name} moved to trash` })
 */
export function notifyMutationResult($q, result, { success, apiMissing } = {}) {
  if (result.ok) {
    $q.notify({
      message: success,
      caption: result.skipped
        ? 'Local preview only — no backend is connected yet.'
        : 'Saved via the API.',
      color: 'dark',
      timeout: 2500
    })
    return
  }

  if (result.apiMissing) {
    $q.notify({
      message: apiMissing ?? "This action doesn't have a live endpoint yet.",
      caption: 'Nothing was saved.',
      color: 'dark',
      timeout: 3000
    })
    return
  }

  $q.notify({
    message: 'That request failed.',
    caption: result.error,
    color: 'dark',
    timeout: 4000
  })
}
