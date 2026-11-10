import { useState } from 'react'
import { ErrorState, LoadingState } from '../../../components/ui/DataState'
import { Icon } from '../../../components/ui/Icon'
import { cardClass, chipClass } from '../../../components/ui/styles'
import type { AnnouncementCategory } from '../sampleData'
import { usePublicAnnouncements } from './announcementsApi'

const filters: Array<'All' | AnnouncementCategory> = ['All', 'Parish', 'Liturgy', 'Sacraments', 'Chapels']

export function AnnouncementsSection() {
  const { state, reload } = usePublicAnnouncements()
  const [filter, setFilter] = useState<(typeof filters)[number]>('All')

  if (state === 'loading') return <LoadingState what="announcements" />
  if (state === 'error') return <ErrorState what="announcements" onRetry={reload} />

  const source = state
  const visible = source.filter((a) => filter === 'All' || a.category === filter)
  const pinned = visible.find((a) => a.pinned)
  const rest = visible.filter((a) => a !== pinned)

  return (
    <div className="space-y-5">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="group" aria-label="Filter announcements">
        {filters.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f} className={chipClass(filter === f)}>
            {f}
          </button>
        ))}
      </div>

      {/* The pinned notice is the one announcement the parish wants everyone to see, so it gets the dark panel. */}
      {pinned && (
        <article className="rounded-2xl bg-forest p-6 text-white sm:p-8">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-sm font-bold text-forest-dark">
            <Icon name="pin" className="size-3.5" />
            Pinned · {pinned.category}
          </p>
          <h3 className="mt-4 max-w-2xl font-serif text-3xl leading-tight font-semibold">{pinned.title}</h3>
          <p className="mt-3 max-w-2xl leading-relaxed text-white/90">{pinned.excerpt}</p>
          <p className="mt-5 text-sm text-white/80">Posted {pinned.postedOn}</p>
        </article>
      )}

      {rest.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {rest.map((a) => (
            <article key={a.id} className={`flex flex-col p-5 ${cardClass}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-brown-soft px-2.5 py-0.5 text-sm font-semibold text-brown">{a.category}</span>
                <time className="text-sm text-stone-600">{a.postedOn}</time>
              </div>
              <h3 className="mt-3 font-serif text-xl leading-snug font-semibold text-stone-900">{a.title}</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-stone-700">{a.excerpt}</p>
            </article>
          ))}
        </div>
      ) : (
        !pinned && (
          <p className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-5 py-10 text-center text-stone-600">
            {source.length === 0
              ? 'The parish has not posted any announcements yet.'
              : `No ${filter.toLowerCase()} announcements right now. Choose All to see every post.`}
          </p>
        )
      )}
    </div>
  )
}
