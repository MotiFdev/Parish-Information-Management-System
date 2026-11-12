import { useState } from 'react'
import { useToast } from '../../components/toast/toastContext'
import { ErrorState, LoadingState } from '../../components/ui/DataState'
import { Icon } from '../../components/ui/Icon'
import { Pagination } from '../../components/ui/Pagination'
import { btnPrimary, btnSecondary, cardClass, chipClass, inputClass } from '../../components/ui/styles'
import { OfficerAvatar } from '../../features/parishioner/chapels/OfficerAvatar'
import {
  approveChapel,
  approveOfficers,
  rejectChapel,
  rejectOfficer,
  useChapelReviews,
  type ReviewChapel,
  type ReviewOfficer,
} from '../../features/ppc/chapelApprovalsApi'
import { RejectDialog, type RejectTarget } from '../../features/ppc/RejectDialog'
import { PpcLayout } from '../../layouts/PpcLayout'
import { ApiError } from '../../lib/api'

type Tab = 'Pending' | 'Rejected'
type View = 'chapels' | 'officers'
type Rejecting = { kind: 'chapel'; chapel: ReviewChapel } | { kind: 'officer'; officer: ReviewOfficer }

const CHAPEL_PAGE = 10
const OFFICER_PAGE = 15
const noFilters = { search: '', sona: '', chapel: '', term: '', creator: '' }
const smallButton = 'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold'
const linkButton = 'inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-forest hover:bg-forest-soft'
const uniqueSorted = (values: Array<string | null>) => [...new Set(values.filter((v): v is string => !!v))].sort()

