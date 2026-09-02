import { camelizeKeys, pageItems } from '@/lib/apiShape'
import { currentAccount } from '@/composables/useMe'
import { useMockResource, sendMutation } from '@/composables/useMockResource'

/**
 * Bring-your-own Airbyte connector images. Live as of backend PR #16:
 *
 *   GET/POST   …/connector-images
 *   DELETE     …/connector-images/{id}
 *
 * What it is for: the catalog at `GET /v1/connectors` is a short, curated list
 * (the Zid app plus the Airbyte connectors already hosted on Jitsu). An image
 * registered here adds one that is not on it — any published Airbyte connector —
 * so a source can be pulled from a system Sfere has never heard of. It is
 * deliberately NOT in the catalog list; `app/services/connectors.py` says custom
 * images "are a separate feature and never appear in this list".
 *
 * ## `status` is `pending → ready | failed`, and `pending` is a poll
 *
 * Registering an image makes the backend fetch and inspect it, which takes as
 * long as it takes. A `pending` row is work in progress, not a broken one, and a
 * `failed` one carries `error`. So the list is worth re-reading while anything is
 * pending — `hasPending()` below is what a screen watches — and a pending row
 * must not be offered as something to build a source from.
 *
 * ## `credentials` is write-only and is never read back
 *
 * `ConnectorImageCreate` takes an optional `credentials` map for a private
 * registry. `ConnectorImage` has no such field: it is accepted, used and never
 * returned. So there is nothing to pre-fill on an edit — and there is no update
 * route either, which is consistent: an image is registered or removed, not
 * edited.
 */

const IMAGE_STATUS = {
  pending: {
    label: 'Preparing',
    tone: 'warn',
    note: 'The backend is fetching and inspecting the image. This finishes on its own.'
  },
  ready: {
    label: 'Ready',
    tone: 'success',
    note: 'Available to pull a source from.'
  },
  failed: {
    label: 'Failed',
    tone: 'danger',
    note: 'The image could not be prepared. The reason is on the row.'
  }
}

/** @param {string} status */
export function imageStatusBadge(status) {
  return (
    IMAGE_STATUS[status] ?? {
      label: status || 'Unknown',
      tone: 'neutral',
      note: ''
    }
  )
}

/** One wire `ConnectorImage`. */
export function adaptConnectorImage(raw) {
  const i = camelizeKeys(raw)
  return {
    id: i.id,
    accountId: i.accountId ?? null,
    package: i.package || '',
    version: i.version || '',
    // Only `airbyte` is in the enum today, and it is optional, so an absent
    // value is left absent rather than assumed.
    protocol: i.protocol ?? null,
    status: i.status || 'pending',
    error: i.error ?? null,
    createdAt: i.createdAt ?? null
  }
}

function imagesPath() {
  return (
    currentAccount.value &&
    `/v1/accounts/${currentAccount.value.id}/connector-images`
  )
}

export function useConnectorImages() {
  const {
    data: images,
    loading,
    error,
    apiMissing,
    load
  } = useMockResource('connector-images', {
    api: {
      path: imagesPath,
      select: payload => pageItems(payload).map(adaptConnectorImage)
    }
  })

  /** Whether anything is still being prepared, so a screen knows to re-read. */
  function hasPending() {
    return images.value.some(i => i.status === 'pending')
  }

  /**
   * Register an image.
   *
   * @param {{ package: string, version: string, credentials?: object|null }} input
   *   `credentials` is write-only: it is used and never returned, so nothing here
   *   keeps a copy after the request.
   */
  async function create(input) {
    const res = await sendMutation({
      method: 'POST',
      path: imagesPath,
      body: {
        package: input.package,
        version: input.version,
        ...(input.credentials ? { credentials: input.credentials } : {})
      }
    })
    if (!res.ok || res.skipped) return res
    const image = adaptConnectorImage(camelizeKeys(res.data))
    images.value = [...images.value, image]
    return { ok: true, data: image }
  }

  async function remove(id) {
    const res = await sendMutation({
      method: 'DELETE',
      path: () => {
        const base = imagesPath()
        return base && `${base}/${id}`
      }
    })
    if (res.ok) images.value = images.value.filter(i => i.id !== id)
    return res
  }

  return {
    images,
    loading,
    error,
    apiMissing,
    load,
    hasPending,
    create,
    remove
  }
}
