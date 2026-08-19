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
import { MAX_URL_SCANS, resolveDetectorItems, runDetectorItems } from './detector-routing'

const GEMINI_FAILURE_FALLBACK =
  "I'm having trouble generating a response right now, but I can still guide you using the options below."

const DETECTOR_RESULTS_INTRO = "Here's what the ScamSense detectors found."

const URL_LIMIT_NOTE = ` Only the first ${MAX_URL_SCANS} links were checked.`

async function requestAssistantReply(message) {
  const response = await fetch('/api/assistant/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, context: {} }),
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
// onPersistMessage: (role, text) => void — App.jsx's conversation-history hook.
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
  onOpenDetectorResult,
  onPersistMessage,
  onConversationReset,
  isLoadingHistory = false,
  persistError = null,
  typingAnimation = true,
  guidedSuggestions = true,
}) {
  const [isDeterministicTyping, setIsDeterministicTyping] = useState(false)
  const [isGeminiTyping, setIsGeminiTyping] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)

  const pushMessage = useCallback(
    (partial) => {
      // `persist` is internal bookkeeping only (e.g. the network-failure
      // fallback below opts out) — stripped before it reaches the rendered
      // message or, further downstream, the database.
      const { persist = true, ...rest } = partial
      const id = crypto.randomUUID()
      onMessagesChange((prev) => [...prev, { id, ...rest }])
      if (persist && rest.text) {
        onPersistMessage?.(rest.role, rest.text)
      }
    },
    [onMessagesChange, onPersistMessage]
  )

  const handleQuickReply = useCallback(
    (reply) => {
      pushMessage({ role: 'user', text: reply.label })
      const nextStep = STEPS[reply.next]
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

  // Routes one send: attachments and links reach their detectors deterministically,
  // free text reaches Message Scan only when the backend intent classifier is
  // confident, and anything else stays an ordinary chatbot turn.
  const handleSend = useCallback(
    async ({ text, attachment }) => {
      pushMessage({
        role: 'user',
        text: text || undefined,
        attachment: attachment || undefined,
      })

      // Batch spreadsheets keep their existing Message Scan handoff — that
      // workflow is driven from the detector page, not by an automatic scan.
      if (attachment?.type === 'excel') {
        const apply = () => {
          pushMessage({
            role: 'assistant',
            text: "I've got your Excel dataset. I can prepare it for Batch Message Analysis.",
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

      setIsDetecting(true)
      let detectorResults = null
      let urlLimitApplied = false
      try {
        const routed = await resolveDetectorItems({ text, attachment })
        urlLimitApplied = routed.urlLimitApplied
        if (routed.items.length > 0) {
          detectorResults = await runDetectorItems(routed.items)
        }
      } catch {
        detectorResults = null
      } finally {
        setIsDetecting(false)
      }

      if (detectorResults) {
        pushMessage({
          role: 'assistant',
          text: DETECTOR_RESULTS_INTRO + (urlLimitApplied ? URL_LIMIT_NOTE : ''),
          detectorResults,
        })
        return
      }

      // An attachment whose detector is unavailable still gets the existing
      // deterministic hand-off reply rather than silently disappearing.
      if (attachment) {
        const isTransaction = attachment.type === 'transaction'
        const apply = () => {
          pushMessage({
            role: 'assistant',
            text: isTransaction ? TRANSACTION_ATTACHED_REPLY : IMAGE_ATTACHED_REPLY,
            suggestions: [isTransaction ? 'transaction' : 'screenshot', 'message'],
            handoffFile: attachment.file,
            handoffMode: isTransaction ? 'transaction' : 'ocr',
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

      if (!text) return

      setIsGeminiTyping(true)
      try {
        const data = await requestAssistantReply(text)
        pushMessage({
          role: 'assistant',
          text: data.reply,
          isFallback: data.source === 'fallback',
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
    [pushMessage, typingAnimation]
  )

  const handleNewChat = useCallback(() => {
    // Same reset App.jsx's Settings "Clear Chat" uses — local Assistant state
    // only, does not touch Screenshot Scan state, does not call the backend.
    onMessagesChange([])
    setIsDeterministicTyping(false)
    setIsGeminiTyping(false)
    setIsDetecting(false)
    // Signed-in only in practice (a no-op for guests) — clears the active
    // saved-conversation id without creating or deleting anything, so the
    // *next* message starts a new conversation instead of appending to the
    // one that was just left.
    onConversationReset?.()
  }, [onMessagesChange, onConversationReset])

  const isBusy = isDeterministicTyping || isGeminiTyping || isDetecting
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
                  onOpenDetectorResult={onOpenDetectorResult}
                />
              ))}
              {isBusy && (
                <TypingIndicator
                  label={isDetecting ? 'Checking with ScamSense detectors…' : undefined}
                />
              )}
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
