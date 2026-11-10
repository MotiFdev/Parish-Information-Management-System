import { useState } from 'react'
import { Dialog } from '../../../components/ui/Dialog'
import { Field } from '../../../components/ui/Field'
import { Icon } from '../../../components/ui/Icon'
import { inputClass } from '../../../components/ui/styles'
import { FormShell } from '../chapels/ChapelDialogs'
import { byRank, CURRENT_TERM, type Chapel, type Officer } from '../chapels/chapelsData'
import { parishToday, type CommunityEvent, type EventInput } from './eventsApi'

interface Props {
  /** An event to edit, 'new', or null when closed. */
  event: CommunityEvent | 'new' | null
  chapels: Chapel[]
  officers: Officer[]
  onClose: () => void
  /** Resolves with field errors from the server (empty when saved). */
  onSave: (input: EventInput) => Promise<Record<string, string>>
}

export function EventDialog({ event, chapels, officers, onClose, onSave }: Props) {
  return (
    <Dialog open={event !== null} onClose={onClose} labelledBy="chd-title" className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-2xl">
      {event && <EventForm key={event === 'new' ? 'new' : event.event_id} event={event === 'new' ? undefined : event} chapels={chapels} officers={officers} onClose={onClose} onSave={onSave} />}
    </Dialog>
  )
}

function EventForm({ event, chapels, officers, onClose, onSave }: Omit<Props, 'event'> & { event?: CommunityEvent }) {
  const [f, setF] = useState({ name: event?.name ?? '', venue: event?.venue ?? '', date: event?.event_date ?? '', time: event?.start_time ?? '' })
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(event?.officers.map((o) => o.officer_id) ?? []))
  const [search, setSearch] = useState('')
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [busy, setBusy] = useState(false)
  const today = parishToday()

  const set = (patch: Partial<typeof f>) => {
    setF((x) => ({ ...x, ...patch }))
    setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) }))
  }
  const toggle = (id: string) => {
    setChosen((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setErrors((e) => ({ ...e, officers: undefined }))
  }

  // This term's PPC-approved officers, plus anyone already on the event.
  const q = search.trim().toLowerCase()
  const pickable = officers.filter((o) => (o.term === CURRENT_TERM && o.status === 'Approved') || chosen.has(o.id))
  const groups = chapels
    .map((c) => ({
      chapel: c,
      people: pickable.filter((o) => o.chapelId === c.id && (!q || [o.name, o.position, o.ministry, c.name].some((v) => v.toLowerCase().includes(q)))).sort(byRank),
    }))
    .filter((g) => g.people.length)

  return (
    <FormShell
      title={event ? `Edit ${event.name}` : 'Set up an event'}
      intro={event?.status === 'Approved' ? 'Saving changes sends this event back to the PPC for approval.' : 'The PPC approves the event before it goes ahead.'}
      label={event ? 'Save and send for approval' : 'Send for approval'}
      busy={busy}
      onClose={onClose}
      onSubmit={async (e) => {
        e.preventDefault()
        if (busy) return
        const next: Record<string, string | undefined> = {
          name: f.name.trim() ? undefined : 'Enter the event name.',
          venue: f.venue.trim() ? undefined : 'Enter where it takes place.',
          date: !f.date ? 'Choose the date.' : f.date < today ? 'Choose today or a later date.' : undefined,
          time: f.time ? undefined : 'Choose the time it starts.',
          officers: chosen.size ? undefined : 'Assign at least one officer.',
        }
        setErrors(next)
        const firstBad = ['name', 'venue', 'date', 'time', 'officers'].find((k) => next[k])
        if (firstBad) return document.getElementById(`ev-${firstBad}`)?.focus()
        setBusy(true)
        const server = await onSave({ name: f.name.trim(), venue: f.venue.trim(), event_date: f.date, start_time: f.time, officer_ids: [...chosen] })
        setBusy(false)
        setErrors(server)
        const firstServer = ['name', 'venue', 'date', 'time', 'officers'].find((k) => server[k])
        if (firstServer) document.getElementById(`ev-${firstServer}`)?.focus()
      }}
    >
      <Field label="Event name" htmlFor="ev-name" required error={errors.name}>
        <input id="ev-name" value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={150} aria-invalid={errors.name ? true : undefined} className={inputClass} />
      </Field>
      <Field label="Venue" htmlFor="ev-venue" required error={errors.venue}>
        <input id="ev-venue" value={f.venue} onChange={(e) => set({ venue: e.target.value })} maxLength={200} aria-invalid={errors.venue ? true : undefined} className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" htmlFor="ev-date" required error={errors.date}>
          <input id="ev-date" type="date" min={today} value={f.date} onChange={(e) => set({ date: e.target.value })} aria-invalid={errors.date ? true : undefined} className={inputClass} />
        </Field>
        <Field label="Start time" htmlFor="ev-time" required error={errors.time}>
          <input id="ev-time" type="time" value={f.time} onChange={(e) => set({ time: e.target.value })} aria-invalid={errors.time ? true : undefined} className={inputClass} />
        </Field>
      </div>

      <fieldset aria-describedby={errors.officers ? 'ev-officers-error' : undefined}>
        <legend className="mb-1.5 text-sm font-medium text-stone-700">
          Assigned officers<span className="text-red-600"> *</span>
          <span className="ml-2 font-normal text-stone-500">{chosen.size} chosen</span>
        </legend>
        <div className="relative">
          <label htmlFor="ev-officers" className="sr-only">
            Search officers
          </label>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-stone-500" />
          <input
            id="ev-officers"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Name, position, or chapel (approved ${CURRENT_TERM} officers)`}
            className={`${inputClass} pl-10`}
          />
        </div>
        <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-stone-200">
          {groups.length ? (
            groups.map((g) => (
              <div key={g.chapel.id} className="border-b border-stone-100 last:border-b-0">
                <p className="sticky top-0 bg-ivory px-3 py-1.5 text-xs font-semibold text-brown">{g.chapel.name}</p>
                <ul>
                  {g.people.map((o) => (
                    <li key={o.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-1.5 hover:bg-forest-soft/40">
                        <input type="checkbox" checked={chosen.has(o.id)} onChange={() => toggle(o.id)} className="size-4 shrink-0 accent-forest" />
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="font-semibold text-stone-900">{o.name}</span>
                          <span className="text-stone-600">
                            {' '}
                            · {o.position}
                            {o.ministry && `, ${o.ministry}`}
                            {o.term !== CURRENT_TERM && ` (${o.term} term)`}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <p className="px-3 py-6 text-center text-sm text-stone-600">
              {officers.some((o) => o.status === 'Approved') ? 'No officers match.' : 'No approved officers yet. Add them in Chapels & Officers; the PPC approves them first.'}
            </p>
          )}
        </div>
        {errors.officers && (
          <p id="ev-officers-error" className="mt-1.5 text-sm text-red-700">
            {errors.officers}
          </p>
        )}
      </fieldset>
    </FormShell>
  )
}
