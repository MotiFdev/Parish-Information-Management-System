import { useState, type ComponentType, type ReactNode } from 'react'
import { useToast } from '../../../components/toast/toastContext'
import { ErrorState, LoadingState } from '../../../components/ui/DataState'
import { Icon } from '../../../components/ui/Icon'
import { Pagination } from '../../../components/ui/Pagination'
import { btnPrimary, btnSecondary, cardClass, chipClass, inputClass } from '../../../components/ui/styles'
import { ApiError } from '../../../lib/api'
import { RejectDialog } from '../../ppc/RejectDialog'
import { EventList } from './EventList'
import { formatEventWhen, parishToday, rejectEvent, useEvents, type CommunityEvent, type EventsPath, type EventStatus } from './eventsApi'

export interface EventReviewConfig {
  portal: 'ppc' | 'priest'
  layout: ComponentType<{ activeHref: string; children: ReactNode }>
  activeHref: string
  path: EventsPath
  title: string
  intro: string
  /** The first tab is the one this reviewer acts on. */
  tabs: Array<{ status: EventStatus; label: string }>
  approveLabel: string
  approvingLabel: string
  approve: (id: string) => Promise<CommunityEvent>
  approvedToast: (name: string) => string
  rejectDetail: string
  emptyTitle: string
  emptyHelp: string
}

const PAGE_SIZE = 10
const noFilters = { search: '', when: 'all', chapel: '', creator: '' }
const linkButton = 'inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-forest hover:bg-forest-soft'

