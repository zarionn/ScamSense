import { ShieldCheck } from 'lucide-react'
import { Message, MessageAvatar, MessageContent } from '@/components/ui/message'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { cn } from '@/lib/utils'
import QuickReplies from './QuickReplies'
import DetectorSuggestionCard from './DetectorSuggestionCard'
import ImageAttachmentPreview from './ImageAttachmentPreview'
import TransactionAttachmentPreview from './TransactionAttachmentPreview'

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
        {message.attachment?.kind === 'transaction' ? (
          <div className={cn('w-full max-w-[260px]', isUser && 'self-end')}>
            <TransactionAttachmentPreview file={message.attachment.file} />
          </div>
        ) : message.attachment ? (
          <div className={cn('w-full max-w-[260px]', isUser && 'self-end')}>
            <ImageAttachmentPreview
              file={message.attachment.file}
              previewUrl={message.attachment.previewUrl}
            />
          </div>
        ): null}

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
                onOpen={(key) => onOpenDetector(key, message.handoffFile)}
              />
            ))}
          </div>
        )}
      </MessageContent>
    </Message>
  )
}
