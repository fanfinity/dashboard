// What the sign-in and sign-up forms accept, and — the part that was missing —
// what they say when they don't.
//
// QA found both forms failing silently: an invalid email or a three-character
// password left the submit button disabled and nothing else happened, so the
// only feedback was a button that would not respond. The rules below are the
// same ones the page used to enforce by disabling the button; they now return a
// sentence, and the page renders it under the field.
//
// ONE THING THIS IS NOT: a security control. Everything here runs in the
// browser, and `POST /v1/register` still accepts anything the backend accepts —
// including `12345678`. This is a guardrail that stops people choosing a weak
// password by accident on our form. Real enforcement has to live in the backend,
// and is written up in todos/backend-ask-auth-onboarding.md.

// Deliberately permissive: the shapes an address can legally take are wider than
// any regex worth maintaining, and a false rejection here blocks a real customer
// for the sake of catching a typo the backend catches anyway. This rejects the
// things that are definitely not addresses — no @, no dot in the domain, spaces
// — and lets everything else through.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/

export const PASSWORD_MIN_LENGTH = 8

// Consumer mailbox providers. Used for a NON-BLOCKING warning, never a
// rejection: contractors, agencies and small companies genuinely run on these,
// and turning that into an error was proposed once and dropped for exactly that
// reason. What the warning buys is the thing that is otherwise discovered a week
// later — a personal address cannot domain-match anyone into a shared workspace,
// so signing up with one means a workspace of one.
const PERSONAL_EMAIL_DOMAINS = new Set([
  'aol.com',
  'gmail.com',
  'googlemail.com',
  'hotmail.co.uk',
  'hotmail.com',
  'icloud.com',
  'live.com',
  'mail.com',
  'me.com',
  'msn.com',
  'outlook.com',
  'proton.me',
  'protonmail.com',
  'yahoo.com',
  'yandex.com',
  'ymail.com',
  'zoho.com'
])

// The passwords that turn up at the top of every breach corpus, plus the ones
// people reach for on a product called Sfere. Short and hand-kept on purpose: a
// real leaked-password check is a backend job against a real corpus (the ask is
// in todos/backend-ask-auth-onboarding.md), and shipping a megabyte of hashes to
// the browser to half-do it is the wrong trade.
const COMMON_PASSWORDS = new Set([
  '000000',
  '11111111',
  '12345678',
  '123456789',
  '1234567890',
  'abc12345',
  'admin123',
  'baseball',
  'dragon123',
  'football',
  'iloveyou',
  'letmein1',
  'login123',
  'monkey123',
  'password',
  'password1',
  'password123',
  'qwerty123',
  'qwertyui',
  'sfere123',
  'sunshine',
  'trustno1',
  'welcome1',
  'welcome123'
])

export function emailDomain(email) {
  const at = String(email ?? '').lastIndexOf('@')
  return at === -1
    ? ''
    : email
        .slice(at + 1)
        .trim()
        .toLowerCase()
}

export function isPersonalEmail(email) {
  return PERSONAL_EMAIL_DOMAINS.has(emailDomain(email))
}

// Returns the sentence to show under the field, or '' when the value is fine.
// A sentence rather than a boolean because the caller's only job should be to
// render it — a page deciding which of five messages a `false` meant is how the
// two forms end up disagreeing about the same rule.
export function emailProblem(value) {
  const email = String(value ?? '').trim()
  if (!email) return 'Enter your email address.'
  if (!EMAIL_PATTERN.test(email))
    return 'That does not look like an email address. Check for a missing @ or a typo in the domain.'
  return ''
}

function characterClasses(password) {
  return {
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password)
  }
}

function classCount(password) {
  return Object.values(characterClasses(password)).filter(Boolean).length
}

// Sign-in checks only that something was typed: the rule below is what we ask of
// a NEW password, and applying it at sign-in would lock out every account that
// predates it while telling them their own password is invalid.
export function signInPasswordProblem(value) {
  return String(value ?? '') ? '' : 'Enter your password.'
}

// Three of the four classes rather than all four: requiring a symbol pushes
// people towards `Password1!`, which satisfies every rule and is in every
// corpus. Length plus variety plus the denylist catches more of what actually
// gets guessed.
export function signUpPasswordProblem(value) {
  const password = String(value ?? '')
  if (!password) return 'Choose a password.'
  if (password.length < PASSWORD_MIN_LENGTH)
    return `Use at least ${PASSWORD_MIN_LENGTH} characters. This one has ${password.length}.`
  if (COMMON_PASSWORDS.has(password.toLowerCase()))
    return 'That is one of the most commonly used passwords. Pick something else.'
  if (classCount(password) < 3)
    return 'Mix at least three of: lower case, upper case, numbers, symbols.'
  return ''
}

const STRENGTH_LEVELS = [
  { label: 'Too weak', tone: 'danger' },
  { label: 'Weak', tone: 'danger' },
  { label: 'Fair', tone: 'warning' },
  { label: 'Good', tone: 'success' },
  { label: 'Strong', tone: 'success' }
]

// A meter, not a gate — `signUpPasswordProblem` decides what is accepted. The
// score exists so someone typing a password that only just clears the rule can
// see that it only just clears it.
export function passwordStrength(value) {
  const password = String(value ?? '')
  if (!password) return { score: 0, ...STRENGTH_LEVELS[0], empty: true }

  if (COMMON_PASSWORDS.has(password.toLowerCase()))
    return { score: 0, ...STRENGTH_LEVELS[0], empty: false }

  let score = 0
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1
  if (password.length >= 12) score += 1
  const classes = classCount(password)
  if (classes >= 3) score += 1
  if (classes === 4) score += 1

  // A long password that is all one class — a passphrase typed in lower case, or
  // a long run of digits — should not read as Good on length alone.
  if (classes < 2) score = Math.min(score, 1)

  return { score, ...STRENGTH_LEVELS[score], empty: false }
}
