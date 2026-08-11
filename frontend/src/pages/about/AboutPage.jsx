import {
  Link2,
  MessageSquareWarning,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Receipt,
  Upload,
  ListChecks,
  Compass,
  Lock,
} from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const FEATURES = [
  {
    key: 'screenshot',
    label: 'Screenshot Scan',
    icon: ScanSearch,
    status: 'ready',
    description:
      'Upload a screenshot of a suspicious message, page or listing. ScamSense analyses it for visual warning signs and gives you clear next steps.',
  },
  {
    key: 'assistant',
    label: 'ScamSense Assistant',
    icon: Sparkles,
    status: 'ready',
    description:
      'A guided conversational helper. Answer a few quick questions and it points you to the detector that fits what you\'re dealing with.',
  },
  {
    key: 'message',
    label: 'Message Scan',
    icon: MessageSquareWarning,
    status: 'soon',
    description: 'Designed for analysing suspicious text messages and chats for scam indicators.',
  },
  {
    key: 'url',
    label: 'URL Scan',
    icon: Link2,
    status: 'soon',
    description: 'Designed for checking suspicious links and websites before you interact with them.',
  },
  {
    key: 'transaction',
    label: 'Transaction Scan',
    icon: Receipt,
    status: 'soon',
    description: 'Designed for reviewing unusual payment or transaction requests for warning signs.',
  },
]

const STEPS = [
  {
    icon: Upload,
    title: 'Share something suspicious',
    description: 'Upload a screenshot, or tell the Assistant what happened.',
  },
  {
    icon: Compass,
    title: 'Pick the right check',
    description: 'ScamSense points you to the detector that matches your situation.',
  },
  {
    icon: ListChecks,
    title: 'Review the findings',
    description: 'See the specific warning signs and context behind the result.',
  },
  {
    icon: ShieldCheck,
    title: 'Follow safer next steps',
    description: 'Get clear, practical guidance for what to do next.',
  },
]

function StatusBadge({ status }) {
  if (status === 'ready') {
    return <Badge className="bg-success-soft text-success">Ready to use</Badge>
  }
  return <Badge className="bg-muted text-muted-foreground">Coming soon</Badge>
}

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-[900px] space-y-4">
      <PageHeader title="About ScamSense" />

      {/* Hero */}
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col items-start gap-4 py-2 sm:flex-row sm:items-center">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-heading text-xl font-semibold text-page-title">
              Making sense of suspicious digital interactions
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              ScamSense helps you make sense of suspicious digital interactions by combining
              focused scam-detection tools with clear, practical guidance — so you can decide
              what to do next with more confidence.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* What ScamSense does */}
      <Card>
        <CardHeader>
          <CardTitle>What ScamSense Does</CardTitle>
          <CardDescription>
            ScamSense is built as a set of focused detectors, plus a guided Assistant to help
            you find the right one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.key}
                  className="flex items-start gap-3 rounded-lg bg-muted/40 p-3.5"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{feature.label}</p>
                      <StatusBadge status={feature.status} />
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => {
              const Icon = step.icon
              return (
                <div key={step.title} className="space-y-2 rounded-lg border border-border p-3.5">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                      <Icon className="size-4" aria-hidden="true" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      Step {index + 1}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Assistant role */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            The ScamSense Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm leading-relaxed text-foreground">
            The Assistant is a guided conversational helper. It asks a few simple questions
            about what happened, helps you work out which detector fits your situation, and can
            answer general scam-awareness questions in plain language.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            It does not replace a specialised detector's analysis, and it never invents scan
            results, confidence scores, or warning signs on its own — those only ever come from
            the detector you actually run, such as Screenshot Scan.
          </p>
        </CardContent>
      </Card>

      {/* Safety / limitations */}
      <Card className="border-warning-border bg-warning-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-warning-strong">
            <ShieldAlert className="size-4" aria-hidden="true" />
            ScamSense Is a Decision-Support Tool
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm leading-relaxed text-foreground">
            Automated analysis can be imperfect, and some situations need a closer look. Use
            ScamSense's findings as one input alongside your own judgement, not as an absolute
            guarantee.
          </p>
          <p className="text-sm leading-relaxed text-foreground">
            If you're dealing with an urgent account or financial issue, contact the relevant
            organisation directly through a number or channel you find yourself — not one taken
            from the suspicious message.
          </p>
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-4 text-primary" aria-hidden="true" />
            Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Screenshots are only sent to ScamSense's server when you explicitly press{' '}
            <span className="font-medium text-foreground">Analyse Screenshot</span> — until then,
            they stay in your browser.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Assistant conversations exist only in your browser for the current session and
            aren't stored by ScamSense. Free-text messages you send the Assistant are sent to
            Google's Gemini API to generate a reply.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your theme and interface preferences are saved locally in your browser so they carry
            over between visits. No account or personal profile is created.
          </p>
        </CardContent>
      </Card>

      <Separator />
      <p className="pb-2 text-center text-xs text-muted-foreground">
        ScamSense uses AI to help identify possible scam indicators, but results may not be
        100% accurate. When in doubt, verify through official sources.
      </p>
    </div>
  )
}
