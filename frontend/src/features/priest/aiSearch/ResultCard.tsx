import type { ReactNode } from 'react'
import { Link } from '../../../components/Link'
import { cardClass } from '../../../components/ui/styles'
import type { SearchHit } from './search'

// One ranked result, shared by the priest and staff AI Record Search pages.
// Only the link to the full entry differs between portals.

const dateFormat = new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' })

/** Wraps each matched word in <mark>; years match the entry's own year. */
function Marked({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>
  // Neighbouring matches ("Dela Cruz") join into one highlight instead of two.
  const alt = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const pattern = new RegExp(`((?:${alt})(?:\\s+(?:${alt}))*)`, 'gi')
  const parts: ReactNode[] = text.split(pattern).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded bg-gold-soft px-0.5 text-stone-900">
        {part}
      </mark>
    ) : (
      part
    ),
  )
  return <>{parts}</>
}

/** strongAt: the score from which a result reads as a strong match, from the server's settings. */
export function ResultCard({ hit, rank, href, strongAt }: { hit: SearchHit; rank: number; href: string; strongAt: number }) {
  const e = hit.entry
  const year = e.date.slice(0, 4)
  const marks = hit.terms.map((t) => (/^(19|20)\d\d$/.test(t) ? year : t))
  const strong = hit.score >= strongAt

  return (
    <li className={`${cardClass} px-5 py-4`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-forest-soft text-sm font-semibold text-forest tabular-nums" aria-hidden="true">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-stone-900">
            <span className="sr-only">Result {rank}: </span>
            {e.type} · <Marked text={e.subject} terms={marks} />
          </h3>
          <p className="text-sm text-stone-600">
            {dateFormat.format(new Date(`${e.date}T12:00:00+08:00`))} · Book {e.register.book}, page {e.register.page}, line {e.register.line}
          </p>
          {hit.highlights.length > 0 && (
            <dl className="mt-2 space-y-1 text-sm">
              {hit.highlights.map(([k, v]) => (
                <div key={k} className="flex flex-wrap gap-x-1.5">
                  <dt className="text-stone-600">{k}:</dt>
                  <dd className="text-stone-800">
                    <Marked text={v} terms={marks} />
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="flex shrink-0 flex-row items-center justify-between gap-4 sm:w-40 sm:flex-col sm:items-end">
          <div className="sm:text-right">
            <p className="text-sm">
              <span className="font-semibold text-stone-900 tabular-nums">{hit.score.toFixed(2)}</span>{' '}
              <span className={`font-semibold ${strong ? 'text-forest' : 'text-stone-700'}`}>{strong ? 'Strong match' : 'Match'}</span>
            </p>
            {/* Track runs from 0 to 1, the scale the score is on. */}
            <span className="mt-1 block h-1.5 w-28 overflow-hidden rounded-full bg-stone-200" aria-hidden="true">
              <span className={`block h-full rounded-full ${strong ? 'bg-forest' : 'bg-forest/55'}`} style={{ width: `${hit.score * 100}%` }} />
            </span>
          </div>
          <Link
            href={href}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 font-semibold whitespace-nowrap text-forest hover:border-forest/50 hover:bg-forest-soft"
          >
            View entry
            <span className="sr-only">: {e.subject}</span>
          </Link>
        </div>
      </div>
    </li>
  )
}
