import { Icon } from '../../../components/ui/Icon'
import { ApprovalTag, RejectionNote } from '../ApprovalTag'
import { CURRENT_TERM, type Chapel, type Officer, type SonaOption } from './chapelsData'

const cellLabel = 'block text-xs text-stone-500 lg:hidden'

interface Props {
  sonas: SonaOption[]
  rows: Chapel[]
  /** This term's officers, for the president and the head count. */
  officers: Officer[]
  onView: (c: Chapel) => void
  onEdit: (c: Chapel) => void
}

// The directory reads Sona by Sona, the way the parish is organised, so each
// Sona gets its own heading row above its chapels.
export function ChapelsTable({ sonas, rows, officers, onView, onEdit }: Props) {
  const groups = sonas.map((s) => ({ sona: s, chapels: rows.filter((c) => c.sonaId === s.id) })).filter((g) => g.chapels.length)

  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-stone-200 text-stone-600 max-lg:sr-only">
        <tr>
          <th scope="col" className="px-5 py-3 font-semibold">
            Chapel
          </th>
          <th scope="col" className="px-3 py-3 font-semibold">
            Fiesta
          </th>
          <th scope="col" className="px-3 py-3 font-semibold">
            President
          </th>
          <th scope="col" className="px-3 py-3 font-semibold">
            Chapel contact
          </th>
          <th scope="col" className="px-5 py-3">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      {groups.map(({ sona, chapels }) => (
        <tbody key={sona.id} className="divide-y divide-stone-100 border-b border-stone-200 last:border-b-0">
          <tr className="bg-ivory/70">
            <th scope="colgroup" colSpan={5} className="px-5 py-2.5 text-left">
              <span className="font-serif text-lg font-semibold text-stone-900">{sona.name}</span>
              <span className="ml-2 text-sm font-normal text-stone-600">
                {chapels.length} {chapels.length === 1 ? 'chapel' : 'chapels'}
              </span>
            </th>
          </tr>
          {chapels.map((c) => {
            const council = officers.filter((o) => o.chapelId === c.id)
            const president = council.find((o) => o.position === 'President' && o.status === 'Approved')
            return (
              <tr key={c.id} className="max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-4 max-lg:gap-y-2.5 max-lg:px-5 max-lg:py-4 sm:max-lg:grid-cols-3">
                <td className="lg:px-5 lg:py-3 max-lg:col-span-2 sm:max-lg:col-span-3">
                  <span className="flex flex-wrap items-baseline gap-x-2 font-semibold text-stone-900">
                    {c.name}
                    {!c.active && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-700">Inactive</span>}
                    <ApprovalTag status={c.status} />
                  </span>
                  <span className="block text-stone-600">{c.patron ? `Patron: ${c.patron}` : 'No patron recorded'}</span>
                  <RejectionNote status={c.status} note={c.reviewNote} />
                </td>
                <td className="text-stone-800 lg:px-3 lg:py-3">
                  <span className={cellLabel}>Fiesta</span>
                  {c.fiesta || <span className="text-stone-500">Not recorded</span>}
                </td>
                <td className="lg:px-3 lg:py-3">
                  <span className={cellLabel}>President</span>
                  {president ? (
                    <>
                      <span className="block text-stone-800">{president.name}</span>
                      <span className="block text-xs text-stone-600 tabular-nums">{president.contact || 'No number'}</span>
                    </>
                  ) : (
                    <span className="block text-stone-500">None for {CURRENT_TERM}</span>
                  )}
                </td>
                <td className="lg:px-3 lg:py-3">
                  <span className={cellLabel}>Chapel contact</span>
                  <span className="block text-stone-800 tabular-nums">{c.contact || <span className="text-stone-500">No number</span>}</span>
                  {c.fbAccount && <span className="block text-xs break-words text-stone-600">Facebook: {c.fbAccount}</span>}
                </td>
                <td className="lg:px-5 lg:py-2 max-lg:col-span-2 sm:max-lg:col-span-3">
                  <div className="flex gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => onView(c)}
                      aria-label={`View ${c.name} and its officers`}
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-stone-300 bg-white px-3.5 font-semibold whitespace-nowrap text-forest hover:border-forest/50 hover:bg-forest-soft lg:flex-none"
                    >
                      Officers ({council.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(c)}
                      aria-label={`Edit ${c.name}`}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 font-semibold text-forest hover:bg-forest-soft lg:flex-none"
                    >
                      <Icon name="pencil" className="size-4" />
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      ))}
    </table>
  )
}
