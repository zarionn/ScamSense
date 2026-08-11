import { useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

const PREVIEW_LENGTH = 320
const SENTENCE_SEARCH_WINDOW = 200

// Finds the cleanest boundary at or after `length` so the visible preview never cuts
// the text off mid-thought. Prefers a sentence end (. ! ?) within a bounded window
// past the target length; falls back to the nearest whitespace so at least no word
// is split. The full message is still just split, never altered: visible + hidden
// concatenate back to the exact original string.
function findSplitIndex(message, length) {
  if (message.length <= length) return message.length

  const sentenceEnd = /[.!?](?=\s|$)/g
  sentenceEnd.lastIndex = length
  const match = sentenceEnd.exec(message)
  if (match && match.index <= length + SENTENCE_SEARCH_WINDOW) {
    return match.index + 1
  }

  const nextSpace = message.indexOf(' ', length)
  return nextSpace === -1 ? message.length : nextSpace
}

export default function AIExplanationCard({ message }) {
  const [open, setOpen] = useState(false)
  const splitIndex = findSplitIndex(message, PREVIEW_LENGTH)
  const isLong = splitIndex < message.length
  const visiblePart = isLong ? message.slice(0, splitIndex) : message
  const restPart = isLong ? message.slice(splitIndex) : ''

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          AI Explanation
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* response_message is guard-verified by the backend to contain every mandatory
            safety action — render it verbatim, do not parse or restructure it. Long
            explanations are only visually split for the preview; the full text below
            is the exact same string, never reworded or reordered. */}
        {isLong ? (
          <Collapsible open={open} onOpenChange={setOpen}>
            <p className="max-w-[80ch] whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {visiblePart}
              {!open && '…'}
            </p>
            <CollapsibleContent>
              <p className="mt-3 max-w-[80ch] whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {restPart}
              </p>
            </CollapsibleContent>
            <CollapsibleTrigger className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded">
              {open ? 'Show less' : 'Read full explanation'}
              <ChevronDown
                className={cn('size-3.5 transition-transform', open && 'rotate-180')}
                aria-hidden="true"
              />
            </CollapsibleTrigger>
          </Collapsible>
        ) : (
          <p className="max-w-[80ch] whitespace-pre-wrap text-sm leading-relaxed text-foreground">{message}</p>
        )}
      </CardContent>
    </Card>
  )
}
