import { Pagination } from '../../../components/ui/Pagination'
import type { Sacrament } from '../sampleData'
import { peopleHeading, type RegisterEntry } from '../registerData'

const dateFormat = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' })
const dateLabel: Record<Sacrament, string> = { Baptism: 'Baptized', Confirmation: 'Confirmed', Marriage: 'Married', Burial: 'Buried' }
const nameLabel: Record<Sacrament, string> = { Baptism: 'Name', Confirmation: 'Name', Marriage: 'Couple', Burial: 'Deceased' }

// Below lg each row becomes a block, so cells carry their own label.
const cellLabel = 'block text-xs text-stone-500 lg:hidden'

interface Props {
  type: Sacrament
  entries: RegisterEntry[]
  matching: number
  search: string
  onSearch: (v: string) => void
  page: number
  pageSize: number
  onPage: (p: number) => void
  onView: (e: RegisterEntry) => void
}

export function RegisterTable({ type, entries, matching, search, onSearch, page, pageSize, onPage, onView }: Props) {
  return (
    <>
      <section aria-label={`${type} register entries`} className="rounded-2xl border border-stone-200 bg-white">
        {matching === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-stone-800">{search.trim() ? <>No entries match “{search.trim()}”</> : 'No entries in this register yet'}</p>
            {search.trim() && (
              <>
                <p className="mt-1 text-sm text-stone-600">Try a surname alone, or a book number such as “book 12”.</p>
                <button
                  type="button"
                  onClick={() => onSearch('')}
                  className="mt-2 inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-forest hover:bg-forest-soft"
                >
                  Clear search
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-200 text-stone-600 max-lg:sr-only">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    {nameLabel[type]}
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    {dateLabel[type]}
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    {peopleHeading[type]}
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Book · page · line
                  </th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {entries.map((e) => (
                  <tr key={e.id} className="max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-4 max-lg:gap-y-2.5 max-lg:px-5 max-lg:py-4 sm:max-lg:grid-cols-3">
                    <td className="lg:px-5 lg:py-3 max-lg:col-span-2 sm:max-lg:col-span-3">
                      <span className="flex flex-wrap items-baseline gap-x-2 font-semibold text-stone-900">
                        {e.subject}
                        {e.pending_correction ? (
                          <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-brown">Correction waiting</span>
                        ) : (
                          e.correction && <span className="text-xs font-semibold text-brown">Corrected</span>
                        )}
                      </span>
                    </td>
                    <td className="text-stone-800 lg:px-3 lg:py-3">
                      <span className={cellLabel}>{dateLabel[type]}</span>
                      {dateFormat.format(new Date(`${e.date}T12:00:00+08:00`))}
                    </td>
                    <td className="text-stone-800 lg:px-3 lg:py-3">
                      <span className={cellLabel}>{peopleHeading[type]}</span>
                      {e.people.replace(/^[^:]+: /, '')}
                    </td>
                    <td className="text-stone-800 tabular-nums lg:px-3 lg:py-3">
                      <span className={cellLabel}>Book · page · line</span>
                      {e.register.book} · {e.register.page} · {e.register.line}
                    </td>
                    <td className="lg:px-5 lg:py-2 max-lg:col-span-2 sm:max-lg:col-span-3">
                      <div className="flex lg:justify-end">
                        <button
                          type="button"
                          onClick={() => onView(e)}
                          aria-label={`View details: ${e.subject}`}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 font-semibold whitespace-nowrap text-forest hover:border-forest/50 hover:bg-forest-soft max-lg:w-full max-lg:justify-center"
                        >
                          View details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageSize={pageSize} total={matching} onPage={onPage} noun={['entry', 'entries']} />
          </>
        )}
      </section>
    </>
  )
}
