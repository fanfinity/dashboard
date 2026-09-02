/**
 * The four words a screen is allowed to print where a value is missing.
 *
 * Every one of these used to be an em dash. One glyph carried four different
 * meanings — "this never happened", "nobody configured it", "nothing measures
 * it", "the list is empty" — and it also appeared mid-sentence as punctuation,
 * so a `—` in a table cell was genuinely ambiguous: the reader could not tell a
 * missing value from a truncated label. QA raised it as visual noise; the
 * clarity problem underneath it is the reason this file exists.
 *
 * Pick by what is actually true of the data, not by what reads shortest:
 *
 * - NEVER      a dated event that has not happened. "Last run: Never" is a
 *              fact about the sync. Do NOT use it for a date that exists but
 *              failed to parse.
 * - NOT_SET    an optional field nobody has filled in. Recoverable by the user,
 *              which is what separates it from NOT_KNOWN.
 * - NOT_KNOWN  nothing measures this. The backend does not return the field, or
 *              the read failed. Nobody can fix it from the UI.
 * - NONE       a collection that is genuinely empty — zero tags, no members.
 *
 * ZERO IS NOT ONE OF THESE, and that is the rule worth stating twice. A count
 * the backend never sent must render NOT_KNOWN, never `0`: a formatter that
 * prints a confident `0` for `undefined` states a measurement nobody took, and
 * unlike a visible gap it never gets reported. See the fixture-wider-than-the-
 * endpoint warning in CLAUDE.md. `0` is for a number that was actually counted
 * and came back zero.
 */

/** A dated event that has not happened yet. */
export const NEVER = 'Never'

/** An optional field nobody has filled in. */
export const NOT_SET = 'Not set'

/** Nothing measures this — no endpoint, or the read failed. */
export const NOT_KNOWN = 'Not known'

/** A collection that is genuinely empty. */
export const NONE = 'None'
