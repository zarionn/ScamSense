import { Info } from 'lucide-react'

export default function UncertaintyNote({ note }) {
  if (!note) return null

  return (
    <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{note}</span>
    </p>
  )
}
