import { useEffect, useState } from 'react'
import PageHeader from '@/components/layout/PageHeader'
import { checkTransaction } from '@/services/transaction-service'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function TransactionScanPage({ initialFile, onInitialFileConsumed, onOpenAssistant }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [expandedRow, setExpandedRow] = useState(null)
  const [emailDraft, setEmailDraft] = useState(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [copied, setCopied] = useState(false)
  const [language, setLanguage] = useState('en')

  useEffect(() => {
    if (initialFile) {
      setSelectedFile(initialFile)
      onInitialFileConsumed?.()
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const LANGUAGE_OPTIONS = [
    { code: 'en', label: 'English' },
    { code: 'zh', label: '中文 (Chinese)' },
    { code: 'ms', label: 'Bahasa Melayu' },
    { code: 'ta', label: 'தமிழ் (Tamil)' },
  ]

  const [exporting, setExporting] = useState(false)

  const handleExportPdf = async () => {
    if (!result?.results?.length) return
    setExporting(true)
    try {
      const response = await fetch('/api/transaction/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          results: result.results,
          statement_summary: result.statement_summary,
        }),
      })
      if (!response.ok) {
          const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || 'Export failed')
    }
      const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'scamsense_transaction_results.pdf'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  } catch (err) {
    setError(err.message)
  } finally {
    setExporting(false)
  }
}

const handleDraftEmail = async () => {
  setEmailLoading(true)
  setEmailError('')
  try {
    const response = await fetch('/api/transaction/draft-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flagged_rows: flaggedRows }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.error || 'Could not draft email')
    setEmailDraft(data.escalation_email)
  } catch (err) {
    setEmailError(err.message)
  } finally {
    setEmailLoading(false)
  }
}

const handleCopyEmail = async () => {
  if (!emailDraft) return
  try {
    await navigator.clipboard.writeText(emailDraft)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  } catch (err) {
    setError('Could not copy to clipboard')
  }
}

const handleUpload = async () => {
  if (!selectedFile) return

  setLoading(true)
  setError('')

  try {
    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('language', language)

    const response = await fetch('/api/transaction/upload', {
      method: 'POST',
      body: formData,
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || 'Excel upload failed')
    }

    setResult(data)
  } catch (err) {
    setError(err.message)
  } finally {
    setLoading(false)
  }
}

const flaggedRows = Array.isArray(result?.results)
  ? result.results
    .map((item) => item?.prediction ?? item)
    .filter((item) => {
      const score = Number(item?.risk_score ?? item?.probability ?? 0)
      return Boolean(item?.is_fraud) || score >= 0.5
    })
  : []

return (
  <div className="mx-auto max-w-5xl space-y-4">
    <PageHeader
      title="Transaction Fraud Detector"
      description="Upload a CSV or Excel file to review suspicious transactions."
    />

    <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 shadow-lg shadow-slate-950/20">

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <label className="flex w-full cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-950/40 px-4 py-6 text-sm text-slate-300 hover:border-amber-400 hover:text-white">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          <span>{selectedFile ? selectedFile.name : 'Choose CSV / Excel file'}</span>
        </label>
        <div className="space-y-1">
          <Button
            type="button"
            onClick={handleUpload}
            disabled={loading || !selectedFile}
            className="rounded-xl h-8 px-5 py-3 font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Processing…' : 'Upload & Scan'}
          </Button>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded-xl border border-slate-600 bg-slate-950/40 px-3 py-1 text-sm text-slate-200"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>


    {error && (
      <div className="rounded-xl border border-red-500/40 bg-red-950/20 p-3 text-sm text-red-200">
        {error}
      </div>
    )}

    {result && (
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Total rows</div>
            <div className="mt-2 text-2xl font-bold text-white">{result.total_rows ?? 0}</div>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Flagged</div>
            <div className="mt-2 text-2xl font-bold text-amber-400">
              {result.flagged_rows ?? flaggedRows.length}
            </div>
          </div>

        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exporting}
            className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:border-amber-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting === 'pdf' ? 'Exporting…' : 'Download output PDF'}
          </button>
        </div>

        {result.statement_summary && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-400">
              Scan summary
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-200">
              {result.statement_summary}
            </p>
          </div>
        )}

        {flaggedRows.length === 0 ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6 text-center">
            <h3 className="text-xl font-semibold text-emerald-300">No possible fraudulent transactions | 安全 | selamat | பாதுகாப்பான</h3>
            <p className="mt-2 text-sm text-emerald-100/80">
              No uploaded row exceeded the fraud detection threshold.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {flaggedRows.map((item, index) => {
              const score = Number(item?.risk_score ?? item?.probability ?? 0)
              const isFraud = Boolean(item?.is_fraud) || score >= 0.5
              const getRiskStatus = (score) => {
                if (score < 0.7) return "Likely fraud"
                if (score >= 0.7) return "Is fraud"
              }

              return (
                <div
                  key={item.row_index ?? index}
                  className={`rounded-2xl border p-5 ${isFraud
                    ? 'border-red-500/40 bg-red-950/20'
                    : 'border-emerald-500/30 bg-emerald-950/20'
                    }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-m uppercase tracking-[0.12em] text-white">
                        Row {item.row_index ?? index}{item.timestamp ? ` - ${item.timestamp}` : ''}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
                      <div className={`text-sm ${getRiskStatus(score) === 'Is fraud' ? 'text-red-500' : getRiskStatus(score) === 'Likely fraud' ? 'text-orange-500' : 'text-emerald-500'}`}>
                        {getRiskStatus(score)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${score >= 0.5 ? 'bg-red-500' : 'bg-emerald-500'
                        }`}
                      style={{ width: `${Math.min(score * 100, 100)}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedRow(expandedRow === index ? null : index)}
                    className="mt-4 flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
                  >
                    <span>AI explanation</span>
                    <span>{expandedRow === index ? '−' : '+'}</span>
                  </button>

                  {expandedRow === index && (
                    <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-300">
                      {item.ai_explanation
                        ? item.ai_explanation
                        : item.ai_error
                          ? `Couldn't generate explanation: ${item.ai_error}`
                          : 'No explanation available.'}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-300">
                    <span className="rounded-full border border-slate-600 px-2 py-1">
                      Verdict: {item.verdict ?? (isFraud ? 'Likely fraud' : 'Low risk')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {flaggedRows.length > 0 && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/10 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-amber-300">
              Next step
            </h3>

            {!emailDraft ? (
              <div className="mt-3 flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-slate-300">
                  {flaggedRows.length} transaction{flaggedRows.length > 1 ? 's' : ''} flagged.
                  Draft an escalation email to send to the bank / SPF for review.
                </p>
                <button
                  type="button"
                  onClick={handleDraftEmail}
                  disabled={emailLoading}
                  className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {emailLoading ? 'Drafting…' : 'Draft escalation email'}
                </button>
              </div>
            ) : (
              <>
                <div className="mt-3 flex w-full items-center justify-between gap-4">
                  <span className="text-sm text-slate-300">Draft ready</span>
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="shrink-0 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-amber-400 hover:text-white"
                  >
                    {copied ? 'Copied ✓' : 'Copy to clipboard'}
                  </button>
                </div>
                <div className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-200">
                  {emailDraft}
                </div>
              </>
            )}

            {emailError && (
              <div className="mt-3 rounded-lg border border-red-500/40 bg-red-950/20 p-2 text-xs text-red-200">
                {emailError}
              </div>
            )}
          </div>
        )}
      </div>
    )}
    <footer className="mx-auto mt-8 max-w-[900px] border-t border-border py-3.5">
      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        ScamSense uses AI to identify possible phishing indicators, but results may not be
        100% accurate. When in doubt, verify the link through an official source.
      </p>
    </footer>
  </div>
)
}