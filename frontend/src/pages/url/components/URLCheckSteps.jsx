import { toneForKey } from '../utils/verdict-styles'

// One card per layer of the finished result. Each step's tone comes from the
// backend's own facts via utils/result-presentation.js — a card never picks a
// tone of its own.
export default function URLCheckSteps({ steps }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {steps.map((step, index) => {
        const tone = toneForKey(step.toneKey)
        const StepIcon = tone.stepIcon

        return (
          <li key={step.title} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Check {String(index + 1).padStart(2, '0')}
              </span>
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full border ${tone.bg} ${tone.border} ${tone.text}`}
              >
                <StepIcon className="size-3.5" aria-hidden="true" />
              </span>
            </div>

            <p className="mt-3 font-medium text-heading">{step.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
          </li>
        )
      })}
    </ol>
  )
}
