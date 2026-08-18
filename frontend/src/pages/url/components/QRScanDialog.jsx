import { useCallback, useId, useRef, useState } from 'react'
import { Camera, CircleAlert, ImageUp, Loader2, QrCode } from 'lucide-react'
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
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  decodeQRImage,
  parseQRWebsiteURL,
  QR_MESSAGES,
  QRDecodeError,
  validateQRImageFile,
} from '@/lib/qr-image-decoding'

// sr-only rather than display:none so the input stays focusable: the label mirrors its
// focus ring and keyboard activation still works.
const PICKER_LABEL_CLASS = cn(
  buttonVariants({ variant: 'outline' }),
  'h-10 w-full cursor-pointer px-3',
  'peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50',
  'peer-disabled:pointer-events-none peer-disabled:opacity-50'
)

function ImagePicker({ id, label, icon, capture, disabled, onChange }) {
  return (
    <div>
      <input
        id={id}
        type="file"
        accept="image/*"
        capture={capture}
        disabled={disabled}
        onChange={onChange}
        className="peer sr-only"
      />
      <label htmlFor={id} className={PICKER_LABEL_CLASS}>
        {icon}
        {label}
      </label>
    </div>
  )
}

export default function QRScanDialog({ onConfirm, disabled }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('idle')
  const [foundLink, setFoundLink] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const uploadInputId = useId()
  const cameraInputId = useId()
  const decodeContainerId = useId()

  // Claimed synchronously, so a second click before the dialog closes cannot
  // start a second scan or a second history row.
  const hasConfirmedRef = useRef(false)

  const handleFileChange = useCallback(
    async (event) => {
      const file = event.target.files?.[0]
      // Cleared now so the same image can be chosen again and the input drops its reference.
      event.target.value = ''

      const fileError = validateQRImageFile(file)
      if (fileError) {
        setFoundLink(null)
        setErrorMessage(fileError)
        setStatus('error')
        return
      }

      setFoundLink(null)
      setErrorMessage('')
      setStatus('decoding')

      try {
        const decodedText = await decodeQRImage(file, decodeContainerId)
        const website = parseQRWebsiteURL(decodedText)

        if (!website) {
          setErrorMessage(QR_MESSAGES.unsupportedContent)
          setStatus('error')
          return
        }

        setFoundLink(website)
        setStatus('found')
      } catch (failure) {
        setErrorMessage(
          failure instanceof QRDecodeError ? failure.message : QR_MESSAGES.unreadableImage
        )
        setStatus('error')
      }
    },
    [decodeContainerId]
  )

  // Nothing about the chosen image survives the dialog closing, however it closes.
  const closeAndReset = useCallback(() => {
    setOpen(false)
    setStatus('idle')
    setFoundLink(null)
    setErrorMessage('')
  }, [])

  const handleOpenChange = useCallback(
    (nextOpen) => {
      if (!nextOpen) {
        closeAndReset()
        return
      }
      hasConfirmedRef.current = false
      setOpen(true)
    },
    [closeAndReset]
  )

  function handleConfirm() {
    if (hasConfirmedRef.current || !foundLink) return
    hasConfirmedRef.current = true

    const confirmedURL = foundLink.url
    closeAndReset()
    onConfirm(confirmedURL)
  }

  const isDecoding = status === 'decoding'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" className="h-10 px-4" disabled={disabled} />
        }
      >
        <QrCode aria-hidden="true" />
        Scan QR
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan a QR code</DialogTitle>
          <DialogDescription>
            Choose a photo or screenshot of a QR code. ScamSense reads the link inside it and
            shows it to you before anything is checked.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2">
          <ImagePicker
            id={uploadInputId}
            label="Choose QR image"
            icon={<ImageUp aria-hidden="true" />}
            disabled={isDecoding}
            onChange={handleFileChange}
          />
          <ImagePicker
            id={cameraInputId}
            label="Take a photo"
            icon={<Camera aria-hidden="true" />}
            capture="environment"
            disabled={isDecoding}
            onChange={handleFileChange}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          On most phones &ldquo;Take a photo&rdquo; opens the camera. On other devices it opens
          the photo picker instead.
        </p>

        {/* Both regions stay mounted so a screen reader announces text added later. */}
        <div className="space-y-2">
          <div role="status" className="space-y-2">
            {status === 'idle' && (
              <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
                No image selected yet.
              </p>
            )}

            {isDecoding && (
              <p className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
                Reading the QR code&hellip;
              </p>
            )}

            {status === 'found' && foundLink && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-sm font-medium text-heading">
                  <QrCode className="size-4 shrink-0" aria-hidden="true" />
                  QR link found
                </p>

                <div>
                  <p className="text-xs text-muted-foreground">Website</p>
                  <p className="text-base font-semibold break-all text-foreground">
                    {foundLink.hostname}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Full link</p>
                  {/* Text, never an anchor: the destination must not be reachable here. */}
                  <p className="font-mono text-xs break-all text-muted-foreground select-all">
                    {foundLink.url}
                  </p>
                </div>

                {!foundLink.hasScheme && (
                  <p className="text-xs text-muted-foreground">
                    Protocol not included. ScamSense will process this using the same URL
                    normalisation as a pasted link.
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  This website has not been opened.
                </p>
              </div>
            )}
          </div>

          <div role="alert">
            {status === 'error' && (
              <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{errorMessage}</span>
              </p>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          The image is checked on this device and is not uploaded. ScamSense will only analyse
          the extracted link after you confirm it.
        </p>

        {/* html5-qrcode looks this element up by id and appends its canvas here, so it
            must exist before a scan starts. */}
        <div id={decodeContainerId} aria-hidden="true" className="hidden" />

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="button" onClick={handleConfirm} disabled={status !== 'found'}>
            Check this link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
