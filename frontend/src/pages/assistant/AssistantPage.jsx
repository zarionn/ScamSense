import { useCallback, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import AssistantWelcome from './components/AssistantWelcome'
import ChatMessage from './components/ChatMessage'
import ChatComposer from './components/ChatComposer'
import TypingIndicator from './components/TypingIndicator'
import { IMAGE_ATTACHED_REPLY, TRANSACTION_ATTACHED_REPLY, STEPS, WELCOME_STEP_ID } from './assistant-flow'



const GEMINI_FAILURE_FALLBACK =
  "I'm having trouble generating a response right now, but I can still guide you using the options below."

async function requestAssistantReply(message, awaitingAdvisoryTopic = false) {
  const response = await fetch('/api/assistant/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      context: { awaiting_advisory_topic: awaitingAdvisoryTopic },
    }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) {
    throw new Error(data?.error || 'Assistant request failed')
  }
  return data
}

// messages/onMessagesChange: lifted to App.jsx (controlled) so Settings'
// "Clear Chat" can reset the same conversation, and so it survives navigating
// away and back rather than reappearing as a fresh welcome every visit.
// onOpenDetector: (detectorKey, file?) => void — App.jsx handles navigation + handoff.
// typingAnimation/guidedSuggestions: Settings-controlled presentation prefs only.
// onPersistMessage: (role, text, advisorySearch?) => void — App.jsx's
// conversation-history hook.
// A no-op for guests; it decides itself whether/how to save. Called once per
// pushMessage with meaningful text, never from a broad effect over `messages`.
// onConversationReset: () => void — clears the active saved-conversation id
// (App.jsx's conversation-history hook) so New Chat doesn't keep appending to
// the previous conversation once one exists.
// isLoadingHistory/persistError: presentation-only state surfaced by that hook.
export default function AssistantPage({
  messages,
  onMessagesChange,
  onOpenDetector,
  onPersistMessage,
  onConversationReset,
  isLoadingHistory = false,
  persistError = null,
  typingAnimation = true,
  guidedSuggestions = true,
}) {
  const [expectedDetector, setExpectedDetector] = useState(null)
  const [isDeterministicTyping, setIsDeterministicTyping] = useState(false)
  const [isGeminiTyping, setIsGeminiTyping] = useState(false)

  const pushMessage = useCallback(
    (partial) => {
      // Persistence controls are internal bookkeeping only (e.g. the network-
      // failure fallback below opts out) — stripped before the rendered message.
      // The hook receives the readable text plus validated advisory structure.
      const { persist = true, persistText, persistAdvisorySearch, ...rest } = partial
      const id = crypto.randomUUID()
      onMessagesChange((prev) => [...prev, { id, ...rest }])
      const textToPersist = persistText ?? rest.text
      if (persist && textToPersist) {
        onPersistMessage?.(rest.role, textToPersist, persistAdvisorySearch)
      }
    },
    [onMessagesChange, onPersistMessage]
  )

  const handleQuickReply = useCallback(
    (reply) => {
      pushMessage({ role: 'user', text: reply.label })
      const nextStep = STEPS[reply.next]
      setExpectedDetector(nextStep.expectsAttachment ?? null)
      const showTyping = (delayMs, apply) => {
        if (!typingAnimation) {
          apply()
          return
        }
        setIsDeterministicTyping(true)
        window.setTimeout(() => {
          setIsDeterministicTyping(false)
          apply()
        }, delayMs)
      }
      // A short frontend delay is acceptable for a deterministic reply — this
      // never calls Gemini, it just looks up the next step in assistant-flow.js.
      // Skipped entirely when "Show typing animation" is off.
      showTyping(450, () => {
        pushMessage({
          role: 'assistant',
          text: nextStep.assistant,
          quickReplies: nextStep.quickReplies,
          suggestions: nextStep.suggestions,
        })
      })
    },
    [pushMessage, typingAnimation]
  )

  // Fires for both text-only sends (existing Gemini free-text path) and
  // image-attachment sends. An attachment ALWAYS short-circuits to a
  // deterministic reply — even if the user typed something alongside it —
  // so the Assistant can never appear to have inspected the screenshot.
  const handleSend = useCallback(
    async ({ text, attachment }) => {
      // Derived from the transcript, never from React-only state: `messages`
      // is rehydrated from saved history, so a pending clarification survives
      // a refresh and a reopened conversation. Read before this turn's own
      // message is appended, and superseded by whatever reply follows — which
      // is what makes it a single-turn state.
      const previousMessage = messages[messages.length - 1]
      const awaitingAdvisoryTopic =
        previousMessage?.role === 'assistant' &&
        previousMessage.advisorySearch?.status === 'needs_clarification'

      pushMessage({
        role: 'user',
        text: text || undefined,
        attachment: attachment || undefined,
      })

      if (attachment) {
        const forcedDetector = expectedDetector
        setExpectedDetector(null)
        // ==========================================================
        // SCREENSHOT ATTACHMENT
        // ==========================================================

        if (forcedDetector === 'transaction') {
          const apply = () => {
            pushMessage({
              role: 'assistant',
              text: TRANSACTION_ATTACHED_REPLY,
              suggestions: ['transaction'],
              handoffFile: attachment.file,
            })
          }
          if (!typingAnimation) { apply(); return }
          setIsDeterministicTyping(true)
          window.setTimeout(() => { setIsDeterministicTyping(false); apply() }, 450)
          return
        }

        if (forcedDetector === 'screenshot') {
          const apply = () => {
            pushMessage({
              role: 'assistant',
              text: IMAGE_ATTACHED_REPLY,
              suggestions: ['screenshot', 'message'],
              handoffFile: attachment.file,
              handoffMode: 'ocr',
            })
          }
          if (!typingAnimation) { apply(); return }
          setIsDeterministicTyping(true)
          window.setTimeout(() => { setIsDeterministicTyping(false); apply() }, 450)
          return
        }

        if (attachment.type === 'image') {
          const isTransaction = attachment.kind === 'transaction'

          const apply = () => {
            pushMessage({
              role: 'assistant',
              text: isTransaction ? TRANSACTION_ATTACHED_REPLY : IMAGE_ATTACHED_REPLY,
              suggestions: [isTransaction ? 'transaction' : 'screenshot', 'message'],
              handoffFile: attachment.file,
              handoffMode: 'ocr',
            })
          }

          if (!typingAnimation) {
            apply()
            return
          }

          setIsDeterministicTyping(true)

          window.setTimeout(() => {
            setIsDeterministicTyping(false)
            apply()
          }, 450)

          return
        }
        //Transaction csv attachment
        if (attachment.type === 'transaction') {
          const apply = () => {
            pushMessage({
              role: 'assistant',
              text: TRANSACTION_ATTACHED_REPLY,
              suggestions: ['transaction'],
              handoffFile: attachment.file,
            })
          }
          if (!typingAnimation) { apply(); return }
          setIsDeterministicTyping(true)
          window.setTimeout(() => { setIsDeterministicTyping(false); apply() }, 450)
          return
        }
        // ==========================================================
        // EXCEL / CSV ATTACHMENT
        // ==========================================================

        if (attachment.type === 'excel') {
          const apply = () => {
            pushMessage({
              role: 'assistant',
              text:
                "I've got your Excel dataset. I can prepare it for Batch Message Analysis.",
              suggestions: ['message'],
              handoffFile: attachment.file,
              handoffMode: 'batch',
            })
          }

          if (!typingAnimation) {
            apply()
            return
          }

          setIsDeterministicTyping(true)

          window.setTimeout(() => {
            setIsDeterministicTyping(false)
            apply()
          }, 450)

          return
        }
      }

      if (!text) return

      setIsGeminiTyping(true)
      try {
        const data = await requestAssistantReply(text, awaitingAdvisoryTopic)

        const advisorySearch = data.advisory_search
        const hasAdvisoryCards =
          advisorySearch?.status === 'matches' &&
          advisorySearch.advisories?.length > 0

        const isClarification =
          advisorySearch?.status === 'needs_clarification'

        const isAdvisoryResponse = Boolean(advisorySearch)

        const structuredSearch =
          hasAdvisoryCards || isClarification
            ? advisorySearch
            : undefined

        pushMessage({
          role: 'assistant',
          text: hasAdvisoryCards ? advisorySearch.message : data.reply,
          advisorySearch: structuredSearch,
          advisories: hasAdvisoryCards
            ? advisorySearch.advisories
            : undefined,
          persistText: data.reply,
          persistAdvisorySearch: structuredSearch,
          isFallback: data.source === 'fallback',
          suggestions: isAdvisoryResponse ? undefined : ['message'],
          handoffMessage: isAdvisoryResponse ? undefined : text,
        })
      } catch {
        // Transient client-side error notice, not real Assistant content —
        // deliberately excluded from persistence (unlike Flask's own
        // `source: "fallback"` replies, which are real generated text).
        pushMessage({
          role: 'assistant',
          text: GEMINI_FAILURE_FALLBACK,
          isFallback: true,
          persist: false,
        })
      } finally {
        setIsGeminiTyping(false)
      }
    },
    [messages, pushMessage, typingAnimation]
  )

  const handleNewChat = useCallback(() => {
    // Same reset App.jsx's Settings "Clear Chat" uses — local Assistant state
    // only, does not touch Screenshot Scan state, does not call the backend.
    onMessagesChange([])
    setIsDeterministicTyping(false)
    setIsGeminiTyping(false)
    setExpectedDetector(null)
    // Signed-in only in practice (a no-op for guests) — clears the active
    // saved-conversation id without creating or deleting anything, so the
    // *next* message starts a new conversation instead of appending to the
    // one that was just left.
    onConversationReset?.()
  }, [onMessagesChange, onConversationReset])

  const isBusy = isDeterministicTyping || isGeminiTyping
  const welcomeStep = STEPS[WELCOME_STEP_ID]
  const showWelcome = messages.length === 0 && !isLoadingHistory

  return (
    <div className="flex flex-col">
      <PageHeader
        title="ScamSense Assistant"
        description="Tell me what happened and I'll help you choose the right scam check."
        actions={
          <Button
            variant="outline"
            onClick={handleNewChat}
            className="border-new-scan-border text-accent-foreground hover:border-ring hover:bg-dropzone-surface hover:text-accent-foreground dark:border-input dark:text-foreground dark:hover:border-input dark:hover:bg-input/50 dark:hover:text-foreground"
          >
            <RefreshCw aria-hidden="true" />
            New Chat
          </Button>
        }
      />

      <div className="mx-auto flex h-[min(72vh,680px)] w-full max-w-[820px] flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {isLoadingHistory ? (
            // Small, deliberately non-empty placeholder while a saved
            // conversation's messages are fetched — avoids a flash of the
            // "new chat" welcome state or the previous conversation's
            // transcript while the real one is still loading.
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : showWelcome ? (
            <AssistantWelcome
              message={welcomeStep.assistant}
              quickReplies={guidedSuggestions ? welcomeStep.quickReplies : null}
              onSelectQuickReply={handleQuickReply}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={
                    guidedSuggestions ? message : { ...message, quickReplies: undefined }
                  }
                  isLast={index === messages.length - 1}
                  onSelectQuickReply={handleQuickReply}
                  onOpenDetector={onOpenDetector}
                />
              ))}
              {isBusy && <TypingIndicator />}
            </div>
          )}
        </div>

        <div className="border-t border-border p-3 sm:p-4">
          {persistError && (
            <p className="pb-2 text-xs text-muted-foreground">{persistError}</p>
          )}
          <ChatComposer onSend={handleSend} disabled={isBusy} />
        </div>
      </div>
    </div>
  )
}
