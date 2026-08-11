import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import LoginDialog from '@/components/account/LoginDialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { getConversationHistory } from '@/services/conversation-service'
import ChatHistoryRow from './components/ChatHistoryRow'
import ChatHistorySearch from './components/ChatHistorySearch'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300
const LOAD_ERROR_MESSAGE = "We couldn't load your chat history. Please try again."

// user/onOpenConversation/onDeleteConversation/onNewChat: the SAME handlers
// App.jsx already wires into the sidebar's saved-chat list, passed straight
// through — this page intentionally has no separate open/delete/new-chat
// implementation of its own, only its own paginated/search fetch (metadata
// only; messages are loaded by the existing openConversation mechanism once
// a conversation is actually opened).
export default function ChatHistoryPage({ user, onOpenConversation, onDeleteConversation, onNewChat }) {
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [conversations, setConversations] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(null)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [searchInput])

  // Re-runs (from page 1) whenever the debounced search text changes, and
  // once on mount for a signed-in user — remounting is what "returning to
  // Chat History" already means under this app's activePage architecture, so
  // this alone keeps the page fresh across visits without extra plumbing.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    getConversationHistory({ userId: user.id, search: debouncedSearch, limit: PAGE_SIZE, offset: 0 })
      .then(({ conversations: rows, hasMore: more }) => {
        if (cancelled) return
        setConversations(rows)
        setHasMore(more)
      })
      .catch((loadError) => {
        console.error('[chat-history] failed to load conversation history', loadError)
        if (!cancelled) setError(LOAD_ERROR_MESSAGE)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, debouncedSearch])

  const handleLoadMore = useCallback(async () => {
    if (!user) return
    setIsLoadingMore(true)
    setError(null)
    try {
      const { conversations: rows, hasMore: more } = await getConversationHistory({
        userId: user.id,
        search: debouncedSearch,
        limit: PAGE_SIZE,
        offset: conversations.length,
      })
      setConversations((prev) => [...prev, ...rows])
      setHasMore(more)
    } catch (loadError) {
      console.error('[chat-history] failed to load more conversation history', loadError)
      setError(LOAD_ERROR_MESSAGE)
    } finally {
      setIsLoadingMore(false)
    }
  }, [user, debouncedSearch, conversations.length])

  const handleConfirmDelete = useCallback(async () => {
    const conversationId = pendingDeleteId
    setPendingDeleteId(null)
    if (!conversationId) return
    await onDeleteConversation(conversationId)
    setConversations((prev) => prev.filter((conversation) => conversation.id !== conversationId))
  }, [pendingDeleteId, onDeleteConversation])

  const handleOpen = useCallback(
    (conversation) => onOpenConversation(conversation.id, conversation.title),
    [onOpenConversation]
  )

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <PageHeader title="Chat History" description="Sign in to save and access your conversations." />
        <div className="flex justify-center pt-4">
          <LoginDialog trigger={<Button>Log in</Button>} />
        </div>
      </div>
    )
  }

  const pendingDeleteTitle = conversations.find(
    (conversation) => conversation.id === pendingDeleteId
  )?.title

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Chat History"
        description="Find and return to your saved ScamSense conversations."
        actions={
          <Button onClick={onNewChat}>
            <Plus aria-hidden="true" />
            New Chat
          </Button>
        }
      />

      <div className="pb-4">
        <ChatHistorySearch value={searchInput} onChange={setSearchInput} />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{error}</p>
        ) : conversations.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {debouncedSearch ? `No chats match "${debouncedSearch}".` : 'No saved chats yet.'}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {conversations.map((conversation) => (
              <ChatHistoryRow
                key={conversation.id}
                conversation={conversation}
                onOpen={handleOpen}
                onRequestDelete={setPendingDeleteId}
              />
            ))}
          </div>
        )}
      </div>

      {!isLoading && !error && hasMore && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}

      <AlertDialog
        open={pendingDeleteId != null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteTitle ? `"${pendingDeleteTitle}"` : 'This conversation'} and its saved
              messages will be permanently removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
