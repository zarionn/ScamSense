import { useCallback, useId, useRef, useState } from 'react'
import { Sparkles, UploadCloud } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Separator } from '@/components/ui/separator'
import ScreenshotAttachment from './ScreenshotAttachment'
import AnalysisStatusList from './AnalysisStatusList'
import ErrorMessage from './ErrorMessage'
import { validateFile } from '@/lib/screenshot-file-validation'
import { cn } from '@/lib/utils'

export default function ScreenshotUploadCard({
  file,
  previewUrl,
  onFileSelected,
  onAnalyse,
  onRemove,
  isAnalysing,
  isAutoResponding,
  analyseError,
  onRetryAnalyse,
}) {
  const inputId = useId()
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [localError, setLocalError] = useState('')

  const isBusy = isAnalysing || isAutoResponding

  const handleFiles = useCallback(
    (fileList) => {
      const picked = fileList?.[0]
      if (!picked) return
      const error = validateFile(picked)
      if (error) {
        setLocalError(error)
        return
      }
      setLocalError('')
      onFileSelected(picked)
    },
    [onFileSelected]
  )

  const openBrowser = useCallback(() => {
    if (isBusy) return
    inputRef.current?.click()
  }, [isBusy])

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault()
      setIsDragging(false)
      if (isBusy) return
      handleFiles(event.dataTransfer.files)
    },
    [isBusy, handleFiles]
  )

  const handleDragOver = useCallback(
    (event) => {
      event.preventDefault()
      if (isBusy) return
      setIsDragging(true)
    },
    [isBusy]
  )

  const handleDragLeave = useCallback((event) => {
    event.preventDefault()
    setIsDragging(false)
  }, [])

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
    <Card>
      <CardHeader>
        <CardTitle>Upload a Screenshot</CardTitle>
        <CardDescription>
          Upload a clear screenshot containing the page, message, URL or warning signs you
          want to analyse.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          className="sr-only"
          disabled={isBusy}
          onChange={(event) => handleFiles(event.target.files)}
        />

        {!file && (
          <div>
            <label htmlFor={inputId} className="sr-only">
              Upload a screenshot to check for scams
            </label>
            <Empty
              role="button"
              tabIndex={0}
              aria-describedby={localError ? `${inputId}-error` : undefined}
              onClick={openBrowser}
              onKeyDown={handleKeyDown}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={cn(
                'min-h-[190px] cursor-pointer border-2 border-dashed border-border bg-dropzone-surface py-6 transition-colors sm:min-h-[210px] lg:min-h-[230px]',
                'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                'hover:border-ring/60 hover:bg-accent/50',
                isDragging && 'border-ring bg-accent'
              )}
            >
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-accent text-primary">
                  <UploadCloud aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle className="text-base font-semibold text-heading">
                  Drag and drop a screenshot here
                </EmptyTitle>
                <EmptyDescription className="text-sm text-muted-foreground">
                  or click to browse
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <p className="text-xs text-muted-foreground">
                  Supports PNG, JPG, JPEG — up to 10MB
                </p>
              </EmptyContent>
            </Empty>
            {localError && (
              <p
                id={`${inputId}-error`}
                role="alert"
                className="mt-2 text-sm text-destructive"
              >
                {localError}
              </p>
            )}
          </div>
        )}

        {file && (
          <div className="space-y-3">
            <ScreenshotAttachment
              file={file}
              previewUrl={previewUrl}
              state={isBusy ? 'processing' : analyseError ? 'error' : 'idle'}
              statusLabel={analyseError || undefined}
              onReplace={openBrowser}
              onRemove={onRemove}
            />

            {isBusy ? (
              <>
                <Separator />
                <AnalysisStatusList stage={isAnalysing ? 'analysing' : 'preparing'} />
              </>
            ) : (
              <Button onClick={onAnalyse} size="lg" className="w-full sm:w-auto">
                <Sparkles aria-hidden="true" />
                Analyse Screenshot
              </Button>
            )}
          </div>
        )}

        {analyseError && !isBusy && (
          <ErrorMessage message={analyseError} onRetry={onRetryAnalyse} />
        )}
      </CardContent>
    </Card>
  )
}
