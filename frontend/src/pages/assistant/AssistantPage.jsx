import { useCallback, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import AssistantWelcome from './components/AssistantWelcome'
import ChatMessage from './components/ChatMessage'
import ChatComposer from './components/ChatComposer'
import TypingIndicator from './components/TypingIndicator'
import { IMAGE_ATTACHED_REPLY, STEPS, WELCOME_STEP_ID } from './assistant-flow'

const GEMINI_FAILURE_FALLBACK =
  "I'm having trouble generating a response right now, but I can still guide you using the options below."

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
export default function AssistantPage({
  messages,
  onMessagesChange,
  onOpenDetector,
  typingAnimation = true,
  guidedSuggestions = true,
}) {
  const [isDeterministicTyping, setIsDeterministicTyping] = useState(false)
  const [isGeminiTyping, setIsGeminiTyping] = useState(false)

  const pushMessage = useCallback(
    (partial) => {
      const id = crypto.randomUUID()
      onMessagesChange((prev) => [...prev, { id, ...partial }])
    },
    [onMessagesChange]
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

  // Fires for both text-only sends (existing Gemini free-text path) and
  // image-attachment sends. An attachment ALWAYS short-circuits to a
  // deterministic reply — even if the user typed something alongside it —
  // so the Assistant can never appear to have inspected the screenshot.
  const handleSend = useCallback(
    async ({ text, attachment }) => {
      pushMessage({
        role: 'user',
        text: text || undefined,
        attachment: attachment || undefined,
      })

      if (attachment) {
        const apply = () => {
          pushMessage({
            role: 'assistant',
            text: IMAGE_ATTACHED_REPLY,
            suggestions: ['screenshot'],
            handoffFile: attachment.file,
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
        pushMessage({ role: 'assistant', text: GEMINI_FAILURE_FALLBACK, isFallback: true })
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
  }, [onMessagesChange])

  const isBusy = isDeterministicTyping || isGeminiTyping
  const welcomeStep = STEPS[WELCOME_STEP_ID]
  const showWelcome = messages.length === 0

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
          {showWelcome ? (
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
          <ChatComposer onSend={handleSend} disabled={isBusy} />
        </div>
      </div>
    </div>
  )
}
