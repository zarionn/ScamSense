import { useCallback, useState } from 'react'
import { RefreshCw } from 'lucide-react'

import PageHeader from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import AssistantWelcome from './components/AssistantWelcome'
import ChatMessage from './components/ChatMessage'
import ChatComposer from './components/ChatComposer'
import TypingIndicator from './components/TypingIndicator'

import {
  IMAGE_ATTACHED_REPLY,
  TRANSACTION_ATTACHED_REPLY,
  STEPS,
  WELCOME_STEP_ID,
} from './assistant-flow'


// ==========================================================
// GEMINI FALLBACK
// ==========================================================

const GEMINI_FAILURE_FALLBACK =
  "I'm having trouble generating a response right now, but I can still guide you using the options below."


// ==========================================================
// REQUEST ASSISTANT RESPONSE
// ==========================================================

async function requestAssistantReply(
  message,
  awaitingAdvisoryTopic = false
) {

  const response = await fetch(
    '/api/assistant/message',
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        message,

        context: {
          awaiting_advisory_topic:
            awaitingAdvisoryTopic,
        },
      }),
    }
  )


  const data =
    await response
      .json()
      .catch(() => null)


  if (
    !response.ok ||
    !data
  ) {

    throw new Error(
      data?.error ||
      'Assistant request failed'
    )

  }


  return data
}

// ==========================================================
// EXTRACT ACTUAL MESSAGE FOR MESSAGE SCAN
// ==========================================================
//
// Removes the user's instruction before the colon.
//
// Examples:
//
// "Can you analyse this message:
// Dear Applicant, You have been selected..."
//
// → "Dear Applicant, You have been selected..."
//
// "Can you check if my message is scam:
// Dear Applicant, You have been selected..."
//
// → "Dear Applicant, You have been selected..."
//
// "Check this message:
// Dear Customer, ..."
//
// → "Dear Customer, ..."
//
// "Is this a scam:
// Your account has been suspended..."
//
// → "Your account has been suspended..."
//
// ==========================================================

function extractMessageForHandoff(text) {

    if (!text?.trim()) {
        return "";
    }

    // Keep original text unchanged
    const cleaned = text.trim();

    // Lowercase copy only for detecting the instruction
    const normalized = cleaned.toLowerCase();


    // ======================================================
    // Find the first colon
    // ======================================================

    const colonIndex =
        normalized.indexOf(":");


    // Check If there is no colon, then the function simply returns the entire input:
    if (colonIndex === -1) {
        return cleaned;
    }


    // ======================================================
    // Get everything before the first colon
    // ======================================================

    const prefix =
        normalized
            .slice(0, colonIndex)
            .trim();


    // ======================================================
    // Recognise common message-scan questions
    // ======================================================

    const isMessageQuestion =
        prefix.includes("is this message scam") ||
        prefix.includes("is this a message scam") ||
        prefix.includes("is this scam") ||
        prefix.includes("is this a scam") ||

        prefix.includes("check if my message is scam") ||
        prefix.includes("check if my message is a scam") ||

        prefix.includes("check this message") ||
        prefix.includes("scan this message") ||

        prefix.includes("analyse this message") ||
        prefix.includes("analyze this message") ||

        prefix.startsWith("message") ||
        prefix.startsWith("sms") ||
        prefix.startsWith("whatsapp") ||
        prefix.startsWith("email");


    // ======================================================
    // Remove the instruction before the colon
    // ======================================================

    if (isMessageQuestion) {

        return cleaned
            .slice(colonIndex + 1)
            .trim();

    }


    // ======================================================
    // Otherwise, treat the entire input as the message
    // ======================================================

    return cleaned;
}


