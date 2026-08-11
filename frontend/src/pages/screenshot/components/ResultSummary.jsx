import { Card, CardContent } from '@/components/ui/card'
import ImagePreviewDialog from '@/components/shared/ImagePreviewDialog'
import { getPrimaryStatus, getVerdict } from '../utils/verdict'
import { cn } from '@/lib/utils'

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
        <ImagePreviewDialog
          src={previewUrl}
          filename={file.name}
          trigger={
            <button
              type="button"
              className="group relative h-40 w-full shrink-0 overflow-hidden rounded-lg border border-border focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-[168px] sm:w-44"
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
