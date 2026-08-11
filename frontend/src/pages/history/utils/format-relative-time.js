const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

// Native Date/Intl only — no date library for a handful of relative-time
// buckets. Mirrors the product spec's examples: "5 min ago", "2 hours ago",
// "Yesterday", "Aug 10" (year added only once it's no longer the current one).
export function formatRelativeTime(isoString) {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const diffMs = now - date

  if (diffMs < MINUTE_MS) return 'Just now'

  if (diffMs < HOUR_MS) {
    const minutes = Math.floor(diffMs / MINUTE_MS)
    return `${minutes} min${minutes === 1 ? '' : 's'} ago`
  }

  if (diffMs < DAY_MS) {
    const hours = Math.floor(diffMs / HOUR_MS)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayDiff = Math.round((startOfToday - startOfDate) / DAY_MS)

  if (dayDiff === 1) return 'Yesterday'
  if (dayDiff < 7) return `${dayDiff} days ago`

  const sameYear = date.getFullYear() === now.getFullYear()
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  })
}
