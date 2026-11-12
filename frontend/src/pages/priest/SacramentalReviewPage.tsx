import { useState } from 'react'
import { useToast } from '../../components/toast/toastContext'
import { ErrorState, LoadingState } from '../../components/ui/DataState'
import { Drawer } from '../../components/ui/Drawer'
import { Icon } from '../../components/ui/Icon'
import { cardClass, chipClass, inputClass } from '../../components/ui/styles'
import { DocumentViewer, type ViewableFile } from '../../components/DocumentViewer'
import type { RegisterEntry } from '../../features/priest/registerData'
import { CorrectionReview } from '../../features/priest/registers/CorrectionReview'
import { EntryDetail } from '../../features/priest/registers/EntryDetail'
import { RegisterTable } from '../../features/priest/registers/RegisterTable'
import { sacramentPlural, sacraments, type Sacrament } from '../../features/priest/sampleData'
import { useRegister } from '../../features/staff/sacraments/registerApi'
import { PriestLayout } from '../../layouts/PriestLayout'
import { api } from '../../lib/api'
import { usePreviewState } from '../../lib/preview'
import { navigate, useLocation } from '../../lib/router'

const PATH = '/priest/records/sacramental'
const PAGE_SIZE = 10

/** Everything a person might type to find an entry: names in any field, and "book 12" style references. */
const haystack = (e: RegisterEntry) =>
  [e.subject, e.people, `book ${e.register.book}`, `page ${e.register.page}`, ...e.details.map(([, v]) => v)].join(' ').toLowerCase()

export default function SacramentalReviewPage() {
  const preview = usePreviewState()
  const { query } = useLocation()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [onlyWaiting, setOnlyWaiting] = useState(false)
  const [page, setPage] = useState(0)
  const [viewing, setViewing] = useState<ViewableFile | null>(null)

  // The chosen register and the open entry live in the URL, so a link (the bell's, for one) can open either.
  const type = sacraments.find((s) => s.toLowerCase() === query.get('register')) ?? 'Baptism'
  const { state: list, reload, upsert } = useRegister(type, '/api/priest/sacramental-records')
  // The design preview switch (?preview=) still overrides what the server returned.
  const state = preview !== 'ready' ? preview : list === 'error' ? 'error' : list === 'loading' ? 'loading' : 'ready'
  const loaded = typeof list === 'object' && state !== 'empty' ? list : null
  const entries = loaded?.data ?? []
  const open = entries.find((e) => e.id === query.get('entry')) ?? null
  const waitingHere = loaded?.waiting?.[type] ?? 0

  const hrefFor = (t: Sacrament, entry?: string) => {
    const params = new URLSearchParams({ register: t.toLowerCase() })
    if (entry) params.set('entry', entry)
    if (query.get('preview')) params.set('preview', query.get('preview')!)
    return `${PATH}?${params}`
  }
  const close = () => navigate(hrefFor(type), { replace: true })

  const selectRegister = (t: Sacrament) => {
    setSearch('')
    setOnlyWaiting(false)
    setPage(0)
    navigate(hrefFor(t), { replace: true })
  }

  const viewScan = async (scan: RegisterEntry['scans'][number]) => {
    const base = { label: scan.label, file: scan.file }
    if (!scan.document_id) return setViewing(base)
    setViewing({ ...base, loading: true })
    try {
      const { url } = await api<{ url: string }>(`/api/documents/${scan.document_id}/link`)
      setViewing((v) => (v?.file === scan.file ? { ...base, url } : v))
    } catch {
      setViewing((v) => (v?.file === scan.file ? { ...base, error: 'The scan could not be opened. Close this and try again.' } : v))
    }
  }

  const q = search.trim().toLowerCase()
  const filtered = entries.filter((e) => (!onlyWaiting || e.pending_correction) && (!q || haystack(e).includes(q)))
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const rows = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
  const ready = state === 'ready' || state === 'empty'

  return (
    <PriestLayout activeHref={PATH}>
      <h1 className="font-serif text-4xl font-semibold text-stone-900">Sacramental Review</h1>
      <p className="mt-1 max-w-2xl text-stone-600">
        The parish registers. Open an entry to see every field and the scanned register page, and to decide corrections the office sends.
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <div className="sm:w-72">
          <label htmlFor="register-select" className="sr-only">
            Register
          </label>
          <select id="register-select" value={type} onChange={(e) => selectRegister(e.target.value as Sacrament)} className={`${inputClass} font-semibold`}>
            {sacraments.map((t) => {
              const waiting = loaded?.waiting?.[t] ?? 0
              return (
                <option key={t} value={t}>
                  {t} register
                  {loaded ? ` (${loaded.counts[t]})` : state === 'empty' ? ' (0)' : ''}
                  {waiting ? ` · ${waiting} to review` : ''}
                </option>
              )
            })}
          </select>
        </div>
        <div className="relative sm:w-96">
          <label htmlFor="register-search" className="sr-only">
            Search the {type.toLowerCase()} register
          </label>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-stone-500" />
          <input
            id="register-search"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            disabled={!ready}
            placeholder="Name, parent, sponsor, or book number"
            className={`${inputClass} pl-10 disabled:bg-stone-50`}
          />
        </div>
      </div>

      {(waitingHere > 0 || onlyWaiting) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            aria-pressed={onlyWaiting}
            onClick={() => {
              setOnlyWaiting((v) => !v)
              setPage(0)
            }}
            className={chipClass(onlyWaiting)}
          >
            {waitingHere === 1 ? '1 correction' : `${waitingHere} corrections`} waiting for you
          </button>
          {onlyWaiting && <span className="text-stone-600">Showing only entries with a correction to review.</span>}
        </div>
      )}

      <div className="mt-4">
        {!ready ? (
          <div className={cardClass}>
            {state === 'loading' ? (
              <LoadingState what={`the ${type.toLowerCase()} register`} variant="table" />
            ) : (
              <ErrorState what={`the ${type.toLowerCase()} register`} help="If it keeps happening, the parish office can check the system." onRetry={reload} />
            )}
          </div>
        ) : (
          <RegisterTable
            type={type}
            entries={rows}
            matching={filtered.length}
            search={search}
            onSearch={(v) => {
              setSearch(v)
              setOnlyWaiting(false)
              setPage(0)
            }}
            page={current}
            pageSize={PAGE_SIZE}
            onPage={setPage}
            onView={(e) => navigate(hrefFor(type, e.id))}
          />
        )}
      </div>

      <Drawer open={open !== null} onClose={() => open && close()} labelledBy="entry-title">
        {open && (
          <EntryDetail
            key={open.id}
            entry={open}
            onViewScan={viewScan}
            onClose={close}
            notice={
              open.pending_correction && (
                <CorrectionReview
                  key={open.pending_correction.correction_id}
                  entry={{ ...open, pending_correction: open.pending_correction }}
                  onDecided={(entry, approved) => {
                    upsert(entry, false)
                    toast(
                      approved
                        ? `Correction approved. The ${type.toLowerCase()} entry for ${entry.subject} is updated.`
                        : 'Correction rejected. The office has been told why.',
                    )
                  }}
                  onStale={(message) => {
                    toast(message)
                    reload()
                  }}
                />
              )
            }
          />
        )}
      </Drawer>

      <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />
      <span className="sr-only" aria-live="polite">
        {ready ? `${filtered.length} ${sacramentPlural[type].toLowerCase()} shown` : ''}
      </span>
    </PriestLayout>
  )
}
