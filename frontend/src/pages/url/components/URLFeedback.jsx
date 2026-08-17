import { useId, useState } from 'react'
import { Check, Flag, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Spinner } from '@/components/ui/spinner'
import LoginDialog from '@/components/account/LoginDialog'
import { useAuth } from '@/providers/auth-provider'
import { COMMENT_MAX_LENGTH, submitURLFeedback } from '@/services/url-feedback-service'

// The secondary "this result looks wrong" action for the URL result card.
// Capture only: it does not rescan, change the verdict or retrain anything, so
// the wording stays "saved for future review" and never claims "reviewed".

// The detector's own verdict wording (see final_verdict() in url_service.py), so
// the user picks between the same three outcomes the card can show.
const EXPECTED_OPTIONS = [
  { value: 'safe', label: 'Looks safe' },
  { value: 'warning', label: 'Be careful' },
  { value: 'danger', label: 'Likely a scam' },
]

const SUBMIT_FAILED_MESSAGE = "We couldn't save your feedback. Please try again."

// Mirrors the token classes on components/ui/input.jsx. No Textarea component is
// installed, and one multi-line field is not reason enough to add one.
const TEXTAREA_CLASS =
  'w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 ' +
  'text-sm transition-colors outline-none placeholder:text-muted-foreground ' +
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30'

export default function URLFeedback({ result, finalLevel }) {
  const { user, loading } = useAuth()
  const fieldId = useId()
  // idle -> form -> done, plus guest for a confirmed signed-out visitor.
  const [mode, setMode] = useState('idle')
  const [correctedLevel, setCorrectedLevel] = useState('')
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const groupLabelId = `${fieldId}-expected`
  const commentId = `${fieldId}-comment`
  const sameLevelId = `${fieldId}-same-level`

  const matchesCurrentResult = correctedLevel !== '' && correctedLevel === finalLevel
  const canSubmit = correctedLevel !== '' && !matchesCurrentResult && !isSubmitting

  function handleOpen() {
    // loading means "we don't know yet", which is not the same as "guest" — an
    // unresolved session must never produce the login-required message.
    if (loading) return
    setErrorMessage('')
    setMode(user ? 'form' : 'guest')
  }

  function handleCancel() {
    setMode('idle')
    setCorrectedLevel('')
    setComment('')
    setErrorMessage('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    // Second guard behind the disabled button: a keyboard submit or double click
    // cannot start a second insert while one is in flight.
    if (!canSubmit) return

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      await submitURLFeedback({ user, result, correctedLevel, comment })
      setMode('done')
    } catch (error) {
      // Selections are left in place so the user can retry without retyping.
      setErrorMessage(
        error instanceof Error && error.message ? error.message : SUBMIT_FAILED_MESSAGE,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (mode === 'done') {
    // Terminal for this result: no way back to the form, which is what prevents
    // a second report for the same scan. A new scan remounts this component.
    return (
      <div role="status" className="flex items-start gap-2">
        <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        <div>
          <p className="font-medium text-heading">Feedback submitted</p>
          <p className="text-sm text-muted-foreground">
            Your feedback has been saved for future review.
          </p>
        </div>
      </div>
    )
  }

  if (mode === 'guest') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Please log in to send feedback about this result. You can keep checking links without
          an account.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <LoginDialog
            trigger={
              <Button type="button" size="sm" variant="outline" className="h-8">
                Log in
              </Button>
            }
          />
          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={handleCancel}>
            Not now
          </Button>
        </div>
      </div>
    )
  }

  if (mode === 'idle') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="-ml-2.5 h-8 text-muted-foreground hover:text-foreground"
          onClick={handleOpen}
          disabled={loading}
        >
          <Flag aria-hidden="true" />
          This result looks wrong
        </Button>
        {loading && (
          <span className="text-xs text-muted-foreground">Checking your sign-in…</span>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <p id={groupLabelId} className="text-sm font-medium text-heading">
          What result did you expect?
        </p>
        <RadioGroup
          value={correctedLevel}
          onValueChange={setCorrectedLevel}
          aria-labelledby={groupLabelId}
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        >
          {EXPECTED_OPTIONS.map((option) => {
            const selected = correctedLevel === option.value
            const isCurrent = option.value === finalLevel

            return (
              <Label
                key={option.value}
                htmlFor={`${fieldId}-${option.value}`}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
                  selected
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border bg-background text-foreground hover:bg-muted'
                }`}
              >
                <RadioGroupItem
                  value={option.value}
                  id={`${fieldId}-${option.value}`}
                  disabled={isSubmitting}
                />
                <span className="text-sm font-medium">{option.label}</span>
                {/* Spelled out in words, not signalled by colour alone. */}
                {isCurrent && (
                  <span className="text-xs font-normal text-muted-foreground">
                    (current result)
                  </span>
                )}
              </Label>
            )
          })}
        </RadioGroup>

        {matchesCurrentResult && (
          <p id={sameLevelId} className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            That matches the result we already showed. Pick a different one to tell us what you
            expected.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={commentId} className="text-sm font-medium text-heading">
          Comment (optional)
        </Label>
        <textarea
          id={commentId}
          value={comment}
          onChange={(event) => setComment(event.target.value.slice(0, COMMENT_MAX_LENGTH))}
          maxLength={COMMENT_MAX_LENGTH}
          rows={3}
          disabled={isSubmitting}
          placeholder="Tell us what looked wrong about this result."
          className={TEXTAREA_CLASS}
        />
        <p className="text-xs text-muted-foreground">
          {comment.length}/{COMMENT_MAX_LENGTH} characters
        </p>
      </div>

      {errorMessage && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {errorMessage}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          size="sm"
          className="h-8"
          disabled={!canSubmit}
          aria-describedby={matchesCurrentResult ? sameLevelId : undefined}
        >
          {isSubmitting && <Spinner className="size-3.5" />}
          {isSubmitting ? 'Sending…' : 'Submit feedback'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Reports are saved for future review. They do not change this result and do not retrain
        the detector.
      </p>
    </form>
  )
}
