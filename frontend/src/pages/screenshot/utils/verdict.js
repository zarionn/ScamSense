import { ShieldAlert, ShieldQuestion, ShieldCheck } from 'lucide-react'

// Keyed by effective_caution_level from the API (see effective_caution() in gen_ai.py).
// This is the *caution-flavoured* wording used for the primary status whenever the raw
// classifier itself did not say "scam" — e.g. a "legitimate" classification that the
// independent visual review escalated to high caution reads as "High Caution", not
// "Likely a Scam", because the official model never called it a scam. See
// getPrimaryStatus() below, which is what actually decides the primary headline.
export const CAUTION_LEVELS = {
  high: {
    label: 'High Caution',
    description: 'Independent review found strong warning signs. Treat this with care.',
    icon: ShieldAlert,
    panelClass: 'border-destructive/20 bg-destructive-soft',
    iconClass: 'text-destructive',
    textClass: 'text-destructive',
    progressClass: 'bg-destructive',
  },
  medium: {
    label: 'Some Caution Advised',
    description: 'A few concerning signs were found. Verify before acting on this.',
    icon: ShieldQuestion,
    panelClass: 'border-warning/25 bg-warning-soft',
    iconClass: 'text-warning',
    textClass: 'text-warning-strong',
    progressClass: 'bg-warning',
  },
  none: {
    label: 'No Strong Scam Signs Found',
    description: 'No extra warning signs were found beyond the classifier result below.',
    icon: ShieldCheck,
    panelClass: 'border-success/20 bg-success-soft',
    iconClass: 'text-success',
    textClass: 'text-success',
    progressClass: 'bg-success',
  },
}

export function getCautionLevel(level) {
  return CAUTION_LEVELS[level] ?? CAUTION_LEVELS.none
}

// Keyed by exposure question severity from the API (critical/high/moderate).
export const QUESTION_SEVERITY = {
  critical: {
    label: 'Critical',
    dotClass: 'bg-destructive',
    badgeClass: 'bg-destructive-soft text-destructive',
  },
  high: {
    label: 'High',
    dotClass: 'bg-warning',
    badgeClass: 'bg-warning-soft text-warning-strong border-warning-border dark:border-border',
  },
  moderate: {
    label: 'Moderate',
    dotClass: 'bg-muted-foreground',
    badgeClass: 'bg-muted text-muted-foreground',
  },
}

export function getQuestionSeverity(severity) {
  return QUESTION_SEVERITY[severity] ?? QUESTION_SEVERITY.moderate
}

// Keyed by the RAW classifier label (classifier.label from /api/analyse — "scam" |
// "suspicious" | "legitimate"). This is ONLY ever used for secondary "official
// classifier" text ("Official classifier: <label> — <confidence>% confidence") and,
// per getPrimaryStatus() below, as the primary headline in the one case where the
// classifier itself said "scam". It must never be used to describe classifier
// confidence as if it were a scam probability — confidence_pct is the model's
// confidence in *this* label, not the probability the image is a scam.
export const VERDICTS = {
  scam: {
    label: 'Likely a Scam',
    description: 'This screenshot shows strong signs of a scam. Do not follow its instructions.',
    icon: ShieldAlert,
    badgeClass: 'bg-destructive-soft text-destructive',
    panelClass: 'border-destructive/20 bg-destructive-soft',
    iconClass: 'text-destructive',
    textClass: 'text-destructive',
    progressClass: 'bg-destructive',
  },
  suspicious: {
    label: 'Potentially Risky',
    description:
      "We could not confidently tell if this is safe or a scam. Treat it with caution and verify before acting.",
    icon: ShieldQuestion,
    badgeClass: 'bg-warning-soft text-warning-strong',
    panelClass: 'border-warning/25 bg-warning-soft',
    iconClass: 'text-warning',
    textClass: 'text-warning-strong',
    progressClass: 'bg-warning',
  },
  legitimate: {
    label: 'No Strong Scam Signs Found',
    description: 'This screenshot does not show the signs of a scam that we look for.',
    icon: ShieldCheck,
    badgeClass: 'bg-success-soft text-success',
    panelClass: 'border-success/20 bg-success-soft',
    iconClass: 'text-success',
    textClass: 'text-success',
    progressClass: 'bg-success',
  },
}

export function getVerdict(label) {
  return VERDICTS[label] ?? VERDICTS.suspicious
}

// The single source of truth for the primary safety status shown in ResultSummary.
//
// Rule: "Likely a Scam" is only ever shown when the official classifier itself said
// "scam" — never inferred purely from an escalated caution level. In every other case
// (classifier said "legitimate" or "suspicious"), the primary status is driven by the
// effective_caution_level using caution-flavoured wording (High/Some/No Caution),
// which can still escalate above what the classifier alone would suggest, but never
// puts scam-specific language on a non-scam classification.
//
// Verified against the three required cases:
//   A: legitimate + high caution -> "High Caution"          (CAUTION_LEVELS.high)
//   B: scam       + high caution -> "Likely a Scam"          (VERDICTS.scam)
//   C: legitimate + none caution -> "No Strong Scam Signs Found" (CAUTION_LEVELS.none)
export function getPrimaryStatus(classifierLabel, cautionLevel) {
  if (classifierLabel === 'scam') return VERDICTS.scam
  return getCautionLevel(cautionLevel)
}
