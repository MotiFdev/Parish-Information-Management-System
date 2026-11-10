import { Icon } from '../../../components/ui/Icon'
import { Pagination } from '../../../components/ui/Pagination'
import { inputClass } from '../../../components/ui/styles'
import { chapelName, fullName, sonaName, summary, type DirectorySona, type Parishioner } from './parishionerData'

const cellLabel = 'block text-xs text-stone-500 lg:hidden'

export interface DirectoryFilters {
  search: string
  sonaId: string
  chapelId: string
  status: 'active' | 'archived' | 'all'
}

interface Props {
  rows: Parishioner[]
  matching: number
  total: number
  byId: Map<string, Parishioner>
  sonas: DirectorySona[]
  filters: DirectoryFilters
  onFilters: (f: Partial<DirectoryFilters>) => void
  onClear: () => void
  page: number
  pageSize: number
  onPage: (p: number) => void
  onView: (p: Parishioner) => void
  onEdit: (p: Parishioner) => void
}

export function ParishionersTable({ rows, matching, total, byId, sonas, filters, onFilters, onClear, page, pageSize, onPage, onView, onEdit }: Props) {
  const sona = sonas.find((s) => s.id === filters.sonaId)
  const filtering = filters.search || filters.sonaId || filters.chapelId || filters.status !== 'active'

  return (
    <>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
        <div className="relative md:col-span-2 xl:col-span-1">
          <label htmlFor="pq" className="sr-only">
            Search parishioners
          </label>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-stone-500" />
          <input
            id="pq"
            type="search"
            value={filters.search}
            onChange={(e) => onFilters({ search: e.target.value })}
            placeholder="Name, contact number, or email"
            className={`${inputClass} pl-10`}
          />
        </div>
        <select aria-label="Sona" value={filters.sonaId} onChange={(e) => onFilters({ sonaId: e.target.value, chapelId: '' })} className={inputClass}>
          <option value="">All Sonas</option>
          {sonas.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Chapel"
          value={filters.chapelId}
          onChange={(e) => onFilters({ chapelId: e.target.value })}
          disabled={!sona}
          className={`${inputClass} disabled:bg-stone-50 disabled:text-stone-500`}
        >
          <option value="">{sona ? 'All chapels in this Sona' : 'Choose a Sona first'}</option>
          {sona?.chapels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          value={filters.status}
          onChange={(e) => onFilters({ status: e.target.value as DirectoryFilters['status'] })}
          className={inputClass}
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">Active and archived</option>
        </select>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-stone-600">
        <p>{total} parishioners in the directory</p>
        {filtering && (
          <button type="button" onClick={onClear} className="inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-forest hover:bg-forest-soft">
            Clear filters
          </button>
        )}
      </div>

      <section aria-label="Parishioner directory" className="mt-2 rounded-2xl border border-stone-200 bg-white">
        {matching === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-stone-800">No parishioners match</p>
            <p className="mt-1 text-sm text-stone-600">Try a surname alone, or include archived records.</p>
            <button
              type="button"
              onClick={onClear}
              className="mt-2 inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-forest hover:bg-forest-soft"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-200 text-stone-600 max-lg:sr-only">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Name
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Sona and chapel
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Contact
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Parents
                  </th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((p) => {
                  const parents = [p.fatherId, p.motherId].map((id) => (id ? byId.get(id) : undefined)).filter(Boolean) as Parishioner[]
                  return (
                    <tr key={p.id} className="max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-4 max-lg:gap-y-2.5 max-lg:px-5 max-lg:py-4 sm:max-lg:grid-cols-3">
                      <td className="lg:px-5 lg:py-3 max-lg:col-span-2 sm:max-lg:col-span-3">
                        <span className="flex flex-wrap items-baseline gap-x-2 font-semibold text-stone-900">
                          {fullName(p)}
                          {p.archived && <span className="text-xs font-semibold text-stone-600">Archived</span>}
                        </span>
                        <span className="block text-stone-600">{summary(p)}</span>
                      </td>
                      <td className="lg:px-3 lg:py-3">
                        <span className={cellLabel}>Sona and chapel</span>
                        {p.chapelId ? (
                          <>
                            <span className="block text-stone-800">{sonaName(sonas, p.sonaId).replace(/^Sona /, '')}</span>
                            <span className="block text-xs text-stone-600">{chapelName(sonas, p.sonaId, p.chapelId)}</span>
                          </>
                        ) : (
                          <span className="text-stone-500">Not recorded</span>
                        )}
                      </td>
                      <td className="lg:px-3 lg:py-3">
                        <span className={cellLabel}>Contact</span>
                        <span className="block text-stone-800 tabular-nums">{p.contact || <span className="text-stone-500">None</span>}</span>
                        {p.email && <span className="block text-xs break-all text-stone-600">{p.email}</span>}
                      </td>
                      <td className="text-stone-800 lg:px-3 lg:py-3">
                        <span className={cellLabel}>Parents</span>
                        {parents.length ? parents.map((x) => x.firstName).join(' & ') : <span className="text-stone-500">Not recorded</span>}
                      </td>
                      <td className="lg:px-5 lg:py-2 max-lg:col-span-2 sm:max-lg:col-span-3">
                        <div className="flex gap-2 lg:justify-end">
                          <button
                            type="button"
                            onClick={() => onView(p)}
                            aria-label={`View ${fullName(p)}`}
                            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-stone-300 bg-white px-3.5 font-semibold text-forest hover:border-forest/50 hover:bg-forest-soft lg:flex-none"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => onEdit(p)}
                            aria-label={`Edit ${fullName(p)}`}
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
            </table>
            <Pagination page={page} pageSize={pageSize} total={matching} onPage={onPage} noun={['parishioner', 'parishioners']} />
          </>
        )}
      </section>
    </>
  )
}
