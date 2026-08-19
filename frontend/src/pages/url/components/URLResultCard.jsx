import { useEffect, useState } from 'react'
import URLCheckSteps from './URLCheckSteps'
import URLTechDetails from './URLTechDetails'
import URLFeedback from './URLFeedback'
import URLShareSummary from './URLShareSummary'
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

const RING_SIZE = 124
const RING_STROKE = 10
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

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="text-3xl font-bold tabular-nums text-foreground-strong">{score}</span>
        <span className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</span>
      </div>
    </div>
  )
}

function InfoCard({ title, accent, children }) {
  return (
    <section className={`${PANEL_CLASS} p-5 ${accent ? `border-l-4 ${accent}` : ''}`}>
      <h2 className="font-medium text-heading">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  )
}

// Identifies one displayed scan. Both parts are needed: two scans can share a
// checked_at, and the same URL can be scanned repeatedly.
function scanKeyFor(result) {
  return `${result.url}|${result.checked_at}`
}

export default function URLResultCard({ result }) {
  // Every user-facing decision below comes from the backend's fused verdict
  // via this one call — the card never re-derives a verdict of its own, and
  // never shows the AI analyst's advice as the action to take.
  const presentation = buildResultPresentation(result)
  const levelTone = toneForKey(presentation.level)
  const VerdictIcon = levelTone.stepIcon

  return (
    <div className="space-y-4">
      <article className={PANEL_CLASS}>
        <div
          className={`flex flex-col items-center gap-5 p-5 text-center sm:flex-row sm:gap-6 sm:text-left ${levelTone.bg}`}
        >
          <div className="shrink-0 sm:border-r sm:border-border sm:pr-6">
            <ScoreRing
              score={presentation.score}
              tone={levelTone}
              label={presentation.scoreLabel}
              ariaLabel={presentation.scoreAriaLabel}
            />
          </div>

          <div className="min-w-0">
            <h2
              className={`flex items-center justify-center gap-2 text-2xl font-bold sm:justify-start ${levelTone.text}`}
            >
              <VerdictIcon className="size-6 shrink-0" aria-hidden="true" />
              {presentation.headline}
            </h2>
            <p className="mt-1.5 leading-relaxed text-foreground">{presentation.summary}</p>

            <div className="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {/* Plain text, never a link: nothing on this page may navigate to
                  a scanned address. */}
              <span className="max-w-full rounded-md border border-border bg-background/60 px-2 py-1 font-mono text-xs break-all text-foreground">
                {result.url}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatCheckedAt(result.checked_at)}
              </span>
            </div>
          </div>
        </div>
      </article>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium text-heading">How we checked this link</h2>
          <URLShareSummary key={scanKeyFor(result)} result={result} />
        </div>
        <URLCheckSteps steps={presentation.steps} />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard title="What our AI analyst found">
          <p className="leading-relaxed text-foreground">{presentation.analystNote.text}</p>
        </InfoCard>

        <InfoCard title="What should I do?" accent={levelTone.accent}>
          <p className="leading-relaxed font-medium text-foreground-strong">
            {presentation.recommendedAction}
          </p>
        </InfoCard>
      </div>

      <div className={PANEL_CLASS}>
        <div className="px-5">
          <URLTechDetails result={result} opinionLabel={presentation.analystOpinionLabel} />
        </div>

        {/* Keyed on the scanned result so a new scan mounts a fresh copy, clearing
            the previous form, error and success state. */}
        <div className="border-t border-border px-5 py-2">
          <URLFeedback
            key={scanKeyFor(result)}
            result={result}
            finalLevel={presentation.level}
          />
        </div>
      </div>
    </div>
  )
}
