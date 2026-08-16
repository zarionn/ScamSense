import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { checkURL } from '@/services/url-service'
import URLResultCard, { PANEL_CLASS, PipelineTimeline } from './URLResultCard'
import { TONES } from '../utils/verdict-styles'

const DEMO_URLS = [
  { label: 'Safe link', url: 'https://www.dbs.com.sg' },
  { label: 'Unclear link', url: 'http://bit.ly/verify-account-2024' },
  {
    label: 'Scam link',
    url: 'http://dbs-secure-verify.com/verify-now/account-locked',
  },
]

export default function URLChecker() {
  const [urlInput, setURLInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [litSteps, setLitSteps] = useState(0)

  // The model and AI review can take a few seconds, so reveal the real pipeline
  // progressively while the request is running. These timers never delay it.
  useEffect(() => {
    if (!isLoading) return undefined

    const firstTimer = setTimeout(() => setLitSteps(1), 300)
    const secondTimer = setTimeout(() => setLitSteps(2), 900)
    const thirdTimer = setTimeout(() => setLitSteps(3), 1500)

    return () => {
      clearTimeout(firstTimer)
      clearTimeout(secondTimer)
      clearTimeout(thirdTimer)
    }
  }, [isLoading])

  async function runCheck(url) {
    if (!url) return

    setIsLoading(true)
    setResult(null)
    setErrorMessage('')
    setLitSteps(0)

    try {
      setResult(await checkURL(url))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not check that link.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    runCheck(urlInput.trim())
  }

  const loadingSteps = [
    {
      title: 'Official site check',
      detail: 'Checking our list of official Singapore sites…',
      tone: TONES.neutral,
      dimmed: litSteps < 1,
    },
    {
      title: 'Risk score',
      detail: 'Working out a risk score for this link…',
      tone: TONES.neutral,
      dimmed: litSteps < 2,
    },
    {
      title: 'AI analyst review',
      detail: 'Our AI analyst is taking a closer look…',
      tone: TONES.neutral,
      dimmed: litSteps < 3,
      spinner: true,
    },
  ]

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border border-border bg-card p-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="text"
            aria-label="Link to check"
            placeholder="Paste a link here, e.g. https://example.com"
            value={urlInput}
            onChange={(event) => setURLInput(event.target.value)}
            autoFocus
            className="h-10 flex-1 bg-background text-base"
          />
          <Button type="submit" disabled={isLoading || !urlInput.trim()} className="h-10 px-5">
            {isLoading ? 'Checking…' : 'Check Link'}
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Try an example:</span>
          {DEMO_URLS.map((example) => (
            <Button
              key={example.label}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setURLInput(example.url)}
              className="h-7 rounded-full px-3 text-xs"
            >
              {example.label}
            </Button>
          ))}
        </div>
      </div>

      <div aria-live="polite" className="space-y-5">
        {isLoading && (
          <div className={`${PANEL_CLASS} p-5`}>
            <p className="mb-4 font-medium text-heading">Checking this link…</p>
            <PipelineTimeline steps={loadingSteps} />
          </div>
        )}

        {errorMessage && !isLoading && (
          <div className={`${PANEL_CLASS} space-y-3 border-l-4 border-l-destructive p-5`}>
            <p className="font-medium text-heading">We couldn&apos;t check that link</p>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <Button
              type="button"
              variant="outline"
              className="h-9"
              onClick={() => runCheck(urlInput.trim())}
              disabled={!urlInput.trim()}
            >
              <RefreshCw aria-hidden="true" />
              Try Again
            </Button>
          </div>
        )}

        {result && !isLoading && <URLResultCard result={result} />}
      </div>
    </div>
  )
}
