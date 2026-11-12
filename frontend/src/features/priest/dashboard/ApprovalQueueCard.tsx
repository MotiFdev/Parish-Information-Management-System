import { Link } from '../../../components/Link'
import { ErrorState, LoadingState } from '../../../components/ui/DataState'
import { Icon } from '../../../components/ui/Icon'
import { cardClass } from '../../../components/ui/styles'
import type { PreviewState } from '../../../lib/preview'
import type { AwaitingRequest } from '../sampleData'
import { isOverdue, waitingDays, waitingText } from '../waiting'

const PREVIEW_COUNT = 6

interface Props {
  preview: PreviewState
  requests: AwaitingRequest[]
  onRetry?: () => void
  className?: string
}

// The side panel beside the trends: a short, oldest-first list of what needs a
// signature. Each row opens that request; the full queue is one click away.
export function ApprovalQueueCard({ preview, requests, onRetry, className = '' }: Props) {
  const queue = [...requests].sort((a, b) => a.verifiedAt.localeCompare(b.verifiedAt))
  const shown = queue.slice(0, PREVIEW_COUNT)

  return (
    <section aria-labelledby="queue-title" className={`${cardClass} flex flex-col ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
        <div>
          <h2 id="queue-title" className="font-serif text-2xl font-semibold text-stone-900">
            Waiting for your signature
          </h2>
          <p className="text-sm text-stone-600">Oldest first</p>
        </div>
      </header>

      {preview === 'loading' ? (
        <LoadingState what="requests awaiting approval" variant="list" rows={3} />
      ) : preview === 'error' ? (
        <ErrorState what="requests awaiting approval" help="If it keeps happening, the parish office can check the system." onRetry={onRetry} />
      ) : queue.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-12 text-center">
          <Icon name="seal" className="size-8 text-forest" />
          <p className="font-semibold text-stone-800">Nothing is waiting for your signature</p>
          <p className="max-w-sm text-sm text-stone-600">Requests appear here once the secretary has checked the register and the documents.</p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-stone-100">
            {shown.map((r) => {
              const days = waitingDays(r.verifiedAt)
              return (
                <li key={r.number}>
                  <Link href={`/priest/records/verify?request=${r.number}`} className="flex min-h-11 items-start gap-3 px-5 py-3 hover:bg-ivory/60">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-stone-900">
                        {r.recordType} {r.requestType === 'Record Correction' ? 'correction' : 'certificate'}
                      </span>
                      <span className="block truncate text-sm text-stone-600">
                        {r.subject} · {r.number}
                      </span>
                    </span>
                    <span className={`shrink-0 pt-0.5 text-xs font-semibold ${isOverdue(days) ? 'text-brown' : 'text-stone-600'}`}>{waitingText(days)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
          <div className="mt-auto border-t border-stone-100 px-5 py-3">
            <Link
              href="/priest/records/verify"
              className="-mx-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-forest hover:underline"
            >
              {queue.length > PREVIEW_COUNT ? `View all ${queue.length} requests` : 'Open Certificate Approvals'}
              <Icon name="chevronRight" className="size-4" />
            </Link>
          </div>
        </>
      )}
    </section>
  )
}
