import { useMockResource } from '@/composables/useMockResource'

/**
 * Secrets = encrypted credentials a pipe function reads back as
 * `secrets.KEY_NAME`. The value itself is write-only: it is submitted once,
 * encrypted, and never returned. Everything a screen can show is the key, what
 * references it, and a partial preview of the tail.
 *
 * Data is `public/data/secrets.json` (live) plus the `secrets` slice of
 * `public/data/trash.json` (deleted, restorable). Writes have no backend:
 * `add`, `remove`, `restore` and `purge` mutate the loaded arrays and nothing
 * else. Pages own the toast and must not imply persistence.
 */

/** How a secret is referenced from inside a function. */
export const SECRET_REFERENCE_PREFIX = 'secrets.'

/** Keys are environment-variable shaped: UPPER_SNAKE, starting with a letter. */
const KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/

/**
 * The expression a function author pastes to read this secret.
 *
 * @param {object|string} secret record or bare key
 * @returns {string}
 */
export function secretReference(secret) {
  const key = typeof secret === 'string' ? secret : (secret?.key ?? '')
  return `${SECRET_REFERENCE_PREFIX}${key}`
}

/**
 * Whatever was typed, in the shape a key has to be in.
 *
 * Applied on input rather than on submit so the field shows the rule instead of
 * explaining it after the fact.
 *
 * @param {string} value
 * @returns {string} e.g. `'meta access-token'` -> `'META_ACCESS_TOKEN'`
 */
export function normaliseSecretKey(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+/, '')
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isValidSecretKey(value) {
  return KEY_PATTERN.test(String(value ?? ''))
}

/**
 * The live secrets, plus local-only mutations.
 *
 * @returns {{
 *   secrets: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   findById: (id: string) => object|null,
 *   hasKey: (key: string) => boolean,
 *   add: (input: object) => object,
 *   remove: (id: string) => void
 * }}
 *
 * @example
 * const { secrets, loading, error, load } = useSettingsSecrets()
 * onMounted(load)
 */
export function useSettingsSecrets() {
  const { data: secrets, loading, error, load } = useMockResource('secrets')

  function findById(id) {
    return secrets.value.find(s => s.id === id) ?? null
  }

  function hasKey(key) {
    const wanted = String(key ?? '').trim()
    return secrets.value.some(s => s.key === wanted)
  }

  /**
   * The submitted value is deliberately dropped on the floor. There is nothing
   * to encrypt it with and nowhere to put it, and holding it in memory so a
   * later Reveal could print it back is exactly the behaviour this screen is
   * supposed to make impossible.
   */
  function add(input) {
    const key = String(input?.key ?? '').trim()
    const record = {
      id: `sec_${key.toLowerCase()}`,
      key,
      description: String(input?.description ?? '').trim(),
      valuePreview: '••••••••',
      usedByCount: 0,
      usedBy: [],
      lastUsedAt: null,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    secrets.value = [...secrets.value, record]
    return record
  }

  function remove(id) {
    secrets.value = secrets.value.filter(s => s.id !== id)
  }

  /**
   * Put a deleted record back in the live list. The encrypted value survives a
   * soft delete on the real product, so a restored secret keeps its preview and
   * its version — only the deletion bookkeeping is dropped.
   */
  function restoreRecord(record) {
    const restored = {
      usedBy: [],
      usedByCount: 0,
      lastUsedAt: null,
      ...record,
      updatedAt: new Date().toISOString()
    }
    delete restored.deletedAt
    delete restored.deletedBy
    delete restored.deletedByName
    secrets.value = [...secrets.value, restored]
    return restored
  }

  return {
    secrets,
    loading,
    error,
    load,
    findById,
    hasKey,
    add,
    remove,
    restoreRecord
  }
}

/**
 * Deleted secrets, from the shared trash file. Restorable for 30 days.
 *
 * @returns {{
 *   deleted: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   restore: (id: string) => void,
 *   purge: (id: string) => void
 * }}
 */
export function useSettingsSecretsTrash() {
  const {
    data: deleted,
    loading,
    error,
    load
  } = useMockResource('trash', { select: payload => payload.secrets })

  // Both writes leave the trash the same way — the difference is what the page
  // does next, which is why restoring the record into the live list belongs to
  // `useSettingsSecrets` and not here.
  function restore(id) {
    deleted.value = deleted.value.filter(s => s.id !== id)
  }

  function purge(id) {
    deleted.value = deleted.value.filter(s => s.id !== id)
  }

  return { deleted, loading, error, load, restore, purge }
}
