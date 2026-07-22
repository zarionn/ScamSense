import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import ErrorMessage from '@/components/ErrorMessage'
import { getQuestionSeverity } from '@/lib/verdict'
import { cn } from '@/lib/utils'

const SEVERITY_ORDER = { critical: 0, high: 1, moderate: 2 }
const OPTION_LABELS = { yes: 'Yes', no: 'No', unsure: 'Not sure' }

export default function ExposureQuestions({ questions, onSubmit, isSubmitting, errorMessage }) {
  const orderedQuestions = useMemo(
    () =>
      [...questions].sort(
        (a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
      ),
    [questions]
  )
  const [answers, setAnswers] = useState({})

  const allAnswered = orderedQuestions.every((q) => answers[q.dimension])

  const handleChange = (dimension, value) => {
    setAnswers((prev) => ({ ...prev, [dimension]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!allAnswered || isSubmitting) return
    onSubmit(answers)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">A few quick questions</h2>
        <p className="text-sm text-muted-foreground">
          This screenshot looks risky. Answer honestly so we can give you the right next steps.
        </p>
      </div>

      <div className="space-y-3">
        {orderedQuestions.map((question) => {
          const severity = getQuestionSeverity(question.severity)
          const options = question.answer_options ?? ['yes', 'no', 'unsure']

          return (
            <Card key={question.dimension}>
              <CardContent>
                <fieldset>
                  <div className="flex flex-wrap items-start gap-2">
                    <span
                      className={cn('mt-1.5 inline-block size-2.5 shrink-0 rounded-full', severity.dotClass)}
                      aria-hidden="true"
                    />
                    <legend className="flex-1 text-base font-medium text-foreground">
                      {question.question}
                    </legend>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        severity.badgeClass
                      )}
                    >
                      {severity.label}
                    </span>
                  </div>

                  <div
                    className="mt-3 flex flex-wrap gap-2 pl-[1.125rem]"
                    role="radiogroup"
                    aria-label={question.question}
                  >
                    {options.map((value) => {
                      const inputId = `${question.dimension}-${value}`
                      const checked = answers[question.dimension] === value

                      return (
                        <label
                          key={value}
                          htmlFor={inputId}
                          className={cn(
                            'cursor-pointer rounded-lg border border-border bg-background px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors',
                            'has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                            'has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground',
                            !checked && 'hover:bg-muted'
                          )}
                        >
                          <input
                            id={inputId}
                            type="radio"
                            name={question.dimension}
                            value={value}
                            checked={checked}
                            onChange={() => handleChange(question.dimension, value)}
                            className="sr-only"
                          />
                          {OPTION_LABELS[value] ?? value}
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {errorMessage && <ErrorMessage message={errorMessage} />}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!allAnswered || isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        {isSubmitting ? 'Preparing your guidance…' : 'Continue'}
      </Button>
    </form>
  )
}
