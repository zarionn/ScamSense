import { useCallback, useEffect, useRef, useState } from 'react'
import { Info, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import ScreenshotUploadCard from './components/ScreenshotUploadCard'
import DynamicQuestionnaire from './components/DynamicQuestionnaire'
import ResultView from './components/ResultView'
import ErrorMessage from './components/ErrorMessage'
import UncertaintyNote from './components/UncertaintyNote'

const PHASE = {
  UPLOAD: 'upload',
  QUESTIONS: 'questions',
  RESULT: 'result',
}

async function parseJsonResponse(response) {
  let data = null
  try {
    data = await response.json()
  } catch {
    throw new Error('The server sent back an unexpected response. Please try again.')
  }
  if (!response.ok) {
    throw new Error(data?.error || 'Something went wrong. Please try again.')
  }
  return data
}

async function analyseScreenshot(file) {
  const formData = new FormData()
  formData.append('file', file)

  let response
  try {
    response = await fetch('/api/analyse', {
      method: 'POST',
      body: formData,
    })
  } catch {
    throw new Error(
      'Could not reach the server. Check your internet connection and try again.'
    )
  }
  return parseJsonResponse(response)
}

async function respondToAnalysis(analysisContext, answers) {
  let response
  try {
    response = await fetch('/api/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis_context: analysisContext, answers }),
    })
  } catch {
    throw new Error(
      'Could not reach the server. Check your internet connection and try again.'
    )
  }
  return parseJsonResponse(response)
}

