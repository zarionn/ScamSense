import { ShieldCheck } from 'lucide-react'
import { FileSpreadsheet } from 'lucide-react'
import { Message, MessageAvatar, MessageContent } from '@/components/ui/message'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { cn } from '@/lib/utils'
import QuickReplies from './QuickReplies'
import DetectorSuggestionCard from './DetectorSuggestionCard'
import ImageAttachmentPreview from './ImageAttachmentPreview'

export default function ChatMessage({ message, isLast, onSelectQuickReply, onOpenDetector }) {
  const isUser = message.role === 'user'

  return (
    <Message align={isUser ? 'end' : 'start'}>
      {!isUser && (
        <MessageAvatar>
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
        </MessageAvatar>
      )}
      <MessageContent>
        {message.attachment?.type === 'image' && (
  <div className={cn('w-full max-w-[260px]', isUser && 'self-end')}>
    <ImageAttachmentPreview
      file={message.attachment.file}
      previewUrl={message.attachment.previewUrl}
    />
  </div>
)}

{message.attachment?.type === 'excel' && (
  <div
    className={cn(
      'flex w-full max-w-[360px] items-center gap-3 rounded-lg border border-border bg-muted/40 p-3',
      isUser && 'self-end'
    )}
  >
    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
      <FileSpreadsheet
        className="size-5 text-primary"
        aria-hidden="true"
      />
    </div>

    <div className="min-w-0">
      <p className="truncate text-sm font-medium">
        {message.attachment.file.name}
      </p>

      <p className="text-xs text-muted-foreground">
        Excel dataset
      </p>
    </div>
  </div>
)}

        {message.text && (
          <Bubble align={isUser ? 'end' : 'start'} variant={isUser ? 'default' : 'muted'}>
            <BubbleContent>{message.text}</BubbleContent>
          </Bubble>
        )}

        {!isUser && isLast && message.quickReplies && (
          <QuickReplies replies={message.quickReplies} onSelect={onSelectQuickReply} />
        )}

        {!isUser && isLast && message.suggestions && (
          <div className="flex flex-col gap-2">
            {message.suggestions.map((detectorKey) => (
              <DetectorSuggestionCard
                key={detectorKey}
                detectorKey={detectorKey}
                onOpen={(key) =>
                  onOpenDetector(
                    key,
                    message.handoffFile,
                    message.handoffMessage,
                    message.handoffMode
                  )
                }
              />
            ))}
          </div>
        )}
      </MessageContent>
    </Message>
  )
}
