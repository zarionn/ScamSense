import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import VerdictPanel from '@/components/VerdictPanel'

export default function ResultView({
  previewUrl,
  classifier,
  effectiveCautionLevel,
  responseMessage,
  onReset,
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 sm:flex-row">
        <img
          src={previewUrl}
          alt="Screenshot you submitted for analysis"
          className="h-40 w-full rounded-lg border border-border object-contain sm:h-auto sm:w-48"
        />
        <div className="flex-1">
          <VerdictPanel
            cautionLevel={effectiveCautionLevel}
            classifierLabel={classifier.label}
            confidencePct={classifier.confidence_pct}
          />
        </div>
      </div>

      <Card>
        <CardContent>
          <section aria-labelledby="response-heading">
            <h2 id="response-heading" className="mb-2 text-lg font-semibold text-foreground">
              What this means and what to do
            </h2>
            {/* response_message is guard-verified by the backend to contain every mandatory
                safety action — render it verbatim, do not parse or restructure it. */}
            <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
              {responseMessage}
            </p>
          </section>
        </CardContent>
      </Card>

      <Button onClick={onReset} variant="outline" size="lg" className="w-full">
        Check another screenshot
      </Button>
    </div>
  )
}
