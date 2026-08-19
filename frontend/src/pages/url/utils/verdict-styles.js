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

// Which tone applies is decided in utils/result-presentation.js, which reads
// the backend's fused verdict; this file only turns that decision into
// classes, so a "low" AI opinion can never pick its own colour.
export function toneForKey(toneKey) {
  return TONES[toneKey] || TONES.neutral
}
