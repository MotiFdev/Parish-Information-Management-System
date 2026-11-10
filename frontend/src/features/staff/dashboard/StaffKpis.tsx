import { StatTile } from '../../../components/ui/StatTile'
import { cardClass } from '../../../components/ui/styles'
import type { PreviewState } from '../../../lib/preview'
import { sacramentPlural, sacraments } from '../../priest/sampleData'
import type { StaffDashboardData } from './dashboardApi'

const number = new Intl.NumberFormat('en-PH')

interface Props {
  state: PreviewState
  data: StaffDashboardData | null
  className?: string
}

// The four figures section 4.3 of the specification puts on the staff dashboard.
export function StaffKpis({ state, data, className = '' }: Props) {
  if (state === 'loading' || state === 'error' || !data) {
    return (
      <div className={`${cardClass} grid place-items-center px-5 py-8 text-sm text-stone-600 ${className}`} role={state === 'error' ? 'alert' : 'status'}>
        {state === 'error' ? 'Parish figures could not be loaded.' : 'Loading parish figures…'}
      </div>
    )
  }

  const { requests, events, registers, parishioners } = data
  const pending = requests.filter((r) => r.status === 'Pending').length
  const verifying = requests.length - pending
  const records = sacraments.reduce((n, s) => n + (registers[s] ?? 0), 0)
  const needApproval = events.filter((e) => e.status === 'Pending').length

  return (
    <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
      <StatTile
        icon="file"
        label="Open requests"
        value={number.format(requests.length)}
        note={
          requests.length ? (
            <>
              <span className="font-semibold text-stone-800">{pending}</span> pending · <span className="font-semibold text-stone-800">{verifying}</span> under
              verification
            </>
          ) : (
            'Nothing waiting'
          )
        }
      />
      <StatTile icon="users" label="Parishioners" value={parishioners ? number.format(parishioners) : 'None yet'} note="In the parish directory" />
      <StatTile icon="book" label="Sacramental records" value={records ? number.format(records) : 'None yet'} note="Entries across all four registers">
        {records > 0 && (
          <p className="text-xs leading-relaxed text-stone-600">
            {sacraments.map((s) => `${number.format(registers[s] ?? 0)} ${sacramentPlural[s].toLowerCase()}`).join(' · ')}
          </p>
        )}
      </StatTile>
      <StatTile
        icon="calendar"
        label="Upcoming events"
        value={number.format(events.length)}
        note={
          events.length ? (
            needApproval ? (
              <span className="font-semibold text-brown">{needApproval} still need approval</span>
            ) : (
              'All approved'
            )
          ) : (
            'Nothing scheduled'
          )
        }
      >
        <p className="text-xs text-stone-600">In the next 7 days</p>
      </StatTile>
    </div>
  )
}
