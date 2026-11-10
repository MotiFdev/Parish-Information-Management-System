import { Link } from '../../../components/Link'
import { ErrorState, LoadingState } from '../../../components/ui/DataState'
import { Icon } from '../../../components/ui/Icon'
import { cardClass } from '../../../components/ui/styles'
import type { PreviewState } from '../../../lib/preview'
import type { UpcomingEvent } from './dashboardApi'

const TZ = 'Asia/Manila'
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ })
const dayLabel = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ })
const timeLabel = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: TZ })

function relativeDay(iso: string) {
  const days = Math.round((new Date(dayKey.format(new Date(iso))).getTime() - new Date(dayKey.format(new Date())).getTime()) / 86_400_000)
  const label = dayLabel.format(new Date(iso))
  return days === 0 ? `Today, ${label}` : days === 1 ? `Tomorrow, ${label}` : label
}

export function EventsCard({
  preview,
  events,
  onRetry,
  className = '',
}: {
  preview: PreviewState
  events: UpcomingEvent[]
  onRetry?: () => void
  className?: string
}) {
  // Group by calendar day, keeping time order.
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start))
  const days: [string, UpcomingEvent[]][] = []
  for (const e of sorted) {
    const k = dayKey.format(new Date(e.start))
    const last = days[days.length - 1]
    if (last && last[0] === k) last[1].push(e)
    else days.push([k, [e]])
  }

  return (
    <section aria-labelledby="events-title" className={`${cardClass} flex flex-col ${className}`}>
      <header className="border-b border-stone-100 px-5 py-4">
        <h2 id="events-title" className="font-serif text-2xl font-semibold text-stone-900">
          Upcoming events
        </h2>
        <p className="text-sm text-stone-600">The next 7 days</p>
      </header>

      {preview === 'loading' ? (
        <LoadingState what="upcoming events" />
      ) : preview === 'error' ? (
        <ErrorState what="upcoming events" help="If it keeps happening, tell the system administrator." onRetry={onRetry} />
      ) : days.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-stone-600">Nothing scheduled in the next 7 days.</p>
      ) : (
        <div className="divide-y divide-stone-100">
          {days.map(([k, items]) => (
            <div key={k} className="px-5 py-3">
              <h3 className="text-sm font-semibold text-forest">{relativeDay(items[0].start)}</h3>
              <ul className="mt-2 space-y-2.5">
                {items.map((e) => (
                  <li key={e.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 text-sm sm:grid-cols-[5rem_minmax(0,1fr)_auto]">
                    <span className="font-semibold text-stone-800 tabular-nums">{timeLabel.format(new Date(e.start))}</span>
                    <span className="min-w-0">
                      <Link
                        href={`/secretary/appointments?view=week&date=${dayKey.format(new Date(e.start))}&appointment=${e.id}`}
                        className="block text-stone-900 hover:text-forest hover:underline"
                      >
                        <span className="font-semibold">{e.type}</span> · {e.title}
                      </Link>
                      <span className="block text-stone-600">
                        {e.venue}
                        {e.place && ` · ${e.place}`}
                        {e.assigned && ` · ${e.assigned}`}
                      </span>
                    </span>
                    <span
                      className={`col-start-2 text-xs font-semibold sm:col-start-auto sm:text-right ${e.status === 'Pending' ? 'text-brown' : 'text-forest'}`}
                    >
                      {e.status === 'Pending' ? 'Needs approval' : 'Approved'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto border-t border-stone-100 px-5 py-3">
        <Link
          href="/secretary/appointments"
          className="-mx-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-forest hover:underline"
        >
          Open Appointments & Events
          <Icon name="chevronRight" className="size-4" />
        </Link>
      </div>
    </section>
  )
}
