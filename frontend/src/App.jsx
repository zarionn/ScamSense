import { useCallback, useEffect, useRef, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useTheme } from '@/providers/theme-provider'
import { useAuth } from '@/providers/auth-provider'
import { useLocalStoragePreference } from '@/hooks/use-local-storage-preference'
import { useConversationHistory, getStoredConversationId } from '@/hooks/use-conversation-history'
import { ScreenshotScanPage } from './pages/screenshot'
import { AssistantPage } from './pages/assistant'
import { MessageScanPage } from './pages/message'
import { URLScanPage } from './pages/url'
import { TransactionScanPage } from './pages/transaction'
import { AboutPage } from './pages/about'
import { SettingsPage } from './pages/settings'
import { ChatHistoryPage } from './pages/history'

// sessionStorage (not localStorage — see useConversationHistory for the same
// reasoning): a refresh in the same tab should land back on the same page,
// but a fresh browser session starting at the default page is fine.
const ACTIVE_PAGE_STORAGE_KEY = 'scamsense-active-page'

// The fixed set of pages App.jsx actually knows how to render below —
// sessionStorage is an untrusted boundary (could be edited, stale from a
// removed page, etc.), so a stored value is only ever used if it's a member
// of this set.
const VALID_PAGES = new Set([
  'assistant',
  'history',
  'screenshot',
  'message',
  'url',
  'transaction',
  'about',
  'settings',
])

function getStoredActivePage() {
  try {
    const stored = sessionStorage.getItem(ACTIVE_PAGE_STORAGE_KEY)
    return VALID_PAGES.has(stored) ? stored : 'assistant'
  } catch {
    return 'assistant'
  }
}

