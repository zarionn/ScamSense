import { MessageSquare, MoreHorizontal, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatRelativeTime } from '../utils/format-relative-time'

// The whole row opens the conversation; only the overflow menu is a distinct
// target. Its click is stopped from bubbling here — DropdownMenuContent
// portals outside this row's DOM subtree, but React still bubbles synthetic
// events through the component tree, so without this a menu click would also
// fire the row's own onClick.
export default function ChatHistoryRow({ conversation, onOpen, onRequestDelete }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(conversation)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(conversation)
        }
      }}
      className="group flex cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
    >
      <MessageSquare className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{conversation.title}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatRelativeTime(conversation.updated_at)}
      </span>
      <div onClick={(event) => event.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[popup-open]:opacity-100"
                aria-label="Conversation options"
              />
            }
          >
            <MoreHorizontal aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={() => onRequestDelete(conversation.id)}>
              <Trash2 aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
