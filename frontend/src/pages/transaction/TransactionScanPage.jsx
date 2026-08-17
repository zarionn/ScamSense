import { useState } from 'react'
import PageHeader from '@/components/layout/PageHeader'
import { checkTransaction } from '@/services/transaction-service'

export default function TransactionScanPage() {
  const [form, setForm] = useState({
    amount: 350,
    account_age_days: 90,
    transaction_count_24h: 2,
    avg_transaction_amount: 120,
    is_foreign_transaction: 1,
    is_weekend: 0,
    hour_of_day: 22,
    day_of_week: 6,
    month: 8,
    is_month_end: 0,
    is_month_start: 0,
    time_since_last_transaction: 6,
    transaction_count_7d: 4,
    transaction_count_30d: 12,
    amount_zscore: 1.5,
    amount_percentile: 0.9,
    amount_rolling_mean_7d: 100,
    amount_rolling_std_7d: 40,
    amount_x_transaction_count: 700,
    amount_x_is_foreign: 350,
    transaction_count_x_is_foreign: 2,
    is_rush_hour: 1,
    is_off_hours: 1,
    avg_amount_ratio: 3,
    transaction_velocity: 0.8,
    merchant_category: 'Online',
    device_type: 'Mobile',
  })

  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = await checkTransaction(form)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Transaction Fraud Detector"
        description="Submit transaction details to check for possible fraud risk."
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label>
            Amount
            <input
              type="number"
              name="amount"
              value={form.amount}
              onChange={handleChange}
            />
          </label>

          <label>
            Account Age Days
            <input
              type="number"
              name="account_age_days"
              value={form.account_age_days}
              onChange={handleChange}
            />
          </label>

          <label>
            Merchant Category
            <input
              type="text"
              name="merchant_category"
              value={form.merchant_category}
              onChange={handleChange}
            />
          </label>

          <label>
            Device Type
            <input
              type="text"
              name="device_type"
              value={form.device_type}
              onChange={handleChange}
            />
          </label>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Checking...' : 'Check Transaction'}
        </button>
      </form>

      {error && <p className="text-red-500">{error}</p>}

      {result && (
        <div>
          <p>Risk score: {result.risk_score}</p>
          <p>Verdict: {result.verdict}</p>
          <p>Label: {result.label}</p>
        </div>
      )}
    </div>
  )
}