export default function ChapelApprovalsPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('Pending')
  const [view, setView] = useState<View>('chapels')
  const [filters, setFilters] = useState(noFilters)
  const [page, setPage] = useState(0)
  const reviews = useChapelReviews(tab)
  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<Rejecting | null>(null)
  const pending = tab === 'Pending'

  const chapels = reviews.data?.chapels ?? []
  const officers = reviews.data?.officers ?? []
  const q = filters.search.trim().toLowerCase()
  const has = (values: Array<string | null>) => !q || values.some((v) => v?.toLowerCase().includes(q))

  const shownChapels = chapels.filter(
    (c) =>
      (!filters.sona || c.sona_name === filters.sona) &&
      (!filters.creator || c.created_by === filters.creator) &&
      has([c.name, c.patron, c.sona_name, c.created_by]),
  )
  const shownOfficers = officers.filter(
    (o) =>
      (!filters.sona || o.sona_name === filters.sona) &&
      (!filters.chapel || o.chapel_name === filters.chapel) &&
      (!filters.term || String(o.term_year) === filters.term) &&
      (!filters.creator || o.created_by === filters.creator) &&
      has([o.name, o.position, o.ministry, o.chapel_name, o.contact_number, o.created_by]),
  )

  const pageSize = view === 'chapels' ? CHAPEL_PAGE : OFFICER_PAGE
  const total = view === 'chapels' ? shownChapels.length : shownOfficers.length
  const currentPage = Math.min(page, Math.max(0, Math.ceil(total / pageSize) - 1))
  const pageChapels = shownChapels.slice(currentPage * CHAPEL_PAGE, (currentPage + 1) * CHAPEL_PAGE)
  const pageOfficers = shownOfficers.slice(currentPage * OFFICER_PAGE, (currentPage + 1) * OFFICER_PAGE)

  // On each page, officers read chapel by chapel and term by term, the way imports arrive.
  const groups = Object.values(
    pageOfficers.reduce<Record<string, { key: string; chapel: string; term: number; officers: ReviewOfficer[] }>>((acc, o) => {
      const key = `${o.chapel_id}-${o.term_year}`
      acc[key] ??= { key, chapel: o.chapel_name ?? 'Unknown chapel', term: o.term_year, officers: [] }
      acc[key].officers.push(o)
      return acc
    }, {}),
  )

  const filtering = q || filters.sona || filters.chapel || filters.term || filters.creator
  const setFilter = (patch: Partial<typeof noFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(0)
  }

  const failed = (e: unknown, what: string) => {
    if (e instanceof ApiError && e.status === 409) {
      toast(`${what} was already decided. The list has been refreshed.`)
      reviews.reload()
    } else toast(`${what} could not be updated. Please try again.`)
  }

  const onApproveChapel = async (c: ReviewChapel) => {
    setBusy(`c${c.chapel_id}`)
    try {
      await approveChapel(c.chapel_id)
      reviews.drop([c.chapel_id], [])
      toast(`${c.name} approved. Officers can now be added to it.`)
    } catch (e) {
      failed(e, c.name)
    }
    setBusy(null)
  }

  const onApproveOfficers = async (list: ReviewOfficer[], key: string) => {
    setBusy(key)
    try {
      const r = await approveOfficers(list.map((o) => o.officer_id))
      reviews.drop([], [...r.approved, ...r.skipped])
      toast(
        `${r.approved.length === 1 ? `${list.find((o) => o.officer_id === r.approved[0])?.name} approved` : `${r.approved.length} officers approved`}.${
          r.skipped.length ? ` ${r.skipped.length} had already been decided.` : ''
        }`,
      )
    } catch (e) {
      failed(e, list.length === 1 ? list[0].name : 'These officers')
    }
    setBusy(null)
  }

  const target: RejectTarget | null = !rejecting
    ? null
    : rejecting.kind === 'chapel'
      ? {
          key: `c${rejecting.chapel.chapel_id}`,
          title: `Reject ${rejecting.chapel.name}?`,
          detail: `${rejecting.chapel.sona_name ?? 'No Sona'}. The GKK or PYA-KKK officer sees your reason and can edit the chapel and send it again.`,
          confirmLabel: 'Reject chapel',
        }
      : {
          key: rejecting.officer.officer_id,
          title: `Reject ${rejecting.officer.name}?`,
          detail: `${rejecting.officer.position} at ${rejecting.officer.chapel_name}, ${rejecting.officer.term_year} term. The organizers see your reason and can edit the officer and send it again.`,
          confirmLabel: 'Reject officer',
        }

  const noun = tab === 'Pending' ? 'waiting for approval' : 'rejected'

  return (
    <PpcLayout activeHref="/ppc/chapels">
      <h1 className="font-serif text-4xl font-semibold text-stone-900">Chapels & Officers</h1>
      <p className="mt-1 max-w-2xl text-stone-600">
        New chapels and officers the GKK and PYA-KKK add. Officers can only be added to an approved chapel, and only approved officers can be
        assigned to events.
      </p>

      <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="group" aria-label="Status">
        {(['Pending', 'Rejected'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t)
              setPage(0)
            }}
            aria-pressed={tab === t}
            className={chipClass(tab === t)}
          >
            {t === 'Pending' ? 'Waiting for approval' : 'Rejected'}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <select
          aria-label="List to show"
          value={view}
          onChange={(e) => {
            setView(e.target.value as View)
            setPage(0)
          }}
          className={`${inputClass} font-semibold`}
        >
          <option value="chapels">Show: Chapels ({shownChapels.length})</option>
          <option value="officers">Show: Officers ({shownOfficers.length})</option>
        </select>
        <div className="relative">
          <label htmlFor="ca-search" className="sr-only">
            {view === 'chapels' ? 'Search chapels' : 'Search officers'}
          </label>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-stone-500" />
          <input
            id="ca-search"
            type="search"
            value={filters.search}
            onChange={(e) => setFilter({ search: e.target.value })}
            placeholder={view === 'chapels' ? 'Chapel, patron, or Sona' : 'Name, position, or chapel'}
            className={`${inputClass} pl-10`}
          />
        </div>
        <select aria-label="Sona" value={filters.sona} onChange={(e) => setFilter({ sona: e.target.value, chapel: '' })} className={inputClass}>
          <option value="">All Sonas</option>
          {uniqueSorted([...chapels.map((c) => c.sona_name), ...officers.map((o) => o.sona_name)]).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select aria-label="Added by" value={filters.creator} onChange={(e) => setFilter({ creator: e.target.value })} className={inputClass}>
          <option value="">Added by anyone</option>
          {uniqueSorted([...chapels.map((c) => c.created_by), ...officers.map((o) => o.created_by)]).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {view === 'officers' && (
          <>
            <select aria-label="Chapel" value={filters.chapel} onChange={(e) => setFilter({ chapel: e.target.value })} className={inputClass}>
              <option value="">All chapels</option>
              {uniqueSorted(officers.filter((o) => !filters.sona || o.sona_name === filters.sona).map((o) => o.chapel_name)).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select aria-label="Term" value={filters.term} onChange={(e) => setFilter({ term: e.target.value })} className={inputClass}>
              <option value="">All terms</option>
              {[...new Set(officers.map((o) => o.term_year))]
                .sort((a, b) => b - a)
                .map((t) => (
                  <option key={t} value={t}>
                    {t} term
                  </option>
                ))}
            </select>
          </>
        )}
      </div>
      {filtering && (
        <div className="mt-1 flex justify-end">
          <button type="button" onClick={() => setFilter(noFilters)} className={linkButton}>
            Clear filters
          </button>
        </div>
      )}

      {reviews.failed ? (
        <div className={`${cardClass} mt-4`}>
          <ErrorState what="chapels and officers" help="If it keeps happening, tell the system administrator." onRetry={reviews.reload} />
        </div>
      ) : !reviews.data ? (
        <div className={`${cardClass} mt-4`}>
          <LoadingState what="chapels and officers" variant="table" />
        </div>
      ) : total === 0 ? (
        <div className={`${cardClass} mt-4 px-5 py-12 text-center`}>
          {filtering ? (
            <>
              <p className="font-semibold text-stone-800">No {view} match</p>
              <p className="mt-1 text-sm text-stone-600">Try fewer words, or another Sona, chapel, or term.</p>
              <button type="button" onClick={() => setFilter(noFilters)} className={`${linkButton} mt-2`}>
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="font-semibold text-stone-800">No {view} {noun}</p>
              {pending && <p className="mt-1 text-sm text-stone-600">New {view} from the GKK and PYA-KKK show up here.</p>}
            </>
          )}
        </div>
      ) : view === 'chapels' ? (
        <section aria-label={`Chapels ${noun}`} className={`${cardClass} mt-4`}>
          <ul className="divide-y divide-stone-100">
            {pageChapels.map((c) => (
              <li key={c.chapel_id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-stone-900">{c.name}</p>
                  <p className="text-sm text-stone-600">
                    {c.sona_name ?? 'No Sona'} · {c.patron ? `Patron: ${c.patron}` : 'No patron'} · {c.fiesta_date ? `Fiesta: ${c.fiesta_date}` : 'No fiesta'}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    Added by {c.created_by ?? 'an officer'}
                    {c.reviewed_by && ` · Rejected by ${c.reviewed_by}`}
                  </p>
                  {c.review_note && <p className="mt-1.5 rounded-md bg-red-50 px-2 py-1 text-sm text-red-900">{c.review_note}</p>}
                </div>
                {pending && (
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => onApproveChapel(c)} disabled={busy !== null} className={`${btnPrimary} disabled:opacity-70`}>
                      <Icon name="check" className="size-4" />
                      {busy === `c${c.chapel_id}` ? 'Approving…' : 'Approve'}
                    </button>
                    <button type="button" onClick={() => setRejecting({ kind: 'chapel', chapel: c })} disabled={busy !== null} className={btnSecondary}>
                      Reject
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={currentPage} pageSize={CHAPEL_PAGE} total={shownChapels.length} onPage={setPage} noun={['chapel', 'chapels']} />
        </section>
      ) : (
        <section aria-label={`Officers ${noun}`} className={`${cardClass} mt-4 overflow-hidden`}>
          {groups.map((g) => (
            <div key={g.key} className="border-b border-stone-100 last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-ivory/70 px-5 py-2.5">
                <h2 className="font-serif text-lg font-semibold text-stone-900">
                  {g.chapel}{' '}
                  <span className="font-sans text-sm font-normal text-stone-500">
                    · {g.term} term · {g.officers.length} {g.officers.length === 1 ? 'officer' : 'officers'} on this page
                  </span>
                </h2>
                {pending && g.officers.length > 1 && (
                  <button type="button" onClick={() => onApproveOfficers(g.officers, g.key)} disabled={busy !== null} className={`${btnPrimary} disabled:opacity-70`}>
                    <Icon name="check" className="size-4" />
                    {busy === g.key ? 'Approving…' : `Approve these ${g.officers.length}`}
                  </button>
                )}
              </div>
              <ul className="divide-y divide-stone-100">
                {g.officers.map((o) => (
                  <li key={o.officer_id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                    <OfficerAvatar officer={{ name: o.name, photo: o.photo_url ?? undefined }} size="md" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p>
                        <span className="font-semibold text-stone-900">{o.name}</span>
                        <span className="text-stone-600">
                          {' '}
                          · {o.position}
                          {o.ministry && `, ${o.ministry}`}
                          {o.age !== null && ` · ${o.age} years old`}
                        </span>
                      </p>
                      <p className="text-xs text-stone-500">
                        {o.sona_name ?? 'No Sona'} · {o.contact_number || 'No number'} · Added by {o.created_by ?? 'an officer'}
                        {o.reviewed_by && ` · Rejected by ${o.reviewed_by}`}
                      </p>
                      {o.review_note && <p className="mt-1 rounded-md bg-red-50 px-2 py-1 text-red-900">{o.review_note}</p>}
                    </div>
                    {pending && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => onApproveOfficers([o], o.officer_id)}
                          disabled={busy !== null}
                          className={`${smallButton} text-forest hover:bg-forest-soft disabled:opacity-70`}
                        >
                          <Icon name="check" className="size-4" />
                          {busy === o.officer_id ? 'Approving…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejecting({ kind: 'officer', officer: o })}
                          disabled={busy !== null}
                          className={`${smallButton} text-red-700 hover:bg-red-50 disabled:opacity-70`}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <Pagination page={currentPage} pageSize={OFFICER_PAGE} total={shownOfficers.length} onPage={setPage} noun={['officer', 'officers']} />
        </section>
      )}

      <RejectDialog
        target={target}
        onClose={() => setRejecting(null)}
        onReject={async (reason) => {
          if (!rejecting) return undefined
          const name = rejecting.kind === 'chapel' ? rejecting.chapel.name : rejecting.officer.name
          try {
            if (rejecting.kind === 'chapel') {
              await rejectChapel(rejecting.chapel.chapel_id, reason)
              reviews.drop([rejecting.chapel.chapel_id], [])
            } else {
              await rejectOfficer(rejecting.officer.officer_id, reason)
              reviews.drop([], [rejecting.officer.officer_id])
            }
            toast(`${name} rejected. The organizers can see your reason.`)
            setRejecting(null)
            return undefined
          } catch (e) {
            if (e instanceof ApiError && e.status === 422) return e.field('reason') ?? e.message
            setRejecting(null)
            failed(e, name)
            return undefined
          }
        }}
      />
    </PpcLayout>
  )
}
