// Writes one "this result looks wrong" report to public.url_scan_feedback.

import { supabase } from '@/lib/supabase'
import { redactURL } from '@/lib/redact-url'
import { headlineFor, toneKeyForLevel } from '@/pages/url/utils/result-presentation'

export const FEEDBACK_LEVELS = ['safe', 'warning', 'danger']

// Matches the char_length check on url_scan_feedback.comment.
export const COMMENT_MAX_LENGTH = 500

const GENAI_RISK_LEVELS = new Set(['low', 'medium', 'high'])

const LOGIN_REQUIRED_MESSAGE = 'Please log in to send feedback about this result.'
const NO_RESULT_MESSAGE = 'There is no result to report yet.'
const NO_CHOICE_MESSAGE = 'Choose the result you expected before submitting.'
const SAME_LEVEL_MESSAGE =
  'That matches the result we already showed. Pick a different one to tell us what you expected.'
const COMMENT_TOO_LONG_MESSAGE = `Please keep your comment under ${COMMENT_MAX_LENGTH} characters.`
const SAVE_FAILED_MESSAGE = "We couldn't save your feedback. Please try again."

// Drops the Supabase error text, which can name the table, the policy or the
// project. The original is still on `cause` for debugging.
export class FeedbackSaveError extends Error {
  constructor(cause) {
    super(SAVE_FAILED_MESSAGE, { cause })
    this.name = 'FeedbackSaveError'
  }
}

// Not coerced: a missing score would become 0, a fabricated "the model saw no
// risk" that the column's check constraint would happily accept.
function mlProbabilityOf(result) {
  const probability = result.probability
  if (typeof probability !== 'number' || !Number.isFinite(probability)) return null
  if (probability < 0 || probability > 1) return null
  return probability
}

// Rating only. The analyst's reasoning and advice are free text that can
// contradict the final verdict, so they are not stored.
function genaiRiskLevelOf(result) {
  const riskLevel = result.genai_analysis?.risk_level
  return GENAI_RISK_LEVELS.has(riskLevel) ? riskLevel : null
}

// Verdict and level come from the same presentation helpers the result card
// uses, so what is stored is what the user actually saw.
export function buildFeedbackPayload({ user, result, correctedLevel, comment = '' }) {
  // Only the authenticated user object supplies the id — a caller-passed one is
  // never read, and the insert policy would reject it anyway.
  const userId = user?.id
  if (!userId) throw new Error(LOGIN_REQUIRED_MESSAGE)
  if (!result || typeof result !== 'object') throw new Error(NO_RESULT_MESSAGE)
  if (!FEEDBACK_LEVELS.includes(correctedLevel)) throw new Error(NO_CHOICE_MESSAGE)

  const originalLevel = toneKeyForLevel(result.verdict_level)
  if (correctedLevel === originalLevel) throw new Error(SAME_LEVEL_MESSAGE)

  const trimmedComment = typeof comment === 'string' ? comment.trim() : ''
  if (trimmedComment.length > COMMENT_MAX_LENGTH) throw new Error(COMMENT_TOO_LONG_MESSAGE)

  // Throws on anything it cannot confidently reduce, aborting the submission —
  // there is no raw-URL fallback.
  const urlRedacted = redactURL(result.url)

  return {
    user_id: userId,
    url_redacted: urlRedacted,
    original_verdict: headlineFor(result),
    original_level: originalLevel,
    ml_probability: mlProbabilityOf(result),
    genai_risk_level: genaiRiskLevelOf(result),
    corrected_level: correctedLevel,
    comment: trimmedComment || null,
  }
}

export async function submitURLFeedback({ user, result, correctedLevel, comment = '' }) {
  // Throws before any network call, so a report we cannot store safely never
  // reaches Supabase.
  const payload = buildFeedbackPayload({ user, result, correctedLevel, comment })

  const { data, error } = await supabase
    .from('url_scan_feedback')
    .insert(payload)
    .select()
    .single()

  if (error) throw new FeedbackSaveError(error)

  return data
}
