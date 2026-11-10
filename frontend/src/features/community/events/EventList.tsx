import type { ReactNode } from 'react'
import { Icon } from '../../../components/ui/Icon'
import { StatusBadge } from '../../parishioner/home/StatusBadge'
import { formatEventWhen, type CommunityEvent } from './eventsApi'

/** One event per row, shared by the GKK/PYA-KKK Events page and the PPC approvals page. */
export function EventList({ events, actions }: { events: CommunityEvent[]; actions: (e: CommunityEvent) => ReactNode }) {
  return (
    <ul className="divide-y divide-stone-100">
      {events.map((e) => {
        const [, month, day] = e.event_date.split('-')
        const monthLabel = new Date(2000, Number(month) - 1, 1).toLocaleDateString('en-US', { month: 'short' })
        return (
          <li key={e.event_id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
            <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-gold-soft text-center leading-none text-brown" aria-hidden="true">
              <span>
                <span className="block text-xs font-semibold uppercase">{monthLabel}</span>
                <span className="block font-serif text-2xl font-semibold">{Number(day)}</span>
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="font-semibold text-stone-900">{e.name}</h2>
                <StatusBadge status={e.status} />
              </div>
              <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-stone-600">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="calendar" className="size-4 text-stone-400" />
                  {formatEventWhen(e)}
                </span>
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Icon name="mapPin" className="size-4 shrink-0 text-stone-400" />
                  {e.venue}
                </span>
              </p>
              <p className="mt-1.5 text-sm text-stone-700">
                <span className="font-semibold">Officers: </span>
                {e.officers.length ? e.officers.map((o) => `${o.name} (${o.position}${o.chapel_name ? `, ${o.chapel_name}` : ''})`).join('; ') : 'None left on the list'}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Set up by {e.created_by ?? 'an officer'}
                {e.reviewed_by && ` · ${e.status === 'Approved' ? 'Approved' : 'Rejected'} by ${e.reviewed_by}`}
              </p>
              {e.status === 'Rejected' && e.review_note && (
                <p className="mt-2 flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
                  <Icon name="message" className="mt-0.5 size-4 shrink-0" />
                  <span>
                    <span className="font-semibold">PPC: </span>
                    {e.review_note}
                  </span>
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-1 sm:justify-end">{actions(e)}</div>
          </li>
        )
      })}
    </ul>
  )
}
