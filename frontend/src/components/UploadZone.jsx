import { useCallback, useId, useRef, useState } from 'react'
import { UploadCloud, ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png']
const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png']
const MAX_SIZE_BYTES = 10 * 1024 * 1024

function isAcceptedFile(file) {
  if (!file) return false
  if (ACCEPTED_TYPES.includes(file.type)) return true
  const lowerName = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
}

export default function UploadZone({ onFileSelected, disabled }) {
  const inputId = useId()
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [localError, setLocalError] = useState('')

  const handleFiles = useCallback(
    (fileList) => {
      const file = fileList?.[0]
      if (!file) return

      if (!isAcceptedFile(file)) {
        setLocalError('Please choose a JPG or PNG image.')
        return
      }
      if (file.size > MAX_SIZE_BYTES) {
        setLocalError('That image is too large. Maximum size is 10MB.')
        return
      }

      setLocalError('')
      onFileSelected(file)
    },
    [onFileSelected]
  )

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault()
      setIsDragging(false)
      if (disabled) return
      handleFiles(event.dataTransfer.files)
    },
    [disabled, handleFiles]
  )

  const handleDragOver = useCallback(
    (event) => {
      event.preventDefault()
      if (disabled) return
      setIsDragging(true)
    },
    [disabled]
  )

  const handleDragLeave = useCallback((event) => {
    event.preventDefault()
    setIsDragging(false)
  }, [])

  const openBrowser = useCallback(() => {
    if (disabled) return
    inputRef.current?.click()
  }, [disabled])

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        openBrowser()
      }
    },
    [openBrowser]
  )

  return (
    <div>
      <label htmlFor={inputId} className="sr-only">
        Upload a screenshot to check for scams
      </label>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-describedby={localError ? `${inputId}-error` : undefined}
        onClick={openBrowser}
        onKeyDown={handleKeyDown}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors',
          'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          disabled
            ? 'cursor-not-allowed border-border bg-muted/30 opacity-60'
            : 'cursor-pointer border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50',
          isDragging && !disabled && 'border-primary bg-primary/5'
        )}
      >
        <UploadCloud className="size-10 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="text-base font-medium text-foreground">
            Drag and drop a screenshot here
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            or click to browse — JPG or PNG, up to 10MB
          </p>
        </div>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>
      {localError && (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="mt-2 flex items-center gap-1.5 text-sm text-destructive"
        >
          <ImageOff className="size-4" aria-hidden="true" />
          {localError}
        </p>
      )}
    </div>
  )
}
