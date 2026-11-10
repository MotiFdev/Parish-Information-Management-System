import type { ReactNode } from 'react'
import { Icon } from '../../../components/ui/Icon'
import { btnPrimary, btnSecondary } from '../../../components/ui/styles'
import { StatusBadge } from '../../parishioner/home/StatusBadge'
import { conflictsWith, holdsTime, placeLine, sonaShort, type Appointment } from './appointmentsData'
import { whenOf } from './calendarDates'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-stone-100 px-5 py-5 first:border-t-0">
      <h3 className="mb-3 font-semibold text-stone-900">{title}</h3>
      {children}
    </section>
  )
}

function Pairs({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-stone-600">{k}</dt>
          <dd className="font-medium break-words text-stone-900">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

interface Props {
  appointment: Appointment
  all: Appointment[]
  onApprove: () => void
  onReject: () => void
  onReschedule: () => void
  onAssign: () => void
  onClose: () => void
}

export function AppointmentDrawer({ appointment: a, all, onApprove, onReject, onReschedule, onAssign, onClose }: Props) {
  const president = a.president
  const clash = holdsTime(a) ? conflictsWith(a, a.start, all) : []

  return (
    <article aria-labelledby="appt-title" className="flex h-full flex-col bg-white">
      <header className="flex items-start gap-3 border-b border-stone-200 px-5 pt-5 pb-4">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-stone-700">{a.type}</span>
            <StatusBadge status={a.status} />
            {a.reference && <span className="font-mono text-stone-600">{a.reference}</span>}
          </p>
          <h2 id="appt-title" className="mt-1 font-serif text-3xl font-semibold text-stone-900">
            {a.title}
          </h2>
          <p className="text-stone-700">
            {whenOf(a.start)} · {placeLine(a)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
        >
          <Icon name="close" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {clash.length > 0 && (
          <section aria-label="Schedule conflict" className="flex gap-2 border-b border-stone-100 bg-gold-soft/60 px-5 py-3 text-sm text-brown">
            <Icon name="alert" className="mt-0.5 size-4.5 shrink-0" />
            <p>
              <span className="font-semibold">Same place, same hour:</span> {clash.map((c) => `${c.title} (${whenOf(c.start)})`).join('; ')}.
            </p>
          </section>
        )}

        <Section title="Schedule">
          <Pairs
            rows={[
              [a.status === 'Approved' ? 'Scheduled' : 'Requested', whenOf(a.start)],
              ['Assigned to', a.assigned ?? (holdsTime(a) ? 'Not assigned yet' : 'Not assigned')],
              ['Requested', whenOf(a.requestedAt)],
            ]}
          />
          {a.status === 'Rejected' && a.rejectionReason && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              <span className="font-semibold">Rejected:</span> {a.rejectionReason}
            </p>
          )}
          {a.remarks && (
            <p className="mt-3 rounded-lg bg-ivory px-3 py-2 text-sm text-stone-800">
              <span className="font-semibold">Told the requester:</span> {a.remarks}
            </p>
          )}
        </Section>

        <Section title="Venue">
          <Pairs
            rows={[
              ['Venue', a.venue],
              ...(a.sonaName ? ([['Sona', sonaShort(a.sonaName)]] as [string, ReactNode][]) : []),
              ...(a.chapelName ? ([[a.venue === 'Chapel' ? 'Chapel' : 'Nearest chapel', a.chapelName]] as [string, ReactNode][]) : []),
              ...(a.houseAddress ? ([['House address', a.houseAddress]] as [string, ReactNode][]) : []),
            ]}
          />
          {/* Section 4.3: for chapel events, show the chapel president's contact so staff can coordinate. */}
          {a.venue === 'Chapel' && president && (
            <div className="mt-4 rounded-xl border border-stone-200 px-4 py-3 text-sm">
              <p className="text-xs font-semibold text-stone-600">Chapel president</p>
              <p className="font-semibold text-stone-900">{president.name}</p>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-stone-700">
                {president.contact && (
                  <a
                    href={`tel:${president.contact.replace(/\s+/g, '')}`}
                    className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-forest underline-offset-2 hover:underline"
                  >
                    <Icon name="phone" className="size-4" />
                    {president.contact}
                  </a>
                )}
                {president.fb && <span className="inline-flex min-h-11 items-center">Facebook: {president.fb}</span>}
              </p>
            </div>
          )}
        </Section>

        <Section title="Details">
          <Pairs
            rows={[
              ...(a.intention
                ? ([
                    ['Intention', a.intention.category],
                    ['For', a.intention.names],
                  ] as [string, ReactNode][])
                : []),
              ...(a.couple
                ? ([
                    ['Groom', a.couple.groom],
                    ['Bride', a.couple.bride],
                    ['Couple’s contact numbers', a.couple.contacts],
                  ] as [string, ReactNode][])
                : []),
              ['Attendees', a.attendees ? String(a.attendees) : 'Not given'],
              ['Notes', a.notes ?? 'None'],
            ]}
          />
        </Section>

        <Section title="Requested by">
          <Pairs
            rows={[
              ['Name', a.requester.name],
              ['Contact number', a.requester.contact],
              ['Email', a.requester.email],
              ...(a.requester.address ? ([['Address', a.requester.address]] as [string, ReactNode][]) : []),
            ]}
          />
        </Section>
      </div>

      {holdsTime(a) && (
        <div className="flex flex-col-reverse gap-2 border-t border-stone-200 bg-ivory px-5 py-4 sm:flex-row sm:flex-wrap sm:justify-end [&>button]:whitespace-nowrap">
          {a.status === 'Pending' ? (
            <>
              <button
                type="button"
                onClick={onReject}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-700/40 bg-white px-5 font-semibold text-red-700 hover:bg-red-50"
              >
                Reject
              </button>
              <button type="button" onClick={onReschedule} className={btnSecondary}>
                Reschedule
              </button>
              <button type="button" onClick={onApprove} className={btnPrimary}>
                <Icon name="check" className="size-4.5" strokeWidth={2.5} />
                Approve
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onReschedule} className={btnSecondary}>
                Reschedule
              </button>
              <button type="button" onClick={onAssign} className={btnPrimary}>
                {a.assigned ? 'Change who is assigned' : 'Assign priest or staff'}
              </button>
            </>
          )}
        </div>
      )}
    </article>
  )
}
