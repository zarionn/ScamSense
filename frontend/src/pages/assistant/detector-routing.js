// Deterministic orchestration for the Assistant: decide which detectors apply to
// what the user submitted, call them, and turn each authoritative result into a
// short card.
//
// The router only ever decides WHICH detector sees WHICH content. It never
// decides scam/legitimate, risk, or recommended action — those come from the
// detector responses and are copied through unchanged. The one non-deterministic
// step is the backend intent classifier, which answers a single routing question
// ("is this text detector input?") and is treated as normal_chat unless it
// answers scan_message with high confidence.

import { parseSupportedWebAddress } from '@/lib/web-address'
import { checkURL } from '@/services/url-service'
import { analyseScreenshot } from '@/services/screenshot-service'
import { uploadTransactionStatement } from '@/services/transaction-service'
import { analyzeMessage } from '@/pages/message'
import {
  headlineFor,
  recommendedActionFor,
  summaryFor,
  toneKeyForLevel,
} from '@/pages/url/utils/result-presentation'
import { getPrimaryStatus } from '@/pages/screenshot/utils/verdict'
import { DETECTORS } from './assistant-flow'

// Caps how many links one message can spend on detector calls.
export const MAX_URL_SCANS = 3

// Below this, whatever text remains after removing links is too thin to be a
// submitted message, so the intent classifier is skipped rather than called.
const MIN_TEXT_LENGTH_FOR_INTENT = 16

// Card order, independent of which detector answers first.
export const DETECTOR_ORDER = ['message', 'url', 'screenshot', 'transaction']

const LEADING_PUNCTUATION = /^[('"[{<«]+/
const TRAILING_PUNCTUATION = /[.,;:!?)\]}>'"»]+$/

// A scheme-less candidate has to end in something that looks like a real TLD,
// otherwise sentence fragments such as "e.g" and "No.1" parse as hostnames.
function hasPlausibleTLD(hostname) {
  const lastLabel = hostname.split('.').pop() || ''
  return /^[a-z]{2,}$/i.test(lastLabel)
}

// Finds link-like substrings in ordinary prose and validates each one through
// the shared address contract, so the Assistant accepts exactly what the URL
// page and the backend accept.
export function extractWebAddresses(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { urls: [], truncated: false }
  }

  const seen = new Set()
  const urls = []
  let matched = 0

  for (const rawToken of text.split(/\s+/)) {
    const token = rawToken.replace(LEADING_PUNCTUATION, '').replace(TRAILING_PUNCTUATION, '')
    if (!token) continue

    const address = parseSupportedWebAddress(token)
    if (!address) continue
    if (!address.hasScheme && !hasPlausibleTLD(address.hostname)) continue

    const key = token.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    matched += 1
    if (urls.length < MAX_URL_SCANS) {
      urls.push(token)
    }
  }

  return { urls, truncated: matched > urls.length }
}

function isAvailable(detectorKey) {
  return DETECTORS[detectorKey]?.available === true
}

// Removes the links already routed to URL Scan so the remaining prose is what
// the intent classifier judges.
function textWithoutAddresses(text, urls) {
  let remaining = text || ''
  for (const url of urls) {
    remaining = remaining.split(url).join(' ')
  }
  return remaining.trim()
}

// Attachment type and extracted links only — no model involved.
export function findDeterministicDetectorItems({ text, attachment }) {
  const items = []

  if (attachment?.type === 'image' && isAvailable('screenshot')) {
    items.push({ detectorKey: 'screenshot', inputType: 'image', file: attachment.file })
  }

  if (attachment?.type === 'transaction' && isAvailable('transaction')) {
    items.push({
      detectorKey: 'transaction',
      inputType: 'transaction-file',
      file: attachment.file,
    })
  }

  const { urls, truncated } = extractWebAddresses(text)
  if (isAvailable('url')) {
    for (const url of urls) {
      items.push({ detectorKey: 'url', inputType: 'url', content: url })
    }
  }

  return { items, urlLimitApplied: isAvailable('url') && truncated }
}

