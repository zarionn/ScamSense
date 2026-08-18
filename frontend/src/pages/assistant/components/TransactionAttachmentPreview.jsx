import { FileSpreadsheet, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatFileSize } from '@/lib/utils'

export default function TransactionAttachmentPreview({ file, onRemove }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted px-2.5 py-2">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-dropzone-surface">
        <FileSpreadsheet className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
      </div>
      {onRemove && (
        <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Remove attachment">
          <X aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}