// initialFile/onInitialFileConsumed are optional — normal sidebar navigation
// to Screenshot Scan passes neither, and the page behaves exactly as before.
// When the Assistant hands off a screenshot, App.jsx passes the same File
// object here; it's consumed once at mount into the existing selected-
// attachment state (no auto-analyse), then immediately reported back as
// consumed so App.jsx clears it and it never re-injects on a later render.
function ScreenshotScanPage({ initialFile, onInitialFileConsumed }) {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const objectUrlRef = useRef(null)

  const [phase, setPhase] = useState(PHASE.UPLOAD)

  const [analyseStatus, setAnalyseStatus] = useState('idle')
  const [analyseError, setAnalyseError] = useState('')
  const [analysisContext, setAnalysisContext] = useState(null)

  const [respondStatus, setRespondStatus] = useState('idle')
  const [respondError, setRespondError] = useState('')
  const [finalResult, setFinalResult] = useState(null)

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  const handleFileSelected = useCallback((selectedFile) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(selectedFile)
    objectUrlRef.current = url

    setFile(selectedFile)
    setPreviewUrl(url)
    setAnalysisContext(null)
    setFinalResult(null)
    setAnalyseError('')
    setRespondError('')
    setAnalyseStatus('idle')
    setRespondStatus('idle')
    setPhase(PHASE.UPLOAD)
  }, [])

  useEffect(() => {
    if (initialFile) {
      handleFileSelected(initialFile)
      onInitialFileConsumed?.()
    }
    // Deliberately run once on mount only — this consumes whatever handoff
    // file was present when the page first mounted. Each navigation to
    // Screenshot Scan mounts a fresh instance of this page, so "once per
    // mount" is exactly "once per handoff", with no re-injection loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submitAnswers = useCallback(async (context, answers) => {
    setRespondStatus('loading')
    setRespondError('')
    try {
      const data = await respondToAnalysis(context, answers)
      setFinalResult(data)
      setRespondStatus('success')
      setPhase(PHASE.RESULT)
    } catch (error) {
      setRespondError(error.message)
      setRespondStatus('error')
    }
  }, [])

  const handleAnalyse = useCallback(async () => {
    if (!file) return
    setAnalyseStatus('loading')
    setAnalyseError('')
    try {
      const data = await analyseScreenshot(file)
      setAnalysisContext(data)
      setAnalyseStatus('success')

      if (!data.exposure_questions || data.exposure_questions.length === 0) {
        // Low-risk screenshot: nothing to ask, go straight to the final response.
        await submitAnswers(data, {})
      } else {
        setPhase(PHASE.QUESTIONS)
      }
    } catch (error) {
      setAnalyseError(error.message)
      setAnalyseStatus('error')
    }
  }, [file, submitAnswers])

  const handleAnswersSubmit = useCallback(
    (answers) => {
      if (!analysisContext) return
      submitAnswers(analysisContext, answers)
    },
    [analysisContext, submitAnswers]
  )

  const handleReset = useCallback(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = null
    setFile(null)
    setPreviewUrl(null)
    setAnalysisContext(null)
    setFinalResult(null)
    setAnalyseError('')
    setRespondError('')
    setAnalyseStatus('idle')
    setRespondStatus('idle')
    setPhase(PHASE.UPLOAD)
  }, [])

  const isAnalysing = analyseStatus === 'loading'
  // The zero-questions path calls /api/respond while still visually in the upload
  // phase (no questions screen to show), so give it its own loading affordance.
  const isAutoResponding = respondStatus === 'loading' && phase === PHASE.UPLOAD
  const isAuditDegraded = analysisContext?.audit_status?.startsWith('degraded')
  const hasResult = phase === PHASE.RESULT && finalResult

  return (
    <>
      <PageHeader
        title="Scam Screenshot Detector"
        description="Upload a suspicious screenshot to identify visual warning signs and receive recommended next steps."
        actions={
          hasResult && (
            // Branded-but-secondary: plum text/border on hover into the lavender
            // surface, so it feels connected to the brand without becoming a
            // second primary action next to the result. The dark: pairs re-assert
            // the outline variant's original dark styling exactly, since the new
            // border/hover tokens driving this are light-mode-only refinements.
            <Button
              variant="outline"
              onClick={handleReset}
              className="border-new-scan-border text-accent-foreground hover:border-ring hover:bg-dropzone-surface hover:text-accent-foreground dark:border-input dark:text-foreground dark:hover:border-input dark:hover:bg-input/50 dark:hover:text-foreground"
            >
              <RefreshCw aria-hidden="true" />
              New Scan
            </Button>
          )
        }
      />

      {hasResult ? (
        <ResultView file={file} previewUrl={previewUrl} result={finalResult} />
      ) : phase === PHASE.QUESTIONS && analysisContext ? (
        <div className="mx-auto w-full max-w-[900px] space-y-4">
          {isAuditDegraded && (
            <UncertaintyNote note="The independent visual review was temporarily unavailable, so these questions are based on the official classifier result." />
          )}
          <DynamicQuestionnaire
            exposureQuestions={analysisContext.exposure_questions}
            onSubmit={handleAnswersSubmit}
            isSubmitting={respondStatus === 'loading'}
            errorMessage={respondStatus === 'error' ? respondError : ''}
          />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[900px] space-y-4">
          <ScreenshotUploadCard
            file={file}
            previewUrl={previewUrl}
            onFileSelected={handleFileSelected}
            onAnalyse={handleAnalyse}
            onRemove={handleReset}
            isAnalysing={isAnalysing}
            isAutoResponding={isAutoResponding}
            analyseError={analyseStatus === 'error' ? analyseError : ''}
            onRetryAnalyse={handleAnalyse}
          />

          {respondStatus === 'error' && phase === PHASE.UPLOAD && (
            <ErrorMessage
              message={respondError}
              onRetry={() => submitAnswers(analysisContext, {})}
            />
          )}
        </div>
      )}

      {/* Matches the width of whichever content is actually on screen — the
          centred 900px workflow card on upload/questions, or the full-width
          result grid — so the footer never reads as a wider, unrelated strip. */}
      <footer className={cn('mt-8 border-t border-border py-3.5', !hasResult && 'mx-auto max-w-[900px]')}>
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          ScamSense uses AI to identify possible scam indicators, but results may not be 100%
          accurate. When in doubt, verify through official sources.
        </p>
      </footer>
    </>
  )
}

export default ScreenshotScanPage