/** The events list a reviewer works through: the PPC's pre-approvals, or the priest's final approvals. */
export function EventReviewBoard({ config }: { config: EventReviewConfig }) {
  const { toast } = useToast()
  const events = useEvents(config.path)
  const actionable = config.tabs[0].status
  const [tab, setTab] = useState<EventStatus>(actionable)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<CommunityEvent | null>(null)
  const [filters, setFilters] = useState(noFilters)
  const [page, setPage] = useState(0)
  const today = parishToday()
  const Layout = config.layout

  const list = typeof events.state === 'string' ? [] : events.state
  const chapelNames = [...new Set(list.flatMap((e) => e.officers.map((o) => o.chapel_name ?? '')).filter(Boolean))].sort()
  const creators = [...new Set(list.map((e) => e.created_by ?? '').filter(Boolean))].sort()

  // Every filter but the status tab, so each tab can say how many it would show.
  const q = filters.search.trim().toLowerCase()
  const matching = list.filter(
    (e) =>
      (filters.when === 'all' || (filters.when === 'upcoming' ? e.event_date >= today : e.event_date < today)) &&
      (!filters.chapel || e.officers.some((o) => o.chapel_name === filters.chapel)) &&
      (!filters.creator || e.created_by === filters.creator) &&
      (!q || [e.name, e.purpose ?? '', e.venue, e.created_by ?? '', ...e.officers.flatMap((o) => [o.name, o.chapel_name ?? ''])].some((v) => v.toLowerCase().includes(q))),
  )
  const shown = matching.filter((e) => e.status === tab)
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const filtering = q || filters.when !== 'all' || filters.chapel || filters.creator

  const setFilter = (patch: Partial<typeof noFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(0)
  }

  const failed = (e: unknown, name: string) => {
    if (e instanceof ApiError && e.status === 409) {
      toast(`${name} was already decided. The list has been refreshed.`)
      events.reload()
    } else toast(`${name} could not be updated. Please try again.`)
  }

  const approve = async (e: CommunityEvent) => {
    setBusyId(e.event_id)
    try {
      events.keep(e.event_id, await config.approve(e.event_id))
      toast(config.approvedToast(e.name))
    } catch (err) {
      failed(err, e.name)
    }
    setBusyId(null)
  }

  const tabLabel = config.tabs.find((t) => t.status === tab)?.label ?? tab

  return (
    <Layout activeHref={config.activeHref}>
      <h1 className="font-serif text-4xl font-semibold text-stone-900">{config.title}</h1>
      <p className="mt-1 max-w-2xl text-stone-600">{config.intro}</p>

      <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="group" aria-label="Show events">
        {config.tabs.map((t) => (
          <button
            key={t.status}
            type="button"
            onClick={() => {
              setTab(t.status)
              setPage(0)
            }}
            aria-pressed={tab === t.status}
            className={`${chipClass(tab === t.status)} shrink-0`}
          >
            {t.label}{' '}
            <span className={`tabular-nums ${tab === t.status ? 'text-white/85' : 'text-stone-500'}`}>{matching.filter((e) => e.status === t.status).length}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <label htmlFor="ea-search" className="sr-only">
            Search events
          </label>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-stone-500" />
          <input
            id="ea-search"
            type="search"
            value={filters.search}
            onChange={(e) => setFilter({ search: e.target.value })}
            placeholder="Event, venue, officer, or chapel"
            className={`${inputClass} pl-10`}
          />
        </div>
        <select aria-label="When" value={filters.when} onChange={(e) => setFilter({ when: e.target.value })} className={inputClass}>
          <option value="all">All dates</option>
          <option value="upcoming">Today and later</option>
          <option value="past">Past</option>
        </select>
        <select aria-label="Chapel" value={filters.chapel} onChange={(e) => setFilter({ chapel: e.target.value })} className={inputClass}>
          <option value="">All chapels</option>
          {chapelNames.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select aria-label="Set up by" value={filters.creator} onChange={(e) => setFilter({ creator: e.target.value })} className={inputClass}>
          <option value="">Set up by anyone</option>
          {creators.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      {filtering && (
        <div className="mt-1 flex justify-end">
          <button type="button" onClick={() => setFilter(noFilters)} className={linkButton}>
            Clear filters
          </button>
        </div>
      )}

      <section aria-label={`${tabLabel} events`} className={`${cardClass} mt-4`}>
        {events.state === 'loading' ? (
          <LoadingState what="events" variant="events" />
        ) : events.state === 'error' ? (
          <ErrorState what="events" help="If it keeps happening, tell the system administrator." onRetry={events.reload} />
        ) : shown.length ? (
          <>
            <EventList
              events={shown.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)}
              actions={(e) =>
                e.status === actionable && (
                  <>
                    <button type="button" onClick={() => approve(e)} disabled={busyId === e.event_id} className={`${btnPrimary} disabled:cursor-wait disabled:opacity-70`}>
                      <Icon name="check" className="size-4" />
                      {busyId === e.event_id ? config.approvingLabel : config.approveLabel}
                    </button>
                    <button type="button" onClick={() => setRejecting(e)} disabled={busyId === e.event_id} className={btnSecondary}>
                      Reject
                    </button>
                  </>
                )
              }
            />
            <Pagination page={currentPage} pageSize={PAGE_SIZE} total={shown.length} onPage={setPage} noun={['event', 'events']} />
          </>
        ) : filtering ? (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-stone-800">No events match</p>
            <p className="mt-1 text-sm text-stone-600">Try fewer words, or another date or chapel.</p>
            <button type="button" onClick={() => setFilter(noFilters)} className={`${linkButton} mt-2`}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-stone-800">{tab === actionable ? config.emptyTitle : `No events here`}</p>
            {tab === actionable && <p className="mt-1 text-sm text-stone-600">{config.emptyHelp}</p>}
          </div>
        )}
      </section>

      <RejectDialog
        target={
          rejecting && {
            key: rejecting.event_id,
            title: `Reject ${rejecting.name}?`,
            detail: `${formatEventWhen(rejecting)} · ${rejecting.venue}. ${config.rejectDetail}`,
            confirmLabel: 'Reject event',
          }
        }
        onClose={() => setRejecting(null)}
        onReject={async (reason) => {
          if (!rejecting) return undefined
          try {
            events.keep(rejecting.event_id, await rejectEvent(config.portal, rejecting.event_id, reason))
            toast(`${rejecting.name} rejected. The organizers can see your reason.`)
            setRejecting(null)
            return undefined
          } catch (err) {
            if (err instanceof ApiError && err.status === 422) return err.field('reason') ?? err.message
            setRejecting(null)
            failed(err, rejecting.name)
            return undefined
          }
        }}
      />
    </Layout>
  )
}
