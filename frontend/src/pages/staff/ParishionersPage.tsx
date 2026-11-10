import { useState } from 'react'
import { useToast } from '../../components/toast/toastContext'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ErrorState, LoadingState } from '../../components/ui/DataState'
import { Drawer } from '../../components/ui/Drawer'
import { Icon } from '../../components/ui/Icon'
import { btnPrimary, cardClass } from '../../components/ui/styles'
import { ParishionerDetail } from '../../features/staff/parishioners/ParishionerDetail'
import { ParishionerForm } from '../../features/staff/parishioners/ParishionerForm'
import { fullName, type Parishioner } from '../../features/staff/parishioners/parishionerData'
import { saveParishioner, setArchived, useDirectory } from '../../features/staff/parishioners/parishionersApi'
import { ParishionersTable, type DirectoryFilters } from '../../features/staff/parishioners/ParishionersTable'
import { StaffLayout } from '../../layouts/StaffLayout'
import { navigate, useLocation } from '../../lib/router'
import { useStaffDefaults } from '../../features/staff/settings/settingsApi'

const PATH = '/secretary/parishioners'
const noFilters: DirectoryFilters = {
  search: '',
  sonaId: '',
  chapelId: '',
  status: 'active',
}

export default function ParishionersPage() {
  const defaults = useStaffDefaults()
  const pageSize = Number(defaults.pageSize)
  const { query } = useLocation()
  const { toast } = useToast()
  const { state, reload, put } = useDirectory()
  const [filters, setFilters] = useState(noFilters)
  const [page, setPage] = useState(0)
  const [archiving, setArchiving] = useState<Parishioner | null>(null)
  const [busy, setBusy] = useState(false)

  const ready = typeof state === 'object'
  const all = ready ? state.people : []
  const sonas = ready ? state.sonas : []
  const byId = new Map(all.map((p) => [p.id, p]))
  const q = filters.search.trim().toLowerCase()
  const filtered = all
    .filter(
      (p) =>
        (filters.status === 'all' || (filters.status === 'archived') === p.archived) &&
        (!filters.sonaId || p.sonaId === filters.sonaId) &&
        (!filters.chapelId || p.chapelId === filters.chapelId) &&
        (!q || [fullName(p), `${p.firstName} ${p.lastName}`, p.contact, p.email].some((v) => v.toLowerCase().includes(q))),
    )
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pageCount - 1)
  const rows = filtered.slice(current * pageSize, (current + 1) * pageSize)

  // ?person=ID opens the record; ?edit=ID or ?edit=new opens the form. Both stay linkable.
  const viewing = byId.get(query.get('person') ?? '') ?? null
  const editParam = query.get('edit')
  const editing = editParam === 'new' ? 'new' : (byId.get(editParam ?? '') ?? null)

  const go = (params: Record<string, string>, replace = false) => {
    const p = new URLSearchParams(params)
    const qs = p.toString()
    navigate(qs ? `${PATH}?${qs}` : PATH, { replace })
  }
  const close = () => go({}, true)

  const archive = async (p: Parishioner, archived: boolean) => {
    setBusy(true)
    const result = await setArchived(p.id, archived)
    setBusy(false)
    if ('message' in result) {
      toast(result.message)
      reload()
      return false
    }
    put(result.person)
    toast(archived ? `${fullName(p)} archived. Find them under Archived to restore.` : `${fullName(p)} restored to the directory.`)
    return true
  }

  return (
    <StaffLayout activeHref={PATH}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-stone-900">Parishioners</h1>
          <p className="mt-1 max-w-2xl text-stone-600">
            The parish directory. Archived records are kept, not deleted, and stay linked to their sacramental records.
          </p>
        </div>
        <button type="button" onClick={() => go({ edit: 'new' })} disabled={!ready} className={`${btnPrimary} shrink-0`}>
          <Icon name="userPlus" className="size-4.5" />
          Add parishioner
        </button>
      </div>

      <div className="mt-6">
        {!ready ? (
          <div className={cardClass}>
            {state === 'loading' ? (
              <LoadingState what="the directory" />
            ) : (
              <ErrorState what="the directory" help="If it keeps happening, tell the system administrator." onRetry={reload} />
            )}
          </div>
        ) : all.length === 0 ? (
          <div className={`${cardClass} px-5 py-12 text-center`}>
            <p className="font-semibold text-stone-800">The directory is empty</p>
            <p className="mt-1 text-sm text-stone-600">Add the first parishioner to start the directory.</p>
          </div>
        ) : (
          <ParishionersTable
            rows={rows}
            matching={filtered.length}
            total={all.length}
            byId={byId}
            sonas={sonas}
            filters={filters}
            onFilters={(f) => {
              setFilters((x) => ({ ...x, ...f }))
              setPage(0)
            }}
            onClear={() => {
              setFilters(noFilters)
              setPage(0)
            }}
            page={current}
            pageSize={pageSize}
            onPage={setPage}
            onView={(p) => go({ person: p.id })}
            onEdit={(p) => go({ edit: p.id })}
          />
        )}
      </div>

      <Drawer open={viewing !== null && !editing} onClose={() => viewing && !editing && close()} labelledBy="pp-title">
        {viewing && !editing && (
          <ParishionerDetail
            key={viewing.id}
            person={viewing}
            all={all}
            byId={byId}
            sonas={sonas}
            onOpen={(p) => go({ person: p.id }, true)}
            onEdit={() => go({ edit: viewing.id }, true)}
            onArchive={() => {
              if (busy) return
              if (viewing.archived) void archive(viewing, false)
              else setArchiving(viewing)
            }}
            onClose={close}
          />
        )}
      </Drawer>

      <Drawer open={editing !== null} onClose={() => editing && close()} labelledBy="pf-title">
        {editing && (
          <ParishionerForm
            key={editing === 'new' ? 'new' : editing.id}
            person={editing === 'new' ? undefined : editing}
            all={all}
            sonas={sonas}
            onCancel={() => (editing === 'new' ? close() : go({ person: editing.id }, true))}
            onSave={async (input) => {
              const result = await saveParishioner(editing === 'new' ? null : editing.id, input)
              if ('errors' in result) return result.errors
              if ('message' in result) {
                toast(result.message)
                return
              }
              put(result.person)
              toast(editing === 'new' ? `${fullName(result.person)} added to the directory.` : `Saved changes to ${fullName(result.person)}.`)
              go({ person: result.person.id }, true)
            }}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={archiving !== null}
        onClose={() => setArchiving(null)}
        title="Archive this parishioner?"
        confirmLabel="Archive"
        onConfirm={async () => {
          if (!archiving || busy) return
          await archive(archiving, true)
          setArchiving(null)
        }}
      >
        {archiving && (
          <p>
            {fullName(archiving)} is hidden from the directory and from new requests. Their sacramental records and family links stay as they are, and the
            record can be restored at any time.
          </p>
        )}
      </ConfirmDialog>
    </StaffLayout>
  )
}
