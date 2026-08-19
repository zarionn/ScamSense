import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const URGENCY_GROUPS = [
  { key: 'now', heading: 'Do this now', iconClass: 'text-destructive' },
  { key: 'soon', heading: 'Do this soon', iconClass: 'text-warning' },
  { key: 'advisable', heading: 'Additional precautions', iconClass: 'text-success' },
]

export default function SafetyRecommendationsCard({ actions }) {
  if (!actions || actions.length === 0) return null

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          Safety Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {URGENCY_GROUPS.map((group) => {
          const items = actions.filter((action) => action.urgency === group.key)
          if (items.length === 0) return null

          return (
            <div key={group.key} className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {group.heading}
              </p>
              <ul className="space-y-2">
                {items.map((action, index) => (
                  <li key={`${group.key}-${index}`} className="flex items-start gap-2">
                    <CheckCircle2
                      className={cn('mt-0.5 size-4 shrink-0', group.iconClass)}
                      aria-hidden="true"
                    />
                    <span
                      className={cn(
                        'text-sm leading-relaxed text-foreground',
                        group.key === 'now' && 'font-medium'
                      )}
                    >
                      {action.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
