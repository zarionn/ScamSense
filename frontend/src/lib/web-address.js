// The one frontend definition of a supported web address, shared by the pasted-link
// input, QR scanning and redaction. url_normalizer.py stays the final authority on
// what the detector sees.

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

// Matches the length guard on /api/url/predict.
export const MAX_WEB_ADDRESS_LENGTH = 2000

// Refused rather than cleaned up: the URL parser drops or rewrites these, which would
// let the address the user reads differ from the string the detector receives.
const UNSAFE_ADDRESS_CHARACTERS = /[\s\\]/

// Written as a code-point range: a regular expression cannot match control
// characters without tripping the linter.
function hasControlCharacter(value) {
  for (const character of value) {
    const code = character.codePointAt(0)
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true
  }
  return false
}

// What a submitted value must be before any request is made — one contract for a pasted
// link and a decoded QR code, so neither path accepts text the other refuses. The value
// is returned exactly as given: a scheme the user never supplied is never added.
export function parseSupportedWebAddress(rawValue) {
  const url = typeof rawValue === 'string' ? rawValue.trim() : ''

  if (!url || url.length > MAX_WEB_ADDRESS_LENGTH) return null
  if (UNSAFE_ADDRESS_CHARACTERS.test(url) || hasControlCharacter(url)) return null

  const address = parseWebAddress(url)
  if (!address) return null

  const hostname = address.parsed.hostname

  // Free text such as "hello" parses as a hostname, so a scheme-less value has to at
  // least look like a domain.
  if (!address.hasScheme && !hostname.includes('.')) return null

  // Anything the parser mapped away — zero-width characters, a punycoded host — would
  // leave the user reading a different address from the one we check.
  if (!url.toLowerCase().includes(hostname)) return null

  return { url, hostname, hasScheme: address.hasScheme }
}
