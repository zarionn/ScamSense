import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createConversation,
  deleteConversation as deleteConversationRow,
  deriveConversationTitle,
  getConversationMessages,
  getRecentConversations,
  saveMessage,
  touchConversation,
} from '@/services/conversation-service'
import {
  deserializeConversationMessage,
  serializeConversationMessage,
} from '@/services/conversation-message-codec'

// The sidebar only ever shows the most recently active conversations, not
// the full history (that's the dedicated Chat History page's job).
const SIDEBAR_LIMIT = 5

// sessionStorage (not localStorage): a refresh in the same tab should return
// to the same conversation, but a new browser session starting fresh is
// fine — and safer, since nothing here is tied to "remember across visits"
// the way auth persistence already is.
const ACTIVE_CONVERSATION_STORAGE_KEY = 'scamsense-active-conversation'

// Exported so App.jsx can check, once auth resolves, whether there's
// anything worth attempting to restore — without duplicating where this key
// lives or how it's read.
export function getStoredConversationId() {
  try {
    return sessionStorage.getItem(ACTIVE_CONVERSATION_STORAGE_KEY)
  } catch {
    return null
  }
}

function setStoredConversationId(conversationId) {
  try {
    if (conversationId) {
      sessionStorage.setItem(ACTIVE_CONVERSATION_STORAGE_KEY, conversationId)
    } else {
      sessionStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY)
    }
  } catch {
    // sessionStorage can throw (e.g. private browsing) — losing this is a
    // minor convenience regression, not a functional one, so it's safe to
    // just skip persisting rather than breaking the app.
  }
}

function toTranscriptMessage(row) {
  return {
    id: row.id,
    role: row.role,
    ...deserializeConversationMessage(row.content, row.role),
  }
}

// Moves a conversation to the front of the list (matching updated_at desc)
// without a full refetch after every message.
function bumpConversation(conversations, conversationId) {
  const index = conversations.findIndex((conversation) => conversation.id === conversationId)
  if (index <= 0) return conversations
  const next = [...conversations]
  const [bumped] = next.splice(index, 1)
  next.unshift({ ...bumped, updated_at: new Date().toISOString() })
  return next
}

