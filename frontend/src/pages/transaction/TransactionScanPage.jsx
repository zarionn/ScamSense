import { useState } from 'react'
import PageHeader from '@/components/layout/PageHeader'
import { checkTransaction } from '@/services/transaction-service'
import { Info } from 'lucide-react'

export default function TransactionScanPage() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)

  const handleUpload = async () => {
    if (!selectedFile) return

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

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
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <PageHeader
        title="Transaction Fraud Detector"
        description="Upload a CSV or Excel file to review suspicious transactions."
      />

      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 shadow-lg shadow-slate-950/20">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Upload Excel file</h2>
        </div>

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

          <button
            type="button"
            onClick={handleUpload}
            disabled={loading || !selectedFile}
            className="rounded-xl bg-amber-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Processing…' : 'Upload & Scan'}
          </button>
        </div>
      </div>
      

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-950/20 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
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

            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
              <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Risk threshold</div>
              <div className="mt-2 text-2xl font-bold text-emerald-400">0.50</div>
            </div>
          </div>

          {flaggedRows.length === 0 ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6 text-center">
              <h3 className="text-xl font-semibold text-emerald-300">No possible fraudulent transactions</h3>
              <p className="mt-2 text-sm text-emerald-100/80">
                No uploaded row exceeded the fraud detection threshold.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {flaggedRows.map((item, index) => {
                const score = Number(item?.risk_score ?? item?.probability ?? 0)
                const isFraud = Boolean(item?.is_fraud) || score >= 0.5

                return (
                  <div
                    key={item.row_index ?? index}
                    className={`rounded-2xl border p-5 ${
                      isFraud
                        ? 'border-red-500/40 bg-red-950/20'
                        : 'border-emerald-500/30 bg-emerald-950/20'
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-[0.12em] text-slate-400">
                          Row {item.row_index ?? index}
                        </div>
                        <div className="mt-1 text-xl font-semibold text-white">
                          {isFraud ? 'Likely fraud' : 'Low risk'}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
                        <span className="text-xs uppercase tracking-[0.12em] text-slate-400">Risk</span>
                        <div className="text-2xl font-bold text-white">{score.toFixed(4)}</div>
                      </div>
                    </div>

                    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full ${
                          score >= 0.5 ? 'bg-red-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(score * 100, 100)}%` }}
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-300">
                      <span className="rounded-full border border-slate-600 px-2 py-1">
                        Verdict: {item.verdict ?? (isFraud ? 'Likely fraud' : 'Low risk')}
                      </span>
                      <span className="rounded-full border border-slate-600 px-2 py-1">
                        Label: {item.label ?? (isFraud ? 'fraud' : 'safe')}
                      </span>
                    </div>
                  </div>
                )
              })}
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