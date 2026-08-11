import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

export default function ChatHistorySearch({ value, onChange }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search chats…"
        aria-label="Search chat history"
        className="pl-8"
      />
    </div>
  )
}
