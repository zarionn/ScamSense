import { ShieldCheck } from 'lucide-react'
import QuickReplies from './QuickReplies'

export default function AssistantWelcome({ message, quickReplies, onSelectQuickReply }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
        <ShieldCheck className="size-6" aria-hidden="true" />
      </div>
      <p className="max-w-md text-base text-foreground">{message}</p>
      <div className="flex max-w-md flex-wrap justify-center gap-2">
        <QuickReplies replies={quickReplies} onSelect={onSelectQuickReply} />
      </div>
    </div>
  )
}
