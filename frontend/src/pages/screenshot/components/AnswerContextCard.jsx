import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const ANSWER_LABEL = { yes: 'Yes', no: 'No', unsure: 'Not sure' }
const ANSWER_BADGE_CLASS = {
  yes: 'bg-destructive-soft text-destructive',
  unsure: 'bg-warning-soft text-warning-strong',
  no: 'bg-success-soft text-success',
}

export default function AnswerContextCard({
  exposureQuestions,
  answers,
  confirmedExposures,
  uncertainExposures,
  defaultedExposures,
}) {
  const relevantDimensions = new Set([...confirmedExposures, ...uncertainExposures])
  const relevantQuestions = exposureQuestions.filter((q) => relevantDimensions.has(q.dimension))

  const hasDefaultedGuidance = defaultedExposures.includes('general_contact')

  if (relevantQuestions.length === 0 && !hasDefaultedGuidance) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Based on Your Answers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {relevantQuestions.map((question) => {
          const answer = answers?.[question.dimension]
          return (
            <div
              key={question.dimension}
              className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2.5"
            >
              <p className="text-sm text-foreground">{question.question}</p>
              <Badge
                variant="outline"
                className={ANSWER_BADGE_CLASS[answer] ?? 'bg-muted text-muted-foreground'}
              >
                {ANSWER_LABEL[answer] ?? 'Unanswered'}
              </Badge>
            </div>
          )
        })}

        {hasDefaultedGuidance && (
          <p className="text-sm text-muted-foreground">
            You did not confirm interacting with this content, but preventive guidance is
            still included below because the screenshot remains risky.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
