import { useState } from 'react'
import { useToast } from '../../components/toast/toastContext'
import { ErrorState, LoadingState } from '../../components/ui/DataState'
import { Drawer } from '../../components/ui/Drawer'
import { btnSecondary, cardClass, inputClass } from '../../components/ui/styles'
import { useSonas } from '../../features/parishioner/useSonas'
import { AppointmentDialog } from '../../features/staff/appointments/AppointmentDialogs'
import { AppointmentDrawer } from '../../features/staff/appointments/AppointmentDrawer'
import { decide, useAssignees, useStaffAppointments, type Decision } from '../../features/staff/appointments/appointmentsApi'
import { eventTypes, holdsTime, type EventType } from '../../features/staff/appointments/appointmentsData'
import { Calendar } from '../../features/staff/appointments/Calendar'
import { noQueueFilters } from '../../features/staff/appointments/queueFilters'
import { RequestsTable } from '../../features/staff/appointments/RequestsTable'
import { dayKey, todayKey, whenOf, type View } from '../../features/staff/appointments/calendarDates'
import { StaffLayout } from '../../layouts/StaffLayout'
import { ApiError } from '../../lib/api'
import { usePreviewState } from '../../lib/preview'
import { navigate, useLocation } from '../../lib/router'
import { useStaffDefaults } from '../../features/staff/settings/settingsApi'

const PATH = '/secretary/appointments'
const QUEUE_PAGE_SIZE = 8

