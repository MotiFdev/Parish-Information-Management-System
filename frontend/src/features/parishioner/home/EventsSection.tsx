import { useCallback, useEffect, useState } from 'react'
import { ErrorState, LoadingState } from '../../../components/ui/DataState'
import { Icon } from '../../../components/ui/Icon'
import { btnSecondary, cardClass } from '../../../components/ui/styles'
import { api } from '../../../lib/api'
import { formatEventDate } from '../../community/events/eventsApi'
import { timeLabel } from '../appointments/slots'

/** GET /api/public/events: approved GKK and PYA-KKK events, soonest first. */
interface PublicEvent {
  event_id: string
  name: string
  venue: string
  event_date: string
  start_time: string
}

/** How many show before "Show all". */
const FIRST = 6

export function EventsSection() {
  const [state, setState] = useState<PublicEvent[] | 'loading' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [all, setAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    api<{ data: PublicEvent[] }>('/api/public/events')
      .then((r) => !cancelled && setState(r.data))
      .catch(() => !cancelled && setState('error'))
    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = useCallback(() => {
    setState('loading')
    setAttempt((n) => n + 1)
  }, [])

  if (state === 'loading') return <LoadingState what="upcoming events" variant="events" />
  if (state === 'error') return <ErrorState what="upcoming events" onRetry={retry} />
  if (!state.length)
    return (
      <p className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-5 py-10 text-center text-stone-600">
        No upcoming events right now. New GKK and PYA-KKK events appear here once the PPC approves them.
      </p>
    )

  const shown = all ? state : state.slice(0, FIRST)

  return (
    <div>
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {shown.map((e) => {
          const [, month, day] = e.event_date.split('-')
          const monthLabel = new Date(2000, Number(month) - 1, 1).toLocaleDateString('en-US', { month: 'short' })
          return (
            <li key={e.event_id} className={`flex gap-4 p-5 ${cardClass}`}>
              <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-gold-soft text-center leading-none text-brown" aria-hidden="true">
                <span>
                  <span className="block text-xs font-semibold uppercase">{monthLabel}</span>
                  <span className="block font-serif text-2xl font-semibold">{Number(day)}</span>
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="font-serif text-xl leading-snug font-semibold text-stone-900">{e.name}</h3>
                <p className="mt-1.5 flex items-center gap-1.5 text-sm text-stone-700">
                  <Icon name="clock" className="size-4 shrink-0 text-stone-500" />
                  <time dateTime={`${e.event_date}T${e.start_time}`}>
                    {formatEventDate(e.event_date)} · {timeLabel(e.start_time)}
                  </time>
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-700">
                  <Icon name="mapPin" className="size-4 shrink-0 text-stone-500" />
                  <span className="min-w-0">{e.venue}</span>
                </p>
              </div>
            </li>
          )
        })}
      </ul>
      {state.length > FIRST && (
        <div className="mt-5 text-center">
          <button type="button" onClick={() => setAll((a) => !a)} aria-expanded={all} className={btnSecondary}>
            {all ? 'Show fewer' : `Show all ${state.length} events`}
          </button>
        </div>
      )}
    </div>
  )
}
