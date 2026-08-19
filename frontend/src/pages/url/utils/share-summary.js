// Builds the short, plain-text scan summary the user can copy or share with
// someone helping them.
//
// Everything here comes from the finished result already on screen: the fused
// verdict, the deterministic summary and recommended-action helpers, and the
// model's own score. Gemini's reasoning, advice, target brand and risk level
// are deliberately absent — a second opinion that cannot clear a high-risk
// result must not be able to reach a message the user forwards either.
//
// Only the hostname (plus a non-default port) leaves the page. Credentials,
// path, query string and fragment are never read, so they cannot be shared,
// and an address we cannot parse disables sharing rather than falling back to
// the raw URL.

import { parseWebAddress } from '@/lib/web-address'
import { headlineFor, recommendedActionFor, scoreFor, summaryFor } from './result-presentation'

export const SHARE_UNAVAILABLE_MESSAGE =
  "We couldn't read this link's website address safely, so there is nothing to share for this result."

const DISCLAIMER =
  'ScamSense is a screening tool and cannot guarantee whether a website is safe.'

// Dots are broken so the summary cannot become a clickable link wherever it is
// pasted, which is the same reason nothing on the result page is an anchor.
function defangHostname(hostname) {
  return hostname.replaceAll('.', '[.]')
}

// hostname excludes username, password and port by definition, and search and
// hash are never read, so those parts are dropped by never being touched.
export function shareHostFor(result) {
  const address = parseWebAddress(result?.url)
  if (!address) return null

  const { parsed } = address
  // The URL parser leaves `port` empty for a scheme's default port.
  const port = parsed.port ? `:${parsed.port}` : ''

  return `${defangHostname(parsed.hostname)}${port}`
}

// Always absolute, unlike the card's relative line: a forwarded summary is read
// later, where "just now" would be wrong.
function formatCheckedAt(isoString) {
  const checkedAt = new Date(isoString)
  if (Number.isNaN(checkedAt.getTime())) return ''

  return checkedAt.toLocaleString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function buildShareSummary(result) {
  const host = shareHostFor(result)
  if (!host) return null

  const lines = [
    'ScamSense URL Check',
    '',
    `Verdict: ${headlineFor(result)}`,
    `Host checked: ${host}`,
    `Model risk: ${scoreFor(result)} out of 100`,
    '',
    'Why:',
    summaryFor(result),
    '',
    'Recommended action:',
    recommendedActionFor(result),
  ]

  const checkedAt = formatCheckedAt(result?.checked_at)
  if (checkedAt) lines.push('', `Checked: ${checkedAt}`)

  lines.push('', DISCLAIMER)

  return { host, text: lines.join('\n') }
}

export function nativeShareSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

// Both actions report an outcome rather than re-throwing: the browser's own
// error can name the page or the blocked permission, and none of that belongs
// in a message shown to the user.
export async function copySummaryToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}

// Only ever called from a click: navigator.share requires a user gesture.
export async function shareSummaryNatively(text) {
  try {
    await navigator.share({ text })
    return 'shared'
  } catch (failure) {
    // Closing the share sheet rejects with AbortError, which is a normal
    // outcome and must not surface as an error.
    return failure instanceof Error && failure.name === 'AbortError' ? 'dismissed' : 'failed'
  }
}
