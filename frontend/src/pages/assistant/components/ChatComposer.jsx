import { useCallback, useId, useRef, useState } from 'react'
import { ImagePlus, SendHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { validateFile } from '@/lib/screenshot-file-validation'
import { validateTransactionFile, isAcceptedTransactionFile } from '@/lib/transaction-file-validation'
import ImageAttachmentPreview from './ImageAttachmentPreview'
import TransactionAttachmentPreview from './TransactionAttachmentPreview'

export default function ChatComposer({ onSend, disabled }) {
  const [value, setValue] = useState('')
  const [attachment, setAttachment] = useState(null) // { file, previewUrl } | null
  const [attachmentError, setAttachmentError] = useState('')
  const fileInputRef = useRef(null)
  const fileInputId = useId()

  const handleFilesPicked = useCallback((fileList) => {
    const picked = fileList?.[0]
    if (!picked) return
    if (isAcceptedTransactionFile(picked)) {
      const error = validateTransactionFile(picked)
      if (error) {
        setAttachmentError(error)
        return
      }
      setAttachmentError('')
      setAttachment({ file: picked, kind: 'transaction' })
      return
    }
    // Same validation Screenshot Scan uses (type/extension + 10MB max) — no
    // second, conflicting set of limits.
    const error = validateFile(picked)
    if (error) {
      setAttachmentError(error)
      return
    }
    setAttachmentError('')
    setAttachment({ file: picked, previewUrl: URL.createObjectURL(picked) })
  }, [])

  const handleRemoveAttachment = useCallback(() => {
    setAttachment((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl)
      return null
    })
    setAttachmentError('')
  }, [])

  const handleSubmit = (event) => {
    event.preventDefault()
    if (disabled) return
    const trimmed = value.trim()
    if (!trimmed && !attachment) return

    onSend({ text: trimmed, attachment })
    setValue('')
    // The message list now owns this object URL for as long as it renders
    // the sent attachment — do not revoke it here.
    setAttachment(null)
    setAttachmentError('')
  }

  return (
    <div className="flex flex-col gap-2">
      {attachment?.kind === 'transaction' ? (
        <TransactionAttachmentPreview file={attachment.file} onRemove={handleRemoveAttachment} />
      ) : attachment ? (
        <ImageAttachmentPreview file={attachment.file} previewUrl={attachment.previewUrl} onRemove={handleRemoveAttachment} />
      ) : null}
      {attachmentError && <p className="text-xs text-destructive">{attachmentError}</p>}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <label htmlFor={fileInputId} className="sr-only">
          Attach a screenshot
        </label>
        <input
          ref={fileInputRef}
          id={fileInputId}
          type="file"
          accept="image/png,image/jpeg, .csv"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            handleFilesPicked(event.target.files)
            event.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach a screenshot"
        >
          <ImagePlus aria-hidden="true" />
        </Button>
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Type a message…"
          aria-label="Message ScamSense Assistant"
          disabled={disabled}
          className="h-10"
        />
        <Button
          type="submit"
          size="icon"
          disabled={disabled || (!value.trim() && !attachment)}
          aria-label="Send"
        >
          <SendHorizontal aria-hidden="true" />
        </Button>
      </form>
    </div>
  )
}
