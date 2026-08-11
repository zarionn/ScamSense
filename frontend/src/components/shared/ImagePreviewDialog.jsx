import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

// The enlarged-image markup, shared by every screenshot preview so there is one
// visual treatment for all of them. Exported separately so callers that need the
// Dialog trigger(s) placed in a specific spot (e.g. ScreenshotAttachment, where the
// thumbnail and filename are two independently-positioned triggers) can build their
// own <Dialog> around this content instead of going through the convenience
// wrapper below.
export function ImagePreviewContent({ src, filename }) {
  return (
    <DialogContent className="max-w-[90vw] max-h-[90dvh] overflow-hidden sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{filename}</DialogTitle>
      </DialogHeader>
      <div className="flex items-center justify-center overflow-hidden rounded-lg bg-muted/40">
        <img
          src={src}
          alt={`Enlarged preview of ${filename}`}
          className="max-h-[80dvh] max-w-full object-contain"
        />
      </div>
    </DialogContent>
  )
}

// Convenience wrapper for the common single-trigger case (e.g. the result summary
// thumbnail). For multiple, independently-positioned triggers around the same
// dialog, compose <Dialog>/<DialogTrigger>/<ImagePreviewContent> directly instead.
export default function ImagePreviewDialog({ src, filename, trigger }) {
  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <ImagePreviewContent src={src} filename={filename} />
    </Dialog>
  )
}
