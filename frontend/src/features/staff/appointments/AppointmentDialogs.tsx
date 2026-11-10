import { useState, type FormEvent, type ReactNode } from 'react'
import { Dialog } from '../../../components/ui/Dialog'
import { Field } from '../../../components/ui/Field'
import { Icon } from '../../../components/ui/Icon'
import { btnDanger, btnPrimary, btnSecondary, inputClass } from '../../../components/ui/styles'
import { ApiError } from '../../../lib/api'
import type { Decision, useAssignees } from './appointmentsApi'
import { conflictsWith, type Appointment } from './appointmentsData'
import { dayKey, todayKey, whenOf } from './calendarDates'

type Mode = Decision['mode']

interface ShellProps {
  id: string
  title: string
  intro?: ReactNode
  label: string
  danger?: boolean
  busy: boolean
  formError: string | null
  onClose: () => void
  onSubmit: (e: FormEvent) => void
  children: ReactNode
}

function Shell({ id, title, intro, label, danger, busy, formError, onClose, onSubmit, children }: ShellProps) {
  return (
    <form noValidate onSubmit={onSubmit} aria-busy={busy}>
      <div className="px-6 pt-5 pb-4">
        <h2 id={id} className="font-serif text-2xl font-semibold text-stone-900">
          {title}
        </h2>
        {intro && <div className="mt-1 text-stone-700">{intro}</div>}
        <div className="mt-4 space-y-4">{children}</div>
        {formError && (
          <p role="alert" className="mt-4 flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
            <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
            {formError}
          </p>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-stone-100 bg-ivory/50 px-6 py-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className={btnSecondary}>
          Cancel
        </button>
        <button type="submit" disabled={busy} className={`${danger ? btnDanger : btnPrimary} disabled:cursor-wait disabled:opacity-70`}>
          {busy && <span className="size-4 rounded-full border-2 border-white/40 border-t-white motion-safe:animate-spin" aria-hidden="true" />}
          {busy ? 'Saving…' : label}
        </button>
      </div>
    </form>
  )
}

function Conflict({ a, start, all }: { a: Appointment; start: string; all: Appointment[] }) {
  const c = conflictsWith(a, start, all)
  if (!c.length) return null
  return <p className="mt-1 text-sm font-semibold text-brown">Same place, same hour as: {c.map((x) => x.title).join('; ')}</p>
}

type Roster = ReturnType<typeof useAssignees>

/**
 * The real priest and staff accounts that can lead an appointment. Only ids the
 * server listed can be chosen; the server checks the account again on save.
 */
function AssignSelect({
  roster,
  value,
  previous,
  onChange,
  error,
}: {
  roster: Roster
  value: string
  /** Who it was assigned to before, to explain when that account is no longer active. */
  previous?: { id?: string; name?: string }
  onChange: (v: string) => void
  error?: string
}) {
  const { people, failed, reload } = roster
  const listed = people?.some((p) => p.user_id === value) ?? false
  const gone = people && previous?.id && !people.some((p) => p.user_id === previous.id) ? previous.name : undefined
  const hint = gone ? `${gone} is no longer an active priest or staff account. Choose who will lead it now.` : 'The priest or staff member who will lead it.'

  if (failed && !people)
    return (
      <div>
        <p className="mb-1.5 block text-sm font-medium text-stone-700">
          Assign to<span className="text-red-600"> *</span>
        </p>
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          The list of priests and staff could not be loaded.
          <button type="button" onClick={reload} className="inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-red-800 hover:bg-red-100">
            Try again
          </button>
        </div>
      </div>
    )

  return (
    <Field label="Assign to" htmlFor="appt-assign" required error={error} hint={hint}>
      <select
        id="appt-assign"
        value={listed ? value : ''}
        disabled={!people}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'appt-assign-error' : 'appt-assign-hint'}
        className={inputClass}
      >
        <option value="">
          {!people
            ? 'Loading…'
            : people.length
              ? 'Choose a priest or staff member'
              : 'No active priest or staff accounts yet. Ask the administrator to add one.'}
        </option>
        {people?.map((p) => (
          <option key={p.user_id} value={p.user_id}>
            {p.name}
            {p.role ? ` (${p.role})` : ''}
          </option>
        ))}
      </select>
    </Field>
  )
}

interface Props {
  mode: Mode | null
  appointment: Appointment | null
  all: Appointment[]
  roster: Roster
  onClose: () => void
  /** Sends the decision; rejects with an ApiError the dialog shows. */
  onSubmit: (d: Decision) => Promise<void>
}

export function AppointmentDialog({ mode, appointment, all, roster, onClose, onSubmit }: Props) {
  return (
    <Dialog open={mode !== null && appointment !== null} onClose={onClose} labelledBy="appt-dialog-title">
      {mode && appointment && (
        <Body key={`${mode}-${appointment.id}`} mode={mode} a={appointment} all={all} roster={roster} onClose={onClose} onSubmit={onSubmit} />
      )}
    </Dialog>
  )
}

const localTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Manila' }).format(new Date(iso))

// The API's field names, mapped onto the dialog's.
const fieldFor: Record<string, string> = { assigned_staff_id: 'assigned', reason: 'reason', message: 'message', date: 'when', time: 'when' }

function Body({
  mode,
  a,
  all,
  roster,
  onClose,
  onSubmit,
}: {
  mode: Mode
  a: Appointment
  all: Appointment[]
  roster: Roster
  onClose: () => void
  onSubmit: Props['onSubmit']
}) {
  const [assigned, setAssigned] = useState(a.assignedId ?? '')
  const [text, setText] = useState('')
  const [when, setWhen] = useState(() => ({ date: dayKey(a.start), time: localTime(a.start) }))
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const newStart = when.date && when.time ? `${when.date}T${when.time}:00+08:00` : ''
  const id = 'appt-dialog-title'

  const send = async (d: Decision) => {
    setBusy(true)
    setFormError(null)
    try {
      await onSubmit(d)
    } catch (err) {
      setBusy(false)
      if (err instanceof ApiError && err.status === 422 && Object.keys(err.errors).length) {
        const next: Record<string, string> = {}
        for (const [f, m] of Object.entries(err.errors)) next[fieldFor[f] ?? f] ??= m[0]
        setErrors(next)
        if (!Object.keys(next).some((k) => Object.values(fieldFor).includes(k))) setFormError(err.message)
      } else {
        setFormError(err instanceof ApiError && err.status !== 500 ? err.message : 'That could not be saved. Please try again in a moment.')
      }
    }
  }

  const assignSelect = (
    <AssignSelect
      roster={roster}
      value={assigned}
      previous={{ id: a.assignedId, name: a.assigned }}
      onChange={(v) => {
        setAssigned(v)
        setErrors((x) => ({ ...x, assigned: undefined }))
      }}
      error={errors.assigned}
    />
  )
  const isListed = (userId: string) => !!userId && !!roster.people?.some((p) => p.user_id === userId)
  const shell = { id, busy, formError, onClose }

  if (mode === 'approve')
    return (
      <Shell
        {...shell}
        title="Approve this appointment?"
        intro={`${a.requester.name} is notified of the date.`}
        label="Approve"
        onSubmit={(e) => {
          e.preventDefault()
          if (!isListed(assigned)) return setErrors({ assigned: 'Choose who will lead it.' })
          send({ mode: 'approve', assignedId: assigned })
        }}
      >
        <div className="mb-2 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm">
          <span className="block text-stone-600">Requested schedule</span>
          <span className="block font-semibold text-stone-900">{whenOf(a.start)}</span>
          <Conflict a={a} start={a.start} all={all} />
        </div>
        {assignSelect}
      </Shell>
    )

  if (mode === 'assign')
    return (
      <Shell
        {...shell}
        title="Assign priest or staff"
        intro={`${a.title}, ${whenOf(a.start)}`}
        label="Save"
        onSubmit={(e) => {
          e.preventDefault()
          if (!isListed(assigned)) return setErrors({ assigned: 'Choose who will lead it.' })
          send({ mode: 'assign', assignedId: assigned })
        }}
      >
        {assignSelect}
      </Shell>
    )

  if (mode === 'reject')
    return (
      <Shell
        {...shell}
        title="Reject this request?"
        intro={`${a.requester.name} is told why, and can book again.`}
        label="Reject request"
        danger
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim().length < 8) {
            setErrors({ reason: 'Give a reason the requester will understand.' })
            return document.getElementById('appt-reason')?.focus()
          }
          send({ mode: 'reject', reason: text.trim() })
        }}
      >
        <Field label="Reason" htmlFor="appt-reason" required error={errors.reason}>
          <textarea
            id="appt-reason"
            rows={3}
            maxLength={1000}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setErrors({})
            }}
            aria-invalid={errors.reason ? true : undefined}
            aria-describedby={errors.reason ? 'appt-reason-error' : undefined}
            className={inputClass}
          />
        </Field>
      </Shell>
    )

  // Reschedule
  const today = todayKey()
  return (
    <Shell
      {...shell}
      title="Reschedule"
      intro={`Now: ${whenOf(a.start)}. It is confirmed at the new time and the requester is notified.`}
      label="Reschedule and notify"
      onSubmit={(e) => {
        e.preventDefault()
        const next: Record<string, string | undefined> = {
          when: !newStart ? 'Choose a date and time.' : when.date < today ? 'Choose a date from today on.' : undefined,
          message: text.trim().length < 8 ? 'Tell the requester why it moved.' : undefined,
          assigned: !isListed(assigned) ? 'Choose who will lead it.' : undefined,
        }
        setErrors(next)
        if (next.when) return document.getElementById('appt-date')?.focus()
        if (next.assigned) return document.getElementById('appt-assign')?.focus()
        if (next.message) return document.getElementById('appt-message')?.focus()
        send({ mode: 'reschedule', date: when.date, time: when.time, message: text.trim(), assignedId: assigned })
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="New date" htmlFor="appt-date" required error={errors.when}>
          <input
            id="appt-date"
            type="date"
            min={today}
            value={when.date}
            onChange={(e) => {
              setWhen((w) => ({ ...w, date: e.target.value }))
              setErrors((x) => ({ ...x, when: undefined }))
            }}
            aria-invalid={errors.when ? true : undefined}
            className={inputClass}
          />
        </Field>
        <Field label="New time" htmlFor="appt-time" required>
          <input
            id="appt-time"
            type="time"
            step={900}
            value={when.time}
            onChange={(e) => {
              setWhen((w) => ({ ...w, time: e.target.value }))
              setErrors((x) => ({ ...x, when: undefined }))
            }}
            className={inputClass}
          />
        </Field>
      </div>
      {newStart && <Conflict a={a} start={newStart} all={all} />}
      {assignSelect}
      <Field label="Message to the requester" htmlFor="appt-message" required error={errors.message}>
        <textarea
          id="appt-message"
          rows={2}
          maxLength={1000}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setErrors((x) => ({ ...x, message: undefined }))
          }}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? 'appt-message-error' : undefined}
          className={inputClass}
        />
      </Field>
    </Shell>
  )
}
