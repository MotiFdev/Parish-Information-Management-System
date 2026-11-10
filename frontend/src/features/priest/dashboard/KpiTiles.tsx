import { Link } from '../../../components/Link'
import { Icon } from '../../../components/ui/Icon'
import { StatTile } from '../../../components/ui/StatTile'
import { cardClass } from '../../../components/ui/styles'
import type { PreviewState } from '../../../lib/preview'
import { sacramentPlural, sacraments, type AwaitingRequest, type Sacrament } from '../sampleData'
import { isOverdue, waitingDays, waitingText } from '../waiting'
import { monthDate, type PriestDashboardData } from './dashboardApi'

const number = new Intl.NumberFormat('en-PH')
const monthLong = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' })
const monthShort = new Intl.DateTimeFormat('en-PH', { month: 'short' })
const monthName = new Intl.DateTimeFormat('en-PH', { month: 'long' })

// Twelve columns, all in the quiet hue except the current month, which carries the accent.
function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex h-8 items-end gap-0.5" aria-hidden="true">
      {values.map((v, i) => (
        <span
          key={i}
          className={`flex-1 rounded-t-[2px] ${i === values.length - 1 ? 'bg-forest' : 'bg-stone-300'}`}
          style={{ height: `${Math.max(6, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

interface Props {
  state: PreviewState
  data: PriestDashboardData | null
  /** The certificate queue; null while it loads. */
  requests: AwaitingRequest[] | null
  className?: string
}

// The headline row: four figures the priest checks first, the same height side by side.
export function KpiTiles({ state, data, requests: queue, className = '' }: Props) {
  if (state === 'loading' || state === 'error' || !data) {
    return (
      <div className={`${cardClass} grid place-items-center px-5 py-8 text-sm text-stone-600 ${className}`} role={state === 'error' ? 'alert' : 'status'}>
        {state === 'error' ? 'Parish figures could not be loaded.' : 'Loading parish figures…'}
      </div>
    )
  }

  const requests = queue ?? []
  const issued = data.this_year
  const issuedTotal = sacraments.reduce((sum, s) => sum + issued[s], 0)
  const latest = monthDate(data.months[data.months.length - 1])
  const bookings = data.mass_bookings
  const oldest = requests.length ? waitingDays([...requests].sort((a, b) => a.verifiedAt.localeCompare(b.verifiedAt))[0].verifiedAt) : 0
  const corrections = sacraments.reduce((n, s) => n + data.corrections_waiting[s], 0)
  // Open the register holding the most corrections, filtered to the ones waiting.
  const correctionsIn = [...sacraments].sort((a, b) => data.corrections_waiting[b] - data.corrections_waiting[a])[0] as Sacrament

  return (
    <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
      <StatTile
        icon="seal"
        label="Awaiting your approval"
        value={queue ? number.format(requests.length) : '…'}
        note={
          !queue ? (
            'Loading the queue'
          ) : requests.length ? (
            <span className={isOverdue(oldest) ? 'font-semibold text-brown' : ''}>Oldest: {waitingText(oldest).toLowerCase()}</span>
          ) : (
            'Nothing to sign'
          )
        }
      >
        {requests.length > 0 && (
          <Link
            href="/priest/records/verify"
            className="-mx-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-forest hover:underline"
          >
            Review and sign
            <Icon name="chevronRight" className="size-4" />
          </Link>
        )}
        {corrections > 0 && (
          <Link
            href={`/priest/records/sacramental?register=${correctionsIn.toLowerCase()}`}
            className="-mx-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-brown hover:underline"
          >
            {corrections === 1 ? '1 register correction' : `${corrections} register corrections`} to review
            <Icon name="chevronRight" className="size-4" />
          </Link>
        )}
      </StatTile>
      <StatTile
        icon="users"
        label="Total parishioners"
        value={data.parishioners ? number.format(data.parishioners) : 'None yet'}
        note="In the parish directory"
      />
      <StatTile
        icon="book"
        label="Sacraments issued"
        value={issuedTotal ? number.format(issuedTotal) : 'None yet'}
        note={`January to ${monthName.format(latest)} ${latest.getFullYear()}`}
      >
        {issuedTotal > 0 && (
          <p className="text-xs leading-relaxed text-stone-600">
            {sacraments.map((s) => `${number.format(issued[s])} ${sacramentPlural[s].toLowerCase()}`).join(' · ')}
          </p>
        )}
      </StatTile>
      <StatTile icon="calendar" label="Mass bookings this month" value={number.format(bookings[bookings.length - 1])} note={monthLong.format(latest)}>
        {bookings.some((b) => b > 0) && (
          <>
            <Sparkline values={bookings} />
            <p className="mt-1 flex justify-between text-xs text-stone-600">
              <span>{monthShort.format(monthDate(data.months[0]))}</span>
              <span>{monthShort.format(latest)}</span>
            </p>
          </>
        )}
      </StatTile>
    </div>
  )
}
