import { supabase } from '@/lib/supabase'

// Screenshot Scan History is never editable: the table has SELECT, INSERT and
// DELETE policies but no UPDATE policy or grant, so this service exposes save,
// list and delete only — deliberately no update, no soft-delete flag, no
// archive column. RLS is the security boundary; the explicit user_id filter on
// every query is for clarity, index use, and to make an unscoped delete
// impossible by construction.

const HISTORY_TABLE = 'screenshot_scan_history'
const HISTORY_LIMIT = 20

// Enough of the filename to stay recognisable in a list row without persisting
// an unbounded string. Only File.name is ever used — never a filesystem path.
const MAX_FILENAME_LENGTH = 200

// The two promoted enums, defined once here and re-used by the history adapter
// so a stored row is validated against exactly what was allowed on the way in.
// Both mirror the backend contracts (ClassifierResult.label / CautionLevel).
export const CLASSIFIER_LABELS = Object.freeze(['legitimate', 'suspicious', 'scam'])
export const CAUTION_LEVELS = Object.freeze(['none', 'medium', 'high'])

export function normaliseSourceFilename(filename) {
  if (typeof filename !== 'string') return null
  const trimmed = filename.trim()
  if (!trimmed) return null
  return trimmed.length > MAX_FILENAME_LENGTH
    ? trimmed.slice(0, MAX_FILENAME_LENGTH)
    : trimmed
}

function isProbability(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

// Builds exactly the row the table accepts — id and created_at are left to the
// database defaults. Exported so the payload can be asserted without Supabase.
// Returns null when the result could not produce a valid row, so a malformed
// response can never become an insert that the NOT NULL / CHECK constraints
// would reject anyway.
export function buildScreenshotScanRow({ userId, filename, result }) {
  if (!userId || typeof userId !== 'string') return null
  if (!result || typeof result !== 'object' || Array.isArray(result)) return null

  const classifier = result.classifier
  if (!classifier || typeof classifier !== 'object' || Array.isArray(classifier)) return null
  if (!CLASSIFIER_LABELS.includes(classifier.label)) return null
  if (!isProbability(classifier.scam_probability)) return null
  if (!CAUTION_LEVELS.includes(result.effective_caution_level)) return null

  return {
    user_id: userId,
    source_filename: normaliseSourceFilename(filename),
    classifier_label: classifier.label,
    scam_probability: classifier.scam_probability,
    effective_caution_level: result.effective_caution_level,
    // The complete Stage-2 response, stored verbatim so a reopened scan shows
    // exactly what the user was given at scan time.
    analysis_result: result,
  }
}

export async function saveScreenshotScan({ userId, filename, result }) {
  const row = buildScreenshotScanRow({ userId, filename, result })
  if (!row) {
    throw new Error('Screenshot result is not persistable')
  }

  const { data, error } = await supabase
    .from(HISTORY_TABLE)
    .insert(row)
    .select()
    .single()

  if (error) throw error
  return data
}

// Both deletes below scope on user_id as well as any row id. `userId` must come
// from the authenticated session — never from props, route params, or a stored
// row — so a component cannot be tricked into deleting another account's rows.
// Guests short-circuit before Supabase, matching getScreenshotScanHistory.

export async function deleteScreenshotScan({ userId, id }) {
  if (!userId || !id) return

  const { error } = await supabase
    .from(HISTORY_TABLE)
    .delete()
    .eq('user_id', userId)
    .eq('id', id)

  if (error) throw error
}

export async function clearScreenshotScanHistory({ userId }) {
  if (!userId) return

  const { error } = await supabase.from(HISTORY_TABLE).delete().eq('user_id', userId)

  if (error) throw error
}

export async function getScreenshotScanHistory(userId, limit = HISTORY_LIMIT) {
  if (!userId) return []

  const { data, error } = await supabase
    .from(HISTORY_TABLE)
    .select(
      'id, source_filename, classifier_label, scam_probability, effective_caution_level, analysis_result, created_at'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}
