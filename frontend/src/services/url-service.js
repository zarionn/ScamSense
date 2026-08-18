// A request that never settles would leave the page stuck on "Checking this
// link…" with no way out, so every check is bounded.
const REQUEST_TIMEOUT_MS = 30000

const VERDICT_LEVELS = new Set(['safe', 'warning', 'danger'])

// A 200 that is not the documented result contract is refused rather than
// rendered: a partial payload would otherwise be shown as a verdict the
// detector never returned.
//
// Only the fields the card cannot safely do without are required. The rest
// (verdict, zone, whitelist_hit, decided_by, genai_*, explanation, advice) are
// already handled as absent by the presentation helpers, so demanding them
// would reject responses that render correctly.
function isURLResult(data) {
  return (
    Boolean(data) &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    // Shown on the card, and the only value redaction, sharing and history read.
    typeof data.url === 'string' &&
    // Drives every tone, the recommended action and the stored verdict level.
    VERDICT_LEVELS.has(data.verdict_level) &&
    // Rendered with .toFixed() in the technical details.
    typeof data.probability === 'number' &&
    Number.isFinite(data.probability) &&
    // Identifies the scan: history dedupes on url|checked_at, and the feedback
    // form remounts on it, so a missing value merges separate scans.
    typeof data.checked_at === 'string'
  )
}

export async function checkURL(url) {
  let response

  try {
    response = await fetch('/api/url/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (failure) {
    if (failure?.name === 'TimeoutError' || failure?.name === 'AbortError') {
      throw new Error('That check took too long to finish. Please try again.')
    }
    throw new Error('Could not reach the server. Check your connection and try again.')
  }

  let data
  try {
    data = await response.json()
  } catch {
    throw new Error('The server sent back an unexpected response. Please try again.')
  }

  if (!response.ok) {
    throw new Error(data?.error || 'Something went wrong while checking this link.')
  }

  if (!isURLResult(data)) {
    throw new Error('The server sent back an unexpected response. Please try again.')
  }

  return data
}
