import { ClipboardCheck, Eye, Globe, MessageCircleQuestion, ScanSearch, ShieldCheck, Sparkles } from 'lucide-react'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import { Spinner } from '@/components/ui/spinner'

// `stage` reflects the one real network request currently in flight:
// - "analysing" -> POST /api/analyse (classifier + visual auditor run together,
//   server-side, in one request — the frontend cannot observe their individual
//   completion, so they are listed as informational content, not live sub-stages).
// - "preparing" -> POST /api/respond (recommendations + explanation, also one request).
const STAGE_COPY = {
  analysing: {
    active: 'Analysing screenshot…',
    items: [
      { label: 'Screenshot classification', icon: ScanSearch },
      { label: 'Visual warning-sign review', icon: Eye },
      { label: 'Domain inspection', icon: Globe },
      { label: 'Follow-up question preparation', icon: MessageCircleQuestion },
    ],
  },
  preparing: {
    active: 'Preparing safety recommendations…',
    items: [
      { label: 'Reviewing your answers', icon: ClipboardCheck },
      { label: 'Selecting relevant safety actions', icon: ShieldCheck },
      { label: 'Generating explanation', icon: Sparkles },
    ],
  },
}

export default function AnalysisStatusList({ stage }) {
  const copy = STAGE_COPY[stage] ?? STAGE_COPY.analysing

  return (
    <div className="space-y-2.5">
      <Marker>
        <MarkerIcon>
          <Spinner className="text-primary" />
        </MarkerIcon>
        <MarkerContent>
          <span role="status" aria-live="polite" className="font-medium text-foreground">
            {copy.active}
          </span>
        </MarkerContent>
      </Marker>

      <Marker variant="separator">
        <MarkerContent className="text-xs font-medium tracking-wide uppercase">
          This analysis includes
        </MarkerContent>
      </Marker>

      <div className="space-y-1">
        {copy.items.map((item) => {
          const ItemIcon = item.icon
          return (
            <Marker key={item.label} className="text-foreground">
              <MarkerIcon>
                <ItemIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              </MarkerIcon>
              <MarkerContent>{item.label}</MarkerContent>
            </Marker>
          )
        })}
      </div>

      <p className="pt-1 text-center text-xs text-muted-foreground">
        This may take a few seconds while ScamSense performs its classifier and visual
        safety checks.
      </p>
    </div>
  )
}
