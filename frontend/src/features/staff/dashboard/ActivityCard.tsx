import { Link } from '../../../components/Link'
import { ErrorState, LoadingState } from '../../../components/ui/DataState'
import { Icon } from '../../../components/ui/Icon'
import { cardClass } from '../../../components/ui/styles'
import type { PreviewState } from '../../../lib/preview'
import type { OfficeActivity } from './dashboardApi'

const TZ = 'Asia/Manila'
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ })
const time = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: TZ })
const date = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ })

const when = (iso: string) => (dayKey.format(new Date(iso)) === dayKey.format(new Date()) ? time.format(new Date(iso)) : date.format(new Date(iso)))

// The latest office work from the audit log: requests, documents, certificate
// releases, and register changes. Sign-ins and account changes are left out.
export function ActivityCard({
  preview,
  items,
  onRetry,
  className = '',
}: {
  preview: PreviewState
  items: OfficeActivity[]
  onRetry?: () => void
  className?: string
}) {
  return (
    <section aria-labelledby="activity-title" className={`${cardClass} flex flex-col ${className}`}>
      <header className="border-b border-stone-100 px-5 py-4">
        <h2 id="activity-title" className="font-serif text-2xl font-semibold text-stone-900">
          Recent activity
        </h2>
        <p className="text-sm text-stone-600">Requests, documents, and register changes</p>
      </header>
      {preview === 'loading' ? (
        <LoadingState what="recent activity" variant="list" />
      ) : preview === 'error' ? (
        <ErrorState what="recent activity" help="If it keeps happening, tell the system administrator." onRetry={onRetry} />
      ) : items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-stone-600">No activity yet. Request updates and document checks appear here.</p>
      ) : (
        <ol className="divide-y divide-stone-100">
          {items.map((e) => (
            <li key={e.id} className="px-5 py-3 text-sm">
              <p className="text-stone-800">
                <span className="font-semibold text-stone-900">{e.by}</span> · {e.action.toLowerCase()}
              </p>
              <p className="break-words text-stone-600">
                {e.record}
                {e.details && ` · ${e.details}`}
              </p>
              <p className="text-xs text-stone-600">{when(e.at)}</p>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-auto border-t border-stone-100 px-5 py-3">
        <Link
          href="/secretary/reports?report=daily"
          className="-mx-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-forest hover:underline"
        >
          Open today’s Daily Log
          <Icon name="chevronRight" className="size-4" />
        </Link>
      </div>
    </section>
  )
}
