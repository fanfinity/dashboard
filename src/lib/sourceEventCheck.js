import { listSourceEvents } from '@/api/fanfinity'
import { currentAccount, waitForAccount } from '@/composables/useMe'

/**
 * Has a real event reached this source?
 *
 * ONE ANSWER TO ONE QUESTION. Three surfaces ask it — the source detail page's
 * `WebSdkSetupPanel`, the shared `SourceInstallGuide` and the first-run arrival's
 * verify beat — and they used to ask it three times in three slightly different
 * ways, which is how the same source could read "Receiving events" on one screen
 * and "Waiting for first event" on the next. The test is `listSourceEvents(page
 * 1, size 1)` and `total > 0`; anything cleverer here would be a second answer a
 * reader meets a week later on a different tab.
 *
 * A `400` IS AN ORDINARY STATE, NOT A FAILURE. The events endpoint answers 400
 * for a source with no queryable event log — every `event_stream` source until
 * its SDK has initialised — so it reports `unsupported` ("nothing to read yet")
 * rather than a red "couldn't run the check". That is the same line
 * `useSourceWriteKeys()` draws between a 400 ("no Jitsu site yet") and a 404
 * ("no endpoint"), followed rather than reinvented.
 *
 * Never throws: every caller renders a state, so a rejected promise would only
 * mean each of them writing the same try/catch again.
 *
 * @param {string} sourceId
 * @returns {Promise<{
 *   state: 'found' | 'empty' | 'unsupported' | 'error',
 *   total: number,
 *   message: string
 * }>}
 */
export async function checkSourceEvents(sourceId) {
  if (!sourceId) return { state: 'error', total: 0, message: 'No source id' }

  try {
    await waitForAccount()
    const accountId = currentAccount.value?.id
    if (!accountId) throw new Error('No account selected')

    const { data } = await listSourceEvents(accountId, sourceId, {
      page: 1,
      size: 1
    })
    const total = data?.total ?? 0
    return {
      state: total > 0 ? 'found' : 'empty',
      total,
      message: ''
    }
  } catch (e) {
    if (e?.status === 400) {
      return { state: 'unsupported', total: 0, message: '' }
    }
    return {
      state: 'error',
      total: 0,
      message: e?.body?.detail || e?.message || 'The request failed.'
    }
  }
}

export default checkSourceEvents