export default function AppointmentsPage() {
  const defaults = useStaffDefaults()
  const preview = usePreviewState()
  const { query } = useLocation()
  const { toast } = useToast()
  const { items, failed, reload, replace } = useStaffAppointments()
  const roster = useAssignees()
  const { sonas } = useSonas()
  const [sonaId, setSonaId] = useState('')
  const [chapelId, setChapelId] = useState('')
  const [type, setType] = useState<EventType | ''>('')
  const [dialog, setDialogMode] = useState<Decision['mode'] | null>(null)
  // Fetch the roster again on every open, so accounts added or deactivated since the page loaded are current.
  const setDialog = (mode: Decision['mode'] | null) => {
    if (mode === 'approve' || mode === 'reschedule' || mode === 'assign') roster.reload()
    setDialogMode(mode)
  }
  const [queueFilters, setQueueFilters] = useState(noQueueFilters)
  const [queuePage, setQueuePage] = useState(0)

  // View, date, and the open appointment live in the URL so the dashboard can link straight in.
  const view = (['month', 'week', 'day'] as View[]).find((v) => v === query.get('view')) ?? defaults.calendarView
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(query.get('date') ?? '') ? query.get('date')! : todayKey()
  const go = (patch: Record<string, string | null>, replace = true) => {
    const p = new URLSearchParams(query)
    for (const [k, v] of Object.entries(patch))
      if (v === null) p.delete(k)
      else p.set(k, v)
    navigate(`${PATH}?${p}`, { replace })
  }

  // The design preview switch (?preview=) still overrides what the server returned.
  const state = preview !== 'ready' ? preview : failed && !items ? 'error' : !items ? 'loading' : 'ready'
  const all = state === 'empty' || !items ? [] : items
  const sona = sonas?.find((s) => String(s.sona_id) === sonaId)
  const filtered = all.filter((a) => (!sonaId || a.sonaId === sonaId) && (!chapelId || a.chapelId === chapelId) && (!type || a.type === type))
  const onCalendar = filtered.filter(holdsTime)
  const waiting = filtered.filter((a) => a.status === 'Pending').length
  const open = all.find((a) => a.id === query.get('appointment')) ?? null
  const ready = state === 'ready' || state === 'empty'
  const filtering = sonaId || chapelId || type

  const submit = async (d: Decision) => {
    if (!open) return
    try {
      const updated = await decide(open.id, d)
      replace(updated)
      setDialog(null)
      const who = open.requester.name
      if (d.mode === 'approve') toast(`Approved for ${whenOf(updated.start)} with ${updated.assigned}. ${who} was notified.`)
      else if (d.mode === 'reject') toast(`Request rejected. ${who} was told why.`)
      else if (d.mode === 'reschedule') {
        toast(`Moved to ${whenOf(updated.start)}. ${who} was notified.`)
        go({ date: dayKey(updated.start) })
      } else toast(`${updated.assigned} will lead it.`)
    } catch (err) {
      // Someone else decided first: show where it stands now instead of a stale copy.
      if (err instanceof ApiError && err.status === 409) {
        setDialog(null)
        toast(err.message)
        reload()
        return
      }
      throw err
    }
  }

  return (
    <StaffLayout activeHref={PATH}>
      <h1 className="font-serif text-4xl font-semibold text-stone-900">Appointments & Events</h1>
      <p className="mt-1 max-w-2xl text-stone-600">
        Review booking requests, assign who leads each one, and see the parish calendar. Rejected requests stay off the calendar.
      </p>

      <div className="mt-6 grid gap-2 sm:grid-cols-3 lg:max-w-3xl">
        <select
          aria-label="Sona"
          value={sonaId}
          onChange={(e) => {
            setSonaId(e.target.value)
            setChapelId('')
          }}
          className={inputClass}
        >
          <option value="">All Sonas</option>
          {sonas?.map((s) => (
            <option key={s.sona_id} value={s.sona_id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Chapel"
          value={chapelId}
          onChange={(e) => setChapelId(e.target.value)}
          disabled={!sona}
          className={`${inputClass} disabled:bg-stone-50 disabled:text-stone-500`}
        >
          <option value="">{sona ? 'All chapels in this Sona' : 'Choose a Sona first'}</option>
          {sona?.chapels.map((c) => (
            <option key={c.chapel_id} value={c.chapel_id}>
              {c.name}
            </option>
          ))}
        </select>
        <select aria-label="Event type" value={type} onChange={(e) => setType(e.target.value as EventType | '')} className={inputClass}>
          <option value="">All event types</option>
          {eventTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      {filtering && (
        <button
          type="button"
          onClick={() => {
            setSonaId('')
            setChapelId('')
            setType('')
          }}
          className="mt-2 inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-forest hover:bg-forest-soft"
        >
          Clear filters
        </button>
      )}

      {/* Requests first: they are the part that needs action. The calendar below shows how the weeks fill up. */}
      <section aria-labelledby="queue-title" className={`${cardClass} mt-4`}>
        <header className="flex flex-wrap items-end justify-between gap-2 px-5 pt-4">
          <div>
            <h2 id="queue-title" className="font-serif text-2xl font-semibold text-stone-900">
              Requests to review
            </h2>
            <p className="text-sm text-stone-600">{ready ? `${waiting} waiting for a decision, oldest first` : ' '}</p>
          </div>
          {ready && (
            <button type="button" onClick={reload} className={btnSecondary}>
              Refresh
            </button>
          )}
        </header>
        {state === 'loading' ? (
          <LoadingState what="requests" variant="list" />
        ) : state === 'error' ? (
          <ErrorState what="requests" help="If it keeps happening, tell the system administrator." />
        ) : (
          <RequestsTable
            source={filtered}
            filters={queueFilters}
            onFilters={(f) => {
              setQueueFilters((x) => ({ ...x, ...f }))
              setQueuePage(0)
            }}
            page={queuePage}
            pageSize={QUEUE_PAGE_SIZE}
            onPage={setQueuePage}
            onOpen={(a) => go({ appointment: a.id }, false)}
          />
        )}
      </section>

      <div className="mt-6">
        {!ready ? (
          <div className={cardClass}>
            {state === 'loading' ? (
              <LoadingState what="the calendar" variant="calendar" />
            ) : (
              <ErrorState what="the calendar" help="If it keeps happening, tell the system administrator." />
            )}
          </div>
        ) : (
          <Calendar
            view={view}
            anchor={anchor}
            events={onCalendar}
            onView={(v) => go({ view: v })}
            onAnchor={(k) => go({ date: k })}
            onDay={(k) => go({ date: k, view: 'day' })}
            onOpen={(a) => go({ appointment: a.id }, false)}
          />
        )}
      </div>

      <Drawer open={open !== null} onClose={() => open && go({ appointment: null })} labelledBy="appt-title">
        {open && (
          <AppointmentDrawer
            key={open.id}
            appointment={open}
            all={all}
            onApprove={() => setDialog('approve')}
            onReject={() => setDialog('reject')}
            onReschedule={() => setDialog('reschedule')}
            onAssign={() => setDialog('assign')}
            onClose={() => go({ appointment: null })}
          />
        )}
      </Drawer>

      <AppointmentDialog mode={dialog} appointment={open} all={all} roster={roster} onClose={() => setDialog(null)} onSubmit={submit} />
    </StaffLayout>
  )
}
