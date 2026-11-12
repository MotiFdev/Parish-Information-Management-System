import { useState } from 'react'
import { useToast } from '../../components/toast/toastContext'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ErrorState, LoadingState } from '../../components/ui/DataState'
import { Drawer } from '../../components/ui/Drawer'
import { Icon } from '../../components/ui/Icon'
import { Pagination } from '../../components/ui/Pagination'
import { btnPrimary, btnSecondary, cardClass, inputClass } from '../../components/ui/styles'
import { ChapelDetail } from '../../features/community/chapels/ChapelDetail'
import { ChapelDialog, OfficerDialog, type ChapelInput, type OfficerInput } from '../../features/community/chapels/ChapelDialogs'
import { deleteChapel, formErrors, importOfficers, removeOfficer, saveChapel, saveOfficer, useChapelDirectory } from '../../features/community/chapels/chapelsApi'
import { byRank, CURRENT_TERM, ministries, positions, type Chapel, type Officer, type SonaOption } from '../../features/community/chapels/chapelsData'
import { ChapelsTable } from '../../features/community/chapels/ChapelsTable'
import { ImportOfficers, type ImportResult } from '../../features/community/chapels/ImportOfficers'
import { OfficerTable } from '../../features/community/chapels/OfficerTable'
import { CommunityLayout } from '../../layouts/CommunityLayout'
import { navigate, useLocation } from '../../lib/router'

const PATH = '/community/chapels'
const PAGE_SIZE = 15
const chapelFieldFor: Record<string, string> = { sona_id: 'sonaId', name: 'name' }
const officerFieldFor: Record<string, string> = { chapel_id: 'chapelId', term_year: 'term', name: 'name', position: 'position', age: 'age' }
const noFilters = {
  search: '',
  sonaId: '',
  chapelId: '',
  status: 'active',
  position: '',
  ministry: '',
  term: String(CURRENT_TERM),
}
const linkButton = 'inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-forest hover:bg-forest-soft'

