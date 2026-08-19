// Reads and writes public.url_scan_history for the signed-in user.
//
// Convenience only: a failure here must never change, delay or hide a scan
// result — callers treat a rejection as "history is out of sync".

import { supabase } from '@/lib/supabase'
import { redactURL } from '@/lib/redact-url'
import { headlineFor } from '@/pages/url/utils/result-presentation'

export const HISTORY_LIMIT = 5

// Mirrors the check constraints on url_scan_history.
const STORABLE_LEVELS = new Set(['safe', 'warning', 'danger'])
const GENAI_RISK_LEVELS = new Set(['low', 'medium', 'high'])

const LOGIN_REQUIRED_MESSAGE = 'Log in to keep your recent scans.'
const NO_RESULT_MESSAGE = 'There is no scan to save yet.'
const SAVE_FAILED_MESSAGE = "We couldn't save this scan to your history."
const LOAD_FAILED_MESSAGE = "We couldn't load your recent scans."
const CLEAR_FAILED_MESSAGE = "We couldn't clear your history. Please try again."

// Supabase error text can name the table, the policy or the project, so these
// carry wording meant for the user and keep the original on `cause`.
export class HistorySaveError extends Error {
  constructor(cause) {
    super(SAVE_FAILED_MESSAGE, { cause })
    this.name = 'HistorySaveError'
  }
}

export class HistoryLoadError extends Error {
  constructor(cause) {
    super(LOAD_FAILED_MESSAGE, { cause })
    this.name = 'HistoryLoadError'
  }
}

export class HistoryClearError extends Error {
  constructor(cause) {
    super(CLEAR_FAILED_MESSAGE, { cause })
    this.name = 'HistoryClearError'
  }
}

// Never coerced: a missing score would become 0, which reads as "the model saw
// no risk".
function mlProbabilityOf(result) {
  const probability = result.probability
  if (typeof probability !== 'number' || !Number.isFinite(probability)) return null
  if (probability < 0 || probability > 1) return null
  return probability
}

// Rating only — the analyst's reasoning and advice are free text that can name
// the link, so they are never stored.
function genaiRiskLevelOf(result) {
  const riskLevel = result.genai_analysis?.risk_level
  return GENAI_RISK_LEVELS.has(riskLevel) ? riskLevel : null
}

export function buildHistoryPayload({ user, result }) {
  // Only the authenticated user object supplies the id; a caller-passed one is
  // never read.
  const userId = user?.id
  if (!userId) throw new Error(LOGIN_REQUIRED_MESSAGE)
  if (!result || typeof result !== 'object') throw new Error(NO_RESULT_MESSAGE)

  // Refused rather than defaulted: storing "warning" for a level we did not
  // recognise would record a verdict the user was never shown.
  const verdictLevel = result.verdict_level
  if (!STORABLE_LEVELS.has(verdictLevel)) throw new Error(NO_RESULT_MESSAGE)

  // Throws rather than falling back to the raw URL, which aborts the save.
  const urlRedacted = redactURL(result.url)

  return {
    user_id: userId,
    url_redacted: urlRedacted,
    verdict: headlineFor(result),
    verdict_level: verdictLevel,
    ml_probability: mlProbabilityOf(result),
    genai_risk_level: genaiRiskLevelOf(result),
  }
}

export async function saveURLScanToHistory({ user, result }) {
  const payload = buildHistoryPayload({ user, result })

  const { data, error } = await supabase
    .from('url_scan_history')
    .insert(payload)
    .select('id, url_redacted, verdict, verdict_level, created_at')
    .single()

  if (error) throw new HistorySaveError(error)

  return data
}

// RLS scopes rows to their owner; the explicit user_id filter is a second layer.
export async function getRecentURLScans({ user, limit = HISTORY_LIMIT }) {
  const userId = user?.id
  if (!userId) throw new Error(LOGIN_REQUIRED_MESSAGE)

  const { data, error } = await supabase
    .from('url_scan_history')
    .select('id, url_redacted, verdict, verdict_level, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new HistoryLoadError(error)

  return data ?? []
}

// Same defence in depth as the read: the delete policy restricts this to
// auth.uid(), and the filter repeats it so a missing policy cannot widen it.
export async function clearURLScanHistory({ user }) {
  const userId = user?.id
  if (!userId) throw new Error(LOGIN_REQUIRED_MESSAGE)

  const { error } = await supabase.from('url_scan_history').delete().eq('user_id', userId)

  if (error) throw new HistoryClearError(error)
}
