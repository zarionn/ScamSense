import { Link2, MessageSquareWarning, Receipt, ScanSearch } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toneForKey } from '@/pages/url/utils/verdict-styles'
import { DETECTORS } from '../assistant-flow'

const DETECTOR_ICON = {
  message: MessageSquareWarning,
  url: Link2,
  transaction: Receipt,
  screenshot: ScanSearch,
}

// Short summary of one authoritative detector result. Every string comes from
// the adapters in detector-routing.js — this component adds no wording of its
// own and never restates a verdict. The full detector page stays the detailed
// view.
export default function DetectorResultCard({ result, onOpen }) {
  const detector = DETECTORS[result.detectorKey]
  if (!detector) return null

  const Icon = DETECTOR_ICON[result.detectorKey]
  const { presentation } = result
  const tone = toneForKey(presentation.tone)

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tone.bg} ${tone.text}`}
          >
            {Icon && <Icon className="size-4" aria-hidden="true" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{presentation.title}</p>
            <p className={`text-sm font-medium ${tone.text}`}>{presentation.status}</p>
          </div>
        </div>

        {presentation.summary && (
          <p className="text-xs leading-relaxed text-muted-foreground">{presentation.summary}</p>
        )}

        {presentation.detail && (
          <p className="text-xs leading-relaxed text-foreground">{presentation.detail}</p>
        )}

        {presentation.followUp && (
          <p className="text-xs leading-relaxed text-muted-foreground">{presentation.followUp}</p>
        )}

        <Button
          type="button"
          size="sm"
          variant={result.error ? 'outline' : 'default'}
          className="self-start"
          onClick={() => onOpen?.(result)}
        >
          {result.error ? `Open ${detector.label}` : 'View full results'}
        </Button>
      </CardContent>
    </Card>
  )
}
