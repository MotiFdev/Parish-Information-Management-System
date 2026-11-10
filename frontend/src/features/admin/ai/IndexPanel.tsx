import { Icon } from '../../../components/ui/Icon'
import { btnSecondary, cardClass } from '../../../components/ui/styles'
import { sourceTypes, type IndexStatus, type ReindexProgress } from '../aiData'

const longFormat = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' })
const number = new Intl.NumberFormat('en-PH')

interface Props {
  index: IndexStatus
  /** Set while a re-index runs (or was left unfinished). */
  progress: ReindexProgress | null
  /** True while this page is sending re-index steps. */
  working: boolean
  /** The last step failed; shown with a button to carry on. */
  stepError: string | null
  configured: boolean
  onReindex: () => void
  onResume: () => void
  className?: string
}

export function IndexPanel({ index, progress, working, stepError, configured, onReindex, onResume, className = '' }: Props) {
  const total = sourceTypes.reduce((sum, t) => sum + index.counts[t], 0)
  const missing = Math.max(0, index.records - index.indexed)
  const percent = progress ? (progress.total ? Math.round((progress.done / progress.total) * 100) : 100) : 0

  return (
    <section aria-labelledby="index-title" className={`${cardClass} ${className}`}>
      <header className="border-b border-stone-100 px-5 py-4">
        <h2 id="index-title" className="font-serif text-xl font-semibold text-stone-900">
          Search index
        </h2>
        <p className="mt-0.5 text-sm text-stone-600">The searchable copy of records that AI search reads from.</p>
      </header>

      <div className="space-y-4 px-5 py-5">
        {!configured && (
          <p role="status" className="flex gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
            <span>AI search is not set up on the server: GEMINI_API_KEY is missing from the backend .env.</span>
          </p>
        )}
        {!progress && (missing > 0 || index.otherModel > 0) && (
          <p role="status" className="flex gap-2 rounded-lg bg-gold-soft px-3 py-2.5 text-sm text-brown">
            <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
            <span>
              {missing > 0 && (
                <>
                  <span className="font-semibold tabular-nums">{number.format(missing)}</span> of {number.format(index.records)} register entries
                  aren’t searchable with <span className="font-semibold">{index.model}</span> yet.{' '}
                </>
              )}
              {index.otherModel > 0 ? 'Some of the index was built with an earlier model. ' : ''}
              Re-index so every entry can be found. New entries are also picked up within the hour.
            </span>
          </p>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div className="col-span-2">
            <dt className="text-stone-600">Last full re-index</dt>
            <dd className="font-semibold text-stone-900">
              {index.lastReindexed ? longFormat.format(new Date(index.lastReindexed)) : 'Not yet'}
              <span className="block font-normal text-stone-600">
                Index model: {index.model}
                {index.lastIndexed && ` · last entry added ${longFormat.format(new Date(index.lastIndexed))}`}
              </span>
            </dd>
          </div>
          {sourceTypes.map((t) => (
            <div key={t}>
              <dt className="text-stone-600">{t}s</dt>
              <dd className="font-semibold text-stone-900 tabular-nums">{number.format(index.counts[t])}</dd>
            </div>
          ))}
          <div>
            <dt className="text-stone-600">Total</dt>
            <dd className="font-semibold text-stone-900 tabular-nums">{number.format(total)}</dd>
          </div>
        </dl>

        {progress && (
          <div>
            <p className="flex justify-between text-sm font-semibold text-forest">
              <span>{working ? 'Re-indexing all records…' : 'Re-index paused'}</span>
              <span className="tabular-nums">
                {number.format(progress.done)} of {number.format(progress.total)}
              </span>
            </p>
            <div
              role="progressbar"
              aria-label="Re-indexing progress"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-2 h-2.5 overflow-hidden rounded-full bg-stone-200"
            >
              <div className="h-full rounded-full bg-forest transition-[width] duration-300" style={{ width: `${percent}%` }} />
            </div>
            {stepError && (
              <p role="alert" className="mt-2 text-sm text-red-800">
                {stepError}
              </p>
            )}
          </div>
        )}

        {progress && !working ? (
          <button type="button" onClick={onResume} disabled={!configured} className={`${btnSecondary} w-full disabled:cursor-not-allowed disabled:opacity-50`}>
            <Icon name="refresh" className="size-4.5" />
            Continue re-indexing
          </button>
        ) : (
          <button
            type="button"
            onClick={onReindex}
            disabled={working || !configured || index.records === 0}
            className={`${btnSecondary} w-full disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Icon name="refresh" className={`size-4.5 ${working ? 'motion-safe:animate-spin' : ''}`} />
            {working ? 'Re-indexing…' : 'Re-index all records'}
          </button>
        )}
        {progress && working && <p className="text-sm text-stone-600">Keep this page open until it finishes. If you leave, you can continue later.</p>}
      </div>
    </section>
  )
}
