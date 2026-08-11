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
          <p className="text-sm font-medium text-foreground">{detector.label}</p>
          <p className="text-xs text-muted-foreground">
            {detector.available ? 'Ready to use' : 'Coming soon'}
          </p>
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
