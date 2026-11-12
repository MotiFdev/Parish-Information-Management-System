import { Icon } from '../../../components/ui/Icon'
import type { CommunityEvent, EventHistoryEntry } from './eventsApi'

const PRIEST_ROLE = 'Parish Priest'

/** "Nov 10, 2026, 2:30 PM" in parish time. */
function stamp(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const badge: Record<string, { label: string; className: string }> = {
  Pending: { label: 'Waiting for PPC', className: 'bg-gold-soft text-brown' },
  'Pre-Approved': { label: 'Waiting for priest', className: 'bg-brown-soft text-brown' },
  Approved: { label: 'Approved', className: 'bg-forest-soft text-forest' },
}

/** Where an event stands, in words each portal reads the same way. */
export function EventStatusBadge({ event }: { event: CommunityEvent }) {
  const { label, className } =
    event.status === 'Rejected'
      ? { label: event.rejected_by_role === 'priest' ? 'Rejected by priest' : 'Rejected by PPC', className: 'bg-red-50 text-red-700' }
      : badge[event.status]
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${className}`}>{label}</span>
}

type StepState = 'done' | 'current' | 'rejected' | 'upcoming'

/** Submitted → PPC pre-approval → priest's final approval. */
export function EventProgress({ event }: { event: CommunityEvent }) {
  const rejectedAt = event.status === 'Rejected' ? (event.rejected_by_role === 'priest' ? 2 : 1) : null
  const reached = { Pending: 1, 'Pre-Approved': 2, Approved: 3, Rejected: rejectedAt ?? 1 }[event.status]
  const submitted = [...event.history].reverse().find((h) => h.action === 'Submitted' || h.action === 'Resubmitted')

  const steps: Array<{ label: string; detail: string }> = [
    { label: 'Submitted', detail: submitted ? `${submitted.by ?? 'An officer'} · ${stamp(submitted.at)}` : (event.created_by ?? '') },
    {
      label: 'PPC pre-approval',
      detail: event.preapproved_by
        ? `${event.preapproved_by} · ${stamp(event.preapproved_at)}`
        : rejectedAt === 1
          ? `${event.reviewed_by ?? 'PPC'} · ${stamp(event.reviewed_at)}`
          : 'Waiting',
    },
    {
      label: 'Priest’s approval',
      detail: event.status === 'Approved' || rejectedAt === 2 ? `${event.reviewed_by ?? 'Parish priest'} · ${stamp(event.reviewed_at)}` : reached === 2 ? 'Waiting' : 'After the PPC',
    },
  ]
  const stateOf = (i: number): StepState => (i === rejectedAt ? 'rejected' : i < reached || event.status === 'Approved' ? 'done' : i === reached ? 'current' : 'upcoming')

  return (
    <ol className="mt-3 grid grid-cols-3 gap-2" aria-label="Approval progress">
      {steps.map((step, i) => {
        const state = stateOf(i)
        return (
          <li key={step.label} className="relative flex min-w-0 flex-col items-start" aria-current={state === 'current' ? 'step' : undefined}>
            <span className="flex w-full items-center gap-2">
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  state === 'done'
                    ? 'bg-forest text-white'
                    : state === 'rejected'
                      ? 'bg-red-600 text-white'
                      : state === 'current'
                        ? 'bg-gold text-forest-dark ring-4 ring-gold-soft'
                        : 'border-2 border-stone-200 bg-white text-stone-400'
                }`}
              >
                {state === 'done' ? (
                  <Icon name="check" className="size-3.5" strokeWidth={3} />
                ) : state === 'rejected' ? (
                  <Icon name="close" className="size-3.5" strokeWidth={3} />
                ) : (
                  i + 1
                )}
              </span>
              {i < steps.length - 1 && <span className={`h-0.5 flex-1 rounded ${i < reached && state !== 'rejected' ? 'bg-forest' : 'bg-stone-200'}`} aria-hidden="true" />}
            </span>
            <span className={`mt-1.5 text-xs leading-tight ${state === 'current' || state === 'rejected' ? 'font-semibold text-stone-800' : 'text-stone-600'}`}>
              {step.label}
              <span className="sr-only">: {state === 'done' ? 'done' : state === 'rejected' ? 'rejected' : state === 'current' ? 'in progress' : 'not yet'}</span>
            </span>
            <span className="mt-0.5 max-w-full truncate text-xs text-stone-500" title={step.detail}>
              {step.detail}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

const fieldLabels: Record<string, string> = { name: 'name', purpose: 'purpose', venue: 'venue', event_date: 'date', start_time: 'time', officers: 'officers' }

function describe(h: EventHistoryEntry) {
  const byPriest = h.by_role === PRIEST_ROLE
  switch (h.action) {
    case 'Submitted':
      return 'Set up and sent to the PPC'
    case 'Resubmitted':
      return h.changes?.length ? `Edited (${h.changes.map((c) => fieldLabels[c] ?? c).join(', ')}) and sent back to the PPC` : 'Sent back to the PPC'
    case 'Pre-Approved':
      return 'Pre-approved by the PPC and sent to the parish priest'
    case 'Approved':
      return 'Approved by the parish priest'
    case 'Rejected':
      return byPriest ? 'Rejected by the parish priest' : 'Rejected by the PPC'
  }
}

const dotClass: Record<EventHistoryEntry['action'], string> = {
  Submitted: 'bg-stone-400',
  Resubmitted: 'bg-stone-400',
  'Pre-Approved': 'bg-gold',
  Approved: 'bg-forest',
  Rejected: 'bg-red-600',
}

/** Every step the event went through, oldest first, behind a toggle. */
export function EventHistory({ event }: { event: CommunityEvent }) {
  if (!event.history.length) return null
  return (
    <details className="group mt-2">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg text-sm font-semibold text-forest hover:underline">
        <Icon name="clock" className="size-4" />
        Approval history ({event.history.length})
        <Icon name="chevronDown" className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <ol className="mt-1 space-y-3 border-l-2 border-stone-100 pl-4">
        {event.history.map((h, i) => (
          <li key={`${h.at}-${i}`} className="relative">
            <span className={`absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full ring-2 ring-white ${dotClass[h.action]}`} aria-hidden="true" />
            <p className="text-sm text-stone-800">{describe(h)}</p>
            <p className="text-xs text-stone-500">
              {h.by ?? 'Someone no longer on the system'}
              {h.by_role ? ` (${h.by_role})` : ''} · {stamp(h.at)}
            </p>
            {h.note && <p className="mt-1 rounded-md bg-red-50 px-2 py-1 text-xs text-red-900">{h.note}</p>}
          </li>
        ))}
      </ol>
    </details>
  )
}
