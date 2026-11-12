import { useState } from 'react'
import { useToast } from '../../components/toast/toastContext'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ErrorState, LoadingState } from '../../components/ui/DataState'
import { Drawer } from '../../components/ui/Drawer'
import { Icon } from '../../components/ui/Icon'
import { Pagination } from '../../components/ui/Pagination'
import { btnPrimary, cardClass, inputClass } from '../../components/ui/styles'
import { AnnouncementDrawer, type NoticeAction } from '../../features/staff/announcements/AnnouncementDrawer'
import { AnnouncementEditor, type NoticeInput } from '../../features/staff/announcements/AnnouncementEditor'
import { deleteNotice, noticeStep, saveNotice, useNotices, type NoticeStep } from '../../features/staff/announcements/announcementsApi'
import { announcementStatuses, categories, plainText, whenLabel, type Notice } from '../../features/staff/announcements/announcementsData'
import { NoticeBadge } from '../../features/staff/announcements/NoticeBadge'
import { StaffLayout } from '../../layouts/StaffLayout'
import { navigate, useLocation } from '../../lib/router'
import { useStaffDefaults } from '../../features/staff/settings/settingsApi'

const PATH = '/secretary/announcements'
const cellLabel = 'block text-xs text-stone-500 lg:hidden'
const linkButton = 'inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-forest hover:bg-forest-soft'

/** The date that matters for each status, shown in the list. */
function dateCell(n: Notice) {
  if (n.status === 'Scheduled') return { label: 'Goes live', value: whenLabel(n.publishAt!) }
  if (n.status === 'Draft') return { label: 'Last edited', value: whenLabel(n.updatedAt) }
  return { label: 'Published', value: whenLabel(n.publishAt!) }
}

