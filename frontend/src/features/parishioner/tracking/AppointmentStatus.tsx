import { Link } from '../../../components/Link'
import { Card } from '../../../components/ui/Card'
import { Icon } from '../../../components/ui/Icon'
import { btnSecondary } from '../../../components/ui/styles'
import { StatusBadge } from '../home/StatusBadge'
import { type Appointment, type AppointmentStatus as Status } from '../sampleData'
import { useOfficeHours } from '../officeHours'

const meaning: Record<Status, string> = {
  Pending: 'The parish office hasn’t confirmed it yet. The date and time may still change.',
  Approved: 'Confirmed by the parish office.',
  Rejected: 'The parish office couldn’t take this appointment.',
  Cancelled: 'This appointment was cancelled.',
}

/** An appointment request found by its reference number. */
export function AppointmentStatus({ appointment: a }: { appointment: Appointment }) {
  const officeHours = useOfficeHours()
  return (
    <section aria-labelledby="result-heading" className="mt-10">
      <h2 id="result-heading" className="font-serif text-3xl font-semibold text-stone-900">
        {a.title}
      </h2>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-stone-600">
        <span className="font-mono font-semibold text-stone-800">{a.reference}</span>
        <span>{a.eventType}</span>
        <StatusBadge status={a.status} />
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card level="h3" title="Where it stands">
            <div className="px-5 py-5">
              <p className="text-stone-800">{meaning[a.status]}</p>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="flex items-center gap-1.5 text-sm font-semibold text-stone-600">
                    <Icon name="clock" className="size-4 text-stone-400" />
                    {a.status === 'Pending' ? 'Requested time' : 'Schedule'}
                  </dt>
                  <dd className="mt-0.5 text-stone-900">{a.schedule}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-sm font-semibold text-stone-600">
                    <Icon name="mapPin" className="size-4 text-stone-400" />
                    Venue
                  </dt>
                  <dd className="mt-0.5 text-stone-900">{a.venue}</dd>
                </div>
              </dl>
            </div>
            {a.staffRemarks && (
              <p
                className={`flex gap-3 border-t px-5 py-4 text-sm ${
                  a.status === 'Rejected' ? 'border-red-100 bg-red-50 text-red-900' : 'border-stone-100 bg-forest-soft/60 text-stone-800'
                }`}
              >
                <Icon name="message" className="mt-0.5 size-4.5 shrink-0" />
                <span>
                  <span className="font-semibold">From the parish office: </span>
                  {a.staffRemarks}
                </span>
              </p>
            )}
          </Card>
        </div>

        <section className="rounded-2xl bg-forest p-5 text-white">
          <h3 className="font-serif text-xl font-semibold">Need to change it?</h3>
          <p className="mt-2 text-sm text-white/85">Call or visit the parish office, {officeHours}, and give them your reference number.</p>
          {(a.status === 'Rejected' || a.status === 'Cancelled') && (
            <Link href="/parishioner/appointments" className={`${btnSecondary} mt-4`}>
              Book another time
            </Link>
          )}
        </section>
      </div>
    </section>
  )
}
