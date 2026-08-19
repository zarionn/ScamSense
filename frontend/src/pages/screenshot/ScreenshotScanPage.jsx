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
import { analyseScreenshot, respondToAnalysis } from '@/services/screenshot-service'

const PHASE = {
  UPLOAD: 'upload',
  QUESTIONS: 'questions',
  RESULT: 'result',
}

// initialFile/onInitialFileConsumed are optional — normal sidebar navigation
// to Screenshot Scan passes neither, and the page behaves exactly as before.
// When the Assistant hands off a screenshot, App.jsx passes the same File
// object here; it's consumed once at mount into the existing selected-
// attachment state (no auto-analyse), then immediately reported back as
// consumed so App.jsx clears it and it never re-injects on a later render.
function ScreenshotScanPage({ initialFile, initialAnalysis, onInitialFileConsumed }) {
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

  const submitAnswers = useCallback(async (analysisToken, answers) => {
    setRespondStatus('loading')
    setRespondError('')
    try {
      const data = await respondToAnalysis(analysisToken, answers)
      setFinalResult(data)
      setRespondStatus('success')
      setPhase(PHASE.RESULT)
    } catch (error) {
      setRespondError(error.message)
      setRespondStatus('error')
    }
  }, [])

  useEffect(() => {
    if (initialFile) {
      handleFileSelected(initialFile)
    }

    // A stage-1 analysis the Assistant already ran. /api/analyse is not called
    // again and the signed token is reused, so the user continues into the same
    // analysis rather than starting a second one. These run after
    // handleFileSelected so they win over its reset.
    if (initialAnalysis) {
      setAnalysisContext(initialAnalysis)
      setAnalyseStatus('success')
      const questions = initialAnalysis.exposure_questions
      if (!questions || questions.length === 0) {
        submitAnswers(initialAnalysis.analysis_token, {})
      } else {
        setPhase(PHASE.QUESTIONS)
      }
    }

    if (initialFile || initialAnalysis) {
      onInitialFileConsumed?.()
    }
    // Deliberately run once on mount only — this consumes whatever handoff
    // was present when the page first mounted. Each navigation to
    // Screenshot Scan mounts a fresh instance of this page, so "once per
    // mount" is exactly "once per handoff", with no re-injection loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        await submitAnswers(data.analysis_token, {})
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
      submitAnswers(analysisContext.analysis_token, answers)
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
  const auditStatus = analysisContext?.audit_status
  const isAuditDegraded = auditStatus && auditStatus !== 'available'
  const auditStatusNote =
    auditStatus === 'malformed'
      ? 'The independent visual review returned an unreadable result, so these questions are based on the official classifier result.'
      : 'The independent visual review was unavailable, so these questions are based on the official classifier result.'
  const hasResult = phase === PHASE.RESULT && finalResult

  return (
    <>
      <PageHeader
        title="Scam Screenshot Detector"
        description="Upload a suspicious screenshot to identify visual warning signs and receive recommended next steps."
        actions={
          (hasResult || (phase === PHASE.QUESTIONS && respondStatus === 'error')) && (
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
            <UncertaintyNote note={auditStatusNote} />
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
