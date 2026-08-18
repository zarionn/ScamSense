// The one frontend definition of a supported web address, shared by QR scanning and
// redaction. url_normalizer.py stays the final authority on what the detector sees.

const AUTHORITY_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i

// A leading "token:" that is neither "scheme://" nor a port. "mailto:someone@…"
// and a scheme-less "user:password@host" have the same shape and cannot be told
// apart, so both are refused. The digit lookahead keeps "example.com:8080/path"
// out of this pattern.
const OPAQUE_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:(?!\/\/)(?!\d)/i

// Restricting the scheme also stops a mailto: or javascript: string being
// treated as "a URL".
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

// A scheme-less value is parsed behind a temporary https:// prefix only so its hostname
// can be read; hasScheme keeps callers from reporting a scheme the user never supplied.
export function parseWebAddress(rawValue) {
  const value = typeof rawValue === 'string' ? rawValue.trim() : ''
  if (!value) return null

  const hasScheme = AUTHORITY_SCHEME_PATTERN.test(value)
  if (!hasScheme && OPAQUE_SCHEME_PATTERN.test(value)) return null

  let parsed
  try {
    parsed = new URL(hasScheme ? value : `https://${value}`)
  } catch {
    return null
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null
  // Rules out inputs the URL parser accepts but that carry no host, such as
  // "https://" on its own.
  if (!parsed.hostname) return null

  return { value, parsed, hasScheme }
}
