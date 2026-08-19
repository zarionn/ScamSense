import { Globe } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const RELATIONSHIP_LABEL = {
  match: 'Visual review suggests a possible match',
  mismatch: 'Visual review suggests a possible mismatch',
  cannot_determine: 'Cannot be determined',
}

const RELATIONSHIP_BADGE_CLASS = {
  match: 'bg-success-soft text-success',
  mismatch: 'bg-destructive-soft text-destructive',
  cannot_determine: 'bg-muted text-muted-foreground',
}

const READABILITY_LABEL = {
  clear: 'Clearly readable',
  partial: 'Partially readable',
  unreadable: 'Unreadable',
}

function Field({ label, children }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  )
}

export default function DomainAnalysisCard({ domainAnalysis }) {
  if (!domainAnalysis?.domain_visible) return null

  const {
    visible_domain: visibleDomain,
    claimed_entity: claimedEntity,
    domain_relationship: relationship,
    domain_readability: readability,
  } = domainAnalysis

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="size-4 text-primary" aria-hidden="true" />
          Domain Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Visible domain">{visibleDomain || 'Not clearly readable'}</Field>
          {claimedEntity && <Field label="Claimed organisation">{claimedEntity}</Field>}
          <Field label="Domain relationship">
            <Badge
              variant="outline"
              className={RELATIONSHIP_BADGE_CLASS[relationship] ?? RELATIONSHIP_BADGE_CLASS.cannot_determine}
            >
              {RELATIONSHIP_LABEL[relationship] ?? 'Cannot be determined'}
            </Badge>
          </Field>
          <Field label="Readability">{READABILITY_LABEL[readability] ?? 'Unreadable'}</Field>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          This is a visual-review assessment only. Domain ownership was not independently verified.
        </p>
      </CardContent>
    </Card>
  )
}
