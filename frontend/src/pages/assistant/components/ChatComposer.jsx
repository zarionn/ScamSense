import { useCallback, useId, useRef, useState } from 'react'
import { FileSpreadsheet, ImagePlus, SendHorizontal, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { validateFile } from '@/lib/screenshot-file-validation'
import ImageAttachmentPreview from './ImageAttachmentPreview'

export default function ChatComposer({ onSend, disabled }) {
  const [value, setValue] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [attachmentError, setAttachmentError] = useState('')

  const screenshotInputRef = useRef(null)
  const excelInputRef = useRef(null)

  const screenshotInputId = useId()
  const excelInputId = useId()

  // ============================================================
  // SCREENSHOT UPLOAD
  // ============================================================

  const handleScreenshotPicked = useCallback((fileList) => {
    const picked = fileList?.[0]

    if (!picked) return

    const error = validateFile(picked)

    if (error) {
      setAttachmentError(error)
      return
    }

    setAttachmentError('')

    // Remove existing attachment first
    setAttachment((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl)
      }

      return {
        type: 'image',
        file: picked,
        previewUrl: URL.createObjectURL(picked),
      }
    })
  }, [])

  // ============================================================
  // EXCEL / CSV UPLOAD
  // ============================================================

  const handleExcelPicked = useCallback((fileList) => {
    const picked = fileList?.[0]

    if (!picked) return

    const allowedExtensions = ['.xlsx', '.xls', '.csv']

    const fileName = picked.name.toLowerCase()

    const validExtension = allowedExtensions.some((extension) =>
      fileName.endsWith(extension)
    )

    if (!validExtension) {
      setAttachmentError(
        'Please upload an Excel or CSV file (.xlsx, .xls or .csv).'
      )
      return
    }

    const MAX_SIZE = 10 * 1024 * 1024

    if (picked.size > MAX_SIZE) {
      setAttachmentError('File size must be less than 10 MB.')
      return
    }

    setAttachmentError('')

    // Excel files do NOT need an object URL.
    setAttachment((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl)
      }

      return {
        type: 'excel',
        file: picked,
      }
    })
  }, [])

  // ============================================================
  // REMOVE ATTACHMENT
  // ============================================================

  const handleRemoveAttachment = useCallback(() => {
    setAttachment((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl)
      }

      return null
    })

    setAttachmentError('')
  }, [])

  // ============================================================
  // SUBMIT
  // ============================================================

  const handleSubmit = (event) => {
    event.preventDefault()

    if (disabled) return

    const trimmed = value.trim()

    if (!trimmed && !attachment) return

    onSend({
      text: trimmed,
      attachment,
    })

    setValue('')

    // Message list now owns the attachment
    setAttachment(null)
    setAttachmentError('')
  }

  return (
    <div className="flex flex-col gap-2">

      {/* ========================================================
          ATTACHMENT PREVIEW
      ======================================================== */}

      {attachment?.type === 'image' && (
        <ImageAttachmentPreview
          file={attachment.file}
          previewUrl={attachment.previewUrl}
          onRemove={handleRemoveAttachment}
        />
      )}

      {attachment?.type === 'excel' && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary/10">
            <FileSpreadsheet
              className="size-5 text-primary"
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {attachment.file.name}
            </p>

            <p className="text-xs text-muted-foreground">
              Ready for Batch Message Analysis
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleRemoveAttachment}
            disabled={disabled}
            aria-label="Remove Excel file"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      )}

      {attachmentError && (
        <p className="text-xs text-destructive">
          {attachmentError}
        </p>
      )}

      {/* ========================================================
          INPUT
      ======================================================== */}

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2"
      >

        {/* ======================================================
            SCREENSHOT INPUT
        ====================================================== */}

        <label
          htmlFor={screenshotInputId}
          className="sr-only"
        >
          Attach a screenshot
        </label>

        <input
          ref={screenshotInputRef}
          id={screenshotInputId}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            handleScreenshotPicked(event.target.files)
            event.target.value = ''
          }}
        />

        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          onClick={() => screenshotInputRef.current?.click()}
          aria-label="Attach a screenshot"
        >
          <ImagePlus aria-hidden="true" />
        </Button>

        {/* ======================================================
            EXCEL INPUT
        ====================================================== */}

        <label
          htmlFor={excelInputId}
          className="sr-only"
        >
          Attach an Excel dataset
        </label>

        <input
          ref={excelInputRef}
          id={excelInputId}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            handleExcelPicked(event.target.files)
            event.target.value = ''
          }}
        />

        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          onClick={() => excelInputRef.current?.click()}
          aria-label="Attach an Excel dataset"
        >
          <FileSpreadsheet aria-hidden="true" />
        </Button>

        {/* ======================================================
            MESSAGE INPUT
        ====================================================== */}

        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Type a message…"
          aria-label="Message ScamSense Assistant"
          disabled={disabled}
          className="h-10"
        />

        {/* ======================================================
            SEND
        ====================================================== */}

        <Button
          type="submit"
          size="icon"
          disabled={
            disabled ||
            (!value.trim() && !attachment)
          }
          aria-label="Send"
        >
          <SendHorizontal aria-hidden="true" />
        </Button>

      </form>
    </div>
  )
}