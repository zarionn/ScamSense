const STRUCTURED_MESSAGE_PREFIX = 'SCAMSENSE::TRUSTED_ADVISORY::'
const STRUCTURED_MESSAGE_VERSION = 1
const STRUCTURED_MESSAGE_TYPE = 'trusted_advisory'
const MAX_SERIALIZED_CHARACTERS = 50_000
const MAX_TEXT_CHARACTERS = 20_000
const MAX_MESSAGE_CHARACTERS = 1_000
const MAX_ADVISORIES = 3
const MAX_ID_CHARACTERS = 128
const MAX_TITLE_CHARACTERS = 500
const MAX_AUTHORITIES = 5
const MAX_AUTHORITY_CHARACTERS = 200
const MAX_SUMMARY_CHARACTERS = 4_000
const MAX_URL_CHARACTERS = 2_048
const MAX_RELEVANCE_CHARACTERS = 1_000

const APPROVED_OFFICIAL_HOSTNAMES = new Set(
  ['scamshield.gov.sg', 'police.gov.sg', 'csa.gov.sg', 'mas.gov.sg', 'gov.sg'].flatMap(
    (domain) => [domain, `www.${domain}`]
  )
)
const STABLE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const CONTROL_OR_FORMAT_PATTERN = /[\p{Cc}\p{Cf}]/u
const SAFE_FALLBACK_TEXT = 'This saved advisory message could not be restored safely.'

const ENVELOPE_KEYS = ['advisory_search', 'text', 'type', 'version']
const SEARCH_KEYS = ['advisories', 'message', 'status']
const ADVISORY_KEYS = [
  'advisory_id',
  'authorities',
  'publication_date',
  'relevance',
  'source_url',
  'summary',
  'title',
]

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false
  const actualKeys = Object.keys(value).sort()
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index])
  )
}

function isBoundedText(value, maximum, { allowLineBreaks = false } = {}) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    return false
  }
  return [...value].every(
    (character) =>
      !CONTROL_OR_FORMAT_PATTERN.test(character) ||
      (allowLineBreaks && ['\n', '\r', '\t'].includes(character))
  )
}

function isRealIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return false
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}

function isApprovedOfficialUrl(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_URL_CHARACTERS ||
    value !== value.trim()
  ) {
    return false
  }

  try {
    const parsed = new URL(value)
    return (
      parsed.protocol === 'https:' &&
      APPROVED_OFFICIAL_HOSTNAMES.has(parsed.hostname.toLowerCase()) &&
      parsed.username === '' &&
      parsed.password === '' &&
      parsed.port === '' &&
      parsed.pathname !== '/'
    )
  } catch {
    return false
  }
}

function validateAdvisory(advisory) {
  return (
    hasExactKeys(advisory, ADVISORY_KEYS) &&
    isBoundedText(advisory.advisory_id, MAX_ID_CHARACTERS) &&
    STABLE_ID_PATTERN.test(advisory.advisory_id) &&
    isBoundedText(advisory.title, MAX_TITLE_CHARACTERS) &&
    Array.isArray(advisory.authorities) &&
    advisory.authorities.length > 0 &&
    advisory.authorities.length <= MAX_AUTHORITIES &&
    advisory.authorities.every((authority) =>
      isBoundedText(authority, MAX_AUTHORITY_CHARACTERS)
    ) &&
    isRealIsoDate(advisory.publication_date) &&
    isBoundedText(advisory.summary, MAX_SUMMARY_CHARACTERS) &&
    isApprovedOfficialUrl(advisory.source_url) &&
    isBoundedText(advisory.relevance, MAX_RELEVANCE_CHARACTERS)
  )
}

function validateMatchedSearch(advisorySearch) {
  return (
    hasExactKeys(advisorySearch, SEARCH_KEYS) &&
    advisorySearch.status === 'matches' &&
    isBoundedText(advisorySearch.message, MAX_MESSAGE_CHARACTERS) &&
    Array.isArray(advisorySearch.advisories) &&
    advisorySearch.advisories.length > 0 &&
    advisorySearch.advisories.length <= MAX_ADVISORIES &&
    advisorySearch.advisories.every(validateAdvisory)
  )
}

