import { Button } from '@/components/ui/button'

export default function QuickReplies({ replies, onSelect, disabled }) {
  if (!replies || replies.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Quick replies">
      {replies.map((reply) => (
        <Button
          key={reply.label}
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onSelect(reply)}
          className="rounded-full border-border-strong bg-background text-foreground hover:border-ring hover:bg-dropzone-surface hover:text-accent-foreground"
        >
          {reply.label}
        </Button>
      ))}
    </div>
  )
}
