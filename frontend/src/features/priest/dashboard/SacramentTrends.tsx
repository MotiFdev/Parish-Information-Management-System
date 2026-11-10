import { useState } from 'react'
import { ErrorState, LoadingState } from '../../../components/ui/DataState'
import { cardClass } from '../../../components/ui/styles'
import type { PreviewState } from '../../../lib/preview'
import { sacramentPlural, sacraments, type Sacrament } from '../sampleData'
import { monthDate } from './dashboardApi'

const monthShort = new Intl.DateTimeFormat('en-PH', { month: 'short' })
const monthLong = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' })

/** A clean axis top: the next multiple of 10 (or 50 for big batches), so the midline is a whole number too. */
function niceMax(v: number) {
  const step = v > 50 ? 50 : 10
  return Math.max(step, Math.ceil(v / step) * step)
}

// Small multiples: each sacrament gets its own panel and its own scale. Confirmations
// come in large batches that would flatten the other three on a shared scale, and
// each panel's job is that sacrament's own month-to-month pattern. The totals beside
// each title compare the four.
function Panel({ type, values, months }: { type: Sacrament; values: number[]; months: Date[] }) {
  const total = values.reduce((a, b) => a + b, 0)
  const max = niceMax(Math.max(...values))

  return (
    <figure className="min-w-0">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-stone-900">{sacramentPlural[type]}</span>
        <span className="text-sm text-stone-600">{total} in 12 months</span>
      </figcaption>
      <div className="relative mt-3 ml-7 h-32">
        {/* Hairline gridlines at 0, half, and the top of the shared scale. */}
        {[0, 0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-stone-200" style={{ bottom: `${f * 100}%` }} aria-hidden="true">
            <span className="absolute -top-2 -left-7 w-6 text-right text-[11px] leading-none text-stone-600 tabular-nums">{Math.round(max * f)}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {values.map((v, i) => (
            <div key={i} className="group relative flex h-full flex-1 items-end justify-center">
              {v > 0 && <span className="w-full max-w-6 rounded-t bg-forest group-hover:bg-forest-dark" style={{ height: `${(v / max) * 100}%` }} />}
              {/* Hover tooltip; the table view carries the same values for keyboard and screen-reader users. */}
              <span
                className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-md bg-stone-900 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg group-hover:block"
                aria-hidden="true"
              >
                {monthLong.format(months[i])}: <span className="font-semibold">{v}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 ml-7 flex text-[11px] text-stone-600" aria-hidden="true">
        {months.map((m, i) => (
          <span key={i} className="flex-1 text-center">
            {i % 3 === 0 || i === months.length - 1 ? monthShort.format(m) : ''}
          </span>
        ))}
      </div>
    </figure>
  )
}

interface Props {
  state: PreviewState
  /** Register entries per month, aligned with `months` ('YYYY-MM'). */
  months: string[]
  trend: Record<Sacrament, number[]> | null
  onRetry?: () => void
}

export function SacramentTrends({ state: preview, months: keys, trend, onRetry }: Props) {
  const [asTable, setAsTable] = useState(false)
  const months = keys.map(monthDate)
  const counts = trend ?? { Baptism: [], Confirmation: [], Marriage: [], Burial: [] }
  const empty = preview === 'empty' || sacraments.every((s) => counts[s].every((v) => v === 0))
  const range = months.length ? `${monthLong.format(months[0])} to ${monthLong.format(months[months.length - 1])}` : 'The last 12 months'

  return (
    <section aria-labelledby="trends-title" className={cardClass}>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-stone-100 px-5 py-4">
        <div>
          <h2 id="trends-title" className="font-serif text-2xl font-semibold text-stone-900">
            Sacraments recorded each month
          </h2>
          <p className="text-sm text-stone-600">{range}. Each chart has its own scale; compare the totals.</p>
        </div>
        {preview === 'ready' && !empty && (
          <button
            type="button"
            aria-pressed={asTable}
            onClick={() => setAsTable((t) => !t)}
            className="inline-flex min-h-11 items-center rounded-lg border border-stone-300 bg-white px-3.5 text-sm font-semibold text-stone-700 hover:border-forest/50 hover:text-forest"
          >
            {asTable ? 'Show as charts' : 'Show as table'}
          </button>
        )}
      </header>

      {preview === 'loading' ? (
        <LoadingState what="sacrament trends" />
      ) : preview === 'error' ? (
        <ErrorState what="sacrament trends" help="If it keeps happening, the parish office can check the system." onRetry={onRetry} />
      ) : empty ? (
        <p className="px-5 py-10 text-center text-sm text-stone-600">
          No sacraments recorded in the last 12 months. Charts appear once entries are added to the registers.
        </p>
      ) : asTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm tabular-nums">
            <caption className="sr-only">Sacraments recorded each month, {range}</caption>
            <thead className="border-b border-stone-200 text-stone-600">
              <tr>
                <th scope="col" className="px-5 py-2.5 text-left font-semibold">
                  Month
                </th>
                {sacraments.map((s) => (
                  <th key={s} scope="col" className="px-3 py-2.5 font-semibold">
                    {sacramentPlural[s]}
                  </th>
                ))}
                <th scope="col" className="px-5 py-2.5 font-semibold">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {months.map((m, i) => (
                <tr key={i}>
                  <th scope="row" className="px-5 py-2 text-left font-medium text-stone-800">
                    {monthLong.format(m)}
                  </th>
                  {sacraments.map((s) => (
                    <td key={s} className="px-3 py-2 text-stone-700">
                      {counts[s][i]}
                    </td>
                  ))}
                  <td className="px-5 py-2 font-semibold text-stone-900">{sacraments.reduce((sum, s) => sum + counts[s][i], 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-x-10 gap-y-8 px-5 py-6 sm:grid-cols-2">
          {sacraments.map((s) => (
            <Panel key={s} type={s} values={counts[s]} months={months} />
          ))}
        </div>
      )}
    </section>
  )
}
