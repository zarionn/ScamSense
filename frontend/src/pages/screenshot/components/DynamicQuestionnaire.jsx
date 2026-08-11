import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from '@/components/ui/questionnaire'
import ErrorMessage from './ErrorMessage'
import { getQuestionSeverity } from '../utils/verdict'
import { cn } from '@/lib/utils'
import {
  answersFromFormData,
  toQuestionnaireItems,
  toQuestionnaireModel,
} from '../utils/questionnaire-adapter'

// Compact rectangular rows, not card-like answer blocks: restrained radius,
// 48px minimum (short labels sit close to 48-52px total), 8px gap comes from
// QuestionnaireChoices' own className below. Unselected rows get an explicit
// light neutral surface (rather than the base component's bg-transparent,
// which would otherwise show the darker questionnaire card straight through)
// so they visibly separate from the card behind them; dark: pairs restore the
// original dark-mode utilities exactly, since --questionnaire-* tokens are
// light-only.
const CHOICE_CLASS = cn(
  'min-h-12 items-center gap-2.5 rounded-md px-3.5 py-2.5 text-base transition-colors',
  // Option text is a neutral data value, not a brand action — text-questionnaire-body
  // (not text-heading) in both selected and unselected states, so the choice never
  // reads as indigo. dark:text-card-foreground restores the exact colour this
  // already resolved to before (Card's default text), since --questionnaire-body
  // is a light-only token but this dark value was never meant to change here.
  'text-questionnaire-body dark:text-card-foreground',
  'border-questionnaire-choice-border bg-questionnaire-choice hover:bg-questionnaire-choice-hover',
  'dark:border-input dark:bg-input/20 dark:hover:bg-muted/50',
  'data-checked:border-primary data-checked:bg-questionnaire-choice-selected',
  'dark:data-checked:bg-muted'
)

// Same rationale for every question — the backend doesn't supply per-question "why
// this matters" copy, so this is fixed UI text, not a fabricated safety claim. The
// specific per-question reason (from the visual auditor's evidence) is rendered
// separately, right beneath it.
const WHY_IT_MATTERS = 'This helps ScamSense recommend the appropriate next steps.'

export default function DynamicQuestionnaire({ exposureQuestions, onSubmit, isSubmitting, errorMessage }) {
  const model = useMemo(() => toQuestionnaireModel(exposureQuestions), [exposureQuestions])
  const [items] = useState(() => toQuestionnaireItems(model))
  const hasMultipleQuestions = model.length > 1

  const handleSubmit = (event) => {
    event.preventDefault()
    if (isSubmitting) return
    const formData = new FormData(event.currentTarget)
    onSubmit(answersFromFormData(formData, model))
  }

  return (
    <Card
      className={cn(
        'mx-auto max-w-[760px] border [--card-spacing:--spacing(6)]',
        'border-questionnaire-border-strong bg-questionnaire-card dark:border-border dark:bg-card'
      )}
    >
      <CardContent>
        <Questionnaire
          className="mx-auto w-full gap-2.5"
          defaultItem={model[0]?.name}
          items={items}
          onSubmit={handleSubmit}
        >
          <QuestionnaireProgress className="text-sm text-questionnaire-muted dark:text-muted-foreground" />

          {model.map((question) => (
            <QuestionnaireItem
              key={question.id}
              name={question.name}
              required={question.required}
              className="gap-2.5"
            >
              <QuestionnaireTitle className="mb-0 text-lg leading-snug text-heading">
                {question.prompt}
              </QuestionnaireTitle>
              <QuestionnaireDescription className="text-questionnaire-body dark:text-muted-foreground">
                {WHY_IT_MATTERS}
              </QuestionnaireDescription>

              {question.description && (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-questionnaire-body dark:text-muted-foreground">
                    {question.description}
                  </p>
                  {question.severity && (
                    <Badge
                      variant="outline"
                      className={getQuestionSeverity(question.severity).badgeClass}
                    >
                      {getQuestionSeverity(question.severity).label}
                    </Badge>
                  )}
                </div>
              )}
              {!question.description && question.severity && (
                <Badge
                  variant="outline"
                  className={cn('w-fit', getQuestionSeverity(question.severity).badgeClass)}
                >
                  {getQuestionSeverity(question.severity).label}
                </Badge>
              )}

              {question.type === 'text' ? (
                <QuestionnaireInput
                  aria-label={question.prompt}
                  placeholder={question.input?.placeholder}
                />
              ) : (
                <QuestionnaireChoices className="gap-2">
                  {question.options.map((option) => (
                    <QuestionnaireChoice key={option.value} value={option.value} className={CHOICE_CLASS}>
                      {option.label}
                    </QuestionnaireChoice>
                  ))}
                </QuestionnaireChoices>
              )}
              <QuestionnaireError />
            </QuestionnaireItem>
          ))}

          {errorMessage && <ErrorMessage message={errorMessage} />}

          <QuestionnaireActions>
            {hasMultipleQuestions && <QuestionnairePrevious />}
            {hasMultipleQuestions && <QuestionnaireSkip />}
            {hasMultipleQuestions && <QuestionnaireNext />}
            {/* Loading stays full-strength bg-primary/text-primary-foreground — the
                base Button's disabled:opacity-50 would otherwise fade an
                in-progress submit into looking unavailable rather than busy. */}
            <QuestionnaireSubmit
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="disabled:cursor-not-allowed disabled:opacity-100"
            >
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
              {isSubmitting ? 'Preparing your guidance…' : 'Submit'}
            </QuestionnaireSubmit>
          </QuestionnaireActions>
        </Questionnaire>
      </CardContent>
    </Card>
  )
}
