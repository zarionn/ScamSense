import { Badge } from '@/components/ui/badge'
import { getSignalMeta, EVIDENCE_QUALITY_LABEL } from '../utils/observations'
import { cn } from '@/lib/utils'

const QUALITY_BADGE_CLASS = {
  clear: 'bg-destructive-soft text-destructive',
  partial: 'bg-warning-soft text-warning-strong',
  weak: 'bg-muted text-muted-foreground',
}

export default function EvidenceCard({ observation, className }) {
  const meta = getSignalMeta(observation.signal_type)
  const Icon = meta.icon

  return (
    <div className={cn('rounded-lg bg-muted/40 p-3.5', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">{meta.title}</p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'shrink-0',
            QUALITY_BADGE_CLASS[observation.evidence_quality] ?? QUALITY_BADGE_CLASS.weak
          )}
        >
          {EVIDENCE_QUALITY_LABEL[observation.evidence_quality] ?? 'Evidence'}
        </Badge>
      </div>
      <p className="mt-1.5 pl-6 text-sm leading-relaxed text-muted-foreground">
        {observation.evidence}
      </p>
    </div>
  )
}
