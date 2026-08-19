import { cn } from '@/lib/utils'

export default function PageHeader({ title, description, actions, align = 'start' }) {
  const isCentred = align === 'center'

  return (
    <div
      className={cn(
        'flex flex-col gap-4 pb-8',
        isCentred ? 'items-center text-center' : 'sm:flex-row sm:items-start sm:justify-between',
      )}
    >
      <div className="space-y-1.5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-page-title">
          {title}
        </h1>
        {description && (
          <p
            className={cn(
              'max-w-2xl text-sm leading-relaxed text-muted-foreground',
              isCentred && 'mx-auto',
            )}
          >
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
