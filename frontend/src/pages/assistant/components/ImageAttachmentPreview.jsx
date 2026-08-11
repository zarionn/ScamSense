import { X } from 'lucide-react'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { ImagePreviewContent } from '@/components/shared/ImagePreviewDialog'
import { Button } from '@/components/ui/button'
import { formatFileSize } from '@/lib/utils'

// Compact row shared by both contexts this preview appears in: staged in the
// composer before sending (onRemove present, no enlarge — removing something
// you haven't sent yet is more useful than previewing it full-size) and
// attached to an already-sent user message (no onRemove, click opens the
// same enlarged preview Screenshot Scan uses).
function AttachmentRow({ file, previewUrl, onRemove }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted px-2.5 py-2">
      <div className="size-10 shrink-0 overflow-hidden rounded-md bg-dropzone-surface">
        <img src={previewUrl} alt="" className="size-full object-cover" />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
      </div>
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label="Remove attachment"
        >
          <X aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}

export default function ImageAttachmentPreview({ file, previewUrl, onRemove }) {
  if (onRemove) {
    return <AttachmentRow file={file} previewUrl={previewUrl} onRemove={onRemove} />
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={`View a larger preview of ${file.name}`}
            className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <AttachmentRow file={file} previewUrl={previewUrl} />
      </DialogTrigger>
      <ImagePreviewContent src={previewUrl} filename={file.name} />
    </Dialog>
  )
}
