import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// Must match the inline no-flash script in index.html exactly: same storage key,
// same validation, same light/dark resolution — otherwise the first paint here
// could disagree with what the inline script already applied to <html>.
const STORAGE_KEY = 'scamsense-theme'
const VALID_THEMES = ['light', 'dark', 'system']

function getStoredTheme() {
  let stored = null
  try {
    stored = localStorage.getItem(STORAGE_KEY)
  } catch {
    // localStorage unavailable (privacy mode, etc.) — fall back to system.
  }
  return VALID_THEMES.includes(stored) ? stored : 'system'
}

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getStoredTheme)
  const [resolvedTheme, setResolvedTheme] = useState(() =>
    theme === 'system' ? getSystemTheme() : theme
  )

  useEffect(() => {
    const next = theme === 'system' ? getSystemTheme() : theme
    setResolvedTheme(next)
    document.documentElement.classList.toggle('dark', next === 'dark')
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const next = getSystemTheme()
      setResolvedTheme(next)
      document.documentElement.classList.toggle('dark', next === 'dark')
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((next) => {
    if (!VALID_THEMES.includes(next)) return
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Ignore write failures — theme still applies for this session.
    }
  }, [])

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within a ThemeProvider.')
  return context
}
