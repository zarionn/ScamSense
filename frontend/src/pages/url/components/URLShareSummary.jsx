import { useEffect, useState } from 'react'
import { Check, Copy, Share2, TriangleAlert } from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  buildShareSummary,
  copySummaryToClipboard,
  nativeShareSupported,
  SHARE_UNAVAILABLE_MESSAGE,
  shareSummaryNatively,
} from '../utils/share-summary'

// Lets someone pass a finished scan to a person helping them. The dialog shows
// the exact text that will leave the page, and neither copying nor sharing
// happens until the user activates one of the buttons.

const COPY_FAILED_MESSAGE =
  "We couldn't copy the summary. Select the text above and copy it yourself."
const SHARE_FAILED_MESSAGE =
  "We couldn't open your device's share options. You can copy the summary instead."

const COPIED_RESET_MS = 4000

export default function URLShareSummary({ result }) {
  const [open, setOpen] = useState(false)
  const [hasCopied, setHasCopied] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [canUseNativeShare] = useState(nativeShareSupported)

  const summary = buildShareSummary(result)

  useEffect(() => {
    if (!hasCopied) return undefined

    const timer = setTimeout(() => setHasCopied(false), COPIED_RESET_MS)
    return () => clearTimeout(timer)
  }, [hasCopied])

  function handleOpenChange(nextOpen) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setHasCopied(false)
      setErrorMessage('')
    }
  }

  async function handleCopy() {
    if (!summary) return

    setErrorMessage('')
    const outcome = await copySummaryToClipboard(summary.text)

    if (outcome === 'copied') {
      setHasCopied(true)
      return
    }
    // The preview stays on screen so the text can still be selected by hand.
    setHasCopied(false)
    setErrorMessage(COPY_FAILED_MESSAGE)
  }

  async function handleNativeShare() {
    if (!summary) return

    setErrorMessage('')
    if ((await shareSummaryNatively(summary.text)) === 'failed') {
      setErrorMessage(SHARE_FAILED_MESSAGE)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        <Share2 aria-hidden="true" />
        Share result
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this result</DialogTitle>
          <DialogDescription>
            This is the whole message. It names the website only, never the full link you
            checked.
          </DialogDescription>
        </DialogHeader>

        {summary ? (
          <>
            {/* Text, never an anchor, and the address inside it is already broken
                up so it cannot become a link wherever it is pasted. */}
            <pre className="max-h-[45dvh] overflow-y-auto rounded-lg border border-border bg-muted/40 px-3 py-2.5 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground select-text">
              {summary.text}
            </pre>

            <div role="status">
              {hasCopied && (
                <p className="flex items-start gap-1.5 text-sm text-success">
                  <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  Summary copied.
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
            {SHARE_UNAVAILABLE_MESSAGE}
          </p>
        )}

        <div role="alert">
          {errorMessage && (
            <p className="flex items-start gap-1.5 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {errorMessage}
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Close</DialogClose>
          {summary && canUseNativeShare && (
            <Button type="button" variant="outline" onClick={handleNativeShare}>
              <Share2 aria-hidden="true" />
              Share
            </Button>
          )}
          <Button type="button" onClick={handleCopy} disabled={!summary}>
            {hasCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {hasCopied ? 'Copied' : 'Copy summary'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
