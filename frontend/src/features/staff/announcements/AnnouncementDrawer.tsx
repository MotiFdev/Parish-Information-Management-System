import { Icon } from '../../../components/ui/Icon'
import { btnPrimary, btnSecondary } from '../../../components/ui/styles'
import { whenLabel, type Notice } from './announcementsData'
import { NoticeBadge } from './NoticeBadge'

export type NoticeAction = 'edit' | 'publish' | 'unschedule' | 'archive' | 'toDraft' | 'delete' | 'pin'

const quiet = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-300 bg-white px-5 font-semibold text-stone-700 hover:bg-stone-100'
const danger = 'inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-semibold text-red-700 hover:bg-red-50'

export function AnnouncementDrawer({ notice: n, onAction, onClose }: { notice: Notice; onAction: (a: NoticeAction) => void; onClose: () => void }) {
  const meta: Array<[string, string]> = [
    ['Category', n.category],
    [n.status === 'Published' || n.status === 'Archived' ? 'Published' : 'Goes live', n.publishAt ? whenLabel(n.publishAt) : 'Not scheduled'],
    ['Written by', n.author],
    ['Last edited', whenLabel(n.updatedAt)],
  ]

  return (
    <article aria-labelledby="nt-title" className="flex h-full flex-col bg-white">
      <header className="flex items-start gap-3 border-b border-stone-200 px-5 pt-5 pb-4">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
            <NoticeBadge status={n.status} />
            {n.pinned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-forest-dark">
                <Icon name="pin" className="size-3" />
                Pinned
              </span>
            )}
          </p>
          <h2 id="nt-title" className="mt-2 font-serif text-3xl leading-tight font-semibold break-words text-stone-900">
            {n.title}
          </h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close details" className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800">
          <Icon name="close" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {n.status === 'Scheduled' && (
          <p className="mx-5 mt-5 flex gap-2 rounded-lg bg-gold-soft px-3 py-2.5 text-sm text-brown">
            <Icon name="clock" className="mt-0.5 size-4 shrink-0" />
            Parishioners see this from {whenLabel(n.publishAt!)}. Until then it stays hidden.
          </p>
        )}
        {n.status === 'Archived' && <p className="mx-5 mt-5 rounded-lg bg-stone-100 px-3 py-2.5 text-sm text-stone-700">Archived announcements are hidden from parishioners and kept here for the record.</p>}

        <dl className="grid gap-x-6 gap-y-2.5 px-5 py-5 text-sm sm:grid-cols-2">
          {meta.map(([k, v]) => (
            <div key={k}>
              <dt className="text-stone-600">{k}</dt>
              <dd className="font-medium text-stone-900">{v}</dd>
            </div>
          ))}
        </dl>

        <section aria-label="Announcement text" className="border-t border-stone-100 px-5 py-5">
          {/* The body was sanitized when it was saved; only the editor's own tags remain. */}
          <div className="notice-body text-[15px] leading-relaxed break-words text-stone-800" dangerouslySetInnerHTML={{ __html: n.body }} />
        </section>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-stone-200 bg-ivory px-5 py-4 sm:flex-row sm:flex-wrap sm:justify-end [&>button]:whitespace-nowrap">
        {(n.status === 'Draft' || n.status === 'Archived') && (
          <button type="button" onClick={() => onAction('delete')} className={`${danger} sm:mr-auto`}>
            Delete
          </button>
        )}
        {n.status === 'Published' && (
          <>
            <button type="button" onClick={() => onAction('archive')} className={`${quiet} sm:mr-auto`}>
              Archive
            </button>
            <button type="button" onClick={() => onAction('pin')} className={btnSecondary}>
              <Icon name="pin" className="size-4.5" />
              {n.pinned ? 'Unpin' : 'Pin to top'}
            </button>
          </>
        )}
        {n.status === 'Scheduled' && (
          <button type="button" onClick={() => onAction('unschedule')} className={`${quiet} sm:mr-auto`}>
            Cancel schedule
          </button>
        )}
        {n.status === 'Archived' ? (
          <button type="button" onClick={() => onAction('toDraft')} className={btnPrimary}>
            Move to drafts
          </button>
        ) : (
          <button type="button" onClick={() => onAction('edit')} className={n.status === 'Published' ? btnPrimary : btnSecondary}>
            <Icon name="pencil" className="size-4.5" />
            Edit
          </button>
        )}
        {(n.status === 'Draft' || n.status === 'Scheduled') && (
          <button type="button" onClick={() => onAction('publish')} className={btnPrimary}>
            Publish now
          </button>
        )}
      </div>
    </article>
  )
}
