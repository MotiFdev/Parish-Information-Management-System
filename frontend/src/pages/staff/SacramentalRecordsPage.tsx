import { useState } from 'react'
import { DocumentViewer, type ViewableFile } from '../../components/DocumentViewer'
import { useToast } from '../../components/toast/toastContext'
import { ErrorState, LoadingState } from '../../components/ui/DataState'
import { Drawer } from '../../components/ui/Drawer'
import { Icon } from '../../components/ui/Icon'
import { btnPrimary, btnSecondary, cardClass, inputClass } from '../../components/ui/styles'
import type { RegisterEntry } from '../../features/priest/registerData'
import { EntryDetail } from '../../features/priest/registers/EntryDetail'
import { RegisterTable } from '../../features/priest/registers/RegisterTable'
import { sacraments, type Sacrament } from '../../features/priest/sampleData'
import { CertificatePreview } from '../../features/staff/sacraments/CertificatePreview'
import { EntryForm } from '../../features/staff/sacraments/EntryForm'
import { addEntry, draftValues, sendCorrection, useEntryDraft, useRegister, type SaveResult } from '../../features/staff/sacraments/registerApi'
import { StaffLayout } from '../../layouts/StaffLayout'
import { api } from '../../lib/api'
import { navigate, useLocation } from '../../lib/router'
import { useStaffDefaults } from '../../features/staff/settings/settingsApi'

const PATH = '/secretary/sacraments'
type Sort = 'newest' | 'index'

const haystack = (e: RegisterEntry) => [e.subject, e.people, `book ${e.register.book}`, ...e.details.map(([, v]) => v)].join(' ').toLowerCase()
const byIndex = (a: RegisterEntry, b: RegisterEntry) =>
  a.register.book - b.register.book || a.register.page - b.register.page || a.register.line - b.register.line