// ==========================================================
// ASSISTANT PAGE
// ==========================================================

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

  // ========================================================
  // LOCAL STATE
  // ========================================================

  const [
    expectedDetector,
    setExpectedDetector
  ] = useState(null)


  const [
    isDeterministicTyping,
    setIsDeterministicTyping
  ] = useState(false)


  const [
    isGeminiTyping,
    setIsGeminiTyping
  ] = useState(false)


  // True when the deterministic guided flow has asked the
  // user to paste a suspicious message.
  const [
    awaitingMessageInput,
    setAwaitingMessageInput
  ] = useState(false)


  // ========================================================
  // PUSH MESSAGE
  // ========================================================

  const pushMessage = useCallback(
    (partial) => {

      // Persistence-only properties are removed before the
      // message is rendered.

      const {
        persist = true,

        persistText,

        persistAdvisorySearch,

        ...rest

      } = partial


      const id =
        crypto.randomUUID()


      onMessagesChange(
        (prev) => [
          ...prev,

          {
            id,
            ...rest,
          },
        ]
      )


      const textToPersist =
        persistText ??
        rest.text


      if (
        persist &&
        textToPersist
      ) {

        onPersistMessage?.(
          rest.role,
          textToPersist,
          persistAdvisorySearch
        )

      }

    },

    [
      onMessagesChange,
      onPersistMessage,
    ]
  )


  // ========================================================
  // QUICK REPLY HANDLER
  // ========================================================

  const handleQuickReply =
    useCallback(
      (reply) => {

        // ----------------------------------------------
        // Add user's selected reply
        // ----------------------------------------------

        pushMessage({

          role: "user",

          text: reply.label,

        })


        // ----------------------------------------------
        // Find next deterministic step
        // ----------------------------------------------

        const nextStep =
          STEPS[reply.next]


        if (!nextStep) {
          return
        }


        // ----------------------------------------------
        // Typing helper
        // ----------------------------------------------

        const showTyping =
          (
            delayMs,
            apply
          ) => {

            if (!typingAnimation) {

              apply()

              return

            }


            setIsDeterministicTyping(
              true
            )


            window.setTimeout(
              () => {

                setIsDeterministicTyping(
                  false
                )

                apply()

              },
              delayMs
            )

          }


        // ----------------------------------------------
        // Display next step
        // ----------------------------------------------

        showTyping(
          450,
          () => {

            // ------------------------------------------
            // If this step expects the user to paste
            // a suspicious message, remember it.
            // ------------------------------------------

            if (
              nextStep.expectsMessage
            ) {

              setAwaitingMessageInput(
                true
              )

            } else {

              setAwaitingMessageInput(
                false
              )

            }


            pushMessage({

              role: "assistant",

              text:
                nextStep.assistant,

              quickReplies:
                nextStep.quickReplies,

              suggestions:
                nextStep.suggestions,

            })

          }
        )

      },

      [
        pushMessage,
        typingAnimation,
      ]
    )


  // ========================================================
  // SEND MESSAGE
  // ========================================================

  const handleSend =
    useCallback(
      async ({
        text,
        attachment,
      }) => {

        // ==================================================
        // ADVISORY CONTEXT
        // ==================================================

        const previousMessage =
          messages[
            messages.length - 1
          ]


        const awaitingAdvisoryTopic =
          previousMessage?.role === 'assistant' &&
          previousMessage.advisorySearch?.status ===
            'needs_clarification'


        // ==================================================
        // ADD USER MESSAGE TO CHAT
        // ==================================================

        pushMessage({

          role: 'user',

          text:
            text || undefined,

          attachment:
            attachment || undefined,

        })


        // ==================================================
        // ATTACHMENT FLOW
        // ==================================================

        if (attachment) {

          const forcedDetector =
            expectedDetector


          setExpectedDetector(
            null
          )


          // ================================================
          // TRANSACTION FORCED ATTACHMENT
          // ================================================

          if (
            forcedDetector === 'transaction'
          ) {

            const apply =
              () => {

                pushMessage({

                  role: 'assistant',

                  text:
                    TRANSACTION_ATTACHED_REPLY,

                  suggestions:
                    ['transaction'],

                  handoffFile:
                    attachment.file,

                })

              }


            if (!typingAnimation) {

              apply()

              return

            }


            setIsDeterministicTyping(
              true
            )


            window.setTimeout(
              () => {

                setIsDeterministicTyping(
                  false
                )

                apply()

              },
              450
            )


            return
          }


          // ================================================
          // SCREENSHOT FORCED ATTACHMENT
          // ================================================

          if (
            forcedDetector === 'screenshot'
          ) {

            const apply =
              () => {

                pushMessage({

                  role: 'assistant',

                  text:
                    IMAGE_ATTACHED_REPLY,

                  suggestions:
                    [
                      'screenshot',
                      'message',
                    ],

                  handoffFile:
                    attachment.file,

                  handoffMode:
                    'ocr',

                })

              }


            if (!typingAnimation) {

              apply()

              return

            }


            setIsDeterministicTyping(
              true
            )


            window.setTimeout(
              () => {

                setIsDeterministicTyping(
                  false
                )

                apply()

              },
              450
            )


            return
          }


          // ================================================
          // IMAGE ATTACHMENT
          // ================================================

          if (
            attachment.type === 'image'
          ) {

            const isTransaction =
              attachment.kind === 'transaction'


            const apply =
              () => {

                pushMessage({

                  role: 'assistant',

                  text:
                    isTransaction
                      ? TRANSACTION_ATTACHED_REPLY
                      : IMAGE_ATTACHED_REPLY,

                  suggestions:
                    [
                      isTransaction
                        ? 'transaction'
                        : 'screenshot',

                      'message',
                    ],

                  handoffFile:
                    attachment.file,

                  handoffMode:
                    'ocr',

                })

              }


            if (!typingAnimation) {

              apply()

              return

            }


            setIsDeterministicTyping(
              true
            )


            window.setTimeout(
              () => {

                setIsDeterministicTyping(
                  false
                )

                apply()

              },
              450
            )


            return
          }


          // ================================================
          // TRANSACTION FILE
          // ================================================

          if (
            attachment.type === 'transaction'
          ) {

            const apply =
              () => {

                pushMessage({

                  role: 'assistant',

                  text:
                    TRANSACTION_ATTACHED_REPLY,

                  suggestions:
                    ['transaction'],

                  handoffFile:
                    attachment.file,

                })

              }


            if (!typingAnimation) {

              apply()

              return

            }


            setIsDeterministicTyping(
              true
            )


            window.setTimeout(
              () => {

                setIsDeterministicTyping(
                  false
                )

                apply()

              },
              450
            )


            return
          }


          // ================================================
          // EXCEL / CSV
          // ================================================

          if (
            attachment.type === 'excel'
          ) {

            const apply =
              () => {

                pushMessage({

                  role: 'assistant',

                  text:
                    "I've got your Excel dataset. I can prepare it for Batch Message Analysis.",

                  suggestions:
                    ['message'],

                  handoffFile:
                    attachment.file,

                  handoffMode:
                    'batch',

                })

              }


            if (!typingAnimation) {

              apply()

              return

            }


            setIsDeterministicTyping(
              true
            )


            window.setTimeout(
              () => {

                setIsDeterministicTyping(
                  false
                )

                apply()

              },
              450
            )


            return
          }

        }


        // ==================================================
        // NO TEXT
        // ==================================================

        if (
          !text?.trim()
        ) {

          return

        }


        const userText =
          text.trim()


        // ==================================================
        // DETERMINE MESSAGE FOR HANDOFF
        // ==================================================
        //
        // CASE 1:
        //
        // Guided flow:
        //
        // Suspicious Message
        //       ↓
        // Yes / No
        //       ↓
        // Paste message
        //
        // In this case, the entire user input is the
        // suspicious message.
        //
        //
        // CASE 2:
        //
        // Direct free-text:
        //
        // "Can you analyse this message:
        //  Dear Applicant..."
        //
        // Extract only the actual suspicious message.
        //
        // ==================================================

        const messageForHandoff =
    extractMessageForHandoff(userText)


        // ==================================================
        // USER HAS NOW PROVIDED MESSAGE
        // ==================================================

        if (
          awaitingMessageInput
        ) {

          setAwaitingMessageInput(
            false
          )

        }


        // ==================================================
        // GEMINI ANALYSIS
        // ==================================================

        setIsGeminiTyping(
          true
        )


        try {

          const data =
            await requestAssistantReply(
              userText,
              awaitingAdvisoryTopic
            )


          // =================================================
          // ADVISORY RESPONSE
          // =================================================

          const advisorySearch =
  data?.advisory_search


const hasAdvisoryCards =
  advisorySearch?.status === 'matches' &&
  Array.isArray(advisorySearch?.advisories) &&
  advisorySearch.advisories.length > 0


const isClarification =
  advisorySearch?.status === 'needs_clarification'


// IMPORTANT:
// Do NOT use Boolean(advisorySearch).
//
// An empty object {} is truthy in JavaScript.
//
// Only treat the response as an advisory flow when
// it actually contains advisory results or clarification.

const isAdvisoryResponse =
  hasAdvisoryCards ||
  isClarification


const structuredSearch =
  isAdvisoryResponse
    ? advisorySearch
    : undefined


          // =================================================
          // NORMAL RESPONSE + DETECTOR REDIRECT
          // =================================================
          //
          // Normal free-text:
          //
          // User
          //   ↓
          // Gemini general answer
          //   ↓
          // Message Scan card
          //   ↓
          // Open
          //   ↓
          // Message Scan with auto-filled message
          //
          // Advisory response:
          //
          // User
          //   ↓
          // Advisory response
          //
          // No Message Scan card is shown for advisory
          // conversations.
          //
          // =================================================

          pushMessage({

            role: 'assistant',

            // ---------------------------------------------
            // Response text
            // ---------------------------------------------

            text:
              hasAdvisoryCards
                ? advisorySearch.message
                : data?.reply ||
                  "I can help you assess that. You can use Message Scan for a more detailed analysis.",


            // ---------------------------------------------
            // Advisory information
            // ---------------------------------------------

            advisorySearch:
              structuredSearch,


            advisories:
              hasAdvisoryCards
                ? advisorySearch.advisories
                : undefined,


            // ---------------------------------------------
            // Persistence
            // ---------------------------------------------

            persistText:
              data?.reply ||
              undefined,


            persistAdvisorySearch:
              structuredSearch,


            isFallback:
              data?.source === 'fallback',


            // ---------------------------------------------
            // Detector suggestion
            // ---------------------------------------------

            suggestions:
            ['message'],

          handoffMessage:
            messageForHandoff,

          })

        } catch (error) {

          console.error(
            'Assistant request failed:',
            error
          )


          // =================================================
          // GEMINI FAILURE
          // =================================================

          pushMessage({

            role: 'assistant',

            text:
              GEMINI_FAILURE_FALLBACK,

            isFallback:
              true,

            persist:
              false,


            // Even if Gemini fails, allow the user to
            // continue to Message Scan when we have a
            // message to hand off.

            suggestions:
              messageForHandoff
                ? ['message']
                : [],


            handoffMessage:
              messageForHandoff,

          })

        } finally {

          setIsGeminiTyping(
            false
          )

        }

      },

      [
        messages,
        pushMessage,
        typingAnimation,
        expectedDetector,
        awaitingMessageInput,
      ]
    )


  // ========================================================
  // NEW CHAT
  // ========================================================

  const handleNewChat =
    useCallback(
      () => {

        onMessagesChange(
          []
        )


        setIsDeterministicTyping(
          false
        )


        setIsGeminiTyping(
          false
        )


        setExpectedDetector(
          null
        )


        setAwaitingMessageInput(
          false
        )


        onConversationReset?.()

      },

      [
        onMessagesChange,
        onConversationReset,
      ]
    )


  // ========================================================
  // UI STATE
  // ========================================================

  const isBusy =
    isDeterministicTyping ||
    isGeminiTyping


  const welcomeStep =
    STEPS[
      WELCOME_STEP_ID
    ]


  const showWelcome =
    messages.length === 0 &&
    !isLoadingHistory


  // ========================================================
  // RENDER
  // ========================================================

  return (

    <div className="flex flex-col">

      <PageHeader

        title="ScamSense Assistant"

        description=
          "Tell me what happened and I'll help you choose the right scam check."

        actions={

          <Button

            variant="outline"

            onClick={
              handleNewChat
            }

            className="
              border-new-scan-border
              text-accent-foreground
              hover:border-ring
              hover:bg-dropzone-surface
              hover:text-accent-foreground
              dark:border-input
              dark:text-foreground
              dark:hover:border-input
              dark:hover:bg-input/50
              dark:hover:text-foreground
            "

          >

            <RefreshCw
              aria-hidden="true"
            />

            New Chat

          </Button>

        }

      />


      <div
        className="
          mx-auto
          flex
          h-[min(72vh,680px)]
          w-full
          max-w-[820px]
          flex-col
          overflow-hidden
          rounded-xl
          border
          border-border
          bg-card
        "
      >

        {/* ==================================================
            CHAT CONTENT
        ================================================== */}

        <div
          className="
            flex-1
            overflow-y-auto
            px-4
            py-5
            sm:px-6
          "
        >

          {/* =================================================
              LOADING HISTORY
          ================================================= */}

          {isLoadingHistory ? (

            <div
              className="
                flex
                flex-col
                gap-3
              "
            >

              <Skeleton
                className="h-4 w-2/3"
              />

              <Skeleton
                className="h-4 w-1/2"
              />

              <Skeleton
                className="h-4 w-3/4"
              />

            </div>

          ) : showWelcome ? (

            /* ===============================================
               WELCOME
            =============================================== */

            <AssistantWelcome

              message={
                welcomeStep.assistant
              }

              quickReplies={
                guidedSuggestions
                  ? welcomeStep.quickReplies
                  : null
              }

              onSelectQuickReply={
                handleQuickReply
              }

            />

          ) : (

            /* ===============================================
               MESSAGES
            =============================================== */

            <div
              className="
                flex
                flex-col
                gap-4
              "
            >

              {messages.map(
                (
                  message,
                  index
                ) => (

                  <ChatMessage

                    key={
                      message.id
                    }

                    message={

                      guidedSuggestions

                        ? message

                        : {
                            ...message,
                            quickReplies:
                              undefined,
                          }

                    }

                    isLast={
                      index ===
                      messages.length - 1
                    }

                    onSelectQuickReply={
                      handleQuickReply
                    }

                    onOpenDetector={
                      onOpenDetector
                    }

                  />

                )
              )}


              {/* ============================================
                  TYPING INDICATOR
              ============================================ */}

              {isBusy && (
                <TypingIndicator />
              )}

            </div>

          )}

        </div>


        {/* ==================================================
            COMPOSER
        ================================================== */}

        <div
          className="
            border-t
            border-border
            p-3
            sm:p-4
          "
        >

          {persistError && (

            <p
              className="
                pb-2
                text-xs
                text-muted-foreground
              "
            >
              {persistError}
            </p>

          )}


          <ChatComposer

            onSend={
              handleSend
            }

            disabled={
              isBusy
            }

          />

        </div>

      </div>

    </div>

  )
}