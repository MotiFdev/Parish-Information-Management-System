import { useEffect, useState } from 'react'
import { ErrorState, LoadingState } from '../components/ui/DataState'
import { Icon } from '../components/ui/Icon'
import { PageBanner } from '../components/ui/PageBanner'
import { btnSecondary, cardClass } from '../components/ui/styles'
import { trackAppointment } from '../features/parishioner/appointments/appointmentsApi'
import { trackRecordRequest } from '../features/parishioner/requests/requestsApi'
import type { Appointment, RecordRequest } from '../features/parishioner/sampleData'
import { AppointmentStatus } from '../features/parishioner/tracking/AppointmentStatus'
import { parseReference } from '../features/parishioner/tracking/reference'
import { RequestStatus } from '../features/parishioner/tracking/RequestStatus'
import { TrackForm } from '../features/parishioner/tracking/TrackForm'
import { ParishionerLayout } from '../layouts/ParishionerLayout'
import { ApiError } from '../lib/api'

/** /track, and /track/RR-7K3M-9QX2 once a reference is entered. */
export default function TrackPage({ reference }: { reference?: string }) {
  return (
    <ParishionerLayout
      activeHref="/track"
      hero={
        <PageBanner
          title="Track a request"
          description="Check where your record request or appointment stands with the reference number you got when you sent it. No account needed."
        />
      }
    >
      <div className={`max-w-2xl p-5 sm:p-6 ${cardClass}`}>
        <TrackForm key={reference ?? ''} initial={reference ?? ''} />
      </div>
      {reference && <TrackResult key={reference} input={reference} />}
    </ParishionerLayout>
  )
}

type Found = { kind: 'record-request'; request: RecordRequest } | { kind: 'appointment'; appointment: Appointment }
type State = { status: 'loading' } | { status: 'not-found' } | { status: 'error' } | { status: 'ready'; found: Found }

function TrackResult({ input }: { input: string }) {
  const parsed = parseReference(input)
  const kind = parsed?.kind
  const reference = parsed?.reference
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!kind || !reference) return
    let cancelled = false
    const lookup: Promise<Found> =
      kind === 'record-request'
        ? trackRecordRequest(reference).then((request) => ({ kind: 'record-request', request }))
        : trackAppointment(reference).then((appointment) => ({ kind: 'appointment', appointment }))
    lookup
      .then((found) => !cancelled && setState({ status: 'ready', found }))
      .catch((e) => !cancelled && setState({ status: e instanceof ApiError && e.status === 404 ? 'not-found' : 'error' }))
    return () => {
      cancelled = true
    }
  }, [kind, reference, attempt])

  if (!parsed || state.status === 'not-found') {
    return (
      <div role="alert" className="mt-8 flex max-w-2xl gap-3 rounded-2xl border border-stone-200 bg-white p-5">
        <Icon name="alert" className="mt-0.5 size-5 shrink-0 text-brown" />
        <div>
          <p className="font-semibold text-stone-900">No request has the reference number {parsed?.reference ?? input}</p>
          <p className="mt-1 text-stone-600">
            Check it against your confirmation. Letters and numbers that look alike are easy to mix up: references never use the
            letters I or O, or the numbers 0 or 1.
          </p>
        </div>
      </div>
    )
  }

  if (state.status === 'loading') {
    return (
      <div className={`mt-8 ${cardClass}`}>
        <LoadingState what="your request" variant="detail" />
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className={`mt-8 ${cardClass}`}>
        <ErrorState what="your request" />
        <div className="px-5 pb-5 text-center">
          <button
            type="button"
            onClick={() => {
              setState({ status: 'loading' })
              setAttempt((n) => n + 1)
            }}
            className={btnSecondary}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return state.found.kind === 'record-request' ? (
    <RequestStatus request={state.found.request} onChange={(request) => setState({ status: 'ready', found: { kind: 'record-request', request } })} />
  ) : (
    <AppointmentStatus appointment={state.found.appointment} />
  )
}