// Single backend call that answers only "is this text detector input?".
// Anything other than a confident scan_message keeps the turn as normal chat.
export async function classifyTextIntent(text) {
  try {
    const response = await fetch('/api/assistant/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) return { intent: 'normal_chat', confidence: 'low' }
    const data = await response.json()
    if (data?.intent === 'scan_message' && data?.confidence === 'high') {
      return { intent: 'scan_message', confidence: 'high' }
    }
    return { intent: 'normal_chat', confidence: data?.confidence ?? 'low' }
  } catch {
    return { intent: 'normal_chat', confidence: 'low' }
  }
}

// Full routing decision: deterministic items, plus Message Scan when the
// classifier is confident the text itself is the suspicious content.
export async function resolveDetectorItems({ text, attachment }) {
  const { items, urlLimitApplied } = findDeterministicDetectorItems({ text, attachment })

  const trimmedText = typeof text === 'string' ? text.trim() : ''
  if (!trimmedText || !isAvailable('message')) {
    return { items, urlLimitApplied }
  }

  const { urls } = extractWebAddresses(trimmedText)
  if (textWithoutAddresses(trimmedText, urls).length < MIN_TEXT_LENGTH_FOR_INTENT) {
    return { items, urlLimitApplied }
  }

  const intent = await classifyTextIntent(trimmedText)
  if (intent.intent !== 'scan_message' || intent.confidence !== 'high') {
    return { items, urlLimitApplied }
  }

  return {
    items: [{ detectorKey: 'message', inputType: 'text', content: trimmedText }, ...items],
    urlLimitApplied,
  }
}

function callDetector(item) {
  switch (item.detectorKey) {
    case 'url':
      return checkURL(item.content)
    case 'message':
      return analyzeMessage(item.content)
    case 'screenshot':
      return analyseScreenshot(item.file)
    case 'transaction':
      return uploadTransactionStatement(item.file)
    default:
      return Promise.reject(new Error('Unsupported detector'))
  }
}

// ---------------------------------------------------------------------------
// Result adapters. Each one only selects and formats fields the detector
// already returned; none of them recompute or soften a verdict.
// ---------------------------------------------------------------------------

function adaptURL(result) {
  return {
    title: DETECTORS.url.label,
    status: headlineFor(result),
    summary: summaryFor(result),
    detail: recommendedActionFor(result),
    tone: toneKeyForLevel(result.verdict_level),
    followUp: null,
  }
}

const MESSAGE_RISK_TONE = { High: 'danger', Medium: 'warning', Low: 'safe' }

function adaptMessage(result) {
  // Only the fields message_service.py assigns in Python are relied on here;
  // the Gemini-written fields are optional and may be absent.
  const scamType = result?.predicted_scam_type
  const riskLevel = result?.risk_level
  const isLegitimate = scamType === 'Legitimate'

  const status = [riskLevel ? `${riskLevel} risk` : null, scamType]
    .filter(Boolean)
    .join(' — ') || 'Result ready'

  const summary = scamType
    ? isLegitimate
      ? 'Message Scan classified this message as Legitimate.'
      : `Message Scan classified this message as a ${scamType}.`
    : 'Message Scan returned a result for this message.'

  return {
    title: DETECTORS.message.label,
    status,
    summary,
    detail: result?.confidence_score ? `Model confidence ${result.confidence_score}.` : null,
    tone: MESSAGE_RISK_TONE[riskLevel] || 'neutral',
    followUp: null,
  }
}

function adaptScreenshot(result) {
  const classifierLabel = result?.classifier?.label
  const cautionLevel = result?.effective_caution_level
  // Same helper the Screenshot page uses, so both show one primary status.
  const primary = getPrimaryStatus(classifierLabel, cautionLevel)

  const tone =
    classifierLabel === 'scam'
      ? 'danger'
      : cautionLevel === 'high'
        ? 'danger'
        : cautionLevel === 'medium'
          ? 'warning'
          : 'safe'

  const hasQuestions = Array.isArray(result?.exposure_questions)
    && result.exposure_questions.length > 0

  return {
    title: DETECTORS.screenshot.label,
    status: primary.label,
    summary: primary.description,
    detail: null,
    tone,
    followUp: hasQuestions
      ? 'Open the full result to answer the follow-up questions and get personalised recovery steps.'
      : null,
  }
}

function adaptTransaction(result) {
  const total = Number(result?.total_rows ?? 0)
  const flagged = Number(result?.flagged_rows ?? 0)

  return {
    title: DETECTORS.transaction.label,
    status: flagged > 0
      ? `${flagged} transaction${flagged === 1 ? '' : 's'} flagged`
      : 'No transactions flagged',
    summary: flagged > 0
      ? `${flagged} of ${total} transactions were flagged for review.`
      : `0 of ${total} transactions were flagged by the detector.`,
    detail: null,
    tone: flagged > 0 ? 'warning' : 'neutral',
    followUp: null,
  }
}

const ADAPTERS = {
  url: adaptURL,
  message: adaptMessage,
  screenshot: adaptScreenshot,
  transaction: adaptTransaction,
}

function adaptFailure(detectorKey, error) {
  return {
    title: DETECTORS[detectorKey]?.label ?? 'Scan',
    status: 'Could not complete this check.',
    summary: error instanceof Error ? error.message : 'Please try again from the detector page.',
    detail: null,
    tone: 'neutral',
    followUp: null,
  }
}

// Runs every routed detector independently and returns one entry per item in
// DETECTOR_ORDER. A rejection becomes that card's error state and never
// discards another detector's successful result.
export async function runDetectorItems(items) {
  const settled = await Promise.allSettled(items.map(callDetector))

  const results = items.map((item, index) => {
    const outcome = settled[index]
    const base = {
      detectorKey: item.detectorKey,
      input: item.content ?? item.file?.name ?? null,
      file: item.file ?? null,
    }

    if (outcome.status === 'fulfilled') {
      return {
        ...base,
        rawResult: outcome.value,
        error: null,
        presentation: ADAPTERS[item.detectorKey](outcome.value),
      }
    }

    return {
      ...base,
      rawResult: null,
      error: outcome.reason instanceof Error ? outcome.reason.message : 'Detector failed',
      presentation: adaptFailure(item.detectorKey, outcome.reason),
    }
  })

  return results.sort(
    (a, b) => DETECTOR_ORDER.indexOf(a.detectorKey) - DETECTOR_ORDER.indexOf(b.detectorKey)
  )
}
