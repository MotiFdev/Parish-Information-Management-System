import { useRef, useState, type KeyboardEvent } from 'react'
import { Link } from '../../../components/Link'
import { ErrorState, LoadingState } from '../../../components/ui/DataState'
import { Icon } from '../../../components/ui/Icon'
import { cardClass } from '../../../components/ui/styles'
import type { PreviewState } from '../../../lib/preview'
import { isOverdue, waitingDays } from '../../priest/waiting'
import type { QueueRequest as StaffRequest, QueueStatus as StaffRequestStatus } from './dashboardApi'

const tabs: { status: StaffRequestStatus; label: string; empty: string }[] = [
  { status: 'Pending', label: 'Pending', empty: 'No new requests. They appear here as people send them.' },
  {
    status: 'Under Verification',
    label: 'Under verification',
    empty: 'Nothing is being checked right now. Requests with the priest are on the Record Requests page.',
  },
]

const submitted = (iso: string) => {
  const d = waitingDays(iso)
  return d <= 0 ? 'Submitted today' : d === 1 ? 'Submitted yesterday' : `Submitted ${d} days ago`
}

function DocStatus({ r }: { r: StaffRequest }) {
  if (r.detailsReturned) return <span className="font-semibold text-brown">Waiting for corrected details</span>
  if (r.status === 'Pending')
    return (
      <span>
        {r.documents.total} {r.documents.total === 1 ? 'document' : 'documents'} to check
      </span>
    )
  return (
    <span>
      {r.documents.verified} of {r.documents.total} verified
      {r.documents.resubmit > 0 && <span className="font-semibold text-brown"> · {r.documents.resubmit} needs resubmission</span>}
    </span>
  )
}

interface Props {
  preview: PreviewState
  requests: StaffRequest[]
  onRetry?: () => void
  className?: string
}

// Section 4.3 asks for pending requests split into Pending and Under Verification;
// a tab each keeps the two queues apart without doubling the card's height.
export function RequestsCard({ preview, requests, onRetry, className = '' }: Props) {
  const [active, setActive] = useState<StaffRequestStatus>('Pending')
  const tabRefs = useRef<Partial<Record<StaffRequestStatus, HTMLButtonElement | null>>>({})
  const rows = requests.filter((r) => r.status === active).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
  const current = tabs.find((t) => t.status === active)!

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = tabs[(tabs.findIndex((t) => t.status === active) + 1) % tabs.length].status
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <section aria-labelledby="requests-title" className={`${cardClass} flex flex-col ${className}`}>
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-100 px-5 pt-4">
        <div className="pb-3">
          <h2 id="requests-title" className="font-serif text-2xl font-semibold text-stone-900">
            Record requests
          </h2>
          <p className="text-sm text-stone-600">Oldest first</p>
        </div>
        <div role="tablist" aria-label="Request status" className="-mb-px flex gap-1">
          {tabs.map((t) => {
            const selected = t.status === active
            const count = requests.filter((r) => r.status === t.status).length
            return (
              <button
                key={t.status}
                ref={(el) => {
                  tabRefs.current[t.status] = el
                }}
                id={`req-tab-${t.status}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="req-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(t.status)}
                onKeyDown={onKey}
                className={`inline-flex min-h-11 items-center gap-1.5 border-b-[3px] px-3 text-sm font-semibold whitespace-nowrap ${
                  selected ? 'border-gold-deep text-forest' : 'border-transparent text-stone-600 hover:text-forest'
                }`}
              >
                {t.label}
                {preview === 'ready' && <span className="tabular-nums">{count}</span>}
              </button>
            )
          })}
        </div>
      </header>

      <div id="req-panel" role="tabpanel" aria-labelledby={`req-tab-${active}`} className="flex flex-1 flex-col">
        {preview === 'loading' ? (
          <LoadingState what="record requests" variant="list" />
        ) : preview === 'error' ? (
          <ErrorState what="record requests" help="If it keeps happening, tell the system administrator." onRetry={onRetry} />
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-stone-600">{current.empty}</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {rows.map((r) => {
              const days = waitingDays(r.submittedAt)
              return (
                <li key={r.number}>
                  <Link
                    href={`/secretary/requests?request=${r.number}`}
                    className="flex min-h-11 flex-col gap-1 px-5 py-3 hover:bg-ivory/60 sm:flex-row sm:items-start sm:gap-4"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-stone-900">
                        {r.recordType} · {r.requestType.toLowerCase()}
                      </span>
                      <span className="block text-sm text-stone-600">
                        {r.subject} · {r.number}
                        {r.assignee && <> · checking: {r.assignee}</>}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm sm:text-right">
                      <span className={`block font-semibold ${isOverdue(days) ? 'text-brown' : 'text-stone-700'}`}>{submitted(r.submittedAt)}</span>
                      <span className="block text-stone-600">
                        <DocStatus r={r} />
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="mt-auto border-t border-stone-100 px-5 py-3">
        <Link
          href="/secretary/requests"
          className="-mx-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-forest hover:underline"
        >
          Open Record Requests
          <Icon name="chevronRight" className="size-4" />
        </Link>
      </div>
    </section>
  )
}
