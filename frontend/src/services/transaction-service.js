import { supabase } from '@/lib/supabase'

export async function saveTransactionScanHistory(userId, results, sourceFile) {
  if (!userId || !Array.isArray(results) || results.length === 0) return

  const rows = results.map((r) => ({
    user_id: userId,
    source_file: sourceFile ?? null,
    row_index: r.row_index ?? null,
    transaction_time: r.timestamp ?? null,
    amount: r.amount ?? null,
    merchant_category: r.merchant_category ?? null,
    device_type: r.device_type ?? null,
    is_foreign_transaction:
      r.is_foreign_transaction != null ? Boolean(r.is_foreign_transaction) : null,
    ml_probability: r.probability ?? r.risk_score ?? 0,
    verdict: r.verdict ?? (r.is_fraud ? 'Likely fraud' : 'Low risk'),
    verdict_level: r.label ?? (r.is_fraud ? 'fraud' : 'safe'),
    ai_explanation: r.ai_explanation ?? null,
  }))

  const { error } = await supabase.from('transaction_scan_history').insert(rows)
  if (error) throw error
}

export async function checkTransaction(payload) {
  let response

  try {
    response = await fetch('/api/transaction/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error('Could not reach the server. Please try again.')
  }

  let data
  try {
    data = await response.json()
  } catch {
    throw new Error('The server returned an invalid response.')
  }

  if (!response.ok) {
    throw new Error(data?.error || 'Something went wrong while checking the transaction.')
  }

  return data
}