import { Icon } from '../../../components/ui/Icon'
import { Pagination } from '../../../components/ui/Pagination'
import { inputClass } from '../../../components/ui/styles'
import { sacraments, type AwaitingRequest, type RequestType, type Sacrament } from '../sampleData'
import { isOverdue, waitingDays, waitingText } from '../waiting'
import { dateTime, requestTitle } from './labels'

// Below lg each row becomes a block, so cells carry their own label.
const cellLabel = 'block text-xs text-stone-500 lg:hidden'

interface Props {
  /** The current page of matching requests. */
  requests: AwaitingRequest[]
  /** How many match the search and filters, across all pages. */
  matching: number
  total: number
  search: string
  onSearch: (v: string) => void
  page: number
  pageSize: number
  onPage: (page: number) => void
  recordType: Sacrament | 'all'
  requestType: RequestType | 'all'
  onRecordType: (v: Sacrament | 'all') => void
  onRequestType: (v: RequestType | 'all') => void
  onClear: () => void
  onView: (r: AwaitingRequest) => void
}

export function ApprovalsTable({ requests, matching, total, search, onSearch, page, pageSize, onPage, recordType, requestType, onRecordType, onRequestType, onClear, onView }: Props) {
  return (
    <>
      <div className="flex flex-col gap-2 lg:flex-row">
        <div className="relative lg:w-80">
          <label htmlFor="approval-search" className="sr-only">
            Search requests
          </label>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-stone-500" />
          <input
            id="approval-search"
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Name, request number, or secretary"
            className={`${inputClass} pl-10`}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 lg:w-96">
          <div>
            <label htmlFor="filter-record" className="sr-only">
              Record type
            </label>
            <select id="filter-record" value={recordType} onChange={(e) => onRecordType(e.target.value as Sacrament | 'all')} className={inputClass}>
              <option value="all">All records</option>
              {sacraments.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-request" className="sr-only">
              Request type
            </label>
            <select id="filter-request" value={requestType} onChange={(e) => onRequestType(e.target.value as RequestType | 'all')} className={inputClass}>
              <option value="all">All requests</option>
              <option value="Certificate Request">Certificates</option>
              <option value="Record Correction">Corrections</option>
              <option value="New Registration">New registrations</option>
            </select>
          </div>
        </div>
        <p className="self-center text-sm text-stone-600 lg:ml-auto">{total} waiting, oldest first</p>
      </div>

      <section aria-label="Requests waiting" className="mt-4 rounded-2xl border border-stone-200 bg-white">
        {requests.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-stone-800">
              No requests match{search.trim() ? <> “{search.trim()}”</> : ' these filters'}
            </p>
            <p className="mt-1 text-sm text-stone-600">Search by the person’s name, the request number, or the secretary who checked it.</p>
            <button type="button" onClick={onClear} className="mt-2 inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-forest hover:bg-forest-soft">
              Clear search and filters
            </button>
          </div>
        ) : (
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
                  Checked by
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Documents
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Waiting
                </th>
                <th scope="col" className="px-5 py-3">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {requests.map((r) => {
                const days = waitingDays(r.verifiedAt)
                return (
                  <tr key={r.number} className="max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-4 max-lg:gap-y-2.5 max-lg:px-5 max-lg:py-4 sm:max-lg:grid-cols-4">
                    <td className="lg:px-5 lg:py-3 max-lg:col-span-2 sm:max-lg:col-span-4">
                      <span className="block font-semibold text-stone-900">{requestTitle(r)}</span>
                      <span className="block text-stone-600">{r.number}</span>
                    </td>
                    <td className="text-stone-800 lg:px-3 lg:py-3">
                      <span className={cellLabel}>For</span>
                      {r.subject}
                    </td>
                    <td className="lg:px-3 lg:py-3">
                      <span className={cellLabel}>Checked by</span>
                      <span className="block text-stone-800">{r.verifiedBy}</span>
                      <span className="block text-xs text-stone-600">{dateTime.format(new Date(r.verifiedAt))}</span>
                    </td>
                    <td className="lg:px-3 lg:py-3">
                      <span className={cellLabel}>Documents</span>
                      <span className="flex items-center gap-1 text-stone-800">
                        <Icon name="check" className="size-4 text-forest" strokeWidth={2.5} />
                        {r.documents.length} verified
                      </span>
                    </td>
                    <td className="lg:px-3 lg:py-3">
                      <span className={cellLabel}>Waiting</span>
                      <span className={`font-semibold ${isOverdue(days) ? 'text-brown' : 'text-stone-700'}`}>{waitingText(days)}</span>
                    </td>
                    <td className="lg:px-5 lg:py-2 max-lg:col-span-2 sm:max-lg:col-span-4">
                      <div className="flex lg:justify-end">
                        <button
                          type="button"
                          onClick={() => onView(r)}
                          aria-label={`View details: ${requestTitle(r)} for ${r.subject}`}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 font-semibold whitespace-nowrap text-forest hover:border-forest/50 hover:bg-forest-soft max-lg:w-full max-lg:justify-center"
                        >
                          View details
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {matching > 0 && <Pagination page={page} pageSize={pageSize} total={matching} onPage={onPage} noun={['request', 'requests']} />}
      </section>
    </>
  )
}