export default function AnnouncementsPage() {
  const defaults = useStaffDefaults()
  const pageSize = Number(defaults.pageSize)
  const { query } = useLocation()
  const { toast } = useToast()
  const { state, reload, put, remove } = useNotices()
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(0)
  const [deleting, setDeleting] = useState<Notice | null>(null)

  const ready = typeof state === 'object'
  const all = ready ? state : []
  const byId = new Map(all.map((n) => [n.id, n]))
  const open = byId.get(query.get('notice') ?? '') ?? null
  const editParam = query.get('edit')
  const editing = editParam === 'new' ? 'new' : (byId.get(editParam ?? '') ?? null)
  const pinned = all.find((n) => n.pinned && n.status === 'Published')

  const go = (params: Record<string, string>, replace = false) => {
    const p = new URLSearchParams(params)
    const qs = p.toString()
    navigate(qs ? `${PATH}?${qs}` : PATH, { replace })
  }

  const q = search.trim().toLowerCase()
  const filtered = all
    .filter(
      (n) =>
        (!status || n.status === status) &&
        (!category || n.category === category) &&
        (!q || n.title.toLowerCase().includes(q) || plainText(n.body).toLowerCase().includes(q)),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pageCount - 1)
  const filtering = q || status || category
  const count = (s: string) => all.filter((n) => n.status === s).length

  const steps: Record<Exclude<NoticeAction, 'edit' | 'delete'>, { step: NoticeStep; done: (n: Notice) => string }> = {
    publish: { step: 'publish', done: (n) => `“${n.title}” is live for parishioners.` },
    unschedule: { step: 'unschedule', done: (n) => `Schedule cancelled. “${n.title}” is back in drafts.` },
    archive: { step: 'archive', done: (n) => `“${n.title}” archived and hidden from parishioners.` },
    toDraft: { step: 'to-draft', done: (n) => `“${n.title}” moved to drafts.` },
    pin: {
      step: 'pin',
      done: (n) =>
        n.pinned ? `“${n.title}” pinned to the top${pinned && pinned.id !== n.id ? `, replacing “${pinned.title}”` : ''}.` : `“${n.title}” unpinned.`,
    },
  }

  const act = async (n: Notice, a: NoticeAction) => {
    if (a === 'edit') return go({ edit: n.id })
    if (a === 'delete') return setDeleting(n)
    if (busy) return
    setBusy(true)
    const result = await noticeStep(n.id, steps[a].step, a === 'pin' ? !n.pinned : undefined)
    setBusy(false)
    if (typeof result === 'string') {
      toast(result)
      reload()
      return
    }
    put(result)
    toast(steps[a].done(result))
  }

  const save = async (input: NoticeInput) => {
    const result = await saveNotice(editing === 'new' || !editing ? null : editing.id, input)
    if ('errors' in result) return result.errors
    if ('message' in result) {
      toast(result.message)
      return
    }
    put(result.notice)
    const message =
      input.mode === 'draft'
        ? 'Draft saved.'
        : input.mode === 'now'
          ? 'Published. Parishioners can see it now.'
          : input.mode === 'schedule'
            ? `Scheduled for ${whenLabel(input.publishAt!)}.`
            : 'Changes saved and live for parishioners.'
    toast(message)
    go({ notice: result.notice.id }, true)
  }

  if (editing && ready)
    return (
      <StaffLayout activeHref={PATH}>
        <AnnouncementEditor
          key={editing === 'new' ? 'new' : editing.id}
          notice={editing === 'new' ? undefined : editing}
          pinnedOther={pinned && (editing === 'new' || pinned.id !== editing.id) ? pinned : undefined}
          onCancel={() => (editing === 'new' ? go({}, true) : go({ notice: editing.id }, true))}
          onSave={save}
        />
      </StaffLayout>
    )

  return (
    <StaffLayout activeHref={PATH}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-stone-900">Announcements</h1>
          <p className="mt-1 max-w-2xl text-stone-600">
            Notices for the parishioner home page. Write them now and publish right away, or schedule them to go live later.
          </p>
        </div>
        <button type="button" onClick={() => go({ edit: 'new' })} disabled={!ready} className={`${btnPrimary} shrink-0`}>
          <Icon name="plus" className="size-4.5" />
          New announcement
        </button>
      </div>

      <div className="mt-6 grid gap-2 md:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))]">
        <div className="relative">
          <label htmlFor="anq" className="sr-only">
            Search announcements
          </label>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-stone-500" />
          <input
            id="anq"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            placeholder="Title or words in the announcement"
            className={`${inputClass} pl-10`}
          />
        </div>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(0)
          }}
          className={inputClass}
        >
          <option value="">All statuses</option>
          {announcementStatuses.map((s) => (
            <option key={s} value={s}>
              {s} ({count(s)})
            </option>
          ))}
        </select>
        <select
          aria-label="Category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value)
            setPage(0)
          }}
          className={inputClass}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="mt-2 flex min-h-11 flex-wrap items-center justify-between gap-2 text-sm text-stone-600">
        <p>{ready && (pinned ? `Pinned on the home page: “${pinned.title}”` : 'Nothing is pinned on the home page.')}</p>
        {filtering && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setStatus('')
              setCategory('')
              setPage(0)
            }}
            className={linkButton}
          >
            Clear filters
          </button>
        )}
      </div>

      <section aria-label="Announcements" className={`${cardClass} mt-2`}>
        {!ready ? (
          state === 'loading' ? (
            <LoadingState what="announcements" variant="table" />
          ) : (
            <ErrorState what="announcements" help="If it keeps happening, tell the system administrator." onRetry={reload} />
          )
        ) : !all.length ? (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-stone-800">No announcements yet</p>
            <p className="mt-1 text-sm text-stone-600">Write the first one. Parishioners see it on their home page once it is published.</p>
          </div>
        ) : !filtered.length ? (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-stone-800">No announcements match</p>
            <p className="mt-1 text-sm text-stone-600">Try fewer words, or another status.</p>
          </div>
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-200 text-stone-600 max-lg:sr-only">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Announcement
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Date
                  </th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.slice(current * pageSize, (current + 1) * pageSize).map((n) => {
                  const d = dateCell(n)
                  return (
                    <tr key={n.id} className="max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-4 max-lg:gap-y-2.5 max-lg:px-5 max-lg:py-4">
                      <td className="lg:max-w-0 lg:px-5 lg:py-3 max-lg:col-span-2 lg:w-[55%]">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-semibold break-words text-stone-900">{n.title}</span>
                          {n.pinned && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-forest-dark">
                              <Icon name="pin" className="size-3" />
                              Pinned
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-stone-600">
                          {n.category} · {plainText(n.body)}
                        </span>
                      </td>
                      <td className="lg:px-3 lg:py-3">
                        <span className={cellLabel}>Status</span>
                        <NoticeBadge status={n.status} />
                      </td>
                      <td className="lg:px-3 lg:py-3">
                        <span className="block text-xs text-stone-500">{d.label}</span>
                        <span className="block whitespace-nowrap text-stone-800">{d.value}</span>
                      </td>
                      <td className="lg:px-5 lg:py-2 max-lg:col-span-2">
                        <div className="flex gap-2 lg:justify-end">
                          <button
                            type="button"
                            onClick={() => go({ notice: n.id })}
                            aria-label={`View ${n.title}`}
                            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-stone-300 bg-white px-3.5 font-semibold text-forest hover:border-forest/50 hover:bg-forest-soft lg:flex-none"
                          >
                            View
                          </button>
                          {n.status !== 'Archived' && (
                            <button
                              type="button"
                              onClick={() => go({ edit: n.id })}
                              aria-label={`Edit ${n.title}`}
                              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 font-semibold text-forest hover:bg-forest-soft lg:flex-none"
                            >
                              <Icon name="pencil" className="size-4" />
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pagination page={current} pageSize={pageSize} total={filtered.length} onPage={setPage} noun={['announcement', 'announcements']} />
          </>
        )}
      </section>

      <Drawer open={open !== null} onClose={() => open && go({}, true)} labelledBy="nt-title">
        {open && <AnnouncementDrawer key={open.id} notice={open} onAction={(a) => void act(open, a)} onClose={() => go({}, true)} />}
      </Drawer>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this announcement?"
        confirmLabel="Delete"
        tone="danger"
        onConfirm={async () => {
          if (!deleting || busy) return
          setBusy(true)
          const refused = await deleteNotice(deleting.id)
          setBusy(false)
          if (refused) {
            toast(refused)
            reload()
          } else {
            remove(deleting.id)
            toast(`“${deleting.title}” deleted.`)
          }
          setDeleting(null)
          go({}, true)
        }}
      >
        {deleting && <p>“{deleting.title}” is removed for good. This cannot be undone.</p>}
      </ConfirmDialog>
    </StaffLayout>
  )
}
