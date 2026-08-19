import { CalendarDays, ExternalLink, Landmark } from 'lucide-react'

export default function AdvisoryCard({ advisory }) {
  if (
    !advisory?.title ||
    !advisory?.summary ||
    !advisory?.publication_date ||
    !advisory?.source_url ||
    !advisory?.relevance ||
    !Array.isArray(advisory.authorities) ||
    advisory.authorities.length === 0
  ) {
    return null
  }

  return (
    <article className="w-full max-w-[560px] rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <p className="flex items-center gap-2 text-xs font-semibold text-primary">
        <Landmark className="size-4 shrink-0" aria-hidden="true" />
        Related official advisory
      </p>

      <h3 className="mt-2 text-sm font-semibold leading-snug">{advisory.title}</h3>

      <dl className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-4">
        <div className="flex min-w-0 items-start gap-1.5">
          <dt className="sr-only">Authority</dt>
          <Landmark className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <dd>{advisory.authorities.join(', ')}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Publication date</dt>
          <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
          <dd>
            <time dateTime={advisory.publication_date}>{advisory.publication_date}</time>
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed">{advisory.summary}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Why this may be relevant: </span>
        {advisory.relevance}
      </p>

      <a
        href={advisory.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Open official source
        <ExternalLink className="size-3.5" aria-hidden="true" />
      </a>
    </article>
  )
}