export default function SacramentalRecordsPage() {
  const defaults = useStaffDefaults()
  const pageSize = Number(defaults.pageSize)
  const { query } = useLocation()
  const { toast } = useToast()
  const type = sacraments.find((s) => s.toLowerCase() === query.get('register')) ?? defaults.register
  const { state, reload, upsert } = useRegister(type)
  const [search, setSearch] = useState('')
  const [book, setBook] = useState('')
  const [sort, setSort] = useState<Sort>('newest')
  const [page, setPage] = useState(0)
  const [viewing, setViewing] = useState<ViewableFile | null>(null)

  const ready = typeof state === 'object'
  const list = ready ? state.data : []
  const books = [...new Set(list.map((e) => e.register.book))].sort((a, b) => a - b)
  const q = search.trim().toLowerCase()
  const filtered = list
    .filter((e) => (!book || e.register.book === Number(book)) && (!q || haystack(e).includes(q)))
    .sort(sort === 'index' ? byIndex : (a, b) => b.date.localeCompare(a.date))
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pageCount - 1)
  const rows = filtered.slice(current * pageSize, (current + 1) * pageSize)

  // ?entry= opens the record, ?edit= (an id or "new") the form, ?certificate= the preview.
  const open = list.find((e) => e.id === query.get('entry')) ?? null
  const editParam = query.get('edit')
  const editing = editParam === 'new' ? 'new' : (list.find((e) => e.id === editParam) ?? null)
  const certificate = list.find((e) => e.id === query.get('certificate')) ?? null
  // ?from= a New Registration request: the new entry starts from its details and is linked to it on save.
  const from = editing === 'new' ? query.get('from') : null
  const draft = useEntryDraft(from)
  const draftReady = draft !== null && draft !== 'loading' && !('error' in draft) ? draft : null

  const go = (params: Record<string, string>, t: Sacrament = type, replace = true) => {
    const p = new URLSearchParams({ register: t.toLowerCase(), ...params })
    if (query.get('preview')) p.set('preview', query.get('preview')!)
    navigate(`${PATH}?${p}`, { replace })
  }
  const backToRequest = (number?: string) => navigate(number ? `/secretary/requests?request=${encodeURIComponent(number)}` : '/secretary/requests')
  const closeForm = () => {
    if (from) return backToRequest(draftReady?.request_number)
    go(editing === 'new' || !editing ? {} : { entry: editing.id })
  }
  const reset = () => {
    setSearch('')
    setBook('')
    setPage(0)
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

  /** Puts a saved entry in the list, or hands the form the server's errors. */
  const settle = (result: SaveResult, isNew: boolean, done: (entry: RegisterEntry) => void) => {
    if ('errors' in result) return result.errors
    if ('message' in result) {
      toast(result.message)
      return undefined
    }
    upsert(result.entry, isNew)
    done(result.entry)
    return undefined
  }

  return (
    <StaffLayout activeHref={PATH}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-stone-900">Sacramental Records</h1>
          <p className="mt-1 max-w-2xl text-stone-600">
            The four parish registers. Add entries as they are written in the books; changes to an entry go to the priest for approval.
          </p>
        </div>
        <button type="button" onClick={() => go({ edit: 'new' }, type, false)} disabled={!ready} className={`${btnPrimary} shrink-0`}>
          <Icon name="plus" className="size-4.5" />
          Add {type.toLowerCase()} entry
        </button>
      </div>

      <div className="mt-6 grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.9fr)]">
        <div>
          <label htmlFor="sr-register" className="sr-only">
            Register
          </label>
          <select
            id="sr-register"
            value={type}
            onChange={(e) => {
              reset()
              go({}, e.target.value as Sacrament)
            }}
            className={`${inputClass} font-semibold`}
          >
            {sacraments.map((t) => (
              <option key={t} value={t}>
                {t} register
                {ready ? ` (${state.counts[t]})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <label htmlFor="sr-search" className="sr-only">
            Search the {type.toLowerCase()} register
          </label>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-stone-500" />
          <input
            id="sr-search"
            type="search"
            value={search}
            disabled={!ready}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            placeholder="Name, parent, sponsor, or priest"
            className={`${inputClass} pl-10 disabled:bg-stone-50`}
          />
        </div>
        {/* The book / page / line index: narrow to one book and read it in order. */}
        <select
          aria-label="Book"
          value={book}
          disabled={!ready}
          onChange={(e) => {
            setBook(e.target.value)
            if (e.target.value) setSort('index')
            setPage(0)
          }}
          className={inputClass}
        >
          <option value="">All books</option>
          {books.map((b) => (
            <option key={b} value={b}>
              Book {b}
            </option>
          ))}
        </select>
        <select aria-label="Order" value={sort} disabled={!ready} onChange={(e) => setSort(e.target.value as Sort)} className={inputClass}>
          <option value="newest">Newest first</option>
          <option value="index">Book, page, line</option>
        </select>
      </div>

      <div className="mt-4">
        {!ready ? (
          <div className={cardClass}>
            {state === 'loading' ? (
              <LoadingState what={`the ${type.toLowerCase()} register`} />
            ) : (
              <ErrorState what={`the ${type.toLowerCase()} register`} help="If it keeps happening, tell the system administrator." onRetry={reload} />
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
              setBook('')
              setPage(0)
            }}
            page={current}
            pageSize={pageSize}
            onPage={setPage}
            onView={(e) => go({ entry: e.id }, type, false)}
          />
        )}
      </div>

      <Drawer open={open !== null && !editing} onClose={() => open && !editing && go({})} labelledBy="entry-title">
        {open && !editing && (
          <EntryDetail
            key={open.id}
            entry={open}
            onViewScan={viewScan}
            onClose={() => go({})}
            notice={
              open.pending_correction && (
                <section aria-label="Correction waiting for approval" className="border-b border-stone-100 bg-gold-soft/60 px-5 py-4 text-sm">
                  <p className="font-semibold text-brown">Correction waiting for the priest’s approval</p>
                  <ul className="mt-1 space-y-0.5 text-stone-800">
                    {open.pending_correction.changes.map((c) => (
                      <li key={c.field}>
                        {c.field}: <span className="text-stone-600 line-through decoration-stone-400">{c.from || 'blank'}</span>
                        <span aria-label="changed to" className="px-1 text-stone-500">
                          →
                        </span>
                        <span className="font-semibold">{c.to || 'blank'}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            }
            actions={
              <>
                <button type="button" onClick={() => go({ entry: open.id, certificate: open.id })} className={btnSecondary}>
                  <Icon name="seal" className="size-4.5" />
                  Generate certificate
                </button>
                <button type="button" onClick={() => go({ edit: open.id })} className={btnPrimary}>
                  <Icon name="pencil" className="size-4.5" />
                  {open.pending_correction ? 'Change the correction' : 'Edit'}
                </button>
              </>
            }
          />
        )}
      </Drawer>

      <Drawer open={editing !== null} onClose={() => editing && closeForm()} labelledBy="ef-title">
        {editing && from && !draftReady ? (
          <div className="flex h-full flex-col bg-white px-5 py-6">
            <h2 id="ef-title" className="font-serif text-3xl font-semibold text-stone-900">
              Add {type.toLowerCase()} entry
            </h2>
            {draft === 'loading' ? (
              <LoadingState what="the request’s details" />
            ) : (
              <div className="mt-4 space-y-4 text-stone-700">
                <p role="alert">{draft && 'error' in draft ? draft.error : 'The request could not be loaded.'}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => backToRequest()} className={btnSecondary}>
                    Back to Record Requests
                  </button>
                  <button type="button" onClick={() => go({ edit: 'new' })} className={btnPrimary}>
                    Start a blank entry
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          editing && (
            <EntryForm
              key={`${type}-${editing === 'new' ? `new-${from ?? ''}` : editing.id}`}
              type={type}
              entry={editing === 'new' ? undefined : editing}
              initial={draftReady ? draftValues(type, draftReady) : undefined}
              notice={
                draftReady && (
                  <section aria-label="Filled in from a request" className="border-b border-stone-100 bg-gold-soft/60 px-5 py-4 text-sm">
                    <p className="font-semibold text-brown">Filled in from request {draftReady.request_number}</p>
                    <p className="mt-0.5 text-stone-800">
                      Check each field against the register book, fill in what is missing, and add the book, page, and line. Saving links the entry to the
                      request.
                    </p>
                    {draftReady.notes.length > 0 && (
                      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-stone-800">
                        {draftReady.notes.map((n) => (
                          <li key={n}>{n}</li>
                        ))}
                      </ul>
                    )}
                  </section>
                )
              }
              checkRef={(ref) => {
                if (editing !== 'new') return undefined
                const taken = list.find((e) => e.register.book === ref.book && e.register.page === ref.page && e.register.line === ref.line)
                return taken ? `Book ${ref.book}, page ${ref.page}, line ${ref.line} already holds ${taken.subject}.` : undefined
              }}
              onCancel={closeForm}
              onSave={async (input) => {
                if (editing === 'new') {
                  return settle(await addEntry(type, input, draftReady?.request_id), true, (entry) => {
                    const where = `book ${entry.register.book}, page ${entry.register.page}, line ${entry.register.line}`
                    if (draftReady) {
                      toast(
                        `${entry.subject} added at ${where} and linked to ${draftReady.request_number}. Mark it ready for collection when the certificate is printed.`,
                      )
                      return backToRequest(draftReady.request_number)
                    }
                    toast(`${entry.subject} added to the ${type.toLowerCase()} register at ${where}.`)
                    go({ entry: entry.id })
                  })
                }
                return settle(await sendCorrection(type, editing.id, input.values), false, (entry) => {
                  const n = entry.pending_correction?.changes.length ?? 0
                  toast(`Sent to the priest as a record correction (${n} ${n === 1 ? 'field' : 'fields'}). The register changes once it is approved.`)
                  go({ entry: entry.id })
                })
              }}
            />
          )
        )}
      </Drawer>

      <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />
      <CertificatePreview entry={certificate} onClose={() => go(certificate ? { entry: certificate.id } : {})} />
    </StaffLayout>
  )
}
