import { Icon } from '../../../components/ui/Icon'
import { Pagination } from '../../../components/ui/Pagination'
import { inputClass } from '../../../components/ui/styles'
import { StatusBadge } from '../../parishioner/home/StatusBadge'
import { placeLine, type Appointment, type AppointmentStatus, type VenueType } from './appointmentsData'
import { whenOf } from './calendarDates'
import { filterQueue, noQueueFilters, type QueueFilters } from './queueFilters'

const cellLabel = 'block text-xs text-stone-500 lg:hidden'
const statuses: AppointmentStatus[] = ['Pending', 'Approved', 'Rejected']
const venues: VenueType[] = ['Parish Church', 'Chapel', "Client's Home"]

interface Props {
  /** Already narrowed by the page's Sona, Chapel, and Event type filters. */
  source: Appointment[]
  filters: QueueFilters
  onFilters: (f: Partial<QueueFilters>) => void
  page: number
  pageSize: number
  onPage: (p: number) => void
  onOpen: (a: Appointment) => void
}

export function RequestsTable({ source, filters, onFilters, page, pageSize, onPage, onOpen }: Props) {
  const rows = filterQueue(source, filters)
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pageCount - 1)
  const count = (s: AppointmentStatus) => source.filter((a) => a.status === s).length
  const narrowed = filters.search || filters.venue !== 'all' || filters.status !== 'Pending'

  return (
    <>
      <div className="grid gap-2 border-b border-stone-100 px-5 py-4 md:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))]">
        <div className="relative">
          <label htmlFor="rq-search" className="sr-only">
            Search requests
          </label>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-stone-500" />
          <input id="rq-search" type="search" value={filters.search} onChange={(e) => onFilters({ search: e.target.value })} placeholder="Reference, title, requester, or intention" className={`${inputClass} pl-10`} />
        </div>
        <select aria-label="Request status" value={filters.status} onChange={(e) => onFilters({ status: e.target.value as QueueFilters['status'] })} className={inputClass}>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s === 'Pending' ? 'To review' : s} ({count(s)})
            </option>
          ))}
          <option value="all">All requests ({source.length})</option>
        </select>
        <select aria-label="Venue" value={filters.venue} onChange={(e) => onFilters({ venue: e.target.value as QueueFilters['venue'] })} className={inputClass}>
          <option value="all">All venues</option>
          {venues.map((v) => (
            <option key={v} value={v}>
              {v === "Client's Home" ? 'Homes' : v}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="font-semibold text-stone-800">{source.length === 0 ? 'No requests yet' : filters.status === 'Pending' && !filters.search && filters.venue === 'all' ? 'Nothing waiting for review' : 'No requests match'}</p>
          <p className="mt-1 text-sm text-stone-600">
            {source.length === 0 ? 'New bookings from parishioners appear here.' : filters.status === 'Pending' && !narrowed ? 'New bookings appear here. Choose All requests to see decided ones.' : 'Try fewer words, another status, or all venues.'}
          </p>
          {narrowed && source.length > 0 && (
            <button type="button" onClick={() => onFilters(noQueueFilters)} className="mt-2 inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-forest hover:bg-forest-soft">
              Show requests to review
            </button>
          )}
        </div>
      ) : (
        <>
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Appointment requests, {filters.status === 'Pending' ? 'waiting for review, oldest first' : 'filtered'}</caption>
            <thead className="border-b border-stone-200 text-stone-600 max-lg:sr-only">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Request
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Venue
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Schedule
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-5 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.slice(current * pageSize, (current + 1) * pageSize).map((a) => (
                <tr key={a.id} className="max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-4 max-lg:gap-y-2.5 max-lg:px-5 max-lg:py-4">
                  <td className="lg:px-5 lg:py-3 max-lg:col-span-2 lg:w-[34%]">
                    <span className="block text-xs font-semibold text-forest">{a.type}</span>
                    <span className="block font-semibold text-stone-900">{a.title}</span>
                    <span className="block text-stone-600">
                      by {a.requester.name} · requested {whenOf(a.requestedAt)}
                    </span>
                    {a.intention && (
                      <span className="block text-xs text-stone-600">
                        Intention: {a.intention.category}, {a.intention.names}
                      </span>
                    )}
                  </td>
                  <td className="text-stone-800 lg:px-3 lg:py-3 max-lg:col-span-2 sm:max-lg:col-span-1">
                    <span className={cellLabel}>Venue</span>
                    {placeLine(a)}
                  </td>
                  <td className="lg:px-3 lg:py-3 max-lg:col-span-2 sm:max-lg:col-span-1">
                    <span className={cellLabel}>Schedule</span>
                    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
                      <dt className="text-stone-600">{a.status === 'Pending' ? 'Requested' : 'Date'}</dt>
                      <dd className="font-semibold whitespace-nowrap text-stone-900">{whenOf(a.start)}</dd>
                      {a.assigned && (
                        <>
                          <dt className="text-stone-600">With</dt>
                          <dd className="text-stone-800">{a.assigned}</dd>
                        </>
                      )}
                    </dl>
                  </td>
                  <td className="lg:px-3 lg:py-3">
                    <span className={cellLabel}>Status</span>
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="lg:px-5 lg:py-2 max-lg:col-span-2">
                    <div className="flex lg:justify-end">
                      <button
                        type="button"
                        onClick={() => onOpen(a)}
                        aria-label={`${a.status === 'Pending' ? 'Review' : 'View'}: ${a.title}`}
                        className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 font-semibold lg:flex-none ${
                          a.status === 'Pending' ? 'bg-forest text-white hover:bg-forest-dark' : 'border border-stone-300 bg-white text-forest hover:border-forest/50 hover:bg-forest-soft'
                        }`}
                      >
                        {a.status === 'Pending' ? 'Review' : 'View'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={current} pageSize={pageSize} total={rows.length} onPage={onPage} noun={['request', 'requests']} />
        </>
      )}
    </>
  )
}
