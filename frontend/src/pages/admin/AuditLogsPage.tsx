import { Fragment, useEffect, useMemo, useState } from 'react'
import { ErrorState, LoadingState } from '../../components/ui/DataState'
import { Field } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { btnSecondary, cardClass, inputClass } from '../../components/ui/styles'
import { useToast } from '../../components/toast/toastContext'
import { exportAuditLogs, listAuditLogs, type AuditEntry, type AuditFilters, type AuditPage } from '../../features/admin/audit/auditApi'
import { AdminLayout } from '../../layouts/AdminLayout'
import { ApiError } from '../../lib/api'

const PAGE_SIZE = 15
const DEFAULT_TZ = 'Asia/Manila'

// Shown until the first response brings the server's list.
const fallbackCategories = [
  { key: 'signins', label: 'Sign-ins' },
  { key: 'accounts', label: 'Accounts & permissions' },
  { key: 'requests', label: 'Record requests' },
  { key: 'documents', label: 'Document verification' },
  { key: 'certificates', label: 'Certificate release' },
  { key: 'records', label: 'Register corrections' },
  { key: 'system', label: 'Security, backups & exports' },
]

function formatters(timeZone: string) {
  return {
    day: new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone }),
    time: new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone }),
    full: new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'medium', timeZone }),
  }
}
type Formats = ReturnType<typeof formatters>

/** The entry's local calendar day; the server sends timestamps with the parish's offset. */
const dayOf = (e: AuditEntry) => e.at.slice(0, 10)
function groupByDay(entries: AuditEntry[]) {
  const groups: [day: string, entries: AuditEntry[]][] = []
  for (const e of entries) {
    const last = groups[groups.length - 1]
    if (last && last[0] === dayOf(e)) last[1].push(e)
    else groups.push([dayOf(e), [e]])
  }
  return groups
}
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const humanize = (key: string) => key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

// Below xl each row becomes a block, so cells carry their own label.
const cellLabel = 'block text-xs text-stone-500 xl:hidden'

/** Waits until typing pauses before searching, so each keystroke is not a request. */
function useDebounced<T>(value: T, ms = 300) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return settled
}

function Change({ field, before, after }: { field: string; before: string | null; after: string | null }) {
  return (
    <span className="block">
      <span className="font-mono text-xs text-stone-600">{field}</span>{' '}
      <span className="text-stone-600 line-through decoration-stone-400">{before ?? 'empty'}</span>
      <span aria-label="changed to" className="px-1 text-stone-500">
        →
      </span>
      <span className="font-semibold text-stone-900">{after ?? 'empty'}</span>
    </span>
  )
}