function App() {

  // Smallest safe page-selection approach with no router installed — the app
  // still only ever renders one page inside the shared AppShell. Lazily
  // initialised from sessionStorage so a refresh reopens the page the user
  // was actually on, instead of always resetting to one default.
  const [activePage, setActivePage] = useState(getStoredActivePage)

  // Persists whichever page is active so a same-tab refresh returns to it
  // instead of always landing back on the default. Deliberately just an
  // effect over the existing setActivePage — every value that ever reaches
  // `activePage` already comes from a known-valid nav identifier, so there's
  // nothing to validate on write (only on the initial read above, which is
  // the actual untrusted boundary).
  useEffect(() => {
    try {
      sessionStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, activePage)
    } catch {
      // sessionStorage can throw (e.g. private browsing) — losing this is a
      // minor convenience regression, not a functional one.
    }
  }, [activePage])

  // Smallest possible shared handoff state for carrying a browser File object
  // from the Assistant into Screenshot Scan. Cleared as soon as Screenshot
  // Scan consumes it (see ScreenshotScanPage's mount effect) so it never
  // re-injects on a later render or a normal, non-handoff visit to the page.
  const [detectorHandoff, setDetectorHandoff] = useState(null)

  // Lifted (not local to AssistantPage) so Settings' "Clear Chat" can reset
  // the same conversation, and so it survives navigating away and back
  // instead of silently resetting every time the page remounts.
  const [assistantMessages, setAssistantMessages] = useState([])

  // Signed-in-only persistent Assistant history. Guests never reach Supabase
  // through this — see useConversationHistory, which no-ops on every write
  // path when `user` is null. `messages` above stays the single source of
  // truth for what's on screen; this only tracks which saved conversation
  // (if any) new messages should be attached to.
  const { user, loading: authLoading } = useAuth()
  const conversationHistory = useConversationHistory(user, authLoading)

  // Never leave a signed-in user's restored transcript on screen after they
  // sign out (privacy), without touching anything already in Supabase.
  // Skipped on the very first resolution of auth state (undefined -> null),
  // which is just "confirmed guest", not a sign-out.
  const previousUserIdRef = useRef(undefined)
  useEffect(() => {
    const previousUserId = previousUserIdRef.current
    const currentUserId = user?.id ?? null
    if (previousUserId && !currentUserId) {
      setAssistantMessages([])
    }
    previousUserIdRef.current = currentUserId
  }, [user])

  // Whether a saved-conversation restore might still be pending — starts
  // true only if there's actually a candidate id in sessionStorage, so a
  // guest (or a signed-in user with nothing stored) never sees an
  // unnecessary loading state. Folded into AssistantPage's existing
  // `isLoadingHistory` skeleton below rather than adding a new one.
  const [isRestoringActiveConversation, setIsRestoringActiveConversation] = useState(
    () => getStoredConversationId() != null
  )

  // Restores the previously active saved conversation, if any, exactly once
  // — only after Supabase's own session check resolves (a stored id must
  // never be used against an unconfirmed session), and never navigates: the
  // restored activePage above is left as-is, so refreshing on e.g.
  // Screenshot Scan with a saved chat still active stays on Screenshot Scan.
  // Reuses the same openConversation the sidebar/history page already use —
  // no second conversation-loading implementation.
  const hasAttemptedConversationRestoreRef = useRef(false)
  useEffect(() => {
    if (authLoading || hasAttemptedConversationRestoreRef.current) return
    hasAttemptedConversationRestoreRef.current = true

    if (!user) {
      // useConversationHistory's own effect already clears any stale stored
      // id for a signed-out session — nothing further to do here.
      setIsRestoringActiveConversation(false)
      return
    }

    const storedConversationId = getStoredConversationId()
    if (!storedConversationId) {
      setIsRestoringActiveConversation(false)
      return
    }

    conversationHistory.openConversation(storedConversationId).then((restoredMessages) => {
      // A null result means the id was invalid/deleted/foreign — openConversation
      // has already cleared it from storage; assistantMessages simply stays
      // at its initial [], i.e. a safe, fresh Assistant.
      if (restoredMessages) {
        setAssistantMessages(restoredMessages)
      }
      setIsRestoringActiveConversation(false)
    })
  }, [authLoading, user, conversationHistory])

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

  const handleOpenDetector = useCallback(
  (detectorKey, file, message, mode) => {

    // ==========================================================
    // SCREENSHOT SCAN
    // ==========================================================

    if (detectorKey === 'screenshot' && file) {
      setDetectorHandoff({
        detector: 'screenshot',
        file,
        source: 'assistant',
        mode: 'screenshot',
      })
    }

    // ==========================================================
    // MESSAGE SCAN - OCR IMAGE
    // ==========================================================

    if (
      detectorKey === 'message' &&
      file &&
      mode === 'ocr'
    ) {
      setDetectorHandoff({
        detector: 'message',
        file,
        source: 'assistant',
        mode: 'ocr',
      })
    }

    // ==========================================================
    // MESSAGE SCAN - BATCH EXCEL
    // ==========================================================

    else if (
      detectorKey === 'message' &&
      file &&
      mode === 'batch'
    ) {
      setDetectorHandoff({
        detector: 'message',
        file,
        source: 'assistant',
        mode: 'batch',
      })
    }

    // ==========================================================
    // MESSAGE SCAN - NORMAL TEXT
    // ==========================================================

    else if (
      detectorKey === 'message' &&
      message
    ) {
      setDetectorHandoff({
        detector: 'message',
        message,
        source: 'assistant',
        mode: 'single',
      })
    }

    setActivePage(detectorKey)
  },
  []
)

  const handleHandoffConsumed = useCallback(() => {
    setDetectorHandoff(null)
  }, [])

  const handleClearAssistantChat = useCallback(() => {
    setAssistantMessages([])
    conversationHistory.startNewChat()
  }, [conversationHistory])

  // Sidebar's own "+ New Chat" shortcut: unlike Settings' Clear Chat, this
  // also has to make the Assistant page active, since it's reachable from
  // any page.
  const handleSidebarNewChat = useCallback(() => {
    setActivePage('assistant')
    setAssistantMessages([])
    conversationHistory.startNewChat()
  }, [conversationHistory])

  const handleOpenConversation = useCallback(
    // `title` is only passed by Chat History (its rows already have it) —
    // the sidebar's own list doesn't need to, since that conversation is
    // already cached there. See useConversationHistory's openConversation.
    async (conversationId, title) => {
      setActivePage('assistant')
      // Clear immediately so the previous conversation's transcript (or the
      // "new chat" welcome state) never flashes while the real one loads.
      setAssistantMessages([])
      const restoredMessages = await conversationHistory.openConversation(conversationId, title)
      if (restoredMessages) {
        setAssistantMessages(restoredMessages)
      }
    },
    [conversationHistory]
  )

  const handleDeleteConversation = useCallback(
    async (conversationId) => {
      const result = await conversationHistory.removeConversation(conversationId)
      if (result?.wasActive) {
        setAssistantMessages([])
      }
    },
    [conversationHistory]
  )

  const handleResetSettings = useCallback(() => {
    setTheme('system')
    setTypingAnimation(true)
    setGuidedSuggestions(true)
    setReducedMotion(false)
  }, [setTheme, setTypingAnimation, setGuidedSuggestions, setReducedMotion])

  const screenshotHandoffFile =
    detectorHandoff?.detector === 'screenshot' ? detectorHandoff.file : null
  
  const messageHandoffText =
  detectorHandoff?.detector === 'message' ? detectorHandoff.message : null

  const messageHandoffFile =
  detectorHandoff?.detector === 'message' && detectorHandoff?.mode === 'batch' ? detectorHandoff.file : null

  const messageHandoffImage = detectorHandoff?.detector === 'message' && detectorHandoff?.mode === 'ocr' ? detectorHandoff.file : null

  const assistantHistory = {
    isSignedIn: !!user,
    conversations: conversationHistory.conversations,
    isLoading: conversationHistory.isLoadingConversations,
    // A saved chat should only ever look selected while AI Assistant is the
    // active page — otherwise it visually competes with whichever detector
    // page is actually open. This does NOT clear the underlying
    // activeConversationId (still owned by conversationHistory, untouched by
    // navigation), so the same chat re-highlights on returning to Assistant.
    activeConversationId:
      activePage === 'assistant' ? conversationHistory.activeConversationId : null,
    error: conversationHistory.historyError,
    onNewChat: handleSidebarNewChat,
    onOpenConversation: handleOpenConversation,
    onDeleteConversation: handleDeleteConversation,
  }

  return (
    <AppShell
      activePage={activePage}
      onNavigate={setActivePage}
      assistantHistory={assistantHistory}
    >
      {activePage === 'assistant' && (
        <AssistantPage
          messages={assistantMessages}
          onMessagesChange={setAssistantMessages}
          onOpenDetector={handleOpenDetector}
          onPersistMessage={conversationHistory.recordMessage}
          onConversationReset={conversationHistory.startNewChat}
          isLoadingHistory={conversationHistory.isLoadingMessages || isRestoringActiveConversation}
          persistError={conversationHistory.persistError}
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
      {activePage === 'message' && (
        <MessageScanPage
          initialMessage={messageHandoffText}
          initialFile={messageHandoffFile}
          initialImage={messageHandoffImage}
          handoffMode={detectorHandoff?.mode}
          onInitialMessageConsumed={handleHandoffConsumed}
          onInitialFileConsumed={handleHandoffConsumed}
          onInitialImageConsumed={handleHandoffConsumed}
        />
      )}
      {activePage === 'url' && <URLScanPage />}
      {activePage === 'transaction' && (
        <TransactionScanPage
          initialFile={transactionHandoffFile}
          onInitialFileConsumed={handleHandoffConsumed}
        />
      )}
      {activePage === 'about' && <AboutPage />}
      {activePage === 'history' && (
        <ChatHistoryPage
          user={user}
          onOpenConversation={handleOpenConversation}
          onDeleteConversation={handleDeleteConversation}
          onNewChat={handleSidebarNewChat}
        />
      )}
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