// A pending clarification is persisted so that reopening or refreshing a
// conversation still knows the assistant asked for a topic. It reuses the
// existing `status` value and the same three-key shape — no new field, and
// nothing extra for the exact-key check to allow.
function validateClarificationSearch(advisorySearch) {
  return (
    hasExactKeys(advisorySearch, SEARCH_KEYS) &&
    advisorySearch.status === 'needs_clarification' &&
    isBoundedText(advisorySearch.message, MAX_MESSAGE_CHARACTERS) &&
    Array.isArray(advisorySearch.advisories) &&
    advisorySearch.advisories.length === 0
  )
}

function validatePersistableSearch(advisorySearch) {
  return (
    validateMatchedSearch(advisorySearch) || validateClarificationSearch(advisorySearch)
  )
}

function copyMatchedSearch(advisorySearch) {
  return {
    status: advisorySearch.status,
    message: advisorySearch.message,
    advisories: advisorySearch.advisories.map((advisory) => ({
      advisory_id: advisory.advisory_id,
      title: advisory.title,
      authorities: [...advisory.authorities],
      publication_date: advisory.publication_date,
      summary: advisory.summary,
      source_url: advisory.source_url,
      relevance: advisory.relevance,
    })),
  }
}

function plainTextFallback(parsed) {
  return isPlainObject(parsed) && isBoundedText(parsed.text, MAX_TEXT_CHARACTERS, {
    allowLineBreaks: true,
  })
    ? parsed.text
    : SAFE_FALLBACK_TEXT
}

export function serializeConversationMessage({ role, text, advisorySearch }) {
  if (
    role !== 'assistant' ||
    !isBoundedText(text, MAX_TEXT_CHARACTERS, { allowLineBreaks: true }) ||
    !validatePersistableSearch(advisorySearch)
  ) {
    return text
  }

  const envelope = {
    version: STRUCTURED_MESSAGE_VERSION,
    type: STRUCTURED_MESSAGE_TYPE,
    text,
    advisory_search: copyMatchedSearch(advisorySearch),
  }
  const serialized = `${STRUCTURED_MESSAGE_PREFIX}${JSON.stringify(envelope)}`
  return serialized.length <= MAX_SERIALIZED_CHARACTERS ? serialized : text
}

export function deserializeConversationMessage(content, role) {
  const legacyText = typeof content === 'string' ? content : ''
  if (role !== 'assistant' || !legacyText.startsWith(STRUCTURED_MESSAGE_PREFIX)) {
    return { text: legacyText }
  }
  if (legacyText.length > MAX_SERIALIZED_CHARACTERS) {
    return { text: SAFE_FALLBACK_TEXT }
  }

  let parsed
  try {
    parsed = JSON.parse(legacyText.slice(STRUCTURED_MESSAGE_PREFIX.length))
  } catch {
    return { text: SAFE_FALLBACK_TEXT }
  }

  const fallbackText = plainTextFallback(parsed)
  if (
    !hasExactKeys(parsed, ENVELOPE_KEYS) ||
    parsed.version !== STRUCTURED_MESSAGE_VERSION ||
    parsed.type !== STRUCTURED_MESSAGE_TYPE ||
    !isBoundedText(parsed.text, MAX_TEXT_CHARACTERS, { allowLineBreaks: true }) ||
    !validatePersistableSearch(parsed.advisory_search)
  ) {
    return { text: fallbackText }
  }

  const advisorySearch = copyMatchedSearch(parsed.advisory_search)
  // Only a matched response carries cards; a restored clarification is text
  // plus the status the next turn reads.
  return advisorySearch.advisories.length > 0
    ? { text: advisorySearch.message, advisorySearch, advisories: advisorySearch.advisories }
    : { text: advisorySearch.message, advisorySearch }
}

export const conversationMessageCodecConstants = Object.freeze({
  prefix: STRUCTURED_MESSAGE_PREFIX,
  version: STRUCTURED_MESSAGE_VERSION,
  fallbackText: SAFE_FALLBACK_TEXT,
})