function Details({ entry, formats }: { entry: AuditEntry; formats: Formats }) {
  const changes = Object.entries(entry.changes)
  const extra = Object.entries(entry.extra ?? {})
  return (
    <div className="grid gap-5 bg-ivory/50 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        {(
          [
            ['Time', formats.full.format(new Date(entry.at))],
            ['Action code', entry.action],
            ['Table', entry.table],
            ['Record ID', entry.recordId],
            ['IP address', entry.ip],
            ['Log ID', entry.id],
          ] as const
        ).map(([k, v]) => (
          <Fragment key={k}>
            <dt className="text-stone-600">{k}</dt>
            <dd className={`break-all text-stone-900 ${k === 'Time' ? '' : 'font-mono text-xs leading-5'}`}>{v}</dd>
          </Fragment>
        ))}
      </dl>
      <div className="min-w-0">
        {changes.length > 0 ? (
          <table className="w-full text-left text-sm">
            <caption className="pb-1.5 text-left font-semibold text-stone-800">Changed fields</caption>
            <thead className="text-xs text-stone-600">
              <tr className="border-b border-stone-200">
                <th scope="col" className="py-1.5 pr-3 font-semibold">
                  Field
                </th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">
                  Before
                </th>
                <th scope="col" className="py-1.5 font-semibold">
                  After
                </th>
              </tr>
            </thead>
            <tbody>
              {changes.map(([field, [before, after]]) => (
                <tr key={field} className="border-b border-stone-200/70 align-top">
                  <th scope="row" className="py-1.5 pr-3 font-mono text-xs leading-5 font-normal text-stone-700">
                    {field}
                  </th>
                  <td className="py-1.5 pr-3 break-words text-stone-700">{before ?? <span className="text-stone-500">empty</span>}</td>
                  <td className="py-1.5 font-semibold break-words text-stone-900">{after ?? <span className="text-stone-500">empty</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-stone-600">No fields changed in this action.</p>
        )}
        {extra.length > 0 && (
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
            {extra.map(([k, v]) => (
              <Fragment key={k}>
                <dt className="text-stone-600">{humanize(k)}</dt>
                <dd className="break-all text-stone-900">{v ?? <span className="text-stone-500">empty</span>}</dd>
              </Fragment>
            ))}
          </dl>
        )}
        {entry.note && <p className="mt-3 text-sm text-stone-700">{entry.note}</p>}
      </div>
    </div>
  )
}

const pageButton =
  'inline-flex min-h-11 items-center gap-1 rounded-lg px-3 font-semibold text-forest hover:bg-forest-soft disabled:cursor-not-allowed disabled:text-stone-400 disabled:hover:bg-transparent'

export default function AuditLogsPage() {
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  const [data, setData] = useState<AuditPage | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  /** Which request the data on screen answers; differs from `requestKey` while a new one is in flight. */
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null)

  const search = useDebounced(query.trim())
  const rangeError = from && to && from > to ? 'The start date is after the end date.' : undefined
  const filters: AuditFilters = useMemo(() => ({ search, category, from, to }), [search, category, from, to])
  const filtering = Boolean(search || category !== 'all' || from || to)
  const formats = useMemo(() => formatters(data?.timezone ?? DEFAULT_TZ), [data?.timezone])
  const requestKey = JSON.stringify([filters, page, reloadKey])
  const loading = loadedKey !== requestKey

  useEffect(() => {
    if (rangeError) return
    let cancelled = false
    listAuditLogs(filters, page, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return
        setLoadError(null)
        setData(result)
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof ApiError ? e.message : 'Something went wrong.')
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(requestKey)
      })
    return () => {
      cancelled = true
    }
  }, [filters, page, requestKey, rangeError])

  const set = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setPage(0)
    setOpen(null)
  }
  const clearFilters = () => {
    setQuery('')
    setCategory('all')
    setFrom('')
    setTo('')
    setPage(0)
  }

  const exportAs = async (format: 'csv' | 'json') => {
    setExporting(format)
    try {
      await exportAuditLogs(filters, format)
      const n = data?.total ?? 0
      toast(`Downloaded ${n} ${n === 1 ? 'entry' : 'entries'} as ${format.toUpperCase()}. The export is recorded in this log.`)
      // The export itself is a new entry; show it.
      setReloadKey((k) => k + 1)
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'The export could not be downloaded. Please try again.')
    } finally {
      setExporting(null)
    }
  }

  const entries = data?.entries ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canExport = !loadError && total > 0 && !rangeError && exporting === null
  const categories = data?.categories ?? fallbackCategories

  return (
    <AdminLayout activeHref="/admin/settings/logs">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-stone-900">Audit Logs</h1>
          <p className="mt-1 max-w-2xl text-stone-600">
            Who did what, when, and from where. Entries are recorded by the system and can’t be edited or deleted.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {(['csv', 'json'] as const).map((f) => (
            <button
              key={f}
              type="button"
              disabled={!canExport}
              onClick={() => exportAs(f)}
              className={`${btnSecondary} flex-1 disabled:cursor-not-allowed disabled:opacity-50 md:flex-none`}
            >
              <Icon name="download" className="size-4.5" />
              {exporting === f ? 'Preparing…' : `Export ${f.toUpperCase()}`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]">
        <Field label="Search" htmlFor="log-search">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-stone-500" />
            <input
              id="log-search"
              type="search"
              value={query}
              onChange={(e) => set(setQuery)(e.target.value)}
              placeholder="Person, record, activity, or IP"
              className={`${inputClass} pl-10`}
            />
          </div>
        </Field>
        <Field label="Activity" htmlFor="log-category">
          <select id="log-category" value={category} onChange={(e) => set(setCategory)(e.target.value)} className={inputClass}>
            <option value="all">All activity</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From" htmlFor="log-from" error={rangeError}>
          <input
            id="log-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => set(setFrom)(e.target.value)}
            aria-invalid={rangeError ? true : undefined}
            aria-describedby={rangeError ? 'log-from-error' : undefined}
            className={inputClass}
          />
        </Field>
        <Field label="To" htmlFor="log-to">
          <input id="log-to" type="date" value={to} min={from || undefined} onChange={(e) => set(setTo)(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <section aria-labelledby="log-title" aria-busy={loading} className={`${cardClass} mt-4`}>
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-stone-100 px-5 py-3">
          <h2 id="log-title" className="font-semibold text-stone-800">
            Activity, newest first
          </h2>
          {filtering && (
            <button type="button" onClick={clearFilters} className="-mr-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-forest hover:bg-forest-soft">
              Clear filters
            </button>
          )}
        </header>

        {loadError ? (
          <ErrorState what="the audit log" help={`${loadError} If it keeps happening, check the server and API logs.`} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : !data ? (
          <LoadingState what="the audit log" />
        ) : total === 0 && !filtering ? (
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <Icon name="list" className="size-7 text-forest" />
            <p className="font-semibold text-stone-800">Nothing recorded yet</p>
            <p className="max-w-md text-sm text-stone-600">
              Sign-ins, account changes, request status changes, document checks, register corrections, and certificate releases
              appear here as they happen.
            </p>
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <p className="font-semibold text-stone-800">No entries match these filters</p>
            <p className="max-w-md text-sm text-stone-600">Try a wider date range or a different activity type.</p>
            <button type="button" onClick={clearFilters} className={btnSecondary}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-200 text-stone-600 max-xl:sr-only">
                <tr>
                  <th scope="col" className="w-32 px-5 py-3 font-semibold">
                    Time
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Who
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Activity
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Changed fields
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    IP address
                  </th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              {/* One tbody per day: the date reads once as a heading instead of on every row. */}
              {groupByDay(entries).map(([day, dayEntries]) => (
                <tbody key={day}>
                  <tr>
                    <th colSpan={6} scope="colgroup" className="border-b border-stone-100 bg-ivory/60 px-5 py-2 text-left font-serif text-lg font-semibold text-forest">
                      {formats.day.format(new Date(dayEntries[0].at))}
                    </th>
                  </tr>
                  {dayEntries.map((e) => {
                    const changes = Object.entries(e.changes)
                    const expanded = open === e.id
                    return (
                      <Fragment key={e.id}>
                        <tr className={`border-b border-stone-100 align-top max-xl:grid max-xl:grid-cols-2 max-xl:gap-x-4 max-xl:gap-y-2 max-xl:px-5 max-xl:py-4 sm:max-xl:grid-cols-4 ${expanded ? 'bg-ivory/50' : ''}`}>
                          <td className="text-stone-700 tabular-nums xl:px-5 xl:py-3 max-xl:order-1">
                            <span className={cellLabel}>Time</span>
                            {formats.time.format(new Date(e.at))}
                          </td>
                          <td className="xl:px-3 xl:py-3 max-xl:order-2">
                            <span className={cellLabel}>Who</span>
                            {e.user ? (
                              <>
                                <span className="block font-semibold text-stone-900">{e.user.name}</span>
                                <span className="block text-stone-600">{e.user.role}</span>
                              </>
                            ) : (
                              <span className="block font-semibold text-stone-700">System</span>
                            )}
                          </td>
                          <td className="xl:px-3 xl:py-3 max-xl:order-0 max-xl:col-span-2 sm:max-xl:col-span-4">
                            <span className={`block font-semibold ${e.alert ? 'text-red-700' : 'text-stone-900'}`}>{e.label}</span>
                            <span className="block break-words text-stone-600">{e.record}</span>
                          </td>
                          <td className="min-w-0 xl:px-3 xl:py-3 max-xl:order-4 max-xl:col-span-2 sm:max-xl:col-span-4">
                            <span className={cellLabel}>Changed fields</span>
                            {changes.length > 0 ? (
                              <>
                                <Change field={changes[0][0]} before={changes[0][1][0]} after={changes[0][1][1]} />
                                {changes.length > 1 && <span className="text-xs text-stone-600">and {plural(changes.length - 1, 'more field')}</span>}
                              </>
                            ) : (
                              <span className="text-stone-500">None</span>
                            )}
                          </td>
                          <td className="break-all text-stone-700 tabular-nums xl:px-3 xl:py-3 max-xl:order-3">
                            <span className={cellLabel}>IP address</span>
                            {e.ip}
                          </td>
                          <td className="xl:px-5 xl:py-1.5 max-xl:order-5 max-xl:col-span-2 max-xl:-mb-2 sm:max-xl:col-span-4">
                            <button
                              type="button"
                              aria-expanded={expanded}
                              aria-controls={`log-details-${e.id}`}
                              aria-label={`${expanded ? 'Hide' : 'Show'} details: ${e.label}, ${formats.time.format(new Date(e.at))}`}
                              onClick={() => setOpen(expanded ? null : e.id)}
                              className="-ml-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold whitespace-nowrap text-forest hover:bg-forest-soft xl:ml-auto"
                            >
                              {expanded ? 'Hide' : 'Details'}
                              <Icon name="chevronDown" className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                            </button>
                          </td>
                        </tr>
                        {expanded && (
                          <tr id={`log-details-${e.id}`} className="border-b border-stone-200 max-xl:block">
                            <td colSpan={6} className="max-xl:block">
                              <Details entry={e} formats={formats} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              ))}
            </table>

            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <p aria-live="polite" className="text-stone-600">
                Showing <span className="font-semibold text-stone-800 tabular-nums">{page * PAGE_SIZE + 1}</span> to{' '}
                <span className="font-semibold text-stone-800 tabular-nums">{page * PAGE_SIZE + entries.length}</span> of{' '}
                <span className="font-semibold text-stone-800 tabular-nums">{total}</span> {total === 1 ? 'entry' : 'entries'}
              </p>
              {pageCount > 1 && (
                <nav aria-label="Pages" className="flex items-center gap-1">
                  <button type="button" onClick={() => setPage(page - 1)} disabled={page === 0 || loading} className={pageButton}>
                    <Icon name="chevronLeft" className="size-4" />
                    Newer
                  </button>
                  <span className="px-2 text-stone-600 tabular-nums">
                    Page {page + 1} of {pageCount}
                  </span>
                  <button type="button" onClick={() => setPage(page + 1)} disabled={page >= pageCount - 1 || loading} className={pageButton}>
                    Older
                    <Icon name="chevronRight" className="size-4" />
                  </button>
                </nav>
              )}
            </div>
          </div>
        )}
      </section>
    </AdminLayout>
  )
}
