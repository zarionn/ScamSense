import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Info, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import ScreenshotUploadCard from './components/ScreenshotUploadCard'
import DynamicQuestionnaire from './components/DynamicQuestionnaire'
import ResultView from './components/ResultView'
import ErrorMessage from './components/ErrorMessage'
import UncertaintyNote from './components/UncertaintyNote'
import ScreenshotHistoryList from './components/ScreenshotHistoryList'
import { useAuth } from '@/providers/auth-provider'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  clearScreenshotScanHistory,
  deleteScreenshotScan,
  getScreenshotScanHistory,
  saveScreenshotScan,
} from '@/services/screenshot-scan-service'
import {
  adaptScreenshotHistoryRow,
  toScreenshotHistoryEntry,
} from './utils/history-result-adapter'

const PHASE = {
  UPLOAD: 'upload',
  QUESTIONS: 'questions',
  RESULT: 'result',
}

// Plain-language only — a raw Supabase error is logged, never surfaced.
const HISTORY_DELETE_ERROR = "We couldn't delete that scan. Please try again."
const HISTORY_CLEAR_ERROR = "We couldn't clear your scan history. Please try again."

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

async function respondToAnalysis(analysisToken, answers) {
  let response
  try {
    response = await fetch('/api/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis_token: analysisToken, answers }),
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
  // The only thing the page did not already know: whether the result on screen
  // came from history or from a live scan. Set on the reopen path, cleared by
  // the existing reset and by selecting a new file — nothing else reads it.
  const [isHistoricalResult, setIsHistoricalResult] = useState(false)

  // Signed-in-only scan history. Guests never reach Supabase from this page —
  // scanning itself stays fully available to them.
  const { user } = useAuth()
  const [historyRows, setHistoryRows] = useState([])
  const [historyStatus, setHistoryStatus] = useState('idle')
  // Confirmation state lives here, matching ChatHistoryPage: the list stays
  // presentational and only asks. Nothing is deleted until confirmed.
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState(null)
  const [isClearHistoryPending, setIsClearHistoryPending] = useState(false)
  const [historyActionError, setHistoryActionError] = useState('')

  const loadHistory = useCallback(async () => {
    if (!user) {
      setHistoryRows([])
      setHistoryStatus('idle')
      return
    }
    setHistoryStatus('loading')
    try {
      setHistoryRows(await getScreenshotScanHistory(user.id))
      setHistoryStatus('success')
    } catch (error) {
      // Deliberately non-blocking: a history failure must never look like the
      // scan itself is broken, so it is logged and the section stays hidden.
      console.error('Failed to load screenshot scan history', error)
      setHistoryRows([])
      setHistoryStatus('error')
    }
  }, [user])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

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
    setIsHistoricalResult(false)
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

  const submitAnswers = useCallback(
    async (analysisToken, answers) => {
      setRespondStatus('loading')
      setRespondError('')
      try {
        const data = await respondToAnalysis(analysisToken, answers)
        setFinalResult(data)
        setRespondStatus('success')
        setPhase(PHASE.RESULT)

        // The live result is already on screen before anything is persisted.
        // History is secondary: this is the single Stage-2 success boundary, so
        // one completed scan makes at most one insert attempt, and a failure is
        // caught here rather than in the scan's own error path. Stage 1 and
        // reopening history never reach this call.
        if (user) {
          saveScreenshotScan({ userId: user.id, filename: file?.name, result: data })
            .then(loadHistory)
            .catch((error) => {
              console.error('Failed to save screenshot scan history', error)
            })
        }
      } catch (error) {
        setRespondError(error.message)
        setRespondStatus('error')
      }
    },
    [file, user, loadHistory]
  )

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

  // Reopening is pure state: the stored Stage-2 response is put straight back
  // into the same state a live scan produces. No /api/analyse, /api/respond,
  // classifier, auditor, explainer or advisory call is involved.
  const handleOpenHistoryEntry = useCallback(
    (entry) => {
      const row = historyRows.find((candidate) => candidate.id === entry.id)
      const restored = adaptScreenshotHistoryRow(row)
      if (!restored) return

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null

      setFile(restored.file)
      setPreviewUrl(restored.previewUrl)
      setAnalysisContext(null)
      setFinalResult(restored.result)
      setIsHistoricalResult(true)
      setAnalyseError('')
      setRespondError('')
      setAnalyseStatus('idle')
      setRespondStatus('success')
      setPhase(PHASE.RESULT)
    },
    [historyRows]
  )

  const handleConfirmDeleteEntry = useCallback(async () => {
    const entry = pendingDeleteEntry
    setPendingDeleteEntry(null)
    if (!entry || !user) return

    // Optimistic: the row goes immediately, and this snapshot is what restores
    // it on failure — so no refetch is needed on either path.
    const snapshot = historyRows
    setHistoryActionError('')
    setHistoryRows((prev) => prev.filter((row) => row.id !== entry.id))
    try {
      await deleteScreenshotScan({ userId: user.id, id: entry.id })
    } catch (error) {
      console.error('Failed to delete screenshot scan', error)
      setHistoryRows(snapshot)
      setHistoryActionError(HISTORY_DELETE_ERROR)
    }
  }, [pendingDeleteEntry, user, historyRows])

  const handleConfirmClearHistory = useCallback(async () => {
    setIsClearHistoryPending(false)
    if (!user) return

    const snapshot = historyRows
    setHistoryActionError('')
    setHistoryRows([])
    try {
      await clearScreenshotScanHistory({ userId: user.id })
    } catch (error) {
      console.error('Failed to clear screenshot scan history', error)
      setHistoryRows(snapshot)
      setHistoryActionError(HISTORY_CLEAR_ERROR)
    }
  }, [user, historyRows])

  const handleReset = useCallback(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = null
    setFile(null)
    setPreviewUrl(null)
    setAnalysisContext(null)
    setFinalResult(null)
    setIsHistoricalResult(false)
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
  const historyEntries = historyRows.map(toScreenshotHistoryEntry).filter(Boolean)
  // Same button, same destination (the upload page, where the history list
  // lives) — only the wording and icon follow how the result was reached.
  const resetLabel = isHistoricalResult ? 'Back to scans' : 'New Scan'
  const ResetIcon = isHistoricalResult ? ArrowLeft : RefreshCw

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
              <ResetIcon aria-hidden="true" />
              {resetLabel}
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

          <ScreenshotHistoryList
            entries={historyEntries}
            status={historyStatus}
            actionError={historyActionError}
            onOpen={handleOpenHistoryEntry}
            onRequestDelete={setPendingDeleteEntry}
            onRequestClearHistory={() => setIsClearHistoryPending(true)}
          />
        </div>
      )}

      {/* Matches the width of whichever content is actually on screen — the
          centred 900px workflow card on upload/questions, or the full-width
          result grid — so the footer never reads as a wider, unrelated strip. */}
      {/* Cancel is the safe default in both: closing performs no request, and
          neither service is called until the destructive action is chosen. */}
      <AlertDialog
        open={pendingDeleteEntry != null}
        onOpenChange={(open) => !open && setPendingDeleteEntry(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this saved scan?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteEntry
                ? `"${pendingDeleteEntry.displayName}"`
                : 'This scan'}{' '}
              and its saved analysis will be permanently removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDeleteEntry}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isClearHistoryPending}
        onOpenChange={(open) => !open && setIsClearHistoryPending(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear your scan history?</AlertDialogTitle>
            <AlertDialogDescription>
              All {historyEntries.length} saved{' '}
              {historyEntries.length === 1 ? 'scan' : 'scans'} and their analyses will be
              permanently removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmClearHistory}>
              Clear history
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
