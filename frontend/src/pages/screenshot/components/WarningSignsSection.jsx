import { ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import EvidenceCard from './EvidenceCard'

export default function WarningSignsSection({ observations }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Why This Screenshot Is Suspicious</CardTitle>
      </CardHeader>
      <CardContent>
        {observations.length === 0 ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-success/20 bg-success-soft p-3.5 text-sm text-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            <p>No specific visual warning signs were flagged in this screenshot.</p>
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
