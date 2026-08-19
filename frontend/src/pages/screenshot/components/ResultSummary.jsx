import { ImageOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import ImagePreviewDialog from '@/components/shared/ImagePreviewDialog'
import { getPrimaryStatus, getVerdict } from '../utils/verdict'
import { cn } from '@/lib/utils'

// Shared by both branches so the summary keeps the same shape whether or not a
// preview exists — a reopened scan must not reflow the card.
const THUMBNAIL_CLASS =
  'h-40 w-full shrink-0 overflow-hidden rounded-lg border border-border sm:h-[168px] sm:w-44'

export default function ResultSummary({ file, previewUrl, classifier, effectiveCautionLevel }) {
  const primary = getPrimaryStatus(classifier.label, effectiveCautionLevel)
  const officialVerdict = getVerdict(classifier.label)
  const Icon = primary.icon
  const roundedConfidence = Math.round(classifier.confidence_pct * 10) / 10

  return (
    // Explicit bg-card-elevated (rather than the Card default of bg-card) keeps this
    // surface tied to the "lift" tier semantically, even though both tokens
    // currently resolve to the same white in this theme.
    <Card className="bg-card-elevated">
      <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center">
        {/* Tile + caption share one column so the caption sits below the tile
            without changing the tile's own dimensions. Rendered in both states,
            which is what keeps the card the same height whether the result is
            live or reopened — no reserved-space placeholder needed. */}
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-44">
          {previewUrl ? (
            <ImagePreviewDialog
              src={previewUrl}
              filename={file.name}
              trigger={
                <button
                  type="button"
                  className={cn(
                    'group relative focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    THUMBNAIL_CLASS
                  )}
                  aria-label={`View a larger preview of ${file.name}`}
                >
                  <img
                    src={previewUrl}
                    alt="Analysed screenshot"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-background/80 px-2 py-1 text-center text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    Click to enlarge
                  </span>
                </button>
              }
            />
          ) : (
            // Saved history keeps the analysis but never the screenshot itself,
            // so there is deliberately nothing to enlarge here. THUMBNAIL_CLASS
            // holds the live tile's exact dimensions so the card does not reflow.
            // Decorative on purpose: the caption below is the accessible text,
            // so labelling the tile too would announce it twice.
            <div
              aria-hidden="true"
              className={cn('flex items-center justify-center bg-muted/40', THUMBNAIL_CLASS)}
            >
              <ImageOff className="size-6 text-muted-foreground" aria-hidden="true" />
            </div>
          )}
          <p className="text-center text-xs leading-snug text-muted-foreground">
            Screenshot not stored for privacy
          </p>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div
            className={cn('flex items-start gap-3 rounded-xl border p-4', primary.panelClass)}
          >
            <Icon className={cn('mt-0.5 size-8 shrink-0', primary.iconClass)} aria-hidden="true" />
            <div>
              <p className={cn('text-xl font-semibold leading-snug', primary.textClass)}>
                {primary.label}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                {primary.description}
              </p>
            </div>
          </div>

          {/* The classifier label is stated once, prominently, as its own value
              line — the confidence row below refers back to "this classification"
              rather than repeating the quoted label a second time.
              text-foreground-strong (not text-heading): this is a data value, not
              a brand action — plum is reserved for headings/buttons/links, so the
              classifier's own output stays a neutral, emphasised dark tone. */}
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground">Official classifier</p>
            <p className="text-base font-semibold text-foreground-strong">{officialVerdict.label}</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Confidence in this classification</span>
              <span className="shrink-0 font-medium text-foreground-strong">{roundedConfidence}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={roundedConfidence}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Classifier confidence in "${officialVerdict.label}"`}
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn('h-full rounded-full', primary.progressClass)}
                style={{ width: `${Math.min(100, Math.max(0, roundedConfidence))}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
