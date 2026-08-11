import { ShieldCheck } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Message, MessageAvatar, MessageContent } from '@/components/ui/message'
import { Bubble, BubbleContent } from '@/components/ui/bubble'

export default function TypingIndicator() {
  return (
    <Message align="start">
      <MessageAvatar>
        <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
      </MessageAvatar>
      <MessageContent>
        <Bubble variant="muted">
          <BubbleContent className="flex items-center gap-2 text-muted-foreground">
            <Spinner className="size-3.5" />
            <span role="status">ScamSense is typing…</span>
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}
