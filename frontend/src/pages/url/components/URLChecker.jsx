import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/providers/auth-provider'
import { useURLScanHistory } from '@/hooks/use-url-scan-history'
import { checkURL } from '@/services/url-service'
import QRScanDialog from './QRScanDialog'
import URLRecentScans from './URLRecentScans'
import URLResultCard, { PANEL_CLASS, PipelineTimeline } from './URLResultCard'

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
  const { user, loading: authLoading } = useAuth()
  // Claimed synchronously, so a repeated activation cannot start a second
  // request or a second history row before isLoading has re-rendered.
  const isCheckingRef = useRef(false)
  const history = useURLScanHistory(user, authLoading)

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
    if (!url || isCheckingRef.current) return

    isCheckingRef.current = true

    setIsLoading(true)
    setResult(null)
    setErrorMessage('')
    setLitSteps(0)

    try {
      const scanResult = await checkURL(url)
      setResult(scanResult)
      // Saved from the completed scan action rather than an effect, so a
      // re-render cannot repeat it, and fire-and-forget so history can never
      // delay or change the result already set above.
      history.recordScan(scanResult)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not check that link.')
    } finally {
      setIsLoading(false)
      isCheckingRef.current = false
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    runCheck(urlInput.trim())
  }

  // Runs the normal detector flow on the address the QR dialog already confirmed.
  function handleQRLink(url) {
    setURLInput(url)
    runCheck(url)
  }

  // Runs the normal detector flow on the stored address; never navigates to it.
  function handleCheckAgain(redactedURL) {
    setURLInput(redactedURL)
    runCheck(redactedURL)
  }

  const loadingSteps = [
    {
      title: 'Official site check',
      detail: 'Checking our list of official Singapore sites…',
      toneKey: 'neutral',
      dimmed: litSteps < 1,
    },
    {
      title: 'Risk score',
      detail: 'Working out a risk score for this link…',
      toneKey: 'neutral',
      dimmed: litSteps < 2,
    },
    {
      title: 'AI analyst review',
      detail: 'Our AI analyst is taking a closer look…',
      toneKey: 'neutral',
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
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isLoading || !urlInput.trim()}
              className="h-10 flex-1 px-5 sm:flex-none"
            >
              {isLoading ? 'Checking…' : 'Check Link'}
            </Button>
            <QRScanDialog onConfirm={handleQRLink} disabled={isLoading} />
          </div>
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

      <URLRecentScans
        entries={history.entries}
        isSignedIn={!authLoading && Boolean(user)}
        isAuthResolving={authLoading}
        isLoading={history.isLoading}
        loadError={history.loadError}
        syncError={history.syncError}
        isClearing={history.isClearing}
        clearError={history.clearError}
        isScanRunning={isLoading}
        onCheckAgain={handleCheckAgain}
        onClearHistory={history.clearHistory}
        onDismissClearError={history.dismissClearError}
      />

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
