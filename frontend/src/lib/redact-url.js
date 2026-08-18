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

import { parseWebAddress } from './web-address'

// Matches the char_length check on url_scan_feedback.url_redacted.
export const REDACTED_URL_MAX_LENGTH = 2048

const CANNOT_REDACT_MESSAGE =
  "We couldn't read that link well enough to store it safely, so this feedback was not sent."

export class URLRedactionError extends Error {
  constructor(message = CANNOT_REDACT_MESSAGE) {
    super(message)
    this.name = 'URLRedactionError'
  }
}

export function redactURL(rawURL) {
  const address = parseWebAddress(rawURL)
  if (!address) throw new URLRedactionError()

  // A link submitted without a scheme keeps none in the stored result:
  // recording "https://" would claim the user sent something they did not.
  const { parsed, hasScheme: hadScheme } = address

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
