import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import URLTechDetails from './URLTechDetails'
import { toneForKey } from '../utils/verdict-styles'
import { buildResultPresentation } from '../utils/result-presentation'

export const PANEL_CLASS = 'overflow-hidden rounded-xl border border-border bg-card text-card-foreground'

function formatCheckedAt(isoString) {
  const checkedAt = new Date(isoString)
  if (Number.isNaN(checkedAt.getTime())) return ''

  if ((Date.now() - checkedAt.getTime()) / 1000 < 60) return 'Checked just now'

  return `Checked ${checkedAt.toLocaleString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`
}

const RING_SIZE = 140
const RING_STROKE = 12
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

function ScoreRing({ score, tone, label, ariaLabel }) {
  const [filledScore, setFilledScore] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setFilledScore(score), 50)
    return () => clearTimeout(timer)
  }, [score])

  return (
    <div
      className="relative shrink-0"
      style={{ width: RING_SIZE, height: RING_SIZE }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90" aria-hidden="true">
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={RING_STROKE}
          className="stroke-border"
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          className={`${tone.ring} transition-[stroke-dashoffset] duration-[600ms] ease-out`}
          style={{
            strokeDasharray: RING_LENGTH,
            strokeDashoffset: RING_LENGTH * (1 - filledScore / 100),
          }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tabular-nums text-foreground-strong">{score}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

export function PipelineTimeline({ steps }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        const tone = toneForKey(step.toneKey)
        const StepIcon = step.spinner ? Loader2 : tone.stepIcon

        return (
          <li key={step.title} className={`flex gap-3 ${step.dimmed ? 'opacity-40' : ''}`}>
            <div className="flex flex-col items-center">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full border ${tone.bg} ${tone.border} ${tone.text}`}
              >
                <StepIcon
                  className={`size-3.5 ${step.spinner ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
              </span>
              {!isLast && <span className="my-1 w-px flex-1 bg-border" />}
            </div>

            <div className={isLast ? 'flex-1' : 'flex-1 pb-5'}>
              <p className="font-medium text-heading">{step.title}</p>
              <p className="text-sm text-muted-foreground">{step.detail}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Section({ title, accent, children }) {
  return (
    <section className={`border-t border-border p-5 ${accent || ''}`}>
      {title && <h2 className="mb-2 font-medium text-heading">{title}</h2>}
      {children}
    </section>
  )
}

export default function URLResultCard({ result }) {
  // Every user-facing decision below comes from the backend's fused verdict
  // via this one call — the card never re-derives a verdict of its own, and
  // never shows the AI analyst's advice as the action to take.
  const presentation = buildResultPresentation(result)
  const levelTone = toneForKey(presentation.level)

  return (
    <article className={PANEL_CLASS}>
      <div className={`p-5 ${levelTone.bg}`}>
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:gap-6 sm:text-left">
          <ScoreRing
            score={presentation.score}
            tone={levelTone}
            label={presentation.scoreLabel}
            ariaLabel={presentation.scoreAriaLabel}
          />
          <div className="min-w-0">
            <h2 className={`text-2xl font-bold ${levelTone.text}`}>{presentation.headline}</h2>
            <p className="mt-1 text-foreground">{presentation.summary}</p>
            <p className="mt-2 break-all text-sm text-muted-foreground">{result.url}</p>
            <p className="mt-2 text-xs text-muted-foreground">{formatCheckedAt(result.checked_at)}</p>
          </div>
        </div>
      </div>

      <Section title="How we checked this link">
        <PipelineTimeline steps={presentation.steps} />
      </Section>

      <Section title="What our AI analyst found">
        <p className="leading-relaxed text-foreground">{presentation.analystNote.text}</p>
      </Section>

      <Section title="What should I do?" accent={`border-l-4 ${levelTone.accent}`}>
        <p className="font-medium text-foreground-strong">{presentation.recommendedAction}</p>
      </Section>

      <div className="border-t border-border px-5">
        <URLTechDetails result={result} opinionLabel={presentation.analystOpinionLabel} />
      </div>
    </article>
  )
}
