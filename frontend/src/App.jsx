import { useCallback, useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useTheme } from '@/providers/theme-provider'
import { useLocalStoragePreference } from '@/hooks/use-local-storage-preference'
import { ScreenshotScanPage } from './pages/screenshot'
import { AssistantPage } from './pages/assistant'
import { MessageScanPage } from './pages/message'
import { URLScanPage } from './pages/url'
import { TransactionScanPage } from './pages/transaction'
import { AboutPage } from './pages/about'
import { SettingsPage } from './pages/settings'

function App() {
  // Smallest safe page-selection approach with no router installed — the app
  // still only ever renders one page inside the shared AppShell.
  const [activePage, setActivePage] = useState('screenshot')

  // Smallest possible shared handoff state for carrying a browser File object
  // from the Assistant into Screenshot Scan. Cleared as soon as Screenshot
  // Scan consumes it (see ScreenshotScanPage's mount effect) so it never
  // re-injects on a later render or a normal, non-handoff visit to the page.
  const [detectorHandoff, setDetectorHandoff] = useState(null)

  // Lifted (not local to AssistantPage) so Settings' "Clear Chat" can reset
  // the same conversation, and so it survives navigating away and back
  // instead of silently resetting every time the page remounts.
  const [assistantMessages, setAssistantMessages] = useState([])

  // Settings-controlled, harmless UI-only preferences. Reused via the shared
  // useLocalStoragePreference hook (no new theme/provider state) — theme
  // itself still comes from the existing ThemeProvider below.
  const [typingAnimation, setTypingAnimation] = useLocalStoragePreference(
    'scamsense-assistant-typing',
    true
  )
  const [guidedSuggestions, setGuidedSuggestions] = useLocalStoragePreference(
    'scamsense-guided-suggestions',
    true
  )
  const [reducedMotion, setReducedMotion] = useLocalStoragePreference(
    'scamsense-reduced-motion',
    false
  )
  const { setTheme } = useTheme()

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reducedMotion)
  }, [reducedMotion])

  const handleOpenDetector = useCallback((detectorKey, file) => {
    if (detectorKey === 'screenshot' && file) {
      setDetectorHandoff({ detector: 'screenshot', file, source: 'assistant' })
    }
    setActivePage(detectorKey)
  }, [])

  const handleHandoffConsumed = useCallback(() => {
    setDetectorHandoff(null)
  }, [])

  const handleClearAssistantChat = useCallback(() => {
    setAssistantMessages([])
  }, [])

  const handleResetSettings = useCallback(() => {
    setTheme('system')
    setTypingAnimation(true)
    setGuidedSuggestions(true)
    setReducedMotion(false)
  }, [setTheme, setTypingAnimation, setGuidedSuggestions, setReducedMotion])

  const screenshotHandoffFile =
    detectorHandoff?.detector === 'screenshot' ? detectorHandoff.file : null

  return (
    <AppShell activePage={activePage} onNavigate={setActivePage}>
      {activePage === 'assistant' && (
        <AssistantPage
          messages={assistantMessages}
          onMessagesChange={setAssistantMessages}
          onOpenDetector={handleOpenDetector}
          typingAnimation={typingAnimation}
          guidedSuggestions={guidedSuggestions}
        />
      )}
      {activePage === 'screenshot' && (
        <ScreenshotScanPage
          initialFile={screenshotHandoffFile}
          onInitialFileConsumed={handleHandoffConsumed}
        />
      )}
      {activePage === 'message' && <MessageScanPage />}
      {activePage === 'url' && <URLScanPage />}
      {activePage === 'transaction' && <TransactionScanPage />}
      {activePage === 'about' && <AboutPage />}
      {activePage === 'settings' && (
        <SettingsPage
          typingAnimation={typingAnimation}
          onTypingAnimationChange={setTypingAnimation}
          guidedSuggestions={guidedSuggestions}
          onGuidedSuggestionsChange={setGuidedSuggestions}
          reducedMotion={reducedMotion}
          onReducedMotionChange={setReducedMotion}
          onClearAssistantChat={handleClearAssistantChat}
          onResetSettings={handleResetSettings}
        />
      )}
    </AppShell>
  )
}

export default App
