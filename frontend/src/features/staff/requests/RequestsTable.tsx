import { Icon } from '../../../components/ui/Icon'
import { Pagination } from '../../../components/ui/Pagination'
import { inputClass } from '../../../components/ui/styles'
import { StatusBadge } from '../../parishioner/home/StatusBadge'
import { sacraments, type Sacrament } from '../../priest/sampleData'
import { noFilters, requestStatuses, stage, type Filters, type OfficeRequest, type RequestStatus, type RequestType } from './requestsData'

const dateFormat = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })
const cellLabel = 'block text-xs text-stone-500 lg:hidden'


function DocSummary({ r }: { r: OfficeRequest }) {
  const verified = r.documents.filter((d) => d.status === 'Verified').length
  const problem = r.documents.filter((d) => d.status === 'Needs Resubmission' || d.status === 'Rejected').length
  return (
    <span>
      {verified} of {r.documents.length} verified
      {problem > 0 && <span className="block font-semibold text-brown">{problem} need attention</span>}
    </span>
  )
}

interface Props {
  rows: OfficeRequest[]
  matching: number
  total: number
  filters: Filters
  onFilters: (f: Partial<Filters>) => void
  onClear: () => void
  page: number
  pageSize: number
  onPage: (p: number) => void
  onView: (r: OfficeRequest) => void
}

export function RequestsTable({ rows, matching, total, filters, onFilters, onClear, page, pageSize, onPage, onView }: Props) {
  const rangeError = filters.from && filters.to && filters.from > filters.to ? 'The start date is after the end date.' : undefined
  const filtering = (Object.keys(noFilters) as (keyof Filters)[]).some((k) => filters[k] !== noFilters[k])

  return (
    <>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
        <div className="relative md:col-span-2 xl:col-span-1">
          <label htmlFor="req-search" className="sr-only">
            Search requests
          </label>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-stone-500" />
          <input
            id="req-search"
            type="search"
            value={filters.search}
            onChange={(e) => onFilters({ search: e.target.value })}
            placeholder="Name, requester, or request number"
            className={`${inputClass} pl-10`}
          />
        </div>
        <select aria-label="Record type" value={filters.recordType} onChange={(e) => onFilters({ recordType: e.target.value as Sacrament | 'all' })} className={inputClass}>
          <option value="all">All records</option>
          {sacraments.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select aria-label="Request type" value={filters.requestType} onChange={(e) => onFilters({ requestType: e.target.value as RequestType | 'all' })} className={inputClass}>
          <option value="all">All request types</option>
          <option value="Certificate Request">Certificate requests</option>
          <option value="New Registration">New registrations</option>
          <option value="Record Correction">Record corrections</option>
        </select>
        <select aria-label="Status" value={filters.status} onChange={(e) => onFilters({ status: e.target.value as RequestStatus | 'all' })} className={inputClass}>
          <option value="all">All statuses</option>
          {requestStatuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="req-from" className="mb-1 block text-xs font-medium text-stone-600">
            Submitted from
          </label>
          <input
            id="req-from"
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => onFilters({ from: e.target.value })}
            aria-invalid={rangeError ? true : undefined}
            aria-describedby={rangeError ? 'req-range-error' : undefined}
            className={`${inputClass} w-44`}
          />
        </div>
        <div>
          <label htmlFor="req-to" className="mb-1 block text-xs font-medium text-stone-600">
            to
          </label>
          <input id="req-to" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => onFilters({ to: e.target.value })} className={`${inputClass} w-44`} />
        </div>
        {filtering && (
          <button type="button" onClick={onClear} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-forest hover:bg-forest-soft">
            Clear filters
          </button>
        )}
        <p className="ml-auto self-center text-sm text-stone-600">{total} requests in all</p>
        {rangeError && (
          <p id="req-range-error" className="w-full text-sm text-red-700">
            {rangeError}
          </p>
        )}
      </div>

      <section aria-label="Record requests" className="mt-4 rounded-2xl border border-stone-200 bg-white">
        {matching === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-stone-800">No requests match these filters</p>
            <p className="mt-1 text-sm text-stone-600">Try a wider date range, or search by request number.</p>
            <button type="button" onClick={onClear} className="mt-2 inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-forest hover:bg-forest-soft">
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-200 text-stone-600 max-lg:sr-only">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Request
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    For
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Submitted
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Documents
                  </th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((r) => (
                  <tr key={r.number} className="max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-4 max-lg:gap-y-2.5 max-lg:px-5 max-lg:py-4 sm:max-lg:grid-cols-4">
                    <td className="lg:px-5 lg:py-3 max-lg:col-span-2 sm:max-lg:col-span-4">
                      <span className="block font-semibold text-stone-900">
                        {r.recordType} · {r.requestType.toLowerCase()}
                      </span>
                      <span className="block text-stone-600">{r.number}</span>
                    </td>
                    <td className="lg:px-3 lg:py-3">
                      <span className={cellLabel}>For</span>
                      <span className="block text-stone-900">{r.subject}</span>
                      <span className="block text-xs text-stone-600">by {r.client.name}</span>
                    </td>
                    <td className="lg:px-3 lg:py-3">
                      <span className={cellLabel}>Status</span>
                      <StatusBadge status={r.status} />
                      <span className="mt-1 block text-xs text-stone-600">{stage(r)}</span>
                    </td>
                    <td className="text-stone-800 lg:px-3 lg:py-3">
                      <span className={cellLabel}>Submitted</span>
                      {dateFormat.format(new Date(r.submittedAt))}
                    </td>
                    <td className="text-stone-800 lg:px-3 lg:py-3">
                      <span className={cellLabel}>Documents</span>
                      <DocSummary r={r} />
                    </td>
                    <td className="lg:px-5 lg:py-2 max-lg:col-span-2 sm:max-lg:col-span-4">
                      <div className="flex lg:justify-end">
                        <button
                          type="button"
                          onClick={() => onView(r)}
                          aria-label={`View details: ${r.number}, ${r.subject}`}
                          className="inline-flex min-h-11 items-center rounded-lg border border-stone-300 bg-white px-3.5 font-semibold whitespace-nowrap text-forest hover:border-forest/50 hover:bg-forest-soft max-lg:w-full max-lg:justify-center"
                        >
                          View details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageSize={pageSize} total={matching} onPage={onPage} noun={['request', 'requests']} />
          </>
        )}
      </section>
    </>
  )
}
