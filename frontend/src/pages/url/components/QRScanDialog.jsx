import { useCallback, useId, useRef, useState } from 'react'
import { CircleAlert, ImageUp, Loader2, QrCode, Video, VideoOff } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  decodeQRImage,
  parseQRWebsiteURL,
  QR_MESSAGES,
  QRDecodeError,
  validateQRImageFile,
} from '@/lib/qr-image-decoding'
import { CAMERA_MESSAGES, getCameraAvailability, useQRCamera } from '@/hooks/use-qr-camera'

const SELECT_CLASS = cn(
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'disabled:opacity-50 dark:bg-input/30'
)

const SEGMENT_CLASS = cn(
  'flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium',
  'transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
  "[&_svg]:size-4 [&_svg]:shrink-0"
)

function ModeSegment({ isActive, onClick, icon, children }) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        SEGMENT_CLASS,
        isActive
          ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {icon}
      {children}
    </button>
  )
}

// sr-only rather than display:none so the input stays focusable and the surface can mirror
// its focus ring.
function UploadSurface({ id, disabled, onChange }) {
  return (
    <div>
      <input
        id={id}
        type="file"
        accept="image/*"
        disabled={disabled}
        onChange={onChange}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        className={cn(
          'flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-1',
          'rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center',
          'transition-colors',
          'hover:border-ring/60 hover:bg-accent/40',
          'peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50',
          'peer-disabled:pointer-events-none peer-disabled:opacity-50'
        )}
      >
        <ImageUp className="size-6 text-primary" aria-hidden="true" />
        <span className="text-sm font-medium text-heading">Choose QR image</span>
        <span className="text-xs text-muted-foreground">
          Select a screenshot or photo containing a QR code.
        </span>
      </label>
    </div>
  )
}

export default function QRScanDialog({ onConfirm, disabled }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('image')
  const [status, setStatus] = useState('idle')
  const [foundLink, setFoundLink] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const uploadInputId = useId()
  const decodeContainerId = useId()
  const viewfinderId = useId()
  const cameraSelectId = useId()

  // Claimed synchronously, so a second click before the dialog closes cannot
  // start a second scan or a second history row.
  const hasConfirmedRef = useRef(false)

  const handleCameraDecoded = useCallback((decodedText) => {
    const website = parseQRWebsiteURL(decodedText)
    if (!website) {
      setFoundLink(null)
      setErrorMessage(QR_MESSAGES.unsupportedContent)
      setStatus('error')
      return
    }
    setFoundLink(website)
    setStatus('found')
  }, [])

  const {
    state: cameraState,
    errorMessage: cameraError,
    cameras,
    activeCameraId,
    start: startCamera,
    reset: resetCamera,
  } = useQRCamera({ containerId: viewfinderId, onDecoded: handleCameraDecoded })

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

  // Nothing about the chosen image, and no camera stream, survives the dialog closing.
  const closeAndReset = useCallback(() => {
    void resetCamera()
    setOpen(false)
    setMode('image')
    setStatus('idle')
    setFoundLink(null)
    setErrorMessage('')
  }, [resetCamera])

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

  function handleModeChange(nextMode) {
    if (nextMode === mode) return
    void resetCamera()
    setMode(nextMode)
    setStatus('idle')
    setFoundLink(null)
    setErrorMessage('')
  }

  function handleConfirm() {
    if (hasConfirmedRef.current || !foundLink) return
    hasConfirmedRef.current = true

    const confirmedURL = foundLink.url
    closeAndReset()
    onConfirm(confirmedURL)
  }

  const isDecoding = status === 'decoding'
  const isCameraMode = mode === 'camera'
  const isCameraLive = cameraState === 'active'
  const isCameraBusy = cameraState === 'starting' || cameraState === 'switching'
  const availability = open && isCameraMode ? getCameraAvailability() : 'available'
  const canUseCamera = availability === 'available'
  const showViewfinder = isCameraMode && canUseCamera && status !== 'found'
  const alertMessage = status === 'error' ? errorMessage : cameraError

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

      <DialogContent className="flex h-[min(90dvh,660px)] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Scan a QR code</DialogTitle>
          <DialogDescription>
            {isCameraMode
              ? 'Scan a QR code with your camera. You will see the link before anything is checked.'
              : 'Choose an image that contains a QR code. You will see the link before anything is checked.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <ModeSegment
            isActive={!isCameraMode}
            onClick={() => handleModeChange('image')}
            icon={<ImageUp aria-hidden="true" />}
          >
            Upload image
          </ModeSegment>
          <ModeSegment
            isActive={isCameraMode}
            onClick={() => handleModeChange('camera')}
            icon={<Video aria-hidden="true" />}
          >
            Live camera
          </ModeSegment>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto">
          {!isCameraMode && (
            <UploadSurface id={uploadInputId} disabled={isDecoding} onChange={handleFileChange} />
          )}

          {showViewfinder && (
            <div className="space-y-2">
              <div className="relative overflow-hidden rounded-lg border border-border bg-muted/40">
                {/* Needs a real height: html5-qrcode measures it. The placeholder is a
                    sibling because the library replaces this element's contents. */}
                <div id={viewfinderId} className="min-h-[200px] w-full" />
                {!isCameraLive && (
                  <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
                    {isCameraBusy ? 'Opening the camera…' : 'The camera is off.'}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {isCameraLive ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void resetCamera()}
                    className="h-9"
                  >
                    <VideoOff aria-hidden="true" />
                    Stop camera
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => startCamera()}
                    disabled={isCameraBusy || cameraState === 'stopping'}
                    className="h-9"
                  >
                    <Video aria-hidden="true" />
                    {status === 'error' ? 'Scan again' : 'Start camera'}
                  </Button>
                )}
              </div>

              {isCameraLive && cameras.length > 1 && (
                <div className="space-y-1">
                  <Label htmlFor={cameraSelectId} className="text-xs text-muted-foreground">
                    Camera
                  </Label>
                  <select
                    id={cameraSelectId}
                    className={SELECT_CLASS}
                    value={activeCameraId}
                    disabled={isCameraBusy}
                    onChange={(event) => startCamera(event.target.value)}
                  >
                    {!activeCameraId && <option value="">Current camera</option>}
                    {cameras.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Both regions stay mounted so a screen reader announces text added later. */}
          <div className="space-y-2">
            <div role="status" className="space-y-2">
              {showViewfinder && (
                <p className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                  {isCameraLive ? (
                    <Video className="size-4 shrink-0 text-heading" aria-hidden="true" />
                  ) : isCameraBusy || cameraState === 'stopping' ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
                  ) : (
                    <VideoOff className="size-4 shrink-0" aria-hidden="true" />
                  )}
                  {cameraState === 'starting' && 'Asking for camera permission…'}
                  {cameraState === 'switching' && 'Switching camera…'}
                  {cameraState === 'stopping' && 'Stopping the camera…'}
                  {cameraState === 'active' && 'Camera is on. Point it at a QR code.'}
                  {cameraState === 'idle' && 'Camera is off. Choose Start camera.'}
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

            <div role="alert" className="space-y-2">
              {alertMessage && (
                <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{alertMessage}</span>
                </p>
              )}

              {isCameraMode && !canUseCamera && (
                <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{CAMERA_MESSAGES[availability]}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {isCameraMode
            ? 'Camera video is processed on this device and is not uploaded or stored.'
            : 'The image is checked on this device and is not uploaded.'}{' '}
          ScamSense will only analyse the extracted link after you confirm it.
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