// Owns persisted Assistant conversation history for signed-in users only.
// Guests never touch any of this — every write path below short-circuits on
// `!user` before it can reach Supabase. Kept separate from the `messages`
// array itself (that still lives in App.jsx) since Settings' "Clear Chat"
// and the sidebar's "New Chat" both need to reach the same reset without
// owning the whole Assistant page.
//
// `authLoading` (from useAuth()) matters specifically because `user` alone
// is `null` in two very different situations — "the session check hasn't
// resolved yet" and "confirmed signed out" — and this hook must not treat
// the first one as the second, or it clears sessionStorage's stored
// conversation id (see below) before App.jsx's mount-time restoration ever
// gets a chance to read it.
export function useConversationHistory(user, authLoading) {
  const [conversations, setConversations] = useState([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const [persistError, setPersistError] = useState(null)

  // Async persistence code (recordMessage/ensureConversation) reads this
  // synchronously instead of the `activeConversationId` state value, which
  // would otherwise be stale inside closures captured before a state update
  // has flushed.
  const activeConversationIdRef = useRef(null)
  // Dedupes a fast double-send: the second caller awaits the same in-flight
  // creation instead of starting its own, so only one conversation row is
  // ever created for a given "first message".
  const creatingPromiseRef = useRef(null)
  // Skips this effect's very first (mount-time) run — see below.
  const hasSyncedStorageOnceRef = useRef(false)

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
  }, [activeConversationId])

  // Single source of truth for keeping sessionStorage in sync with every
  // *subsequent* state change: New Chat, deleting the active conversation,
  // and successfully opening/creating one.
  //
  // The very first invocation (on mount) is deliberately skipped. Without
  // that guard, this fires immediately with the hook's initial
  // `activeConversationId = null` — before App.jsx's restoration effect
  // (which waits on auth) has had any chance to read the stored id — and
  // wipes it out from under that restoration. Real changes after mount are
  // never affected by this guard, only the default value React starts with.
  useEffect(() => {
    if (!hasSyncedStorageOnceRef.current) {
      hasSyncedStorageOnceRef.current = true
      return
    }
    setStoredConversationId(activeConversationId)
  }, [activeConversationId])

  useEffect(() => {
    // Auth hasn't resolved yet — `user` being null right now doesn't mean
    // "guest", it means "unknown". Wait rather than treating this as a
    // confirmed sign-out (which would also clear the stored conversation id
    // sessionStorage restoration needs).
    if (authLoading) return

    if (!user) {
      setConversations([])
      setActiveConversationId(null)
      setHistoryError(null)
      // Explicit even though activeConversationId may already be null (so
      // the reactive effect above wouldn't otherwise fire) — a confirmed
      // signed-out session must never keep a previous account's
      // conversation id lying around in storage, ready to be restored into
      // the wrong session.
      setStoredConversationId(null)
      return
    }

    let cancelled = false
    setIsLoadingConversations(true)
    getRecentConversations(user.id, SIDEBAR_LIMIT)
      .then((rows) => {
        if (!cancelled) setConversations(rows)
      })
      .catch((error) => {
        console.error('[conversation-history] failed to load conversations', error)
        if (!cancelled) setHistoryError("Couldn't load saved chats.")
      })
      .finally(() => {
        if (!cancelled) setIsLoadingConversations(false)
      })

    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  const ensureConversation = useCallback(
    async (firstUserText) => {
      if (activeConversationIdRef.current) return activeConversationIdRef.current
      if (creatingPromiseRef.current) return creatingPromiseRef.current

      const promise = (async () => {
        const title = deriveConversationTitle(firstUserText)
        const conversation = await createConversation(user.id, title)
        activeConversationIdRef.current = conversation.id
        setActiveConversationId(conversation.id)
        setConversations((prev) => [conversation, ...prev].slice(0, SIDEBAR_LIMIT))
        return conversation.id
      })()

      creatingPromiseRef.current = promise
      try {
        return await promise
      } finally {
        creatingPromiseRef.current = null
      }
    },
    [user]
  )

  // Tied to explicit message-send actions (see AssistantPage's pushMessage),
  // never to a broad "whenever messages changes" effect — that's what the
  // task called out as the double-insert risk.
  const recordMessage = useCallback(
    async (role, text, advisorySearch) => {
      if (!user || !text) return
      try {
        let conversationId = activeConversationIdRef.current
        if (!conversationId) {
          // An assistant reply can only follow a user message that already
          // triggered creation — if there's still no conversation at this
          // point, there is nothing sensible to attach it to.
          if (role !== 'user') return
          conversationId = await ensureConversation(text)
        }
        const content = serializeConversationMessage({ role, text, advisorySearch })
        await saveMessage(conversationId, role, content)
        await touchConversation(conversationId)
        setConversations((prev) => bumpConversation(prev, conversationId))
        setPersistError(null)
      } catch (error) {
        console.error('[conversation-history] failed to persist message', error)
        setPersistError("This conversation couldn't be saved.")
      }
    },
    [user, ensureConversation]
  )

  const startNewChat = useCallback(() => {
    activeConversationIdRef.current = null
    setActiveConversationId(null)
    setPersistError(null)
  }, [])

  const openConversation = useCallback(async (conversationId, title) => {
    setIsLoadingMessages(true)
    setHistoryError(null)
    try {
      const rows = await getConversationMessages(conversationId)
      if (rows.length === 0) {
        // A real, currently-open conversation always has at least one
        // message (the first is saved in the same call that creates the
        // conversation — see recordMessage/ensureConversation), so zero rows
        // here means this id doesn't exist, was deleted, or — since RLS
        // filters rather than errors — belongs to someone else. Never adopt
        // it as active; this is what stops a stale or foreign conversation
        // id (e.g. restored from sessionStorage after switching accounts)
        // from silently opening into the wrong session.
        setStoredConversationId(null)
        return null
      }
      activeConversationIdRef.current = conversationId
      setActiveConversationId(conversationId)
      // A conversation opened from the sidebar is already in `conversations`.
      // One opened from the full Chat History page usually isn't (it can be
      // well outside the top 5) — seed a lightweight placeholder so it's
      // there for `recordMessage`/bumpConversation to promote back into
      // Recent Chats the moment a new message touches it, without a refetch.
      if (title) {
        setConversations((prev) =>
          prev.some((conversation) => conversation.id === conversationId)
            ? prev
            : [{ id: conversationId, title, updated_at: new Date().toISOString() }, ...prev].slice(
                0,
                SIDEBAR_LIMIT
              )
        )
      }
      return rows.map(toTranscriptMessage)
    } catch (error) {
      console.error('[conversation-history] failed to load conversation messages', error)
      setHistoryError("Couldn't open that conversation.")
      setStoredConversationId(null)
      return null
    } finally {
      setIsLoadingMessages(false)
    }
  }, [])

  const removeConversation = useCallback(async (conversationId) => {
    try {
      await deleteConversationRow(conversationId)
      setConversations((prev) => prev.filter((conversation) => conversation.id !== conversationId))
      if (activeConversationIdRef.current === conversationId) {
        activeConversationIdRef.current = null
        setActiveConversationId(null)
        return { wasActive: true }
      }
      return { wasActive: false }
    } catch (error) {
      console.error('[conversation-history] failed to delete conversation', error)
      setHistoryError("Couldn't delete that conversation.")
      return { wasActive: false, failed: true }
    }
  }, [])

  return {
    conversations,
    isLoadingConversations,
    activeConversationId,
    isLoadingMessages,
    historyError,
    persistError,
    recordMessage,
    startNewChat,
    openConversation,
    removeConversation,
  }
}
