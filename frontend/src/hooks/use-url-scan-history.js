import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clearURLScanHistory,
  getRecentURLScans,
  HISTORY_LIMIT,
  saveURLScanToHistory,
} from '@/services/url-history-service'

// Owns the signed-in user's recent URL scans for the URL page.
//
// `user` being null means two different things: "the session check hasn't
// resolved yet" and "confirmed signed out". Treating the first as the second
// would silently drop a signed-in user's scan, so a scan that arrives while
// `authLoading` is true is parked and saved once auth resolves.

const SAVE_FAILED_MESSAGE = "This scan wasn't saved to your recent scans."
const LOAD_FAILED_MESSAGE = "We couldn't load your recent scans."
const CLEAR_FAILED_MESSAGE = "We couldn't clear your history. Please try again."

// Both parts are needed: two scans can share a checked_at, and a rescan of the
// same URL is its own entry.
function scanKeyFor(result) {
  return `${result.url}|${result.checked_at}`
}

// A fetch started before an insert committed comes back without that row, so
// rows written in this session are folded back in rather than lost from view.
function mergeRows(fetched, localRows) {
  const byId = new Map()
  for (const row of [...localRows, ...fetched]) {
    if (!byId.has(row.id)) byId.set(row.id, row)
  }
  return [...byId.values()]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, HISTORY_LIMIT)
}

export function useURLScanHistory(user, authLoading) {
  const [entries, setEntries] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [syncError, setSyncError] = useState('')
  const [isClearing, setIsClearing] = useState(false)
  const [clearError, setClearError] = useState('')

  // Claimed synchronously before any await: Strict Mode double-invokes effects
  // and a re-render can re-run a handler's closure.
  const savedKeysRef = useRef(new Set())
  // A scan that finished before the session check did.
  const pendingScanRef = useRef(null)
  const localRowsRef = useRef([])

  const persist = useCallback(async (result, activeUser) => {
    try {
      const row = await saveURLScanToHistory({ user: activeUser, result })
      localRowsRef.current = [row, ...localRowsRef.current].slice(0, HISTORY_LIMIT)
      setEntries((previous) =>
        [row, ...previous.filter((entry) => entry.id !== row.id)].slice(0, HISTORY_LIMIT)
      )
      setSyncError('')
    } catch {
      // A rejection — a Supabase failure, or a URL that could not be redacted —
      // leaves the scan unstored and the displayed result untouched. The key
      // stays claimed, since a rejection cannot prove the insert did not land.
      setSyncError(SAVE_FAILED_MESSAGE)
    }
  }, [])

  // Called from the completed scan action, never from a render-driven effect,
  // so a re-render cannot cause a second insert for the same result.
  const recordScan = useCallback(
    (result) => {
      if (!result || typeof result !== 'object') return

      const key = scanKeyFor(result)
      if (savedKeysRef.current.has(key)) return

      if (authLoading) {
        // Parked, not discarded — the effect below picks it up once the session
        // check answers.
        pendingScanRef.current = result
        return
      }

      // Confirmed guest: nothing stored, no message shown.
      if (!user) return

      savedKeysRef.current.add(key)
      void persist(result, user)
    },
    [user, authLoading, persist]
  )

  // Flushes only a scan recordScan explicitly parked, taking and clearing it
  // synchronously so a Strict Mode re-run finds nothing left to save.
  useEffect(() => {
    if (authLoading) return

    const pending = pendingScanRef.current
    if (!pending) return
    pendingScanRef.current = null

    if (!user) return

    const key = scanKeyFor(pending)
    if (savedKeysRef.current.has(key)) return
    savedKeysRef.current.add(key)
    void persist(pending, user)
  }, [user, authLoading, persist])

  useEffect(() => {
    // Unknown, not signed out — waiting beats clearing a list about to load.
    if (authLoading) return

    if (!user) {
      // A confirmed sign-out must leave nothing from the previous account.
      setEntries([])
      setIsLoading(false)
      setLoadError('')
      setSyncError('')
      setClearError('')
      savedKeysRef.current.clear()
      localRowsRef.current = []
      return undefined
    }

    let cancelled = false
    setIsLoading(true)
    setLoadError('')

    getRecentURLScans({ user })
      .then((rows) => {
        if (!cancelled) setEntries(mergeRows(rows, localRowsRef.current))
      })
      .catch(() => {
        if (!cancelled) setLoadError(LOAD_FAILED_MESSAGE)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  // Resolves to whether Supabase confirmed the delete, so the caller can keep
  // its confirmation open on failure.
  const clearHistory = useCallback(async () => {
    if (!user) return false

    setIsClearing(true)
    setClearError('')

    try {
      await clearURLScanHistory({ user })
      setEntries([])
      savedKeysRef.current.clear()
      localRowsRef.current = []
      setSyncError('')
      setLoadError('')
      return true
    } catch {
      setClearError(CLEAR_FAILED_MESSAGE)
      return false
    } finally {
      setIsClearing(false)
    }
  }, [user])

  const dismissClearError = useCallback(() => setClearError(''), [])

  return {
    entries,
    isLoading,
    loadError,
    syncError,
    isClearing,
    clearError,
    recordScan,
    clearHistory,
    dismissClearError,
  }
}
