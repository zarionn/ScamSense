import { Link2, Lock, MessageSquareWarning, Receipt, ScanSearch } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DETECTORS } from '../assistant-flow'

const DETECTOR_ICON = {
  message: MessageSquareWarning,
  url: Link2,
  transaction: Receipt,
  screenshot: ScanSearch,
}

export default function DetectorSuggestionCard({ detectorKey, onOpen }) {
  const detector = DETECTORS[detectorKey]
  if (!detector) return null

  const Icon = DETECTOR_ICON[detectorKey]

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {detector.label}
        </p>

        <p className="text-xs text-muted-foreground">
          {detector.available ? 'Ready to use' : 'Coming soon'}
        </p>

        {detectorKey === 'screenshot' && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Check a screenshot for suspicious content and scam indicators.
          </p>
        )}

        {detectorKey === 'message' && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Analyze an SMS, WhatsApp or email message for scam indicators.
          </p>
        )}

        {detectorKey === 'url' && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Check a website or URL for possible phishing and scam risks.
          </p>
        )}

        {detectorKey === 'transaction' && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Review a payment request or transaction for potential scam risks.
          </p>
        )}
      </div>
        {detector.available ? (
          <Button type="button" size="sm" onClick={() => onOpen?.(detector.key)}>
            Open
          </Button>
        ) : (
          <Lock className="size-3.5 shrink-0 text-disabled-foreground" aria-hidden="true" />
        )}
      </CardContent>
    </Card>
  )
}
