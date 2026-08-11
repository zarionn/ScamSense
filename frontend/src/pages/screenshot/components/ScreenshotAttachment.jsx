import { AlertCircle, RefreshCw, X } from 'lucide-react'
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
} from '@/components/ui/attachment'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ImagePreviewContent } from '@/components/shared/ImagePreviewDialog'
import { formatFileSize } from '@/lib/utils'

const DEFAULT_STATUS_LABEL = {
  idle: 'Selected',
  processing: 'Analysing…',
  done: 'Complete',
  error: 'Error',
}

export default function ScreenshotAttachment({
  file,
  previewUrl,
  state = 'idle',
  statusLabel,
  onReplace,
  onRemove,
  size = 'default',
}) {
  const label = statusLabel ?? DEFAULT_STATUS_LABEL[state]
  const description = state === 'error' && statusLabel ? statusLabel : `${label} · ${formatFileSize(file.size)}`
  const showActions = (onReplace || onRemove) && state !== 'processing'
  const previewLabel = `View a larger preview of ${file.name}`

  return (
    <Dialog>
      {/* bg-muted: the attachment row is nested content inside the white upload
          card, so it needs a visibly different surface from its parent — the
          shared Attachment registry component defaults to bg-card, and
          --card-elevated is also white in this theme, so bg-muted (the
          lavender-tinted inner surface) is what actually distinguishes it. */}
      <Attachment state={state} size={size} className="w-full bg-muted">
        {/* Only the thumbnail and the filename open the preview — the rest of the
            card (description text, padding) is not clickable, so hovering near the
            file size or whitespace never triggers an accidental preview. Base UI's
            Dialog.Trigger wants a real <button> as its render target (it warns
            otherwise, and cloning onto AttachmentMedia/AttachmentTitle directly
            collides with their own data-slot attribute), so each trigger here is a
            plain button scoped to its own small area rather than the styled
            Attachment sub-components themselves. */}
        <AttachmentMedia variant="image">
          <img src={previewUrl} alt="" />
          {state === 'processing' && (
            <span className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Spinner className="size-5 text-primary" />
            </span>
          )}
          {state === 'error' && (
            <span className="absolute inset-0 flex items-center justify-center bg-destructive-soft">
              <AlertCircle className="size-5 text-destructive" aria-hidden="true" />
            </span>
          )}
          <DialogTrigger
            render={
              <button
                type="button"
                aria-label={previewLabel}
                className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            }
          />
        </AttachmentMedia>

        <AttachmentContent>
          <DialogTrigger
            render={
              <button
                type="button"
                aria-label={previewLabel}
                className="block max-w-full min-w-0 truncate rounded text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 group-data-[state=processing]/attachment:shimmer group-data-[state=uploading]/attachment:shimmer"
              />
            }
          >
            {file.name}
          </DialogTrigger>
          <AttachmentDescription>{description}</AttachmentDescription>
        </AttachmentContent>

        {showActions && (
          <AttachmentActions className="gap-1">
            {onReplace && (
              <Tooltip>
                <TooltipTrigger
                  render={<AttachmentAction aria-label="Replace screenshot" onClick={onReplace} />}
                >
                  <RefreshCw aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>Replace screenshot</TooltipContent>
              </Tooltip>
            )}
            {onReplace && onRemove && <Separator orientation="vertical" className="h-4" />}
            {onRemove && (
              <Tooltip>
                <TooltipTrigger
                  render={<AttachmentAction aria-label="Remove screenshot" onClick={onRemove} />}
                >
                  <X aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>Remove screenshot</TooltipContent>
              </Tooltip>
            )}
          </AttachmentActions>
        )}
      </Attachment>

      <ImagePreviewContent src={previewUrl} filename={file.name} />
    </Dialog>
  )
}
