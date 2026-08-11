import { useCallback, useState } from 'react'

// Generic, minimal localStorage-backed preference — used only for harmless UI
// presentation settings (theme uses its own existing ThemeProvider; this is
// for the newer Assistant/accessibility preferences added in Settings).
// Never store screenshots, chat content, or detector results with this.
export function useLocalStoragePreference(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored === null ? defaultValue : JSON.parse(stored)
    } catch {
      return defaultValue
    }
  })

  const update = useCallback(
    (next) => {
      setValue(next)
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // localStorage unavailable (privacy mode, etc.) — preference still
        // applies for this session, just doesn't persist.
      }
    },
    [key]
  )

  return [value, update]
}
