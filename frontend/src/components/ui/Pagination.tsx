import { Icon } from './Icon'

interface Props {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
  /** What the rows are, for the "Showing 1 to 10 of 12 requests" line. */
  noun: [singular: string, plural: string]
}

const pageButton =
  'inline-flex min-h-11 items-center gap-1 rounded-lg px-3 font-semibold text-forest hover:bg-forest-soft disabled:cursor-not-allowed disabled:text-stone-400 disabled:hover:bg-transparent'

export function Pagination({ page, pageSize, total, onPage, noun }: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : page * pageSize + 1
  const last = Math.min(total, (page + 1) * pageSize)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-5 py-3 text-sm">
      <p aria-live="polite" className="text-stone-600">
        Showing <span className="font-semibold text-stone-800 tabular-nums">{first}</span> to{' '}
        <span className="font-semibold text-stone-800 tabular-nums">{last}</span> of{' '}
        <span className="font-semibold text-stone-800 tabular-nums">{total}</span> {total === 1 ? noun[0] : noun[1]}
      </p>
      {pageCount > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-1">
          <button type="button" onClick={() => onPage(page - 1)} disabled={page === 0} className={pageButton}>
            <Icon name="chevronLeft" className="size-4" />
            Previous
          </button>
          <span className="px-2 text-stone-600 tabular-nums">
            Page {page + 1} of {pageCount}
          </span>
          <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pageCount - 1} className={pageButton}>
            Next
            <Icon name="chevronRight" className="size-4" />
          </button>
        </nav>
      )}
    </div>
  )
}
