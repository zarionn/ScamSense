import { ScanSearch, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import EvidenceCard from './EvidenceCard'

export default function WarningSignsSection({ observations, auditStatus }) {
  const assessmentUnavailable = auditStatus === 'unavailable' || auditStatus === 'malformed'
  const EmptyStateIcon = assessmentUnavailable ? ShieldAlert : ShieldCheck
  const emptyStateMessage = assessmentUnavailable
    ? 'No visual warning-sign assessment is available because the independent visual review could not be completed.'
    : 'No specific visual warning signs were flagged in this screenshot.'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanSearch className="size-4 text-primary" aria-hidden="true" />
          What the Visual Review Found
        </CardTitle>
      </CardHeader>
      <CardContent>
        {observations.length === 0 ? (
          <div
            className={`flex items-start gap-2.5 rounded-lg border p-3.5 text-sm text-foreground ${
              assessmentUnavailable
                ? 'border-warning-border bg-warning-soft'
                : 'border-success/20 bg-success-soft'
            }`}
          >
            <EmptyStateIcon
              className={`mt-0.5 size-4 shrink-0 ${
                assessmentUnavailable ? 'text-warning-strong' : 'text-success'
              }`}
              aria-hidden="true"
            />
            <p>{emptyStateMessage}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {observations.map((observation, index) => {
              // A trailing item left alone in an odd-count grid spans both columns
              // instead of sitting half-empty next to a blank cell.
              const isTrailingOdd =
                observations.length % 2 !== 0 && index === observations.length - 1
              return (
                <EvidenceCard
                  key={`${observation.signal_type}-${index}`}
                  observation={observation}
                  className={isTrailingOdd ? 'sm:col-span-2' : undefined}
                />
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
