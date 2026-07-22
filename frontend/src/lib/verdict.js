import { ShieldAlert, ShieldQuestion, ShieldCheck } from 'lucide-react'

// Keyed by effective_caution_level from the API. This drives the risk banner's
// color/severity — it can be more severe than the raw classifier label (e.g. a
// "legitimate" label with a high caution escalation must still show as high risk.
export const CAUTION_LEVELS = {
  high: {
    label: 'High caution',
    description: 'Independent review found strong warning signs. Treat this with care.',
    icon: ShieldAlert,
    panelClass: 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40',
    iconClass: 'text-red-600 dark:text-red-400',
    textClass: 'text-red-900 dark:text-red-100',
  },
  medium: {
    label: 'Some caution advised',
    description: 'A few concerning signs were found. Verify before acting on this.',
    icon: ShieldQuestion,
    panelClass: 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
    iconClass: 'text-amber-600 dark:text-amber-400',
    textClass: 'text-amber-900 dark:text-amber-100',
  },
  none: {
    label: 'No additional caution',
    description: 'No extra warning signs were found beyond the classifier result below.',
    icon: ShieldCheck,
    panelClass: 'border-green-300 bg-green-50 dark:border-green-900 dark:bg-green-950/40',
    iconClass: 'text-green-600 dark:text-green-400',
    textClass: 'text-green-900 dark:text-green-100',
  },
}

export function getCautionLevel(level) {
  return CAUTION_LEVELS[level] ?? CAUTION_LEVELS.none
}

// Keyed by exposure question severity from the API (critical/high/moderate).
export const QUESTION_SEVERITY = {
  critical: {
    label: 'Critical',
    dotClass: 'bg-red-600 dark:bg-red-400',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  },
  high: {
    label: 'High',
    dotClass: 'bg-amber-600 dark:bg-amber-400',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  },
  moderate: {
    label: 'Moderate',
    dotClass: 'bg-neutral-500 dark:bg-neutral-400',
    badgeClass: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200',
  },
}

export function getQuestionSeverity(severity) {
  return QUESTION_SEVERITY[severity] ?? QUESTION_SEVERITY.moderate
}

export const VERDICTS = {
  scam: {
    label: 'Likely a scam',
    description: 'This screenshot shows strong signs of a scam. Do not follow its instructions.',
    icon: ShieldAlert,
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
    panelClass:
      'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40',
    iconClass: 'text-red-600 dark:text-red-400',
    textClass: 'text-red-900 dark:text-red-100',
  },
  suspicious: {
    label: 'Uncertain — check carefully',
    description:
      "We could not confidently tell if this is safe or a scam. Treat it with caution and verify before acting.",
    icon: ShieldQuestion,
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    panelClass:
      'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
    iconClass: 'text-amber-600 dark:text-amber-400',
    textClass: 'text-amber-900 dark:text-amber-100',
  },
  legitimate: {
    label: 'Looks legitimate',
    description: 'This screenshot does not show the signs of a scam that we look for.',
    icon: ShieldCheck,
    badgeClass: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
    panelClass:
      'border-green-300 bg-green-50 dark:border-green-900 dark:bg-green-950/40',
    iconClass: 'text-green-600 dark:text-green-400',
    textClass: 'text-green-900 dark:text-green-100',
  },
}

export function getVerdict(label) {
  return VERDICTS[label] ?? VERDICTS.suspicious
}
