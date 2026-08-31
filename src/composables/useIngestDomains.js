import { camelizeKeys, pageItems } from '@/lib/apiShape'
import { currentAccount } from '@/composables/useMe'
import { useMockResource, sendMutation } from '@/composables/useMockResource'

/**
 * Custom domains that front the event-ingest endpoint, with DNS verification.
 * Live as of backend PR #16:
 *
 *   GET/POST      …/domains
 *   GET/DELETE    …/domains/{id}
 *   POST          …/domains/{id}/verify
 *
 * Why anyone wants one: events posted to `events.yourbrand.com` are first-party
 * requests, which survive the tracking protection that blocks a third-party
 * collector host. That is the whole feature, and it is why the DNS records below
 * are the screen rather than an implementation detail.
 *
 * ## Two statuses, not one, and they fail independently
 *
 * `status` is the domain's ownership check (`pending | verified | failed`) and
 * `certificate_status` is the TLS certificate (`pending | issued | failed`). A
 * domain can be verified with a certificate still pending — that is the normal
 * middle state, lasting minutes — and it can be verified with a FAILED
 * certificate, which is broken in a way "verified" alone would hide. So the UI
 * shows both rather than collapsing them into one badge.
 *
 * ## `dns_records` is the instruction, and it is nullable
 *
 * `POST …/domains` returns the records to add. They are surfaced from whatever
 * Jitsu reports (`app/services/ingest_domains.py`) and are absent until it has
 * evaluated the domain — so a freshly-created domain can legitimately come back
 * with no records yet, and the panel says "the records appear here shortly"
 * rather than "no records needed", which would be a very expensive thing to get
 * wrong.
 *
 * `verify()` re-reads rather than trusting its own response: verification is a
 * request to check, and the answer is whatever the backend says afterwards.
 */

const DOMAIN_STATUS = {
  pending: { label: 'Pending', tone: 'warn' },
  verified: { label: 'Verified', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' }
}

const CERT_STATUS = {
  pending: { label: 'Certificate pending', tone: 'warn' },
  issued: { label: 'Certificate issued', tone: 'success' },
  failed: { label: 'Certificate failed', tone: 'danger' }
}

/** @param {string} status */
export function domainStatusBadge(status) {
  return (
    DOMAIN_STATUS[status] ?? { label: status || 'Unknown', tone: 'neutral' }
  )
}

/** @param {string} status */
export function certificateStatusBadge(status) {
  return CERT_STATUS[status] ?? { label: status || 'Unknown', tone: 'neutral' }
}

/** One wire `DnsRecord`. */
function adaptDnsRecord(raw) {
  const r = camelizeKeys(raw)
  return {
    type: r.type,
    name: r.name,
    value: r.value || '',
    // Null rather than a default: a TTL the provider did not state is the
    // provider's choice, not 3600.
    ttl: r.ttl ?? null
  }
}

/** One wire `IngestDomain`. */
export function adaptIngestDomain(raw) {
  const d = camelizeKeys(raw)
  return {
    id: d.id,
    accountId: d.accountId ?? null,
    domain: d.domain || '',
    status: d.status || 'pending',
    certificateStatus: d.certificateStatus || 'pending',
    // Null, NOT [] — "not evaluated yet" and "no records needed" are different
    // answers and only one of them is ever true here. See the note above.
    dnsRecords: Array.isArray(d.dnsRecords)
      ? d.dnsRecords.map(adaptDnsRecord)
      : null,
    error: d.error ?? null,
    verifiedAt: d.verifiedAt ?? null,
    createdAt: d.createdAt ?? null
  }
}

function domainsPath() {
  return (
    currentAccount.value && `/v1/accounts/${currentAccount.value.id}/domains`
  )
}

export function useIngestDomains() {
  const {
    data: domains,
    loading,
    error,
    apiMissing,
    load
  } = useMockResource('ingest-domains', {
    api: {
      path: domainsPath,
      select: payload => pageItems(payload).map(adaptIngestDomain)
    }
  })

  function domainPath(id) {
    const base = domainsPath()
    return base && `${base}/${id}`
  }

  /**
   * Claim a domain. The response carries the DNS records to add, which is the
   * only reason the create flow shows a result panel rather than a toast.
   *
   * @param {string} domain
   */
  async function create(domain) {
    const res = await sendMutation({
      method: 'POST',
      path: domainsPath,
      body: { domain }
    })
    if (!res.ok || res.skipped) return res
    const record = adaptIngestDomain(camelizeKeys(res.data))
    domains.value = [...domains.value, record]
    return { ok: true, data: record }
  }

  /**
   * Ask the backend to re-check the DNS records.
   *
   * The response is the domain, so this replaces the row in place. It is not
   * assumed to be verified afterwards — a verify that finds the records still
   * missing comes back `pending` or `failed`, and that is the honest outcome to
   * show.
   *
   * @param {string} id
   */
  async function verify(id) {
    const res = await sendMutation({
      method: 'POST',
      path: () => {
        const base = domainPath(id)
        return base && `${base}/verify`
      }
    })
    if (!res.ok || res.skipped) return res
    const record = adaptIngestDomain(camelizeKeys(res.data))
    domains.value = domains.value.map(d => (d.id === id ? record : d))
    return { ok: true, data: record }
  }

  async function remove(id) {
    const res = await sendMutation({
      method: 'DELETE',
      path: () => domainPath(id)
    })
    if (res.ok) domains.value = domains.value.filter(d => d.id !== id)
    return res
  }

  return { domains, loading, error, apiMissing, load, create, verify, remove }
}
