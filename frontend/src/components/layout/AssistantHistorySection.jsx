import { useState } from 'react'
import { MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

// Signed-in-only saved Assistant chat history, inserted into the existing
// left sidebar between the "AI Assistant" nav item and "Scam Detectors" —
// not a second sidebar. Renders nothing for guests so their navigation stays
// exactly as it is today (no empty/fake history rows).
export default function AssistantHistorySection({
  isSignedIn,
  conversations = [],
  isLoading = false,
  activeConversationId = null,
  error = null,
  onNewChat,
  onOpenConversation,
  onDeleteConversation,
  onViewAllChats,
  isHistoryPageActive = false,
}) {
  const [pendingDeleteId, setPendingDeleteId] = useState(null)

  if (!isSignedIn) return null

  const pendingDeleteTitle = conversations.find(
    (conversation) => conversation.id === pendingDeleteId
  )?.title

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={onNewChat} tooltip="New Chat">
                <Plus aria-hidden="true" />
                <span>New Chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* A growing chat list doesn't read well as icon-only squares like the
          single nav buttons above it, so the whole section hides when the
          sidebar collapses rather than trying to render truncated rows. */}
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>Recent Chats</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {isLoading &&
              Array.from({ length: 3 }).map((_, index) => <SidebarMenuSkeleton key={index} />)}

            {!isLoading && conversations.length === 0 && !error && (
              <p className="px-2 py-1.5 text-xs text-sidebar-foreground/60">No saved chats yet</p>
            )}

            {!isLoading && error && (
              <p className="px-2 py-1.5 text-xs text-destructive">{error}</p>
            )}

            {!isLoading &&
              !error &&
              conversations.map((conversation) => (
                <SidebarMenuItem key={conversation.id}>
                  <SidebarMenuButton
                    isActive={conversation.id === activeConversationId}
                    onClick={() => onOpenConversation?.(conversation.id)}
                    tooltip={conversation.title}
                    // Same active colour tokens as the parent "AI Assistant"
                    // nav item (bg-sidebar-accent / text-sidebar-accent-foreground)
                    // — that pairing is what's actually themed correctly in
                    // both light and dark mode. Diluting the background via
                    // opacity here previously broke dark mode specifically:
                    // --sidebar-accent is already a subtle tint there, so
                    // halving it read as "nearly-black fill, purple text"
                    // instead of matching AI Assistant's active look. Only
                    // font-weight differs, marking this as a child selection
                    // rather than a distinct top-level destination.
                    className="data-active:bg-sidebar-accent data-active:font-normal data-active:text-sidebar-accent-foreground"
                  >
                    <span className="truncate">{conversation.title}</span>
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<SidebarMenuAction showOnHover aria-label="Conversation options" />}
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start">
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setPendingDeleteId(conversation.id)}
                      >
                        <Trash2 aria-hidden="true" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              ))}

            {/* Only worth surfacing once there's something to browse — with
                zero saved chats there's nothing for the full history page to
                show either. Shown regardless of whether the 5-row cap above
                was actually reached, since it's still a useful entry point
                with just a handful of chats. */}
            {!isLoading && !error && conversations.length > 0 && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isHistoryPageActive}
                  onClick={onViewAllChats}
                  tooltip="View all chats"
                  // Same child treatment as a selected Recent Chat above —
                  // "AI Assistant" is still the strong parent-active item;
                  // this only needs to read as "the current child destination
                  // within it", not a second top-level page.
                  className="text-sidebar-foreground/70 data-active:bg-sidebar-accent data-active:font-normal data-active:text-sidebar-accent-foreground"
                >
                  <span>View all chats</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <AlertDialog
        open={pendingDeleteId != null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteTitle ? `"${pendingDeleteTitle}"` : 'This conversation'} and its
              messages will be permanently removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onDeleteConversation?.(pendingDeleteId)
                setPendingDeleteId(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
