import { useEffect, useState } from 'react'
import { History, RotateCcw, Trash2, TriangleAlert } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
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
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import LoginDialog from '@/components/account/LoginDialog'
// Shared with the Chat History page so both histories read the same.
import { formatRelativeTime } from '@/pages/history/utils/format-relative-time'
import { toneKeyForLevel } from '../utils/result-presentation'
import { toneForKey } from '../utils/verdict-styles'

// The signed-in user's five most recent URL scans, collapsed by default beneath
// the scanner. A stored address is never rendered as a link, so no click here
// can navigate to a scanned site.

const GUEST_MESSAGE = 'Log in to keep your recent scans.'
const EMPTY_MESSAGE = 'No saved scans yet.'
const CLEARED_MESSAGE = 'Recent scans cleared.'

export default function URLRecentScans({
  entries = [],
  isSignedIn = false,
  isAuthResolving = false,
  isLoading = false,
  loadError = '',
  syncError = '',
  isClearing = false,
  clearError = '',
  isScanRunning = false,
  onCheckAgain,
  onClearHistory,
  onDismissClearError,
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [wasCleared, setWasCleared] = useState(false)

  // A fresh scan, or another account's history, makes the "cleared" line stale.
  useEffect(() => {
    if (entries.length > 0 || !isSignedIn) setWasCleared(false)
  }, [entries.length, isSignedIn])

  function handleConfirmChange(open) {
    setIsConfirmOpen(open)
    if (!open) onDismissClearError?.()
  }

  async function handleConfirmClear() {
    // The hook empties the list only once Supabase confirms; until then the
    // dialog stays open so the error is retryable.
    const cleared = await onClearHistory?.()
    if (cleared) {
      setWasCleared(true)
      setIsConfirmOpen(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card px-5">
      <Accordion>
        <AccordionItem value="url-recent-scans">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" aria-hidden="true" />
              Recent scans
              {isSignedIn && !isLoading && entries.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  ({entries.length})
                </span>
              )}
            </span>
          </AccordionTrigger>

          <AccordionContent>
            <div aria-live="polite" className="space-y-1.5">
              {isAuthResolving && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="size-3.5" />
                  Checking your sign-in…
                </p>
              )}

              {!isAuthResolving && !isSignedIn && (
                <p className="text-sm text-muted-foreground">{GUEST_MESSAGE}</p>
              )}

              {isSignedIn && isLoading && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="size-3.5" />
                  Loading your recent scans…
                </p>
              )}

              {isSignedIn && !isLoading && loadError && (
                <p className="flex items-start gap-1.5 text-sm text-destructive">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {loadError}
                </p>
              )}

              {isSignedIn && !isLoading && !loadError && wasCleared && (
                <p className="text-sm text-muted-foreground">{CLEARED_MESSAGE}</p>
              )}

              {isSignedIn && !isLoading && !loadError && entries.length === 0 && (
                <p className="text-sm text-muted-foreground">{EMPTY_MESSAGE}</p>
              )}
            </div>

            {!isAuthResolving && !isSignedIn && (
              <div className="mt-2">
                <LoginDialog
                  trigger={
                    <Button type="button" size="sm" variant="outline" className="h-8">
                      Log in
                    </Button>
                  }
                />
              </div>
            )}

            {isSignedIn && !isLoading && !loadError && entries.length > 0 && (
              <>
                <ul className="mt-1">
                  {entries.map((entry) => {
                    const tone = toneForKey(toneKeyForLevel(entry.verdict_level))
                    const ToneIcon = tone.stepIcon

                    return (
                      <li
                        key={entry.id}
                        className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-1"
                      >
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full border ${tone.bg} ${tone.border} ${tone.text}`}
                        >
                          <ToneIcon className="size-3.5" aria-hidden="true" />
                        </span>

                        {/* Truncation is visual only — the full stored value is
                            what the title and "Check again" use. */}
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-sm font-medium text-foreground"
                            title={entry.url_redacted}
                          >
                            {entry.url_redacted}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {/* Verdict in words, not colour alone. */}
                            <span className={tone.text}>{entry.verdict}</span>
                            <span aria-hidden="true"> · </span>
                            <span>{formatRelativeTime(entry.created_at)}</span>
                          </p>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 shrink-0"
                          disabled={isScanRunning}
                          aria-label={`Check ${entry.url_redacted} again`}
                          onClick={() => onCheckAgain?.(entry.url_redacted)}
                        >
                          <RotateCcw aria-hidden="true" />
                          Check again
                        </Button>
                      </li>
                    )
                  })}
                </ul>

                <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="-ml-2.5 h-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setIsConfirmOpen(true)}
                    disabled={isClearing}
                  >
                    <Trash2 aria-hidden="true" />
                    Clear history
                  </Button>
                </div>
              </>
            )}

            {isSignedIn && (
              <p className="mt-2 text-xs text-muted-foreground">
                Only the link address is saved — never anything after “?” or “#”. Saved scans stay
                in your account until you clear them or delete your account.
              </p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Outside the panel so a failed save is visible while collapsed. */}
      {syncError && (
        <p
          role="status"
          className="flex items-start gap-1.5 border-t border-border py-2.5 text-xs text-muted-foreground"
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {syncError}
        </p>
      )}

      <AlertDialog open={isConfirmOpen} onOpenChange={handleConfirmChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear your recent scans?</AlertDialogTitle>
            <AlertDialogDescription>
              All saved scans in your account will be permanently removed. This can&apos;t be
              undone, and it does not change the result shown on this page.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {clearError && (
            <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {clearError}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isClearing}
              onClick={handleConfirmClear}
            >
              {isClearing && <Spinner className="size-3.5" />}
              {isClearing ? 'Clearing…' : clearError ? 'Try again' : 'Clear history'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
