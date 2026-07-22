import { getCautionLevel, getVerdict } from '@/lib/verdict'

export default function VerdictPanel({ cautionLevel, classifierLabel, confidencePct }) {
  const caution = getCautionLevel(cautionLevel)
  const verdict = getVerdict(classifierLabel)
  const Icon = caution.icon
  const roundedConfidence = Math.round(confidencePct * 10) / 10

  return (
    <div
      className={`flex items-center gap-4 rounded-xl border-2 p-5 ${caution.panelClass}`}
      role="status"
    >
      <Icon className={`size-10 shrink-0 ${caution.iconClass}`} aria-hidden="true" />
      <div>
        <p className={`text-xl font-semibold ${caution.textClass}`}>{caution.label}</p>
        <p className={`mt-0.5 text-sm ${caution.textClass} opacity-90`}>
          {caution.description}
        </p>
        <p className={`mt-2 text-sm font-medium ${caution.textClass} opacity-80`}>
          Official classifier: {verdict.label} ({roundedConfidence}% confidence)
        </p>
      </div>
    </div>
  )
}
