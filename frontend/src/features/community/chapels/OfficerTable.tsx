import { Icon } from '../../../components/ui/Icon'
import { OfficerAvatar } from '../../parishioner/chapels/OfficerAvatar'
import { ApprovalTag, RejectionNote } from '../ApprovalTag'
import { sonaShortName, type Chapel, type Officer, type SonaOption } from './chapelsData'

const cellLabel = 'block text-xs text-stone-500 lg:hidden'

interface Props {
  sonas: SonaOption[]
  rows: Officer[]
  /** Set on the all-officers list; the chapel drawer already says which chapel. */
  chapels?: Map<string, Chapel>
  label: string
  onEdit: (o: Officer) => void
  onRemove: (o: Officer) => void
}

// One officer per row; below the lg breakpoint each row stacks into a small card.
export function OfficerTable({ sonas, rows, chapels, label, onEdit, onRemove }: Props) {
  return (
    <table aria-label={label} className="w-full text-left text-sm">
      <thead className="border-b border-stone-200 text-stone-600 max-lg:sr-only">
        <tr>
          <th scope="col" className="px-5 py-3 font-semibold">
            Name
          </th>
          <th scope="col" className="px-3 py-3 font-semibold">
            Position and ministry
          </th>
          {chapels && (
            <th scope="col" className="px-3 py-3 font-semibold">
              Chapel
            </th>
          )}
          <th scope="col" className="px-3 py-3 font-semibold">
            Contact
          </th>
          <th scope="col" className="px-5 py-3">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-stone-100">
        {rows.map((o) => {
          const chapel = chapels?.get(o.chapelId)
          return (
            <tr key={o.id} className="max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-4 max-lg:gap-y-2.5 max-lg:px-5 max-lg:py-4">
              <td className="lg:px-5 lg:py-3 max-lg:col-span-2">
                <div className="flex items-start gap-3">
                  <OfficerAvatar officer={o} size="sm" />
                  <div className="min-w-0">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-stone-900">
                      {o.name}
                      <ApprovalTag status={o.status} />
                    </span>
                    <span className="block text-stone-600">{o.age !== null ? `${o.age} years old` : 'Age not given'}</span>
                    <RejectionNote status={o.status} note={o.reviewNote} />
                  </div>
                </div>
              </td>
              <td className="lg:px-3 lg:py-3">
                <span className={cellLabel}>Position and ministry</span>
                <span className={`block ${o.position === 'President' ? 'font-semibold text-forest' : 'text-stone-800'}`}>{o.position}</span>
                <span className="block text-xs text-stone-600">{o.ministry || 'No ministry'}</span>
              </td>
              {chapels && (
                <td className="lg:px-3 lg:py-3">
                  <span className={cellLabel}>Chapel</span>
                  <span className="block text-stone-800">{chapel?.name ?? 'Unknown chapel'}</span>
                  <span className="block text-xs text-stone-600">
                    {chapel ? sonaShortName(sonas, chapel.sonaId) : ''} · {o.term} term
                  </span>
                </td>
              )}
              <td className="lg:px-3 lg:py-3 max-lg:col-span-2 sm:max-lg:col-span-1">
                <span className={cellLabel}>Contact</span>
                {o.contact ? (
                  <a href={`tel:${o.contact.replace(/\s/g, '')}`} className="block text-forest tabular-nums hover:underline">
                    {o.contact}
                  </a>
                ) : (
                  <span className="block text-stone-500">No number</span>
                )}
                <span className="block text-xs break-words text-stone-600">{o.fb ? `Facebook: ${o.fb}` : 'No Facebook account'}</span>
              </td>
              <td className="lg:px-5 lg:py-2 max-lg:col-span-2">
                <div className="flex gap-2 lg:justify-end">
                  <button
                    type="button"
                    onClick={() => onEdit(o)}
                    aria-label={`Edit ${o.name}`}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 font-semibold text-forest hover:border-forest/50 hover:bg-forest-soft lg:flex-none"
                  >
                    <Icon name="pencil" className="size-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(o)}
                    aria-label={`Remove ${o.name}`}
                    className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 font-semibold text-stone-700 hover:bg-stone-100 lg:flex-none"
                  >
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
