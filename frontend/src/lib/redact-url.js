// Reduces a scanned URL to scheme, host, optional port and path before it is
// stored as feedback.
//
// Credentials, query strings and fragments are the parts most likely to carry a
// reset token, a session id or an email address, so they are dropped here in the
// browser rather than filtered downstream. There is no raw-URL fallback: every
// failure throws, so a URL we could not confidently redact is never stored.
//
// Separate from the model's own normalisation in url_normalizer.py — that
// decides what the detector sees, this decides what we are willing to store.

// Matches the char_length check on url_scan_feedback.url_redacted.
export const REDACTED_URL_MAX_LENGTH = 2048

const AUTHORITY_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i

// A leading "token:" that is neither "scheme://" nor a port. "mailto:someone@…"
// and a scheme-less "user:password@host" have the same shape and cannot be told
// apart, so both are refused. The digit lookahead keeps "example.com:8080/path"
// out of this pattern.
const OPAQUE_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:(?!\/\/)(?!\d)/i

// Restricting the stored scheme also stops a mailto: or javascript: string being
// recorded as "a URL".
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

const CANNOT_REDACT_MESSAGE =
  "We couldn't read that link well enough to store it safely, so this feedback was not sent."

export class URLRedactionError extends Error {
  constructor(message = CANNOT_REDACT_MESSAGE) {
    super(message)
    this.name = 'URLRedactionError'
  }
}

export function redactURL(rawURL) {
  const trimmed = typeof rawURL === 'string' ? rawURL.trim() : ''
  if (!trimmed) throw new URLRedactionError()

  // A link typed without a scheme is parsed with a temporary one, but the result
  // keeps none: recording "https://" would claim the user submitted something
  // they did not.
  const hadScheme = AUTHORITY_SCHEME_PATTERN.test(trimmed)

  if (!hadScheme && OPAQUE_SCHEME_PATTERN.test(trimmed)) throw new URLRedactionError()

  let parsed
  try {
    parsed = new URL(hadScheme ? trimmed : `https://${trimmed}`)
  } catch {
    throw new URLRedactionError()
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) throw new URLRedactionError()
  // Rules out inputs the URL parser accepts but that carry no host, such as
  // "https://" on its own.
  if (!parsed.hostname) throw new URLRedactionError()

  // hostname excludes username, password and port by definition, so credentials
  // are dropped by never being read rather than by stripping.
  const host = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname

  // search and hash are never read, so the query string and fragment cannot
  // reach the payload.
  const path = parsed.pathname === '/' ? '' : parsed.pathname

  const redacted = hadScheme ? `${parsed.protocol}//${host}${path}` : `${host}${path}`

  // Truncating would store a misleading path, so an over-long link is rejected.
  if (redacted.length > REDACTED_URL_MAX_LENGTH) throw new URLRedactionError()

  return redacted
}
