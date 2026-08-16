import { Check, Minus, TriangleAlert, X } from 'lucide-react'

// These use the existing ScamSense theme tokens, including their dark-mode
// values, instead of introducing a URL-page-specific colour system.
export const TONES = {
  safe: {
    text: 'text-success',
    bg: 'bg-success-soft',
    border: 'border-success/30',
    ring: 'stroke-success',
    accent: 'border-l-success',
    stepIcon: Check,
  },
  warning: {
    text: 'text-warning-strong dark:text-warning',
    bg: 'bg-warning-soft',
    border: 'border-warning-border dark:border-warning/30',
    ring: 'stroke-warning',
    accent: 'border-l-warning',
    stepIcon: TriangleAlert,
  },
  danger: {
    text: 'text-destructive',
    bg: 'bg-destructive-soft',
    border: 'border-destructive/30',
    ring: 'stroke-destructive',
    accent: 'border-l-destructive',
    stepIcon: X,
  },
  neutral: {
    text: 'text-muted-foreground',
    bg: 'bg-muted',
    border: 'border-border',
    ring: 'stroke-muted-foreground',
    accent: 'border-l-border',
    stepIcon: Minus,
  },
}

export function toneForLevel(level) {
  return TONES[level] || TONES.warning
}

export function toneForZone(zone) {
  if (zone === 'safe') return TONES.safe
  if (zone === 'uncertain') return TONES.warning
  if (zone === 'phishing') return TONES.danger
  return TONES.neutral
}

export function toneForRisk(riskLevel) {
  if (riskLevel === 'low') return TONES.safe
  if (riskLevel === 'medium') return TONES.warning
  if (riskLevel === 'high') return TONES.danger
  return TONES.neutral
}