export default function ChapelsPage() {
  const { query } = useLocation()
  const { toast } = useToast()
  const directory = useChapelDirectory()
  const loaded = typeof directory.state === 'object' ? directory.state : null
  const [filters, setFilters] = useState(noFilters)
  const [page, setPage] = useState(0)
  const [editingChapel, setEditingChapel] = useState<Chapel | 'new' | null>(null)
  const [editingOfficer, setEditingOfficer] = useState<Officer | { chapelId: string; term: number } | null>(null)
  const [removing, setRemoving] = useState<Officer | null>(null)
  const [deletingChapel, setDeletingChapel] = useState<Chapel | null>(null)
  const [importing, setImporting] = useState<{
    chapelId: string
    term: number
  } | null>(null)

  const sonas: SonaOption[] = loaded?.sonas ?? []
  const chapels = loaded?.chapels ?? []
  const officers = loaded?.officers ?? []
  const chapelMap = new Map(chapels.map((c) => [c.id, c]))
  const ready = loaded !== null
  const setChapels = (f: (cs: Chapel[]) => Chapel[]) => directory.setState((s) => (typeof s === 'object' ? { ...s, chapels: f(s.chapels) } : s))
  const setOfficers = (f: (os: Officer[]) => Officer[]) => directory.setState((s) => (typeof s === 'object' ? { ...s, officers: f(s.officers) } : s))

  /** Saves, updates the list, and returns field errors for the form (empty when saved). */
  const onSaveChapel = async (input: ChapelInput) => {
    const editing = editingChapel
    try {
      const saved = await saveChapel(input, editing && editing !== 'new' ? editing.id : undefined)
      setChapels((cs) => (cs.some((c) => c.id === saved.id) ? cs.map((c) => (c.id === saved.id ? saved : c)) : [...cs, saved]))
      toast(editing === 'new' ? `${saved.name} sent to the PPC for approval.` : saved.status === 'Pending' && editing?.status === 'Rejected' ? `${saved.name} sent to the PPC again.` : `Saved changes to ${saved.name}.`)
      setEditingChapel(null)
      if (editing === 'new') go({ chapel: saved.id, view: null })
      return {}
    } catch (e) {
      const errors = formErrors(e, chapelFieldFor)
      if (errors.form) toast(errors.form)
      return errors
    }
  }

  const onSaveOfficer = async (input: OfficerInput) => {
    const editing = editingOfficer
    try {
      const saved = await saveOfficer(input, editing && 'id' in editing ? editing.id : undefined)
      setOfficers((os) => (os.some((o) => o.id === saved.id) ? os.map((o) => (o.id === saved.id ? saved : o)) : [...os, saved]))
      toast(
        editing && 'id' in editing
          ? editing.status === 'Rejected'
            ? `${saved.name} sent to the PPC again.`
            : `Saved changes to ${saved.name}.`
          : `${saved.name} sent to the PPC for approval as ${saved.position} for ${saved.term}.`,
      )
      setEditingOfficer(null)
      return {}
    } catch (e) {
      const errors = formErrors(e, officerFieldFor)
      if (errors.form) toast(errors.form)
      return errors
    }
  }

  const onImport = async (r: ImportResult) => {
    try {
      const list = await importOfficers(r)
      setOfficers((os) => [...os.filter((o) => !(o.chapelId === r.chapelId && o.term === r.term)), ...list])
      toast(`${r.rows.length} officers imported to ${chapelMap.get(r.chapelId)?.name} for ${r.term}${r.replace ? ', replacing the old list' : ''}. They wait for PPC approval.`)
      setImporting(null)
      go({ chapel: r.chapelId })
      return null
    } catch (e) {
      const errors = formErrors(e, {})
      return errors.form ?? 'Some rows were not accepted. Check the file and try again.'
    }
  }

  // ?view=officers switches lists; ?chapel=ID opens a chapel. Both stay linkable.
  const view = query.get('view') === 'officers' ? 'officers' : 'chapels'
  const open = chapelMap.get(query.get('chapel') ?? '') ?? null
  const go = (patch: Record<string, string | null>, replace = false) => {
    const p = new URLSearchParams(query)
    for (const [k, v] of Object.entries(patch))
      if (v === null) p.delete(k)
      else p.set(k, v)
    const qs = p.toString()
    navigate(qs ? `${PATH}?${qs}` : PATH, { replace })
  }
  const setFilter = (patch: Partial<typeof noFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(0)
  }

  const q = filters.search.trim().toLowerCase()
  const sona = sonas.find((s) => s.id === filters.sonaId)
  const current = officers.filter((o) => o.term === CURRENT_TERM)
  const firstApproved = chapels.find((c) => c.status === 'Approved')?.id ?? ''

  // Chapels list: search covers chapel, patron, and this term's president.
  const shownChapels = chapels.filter((c) => {
    const president = current.find((o) => o.chapelId === c.id && o.position === 'President')?.name ?? ''
    return (
      (filters.status === 'all' || (filters.status === 'active') === c.active) &&
      (!filters.sonaId || c.sonaId === filters.sonaId) &&
      (!q || [c.name, c.patron, president].some((v) => v.toLowerCase().includes(q)))
    )
  })

  // Officers list: every chapel's council for one term.
  const terms = [...new Set([CURRENT_TERM, ...officers.map((o) => o.term)])].sort((a, b) => b - a)
  const shownOfficers = officers
    .filter((o) => {
      const c = chapelMap.get(o.chapelId)
      return (
        String(o.term) === filters.term &&
        (!filters.sonaId || c?.sonaId === filters.sonaId) &&
        (!filters.chapelId || o.chapelId === filters.chapelId) &&
        (!filters.position || o.position === filters.position) &&
        (!filters.ministry || o.ministry === filters.ministry) &&
        (!q || [o.name, o.contact, o.fb].some((v) => v.toLowerCase().includes(q)))
      )
    })
    .sort((a, b) => (chapelMap.get(a.chapelId)?.name ?? '').localeCompare(chapelMap.get(b.chapelId)?.name ?? '') || byRank(a, b))
  const pageCount = Math.max(1, Math.ceil(shownOfficers.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)

  const filtering =
    view === 'chapels'
      ? q || filters.sonaId || filters.status !== 'active'
      : q || filters.sonaId || filters.chapelId || filters.position || filters.ministry || filters.term !== String(CURRENT_TERM)
  const clear = () => setFilter(noFilters)
  const firstChapel = [open?.id, filters.chapelId].find((id) => id && chapelMap.get(id)?.status === 'Approved') ?? firstApproved

  return (
    <CommunityLayout activeHref={PATH}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-stone-900">Chapels & Officers</h1>
          <p className="mt-1 max-w-2xl text-stone-600">
            Each Sona’s chapels with their patron, fiesta, and contacts, and the officers who serve them each term.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setImporting({ chapelId: firstChapel, term: CURRENT_TERM })}
            disabled={!ready || !firstApproved}
            className={btnSecondary}
          >
            <Icon name="upload" className="size-4.5" />
            Import officers
          </button>
          <button type="button" onClick={() => setEditingChapel('new')} disabled={!ready} className={btnPrimary}>
            <Icon name="plus" className="size-4.5" />
            Add chapel
          </button>
        </div>
      </div>

      <div className={`mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4`}>
        <select
          aria-label="List to show"
          value={view}
          onChange={(e) => {
            go({ view: e.target.value === 'officers' ? 'officers' : null }, true)
            setPage(0)
          }}
          className={`${inputClass} font-semibold`}
        >
          <option value="chapels">Show: Chapels</option>
          <option value="officers">Show: Officers</option>
        </select>
        <div className={`relative ${view === 'officers' ? 'lg:col-span-2' : ''}`}>
          <label htmlFor="chq" className="sr-only">
            {view === 'chapels' ? 'Search chapels' : 'Search officers'}
          </label>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-stone-500" />
          <input
            id="chq"
            type="search"
            value={filters.search}
            onChange={(e) => setFilter({ search: e.target.value })}
            placeholder={view === 'chapels' ? 'Chapel, patron, or president' : 'Name, number, or Facebook'}
            className={`${inputClass} pl-10`}
          />
        </div>
        <select aria-label="Sona" value={filters.sonaId} onChange={(e) => setFilter({ sonaId: e.target.value, chapelId: '' })} className={inputClass}>
          <option value="">All Sonas</option>
          {sonas.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {view === 'chapels' ? (
          <select aria-label="Status" value={filters.status} onChange={(e) => setFilter({ status: e.target.value })} className={inputClass}>
            <option value="active">Active chapels</option>
            <option value="inactive">Inactive chapels</option>
            <option value="all">Active and inactive</option>
          </select>
        ) : (
          <>
            <select
              aria-label="Chapel"
              value={filters.chapelId}
              onChange={(e) => setFilter({ chapelId: e.target.value })}
              disabled={!sona}
              className={`${inputClass} disabled:bg-stone-50 disabled:text-stone-500`}
            >
              <option value="">{sona ? 'All chapels in this Sona' : 'Choose a Sona first'}</option>
              {chapels
                .filter((c) => c.sonaId === filters.sonaId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            <select aria-label="Position" value={filters.position} onChange={(e) => setFilter({ position: e.target.value })} className={inputClass}>
              <option value="">All positions</option>
              {positions.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select aria-label="Ministry" value={filters.ministry} onChange={(e) => setFilter({ ministry: e.target.value })} className={inputClass}>
              <option value="">All ministries</option>
              {ministries.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <select aria-label="Term" value={filters.term} onChange={(e) => setFilter({ term: e.target.value })} className={inputClass}>
              {terms.map((t) => (
                <option key={t} value={t}>
                  {t} term{t === CURRENT_TERM ? ' (current)' : ''}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      <div className="mt-2 flex min-h-11 flex-wrap items-center justify-between gap-2 text-sm text-stone-600">
        <p>
          {ready &&
            (view === 'chapels'
              ? `${shownChapels.length} of ${chapels.length} chapels in ${sonas.length} Sonas`
              : `${officers.filter((o) => String(o.term) === filters.term).length} officers listed for ${filters.term} across all chapels`)}
        </p>
        {filtering && (
          <button type="button" onClick={clear} className={linkButton}>
            Clear filters
          </button>
        )}
      </div>

      <section aria-label={view === 'chapels' ? 'Chapel directory' : 'Chapel officers'} className={`${cardClass} mt-2`}>
        {!ready ? (
          directory.state === 'loading' ? (
            <LoadingState what={view === 'chapels' ? 'the chapel directory' : 'chapel officers'} variant="table" />
          ) : (
            <ErrorState
              what={view === 'chapels' ? 'the chapel directory' : 'chapel officers'}
              help="If it keeps happening, tell the system administrator."
              onRetry={directory.reload}
            />
          )
        ) : !chapels.length ? (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-stone-800">No chapels yet</p>
            <p className="mt-1 text-sm text-stone-600">Add each Sona’s chapels, then their officers.</p>
          </div>
        ) : view === 'chapels' ? (
          shownChapels.length ? (
            <ChapelsTable sonas={sonas} rows={shownChapels} officers={current} onView={(c) => go({ chapel: c.id })} onEdit={setEditingChapel} />
          ) : (
            <div className="px-5 py-12 text-center">
              <p className="font-semibold text-stone-800">No chapels match</p>
              <p className="mt-1 text-sm text-stone-600">Try part of the name, or include inactive chapels.</p>
              <button type="button" onClick={clear} className={`${linkButton} mt-2`}>
                Clear filters
              </button>
            </div>
          )
        ) : shownOfficers.length ? (
          <>
            <OfficerTable
              sonas={sonas}
              rows={shownOfficers.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)}
              chapels={chapelMap}
              label={`Officers, ${filters.term} term`}
              onEdit={setEditingOfficer}
              onRemove={setRemoving}
            />
            <Pagination page={currentPage} pageSize={PAGE_SIZE} total={shownOfficers.length} onPage={setPage} noun={['officer', 'officers']} />
          </>
        ) : (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-stone-800">No officers match</p>
            <p className="mt-1 text-sm text-stone-600">Try another term or ministry, or import a chapel’s list.</p>
            <button type="button" onClick={clear} className={`${linkButton} mt-2`}>
              Clear filters
            </button>
          </div>
        )}
      </section>

      <Drawer open={open !== null} onClose={() => open && go({ chapel: null }, true)} labelledBy="ch-title">
        {open && (
          <ChapelDetail
            sonas={sonas}
            key={open.id}
            chapel={open}
            officers={officers}
            onEdit={() => setEditingChapel(open)}
            onDelete={() => setDeletingChapel(open)}
            onAddOfficer={(term) => setEditingOfficer({ chapelId: open.id, term })}
            onImport={(term) => setImporting({ chapelId: open.id, term })}
            onEditOfficer={setEditingOfficer}
            onRemoveOfficer={setRemoving}
            onClose={() => go({ chapel: null }, true)}
          />
        )}
      </Drawer>

      <ChapelDialog sonas={sonas} chapel={editingChapel} onClose={() => setEditingChapel(null)} onSave={onSaveChapel} />

      <OfficerDialog sonas={sonas} officer={editingOfficer} chapels={chapels} all={officers} onClose={() => setEditingOfficer(null)} onSave={onSaveOfficer} />

      <ImportOfficers sonas={sonas} start={importing} chapels={chapels} officers={officers} onClose={() => setImporting(null)} onImport={onImport} />

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Remove this officer?"
        confirmLabel="Remove"
        tone="danger"
        onConfirm={async () => {
          if (!removing) return
          try {
            await removeOfficer(removing.id)
            setOfficers((os) => os.filter((o) => o.id !== removing.id))
            toast(`${removing.name} removed from the ${removing.term} list.`)
          } catch {
            toast(`${removing.name} could not be removed. Please try again.`)
          }
          setRemoving(null)
        }}
      >
        {removing && (
          <p>
            {removing.name} ({removing.position}) comes off the {removing.term} list for {chapelMap.get(removing.chapelId)?.name}, and off any events they
            were assigned to. Lists for other terms are not changed.
          </p>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={deletingChapel !== null}
        onClose={() => setDeletingChapel(null)}
        title="Delete this chapel?"
        confirmLabel="Delete"
        tone="danger"
        onConfirm={async () => {
          if (!deletingChapel) return
          try {
            await deleteChapel(deletingChapel.id)
            setChapels((cs) => cs.filter((c) => c.id !== deletingChapel.id))
            toast(`${deletingChapel.name} deleted.`)
            go({ chapel: null }, true)
          } catch {
            toast(`${deletingChapel.name} could not be deleted. Please try again.`)
          }
          setDeletingChapel(null)
        }}
      >
        {deletingChapel && <p>{deletingChapel.name} was never approved by the PPC, so it is removed from the directory completely.</p>}
      </ConfirmDialog>
    </CommunityLayout>
  )
}
