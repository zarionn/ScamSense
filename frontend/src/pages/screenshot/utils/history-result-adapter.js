import { CAUTION_LEVELS, CLASSIFIER_LABELS } from '@/services/screenshot-scan-service'

// The single boundary between a stored history row and Screenshot page state.
// Nothing else parses or validates analysis_result, so a corrupted row is
// rejected in exactly one place rather than crashing somewhere inside ResultView.
//
// Deliberately NOT a migration/versioning framework: validate only what the
// current ResultView genuinely needs, and tolerate absence for everything it
// already defaults itself (observations, actions, exposures, guards).

export const HISTORY_FALLBACK_FILENAME = 'Saved screenshot'

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isRestorableScreenshotResult(result) {
  if (!isPlainObject(result)) return false

  const classifier = result.classifier
  if (!isPlainObject(classifier)) return false
  if (!CLASSIFIER_LABELS.includes(classifier.label)) return false
  if (
    typeof classifier.scam_probability !== 'number' ||
    !Number.isFinite(classifier.scam_probability) ||
    classifier.scam_probability < 0 ||
    classifier.scam_probability > 1
  ) {
    return false
  }

  // ResultSummary renders confidence_pct directly, so it has to be usable too.
  if (
    typeof classifier.confidence_pct !== 'number' ||
    !Number.isFinite(classifier.confidence_pct)
  ) {
    return false
  }

  if (!CAUTION_LEVELS.includes(result.effective_caution_level)) return false

  // AIExplanationCard measures and slices this string, so an absent or
  // non-string message is not renderable.
  if (typeof result.response_message !== 'string' || result.response_message.length === 0) {
    return false
  }

  return true
}

// Row -> the exact props ScreenshotScanPage already holds for a live scan.
// previewUrl is null by design: the screenshot itself is never persisted.
// Returns null when the row cannot be rendered, so the caller can mark that one
// row unopenable while every other row keeps working.
export function adaptScreenshotHistoryRow(row) {
  if (!isPlainObject(row)) return null

  const result = row.analysis_result
  if (!isRestorableScreenshotResult(result)) return null

  return {
    id: row.id,
    file: { name: row.source_filename || HISTORY_FALLBACK_FILENAME },
    previewUrl: null,
    result,
  }
}

// List-row view model. Built from the promoted columns so the list never has to
// read analysis_result, and kept separate from the reopen adapter so one bad
// payload only makes that row unopenable rather than hiding it entirely.
export function toScreenshotHistoryEntry(row) {
  if (!isPlainObject(row)) return null

  const restorable = isRestorableScreenshotResult(row.analysis_result)

  return {
    id: row.id,
    displayName: row.source_filename || HISTORY_FALLBACK_FILENAME,
    classifierLabel: row.classifier_label,
    effectiveCautionLevel: row.effective_caution_level,
    // Mirrors the backend's own confidence definition (see classify()), so the
    // list and the reopened ResultSummary cannot disagree.
    confidencePct: Math.max(row.scam_probability, 1 - row.scam_probability) * 100,
    contentType: row.analysis_result?.audit?.content_type ?? null,
    createdAt: row.created_at,
    isRestorable: restorable,
  }
}
