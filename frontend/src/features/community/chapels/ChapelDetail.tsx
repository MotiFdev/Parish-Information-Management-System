import { useState } from 'react'
import { Icon } from '../../../components/ui/Icon'
import { btnPrimary, btnSecondary, inputClass } from '../../../components/ui/styles'
import { ApprovalTag, RejectionNote } from '../ApprovalTag'
import { byRank, CURRENT_TERM, type Chapel, type Officer, type SonaOption } from './chapelsData'
import { OfficerTable } from './OfficerTable'

interface Props {
  sonas: SonaOption[]
  chapel: Chapel
  officers: Officer[]
  onEdit: () => void
  /** Only for a chapel the PPC hasn't approved. */
  onDelete: () => void
  onAddOfficer: (term: number) => void
  onImport: (term: number) => void
  onEditOfficer: (o: Officer) => void
  onRemoveOfficer: (o: Officer) => void
  onClose: () => void
}

export function ChapelDetail({ sonas, chapel: c, officers, onEdit, onDelete, onAddOfficer, onImport, onEditOfficer, onRemoveOfficer, onClose }: Props) {
  const own = officers.filter((o) => o.chapelId === c.id)
  // Always offer the current term, even before anyone is listed for it.
  const terms = [...new Set([CURRENT_TERM, ...own.map((o) => o.term)])].sort((a, b) => b - a)
  const [term, setTerm] = useState(CURRENT_TERM)
  const council = own.filter((o) => o.term === term).sort(byRank)
  const approved = c.status === 'Approved'

  return (
    <article aria-labelledby="ch-title" className="flex h-full flex-col bg-white">
      <header className="flex items-start gap-3 border-b border-stone-200 px-5 pt-5 pb-4">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
            {sonas.find((s) => s.id === c.sonaId)?.name}
            {!c.active && <span className="rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-semibold text-stone-700">Inactive</span>}
            <ApprovalTag status={c.status} />
          </p>
          <h2 id="ch-title" className="mt-1 font-serif text-3xl font-semibold text-stone-900">
            {c.name}
          </h2>
          <RejectionNote status={c.status} note={c.reviewNote} />
        </div>
        <button type="button" onClick={onClose} aria-label="Close details" className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800">
          <Icon name="close" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="px-5 py-5">
          <h3 className="mb-3 font-semibold text-stone-900">Chapel details</h3>
          <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
            {(
              [
                ['Patron', c.patron || 'Not recorded'],
                ['Fiesta', c.fiesta || 'Not recorded'],
                ['Contact number', c.contact || 'None'],
                ['Facebook account', c.fbAccount || 'None'],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-stone-600">{k}</dt>
                <dd className="font-medium break-words text-stone-900">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="ch-officers" className="border-t border-stone-100">
          <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5 pb-3">
            <div>
              <h3 id="ch-officers" className="font-semibold text-stone-900">
                Officers
              </h3>
              <p className="text-sm text-stone-600">
                {council.length} listed for the {term} term
              </p>
            </div>
            <div className="w-40">
              <label htmlFor="ch-term" className="mb-1 block text-xs font-medium text-stone-600">
                Term
              </label>
              <select id="ch-term" value={term} onChange={(e) => setTerm(Number(e.target.value))} className={inputClass}>
                {terms.map((t) => (
                  <option key={t} value={t}>
                    {t}
                    {t === CURRENT_TERM ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {!approved ? (
            <div className="mx-5 mb-5 rounded-xl border border-dashed border-stone-300 px-4 py-8 text-center">
              <p className="font-semibold text-stone-800">Officers can be added once the PPC approves this chapel</p>
              <p className="mt-1 text-sm text-stone-600">
                {c.status === 'Pending' ? 'It is waiting in the PPC’s approvals.' : 'Edit the chapel to send it to the PPC again.'}
              </p>
            </div>
          ) : council.length ? (
            <OfficerTable sonas={sonas} rows={council} label={`${c.name} officers, ${term} term`} onEdit={onEditOfficer} onRemove={onRemoveOfficer} />
          ) : (
            <div className="mx-5 mb-5 rounded-xl border border-dashed border-stone-300 px-4 py-8 text-center">
              <p className="font-semibold text-stone-800">No officers for {term} yet</p>
              <p className="mt-1 text-sm text-stone-600">Add them one at a time, or import the list the chapel sent as a spreadsheet.</p>
            </div>
          )}
        </section>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-stone-200 bg-ivory px-5 py-4 sm:flex-row sm:justify-end [&>button]:whitespace-nowrap">
        {!approved && (
          <button type="button" onClick={onDelete} className={`${btnSecondary} text-red-700`}>
            Delete chapel
          </button>
        )}
        <button type="button" onClick={onEdit} className={btnSecondary}>
          <Icon name="pencil" className="size-4.5" />
          Edit chapel
        </button>
        {approved && (
          <>
            <button type="button" onClick={() => onImport(term)} className={btnSecondary}>
              <Icon name="upload" className="size-4.5" />
              Import list
            </button>
            <button type="button" onClick={() => onAddOfficer(term)} className={btnPrimary}>
              <Icon name="userPlus" className="size-4.5" />
              Add officer
            </button>
          </>
        )}
      </div>
    </article>
  )
}
