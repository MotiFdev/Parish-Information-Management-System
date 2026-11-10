import { useState } from 'react'
import { useToast } from '../../components/toast/toastContext'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ErrorState, LoadingState } from '../../components/ui/DataState'
import { Icon } from '../../components/ui/Icon'
import { Pagination } from '../../components/ui/Pagination'
import { btnPrimary, cardClass } from '../../components/ui/styles'
import { pesoExact } from '../priest/reports/reportFormat'
import { deleteOffering, useOfferings, type Offering } from './offeringsApi'
import { OfferingForm } from './OfferingForm'

const PAGE_SIZE = 10
const day = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' })
const dayOf = (d: string) => day.format(new Date(`${d}T12:00:00+08:00`))

interface Props {
  /** Month range, 'YYYY-MM'. */
  from: string
  to: string
  /** Shown under the heading, e.g. "November 2025 to November 2026". */
  period?: string
  /** Called after any add, edit, or delete, so a report built on the ledger can refresh. */
  onChanged?: () => void
  className?: string
}

// The offerings ledger: what the parish received, entry by entry. Staff and
// the priest both add and correct entries; the Financial report adds them up.
export function OfferingsLedger({ from, to, period, onChanged, className = '' }: Props) {
  const { toast } = useToast()
  const { state, reload } = useOfferings(from, to)
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<Offering | 'new' | null>(null)
  const [removing, setRemoving] = useState<Offering | null>(null)
  const [busy, setBusy] = useState(false)

  const ledger = typeof state === 'object' ? state : null
  const rows = ledger?.data ?? []
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const shown = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  const changed = () => {
    reload()
    onChanged?.()
  }

  const remove = async () => {
    if (!removing) return
    setBusy(true)
    const error = await deleteOffering(removing.id)
    setBusy(false)
    if (error) return toast(error)
    toast(`Deleted the ${removing.category.toLowerCase()} of ${dayOf(removing.received_on)}.`)
    setRemoving(null)
    changed()
  }

  return (
    <section aria-labelledby="ledger-title" className={`${cardClass} ${className}`}>
      <header className="flex flex-col gap-3 border-b border-stone-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="ledger-title" className="font-serif text-xl font-semibold text-stone-900">
            Offerings ledger
          </h2>
          <p className="text-sm text-stone-600">
            {period ? `${period} · ` : ''}
            {ledger
              ? `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}, ${pesoExact.format(ledger.total)} in all`
              : 'Every collection, offering, and fee received'}
          </p>
        </div>
        <button type="button" onClick={() => setEditing('new')} disabled={!ledger} className={`${btnPrimary} shrink-0`}>
          <Icon name="plus" className="size-4.5" />
          Record offering
        </button>
      </header>

      {state === 'loading' ? (
        <LoadingState what="the offerings ledger" />
      ) : state === 'error' ? (
        <ErrorState what="the offerings ledger" help="If it keeps happening, tell the system administrator." onRetry={reload} />
      ) : rows.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="font-semibold text-stone-800">No offerings recorded in this period</p>
          <p className="mt-1 text-sm text-stone-600">Use Record offering to add a collection, Mass intention, or fee.</p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-stone-100">
            {shown.map((o) => (
              <li key={o.id} className="flex flex-col gap-2 px-5 py-3 text-sm sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold text-stone-900">{o.category}</span>
                    <span className="text-stone-600">{dayOf(o.received_on)}</span>
                  </p>
                  {o.description && <p className="break-words text-stone-700">{o.description}</p>}
                  <p className="text-xs text-stone-600">Recorded by {o.recorded_by ?? 'a former user'}</p>
                </div>
                <p className="font-semibold text-stone-900 tabular-nums sm:w-36 sm:text-right">{pesoExact.format(o.amount)}</p>
                <div className="flex gap-1 max-sm:-ml-3">
                  <button
                    type="button"
                    onClick={() => setEditing(o)}
                    aria-label={`Edit ${o.category}, ${dayOf(o.received_on)}`}
                    className="grid size-11 place-items-center rounded-lg text-stone-600 hover:bg-stone-100 hover:text-forest"
                  >
                    <Icon name="pencil" className="size-4.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoving(o)}
                    aria-label={`Delete ${o.category}, ${dayOf(o.received_on)}`}
                    className="grid size-11 place-items-center rounded-lg text-stone-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Icon name="close" className="size-4.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={current} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} noun={['entry', 'entries']} />
        </>
      )}

      <OfferingForm
        editing={editing}
        categories={ledger?.categories ?? []}
        onClose={() => setEditing(null)}
        onSaved={(o, isNew) => {
          setEditing(null)
          toast(isNew ? `Recorded ${pesoExact.format(o.amount)} for ${o.category.toLowerCase()} on ${dayOf(o.received_on)}.` : 'Offering updated.')
          if (isNew) setPage(0)
          changed()
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
        title="Delete this offering?"
        confirmLabel="Delete"
        tone="danger"
        busy={busy}
        busyLabel="Deleting…"
      >
        {removing && (
          <p>
            {removing.category}, {dayOf(removing.received_on)}, {pesoExact.format(removing.amount)}. Only delete an entry made by mistake; the audit log keeps a
            record of it.
          </p>
        )}
      </ConfirmDialog>
    </section>
  )
}
