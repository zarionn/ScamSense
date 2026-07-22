import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import UploadZone from '@/components/UploadZone'
import ExposureQuestions from '@/components/ExposureQuestions'
import ResultView from '@/components/ResultView'
import ErrorMessage from '@/components/ErrorMessage'
import UncertaintyNote from '@/components/UncertaintyNote'

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

function App() {
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

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5 px-4 py-5">
          <ShieldCheck className="size-7 text-primary" aria-hidden="true" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">ScamSense</h1>
            <p className="text-sm text-muted-foreground">
              Upload a screenshot to check if it looks like a scam
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {phase === PHASE.RESULT && finalResult ? (
          <ResultView
            previewUrl={previewUrl}
            classifier={finalResult.classifier}
            effectiveCautionLevel={finalResult.effective_caution_level}
            responseMessage={finalResult.response_message}
            onReset={handleReset}
          />
        ) : phase === PHASE.QUESTIONS && analysisContext ? (
          <div className="space-y-5">
            {isAuditDegraded && (
              <UncertaintyNote note="The independent visual review was temporarily unavailable, so these questions are based on the official classifier result." />
            )}
            <ExposureQuestions
              questions={analysisContext.exposure_questions}
              onSubmit={handleAnswersSubmit}
              isSubmitting={respondStatus === 'loading'}
              errorMessage={respondStatus === 'error' ? respondError : ''}
            />
          </div>
        ) : (
          <div className="space-y-5">
            {!file && (
              <UploadZone onFileSelected={handleFileSelected} disabled={isAnalysing} />
            )}

            {file && (
              <div className="space-y-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <img
                    src={previewUrl}
                    alt="Screenshot you selected"
                    className="h-40 w-full rounded-lg border border-border object-contain sm:h-32 sm:w-32"
                  />
                  <div className="flex-1 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Ready to check <span className="font-medium">{file.name}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={handleAnalyse}
                        disabled={isAnalysing || isAutoResponding}
                        size="lg"
                        aria-busy={isAnalysing || isAutoResponding}
                      >
                        {(isAnalysing || isAutoResponding) && (
                          <Loader2 className="animate-spin" aria-hidden="true" />
                        )}
                        {isAnalysing
                          ? 'Analysing…'
                          : isAutoResponding
                            ? 'Preparing your guidance…'
                            : 'Check this screenshot'}
                      </Button>
                      <Button
                        onClick={handleReset}
                        variant="outline"
                        size="lg"
                        disabled={isAnalysing || isAutoResponding}
                      >
                        Choose a different image
                      </Button>
                    </div>
                  </div>
                </div>

                {isAnalysing && (
                  <p role="status" className="text-sm text-muted-foreground">
                    This can take up to a few seconds — we run two models in sequence to
                    give you a careful answer.
                  </p>
                )}
                {isAutoResponding && (
                  <p role="status" className="text-sm text-muted-foreground">
                    This screenshot looks low-risk — putting together a short explanation.
                  </p>
                )}
              </div>
            )}

            {analyseStatus === 'error' && (
              <ErrorMessage message={analyseError} onRetry={handleAnalyse} />
            )}
            {respondStatus === 'error' && phase === PHASE.UPLOAD && (
              <ErrorMessage
                message={respondError}
                onRetry={() => submitAnswers(analysisContext, {})}
              />
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
