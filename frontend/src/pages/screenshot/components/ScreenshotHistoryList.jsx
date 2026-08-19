import { ChevronRight, Info, MoreHorizontal, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/pages/history/utils/format-relative-time'
import { getPrimaryStatus } from '../utils/verdict'

// Signed-in-only "Recent scans", shown inline on the Screenshot page — the
// same placement the Message and Transaction detectors use for their own
// history. No delete control: history is append-only in V1.

const CONTENT_TYPE_LABEL = {
  website: 'Website',
  login_page: 'Login page',
  email: 'Email',
  sms_or_chat: 'Message',
  marketplace_listing: 'Marketplace listing',
  other: null,
}

function RowMenu({ entry, onRequestDelete }) {
  // DropdownMenuContent portals out of this row, but React still bubbles
  // synthetic events through the tree — without this the menu would also fire
  // the row's own onClick and reopen the scan behind the dialog.
  return (
    <div onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[popup-open]:opacity-100"
              aria-label={`Scan options for ${entry.displayName}`}
            />
          }
        >
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onClick={() => onRequestDelete(entry)}>
            <Trash2 aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function HistoryRow({ entry, onOpen, onRequestDelete }) {
  // The exact status the reopened ResultSummary will show — same helper, so the
  // list and the result can never disagree about a scan.
  const primary = getPrimaryStatus(entry.classifierLabel, entry.effectiveCautionLevel)
  const Icon = primary.icon
  const contentTypeLabel = CONTENT_TYPE_LABEL[entry.contentType] ?? null

  const meta = [
    contentTypeLabel,
    `${Math.round(entry.confidencePct * 10) / 10}% confidence`,
    formatRelativeTime(entry.createdAt),
  ].filter(Boolean)

  if (!entry.isRestorable) {
    return (
      <div className="group flex items-center gap-3 px-4 py-3 text-left opacity-70">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-muted-foreground">
            {entry.displayName}
          </span>
          <span className="block text-xs text-muted-foreground">
            This saved scan could not be opened.
          </span>
        </span>
        {/* Still deletable — an unopenable row would otherwise be stuck. */}
        <RowMenu entry={entry} onRequestDelete={onRequestDelete} />
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(entry)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(entry)
        }
      }}
      className="group flex cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
    >
      <Icon className={cn('size-4 shrink-0', primary.iconClass)} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{entry.displayName}</span>
        <span className="block truncate text-xs text-muted-foreground">{meta.join(' · ')}</span>
      </span>
      <span className={cn('shrink-0 text-xs font-medium', primary.textClass)}>
        {primary.label}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <RowMenu entry={entry} onRequestDelete={onRequestDelete} />
    </div>
  )
}

export default function ScreenshotHistoryList({
  entries,
  status,
  actionError,
  onOpen,
  onRequestDelete,
  onRequestClearHistory,
}) {
  // Guests never reach this component (see ScreenshotScanPage) — history is a
  // signed-in feature, while scanning itself stays open to everyone.
  if (status === 'idle') return null

  // A history fetch failure is deliberately silent: it must never look like the
  // scan itself is broken, and there is nothing the user can act on.
  if (status === 'error') return null
  if (status === 'success' && entries.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent scans</CardTitle>
        {/* Only offered when there is something to clear; guests never render
            this component at all (status stays 'idle'). */}
        {status === 'success' && entries.length > 0 && (
          <CardAction>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive-soft hover:text-destructive"
              onClick={onRequestClearHistory}
            >
              <Trash2 aria-hidden="true" />
              Clear history
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="px-0">
        {status === 'loading' ? (
          <div className="flex flex-col gap-3 px-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ) : (
          <>
            {/* Plain-language only — a raw Supabase error never reaches here. */}
            {actionError && (
              <p className="px-4 pb-3 text-xs text-destructive">{actionError}</p>
            )}
            <div className="flex flex-col divide-y divide-border">
              {entries.map((entry) => (
                <HistoryRow
                  key={entry.id}
                  entry={entry}
                  onOpen={onOpen}
                  onRequestDelete={onRequestDelete}
                />
              ))}
            </div>
            {/* Same treatment as the page's own footnote. */}
            <p className="flex items-start gap-1.5 border-t border-border px-4 pt-3.5 text-xs leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              The screenshot itself is never stored — only the filename and the analysis
              result. Saved scans stay in your account until you delete them.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
