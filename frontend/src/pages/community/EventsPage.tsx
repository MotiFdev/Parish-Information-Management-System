import { useState } from 'react'
import { useToast } from '../../components/toast/toastContext'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ErrorState, LoadingState } from '../../components/ui/DataState'
import { Icon } from '../../components/ui/Icon'
import { btnPrimary, cardClass, chipClass } from '../../components/ui/styles'
import { formErrors, useChapelDirectory } from '../../features/community/chapels/chapelsApi'
import { EventDialog } from '../../features/community/events/EventDialog'
import { EventList } from '../../features/community/events/EventList'
import { deleteEvent, formatEventWhen, parishToday, saveEvent, useEvents, type CommunityEvent, type EventInput } from '../../features/community/events/eventsApi'
import { CommunityLayout } from '../../layouts/CommunityLayout'

const filters = {
  Upcoming: (e: CommunityEvent, today: string) => e.event_date >= today,
  'Needs changes': (e: CommunityEvent) => e.status === 'Rejected',
  Past: (e: CommunityEvent, today: string) => e.event_date < today,
  All: () => true,
} satisfies Record<string, (e: CommunityEvent, today: string) => boolean>
type Filter = keyof typeof filters

const fieldFor: Record<string, string> = { name: 'name', venue: 'venue', event_date: 'date', start_time: 'time', officer_ids: 'officers' }

export default function EventsPage() {
  const { toast } = useToast()
  const events = useEvents('/api/community/events')
  const directory = useChapelDirectory()
  const loaded = typeof directory.state === 'object' ? directory.state : null
  const [filter, setFilter] = useState<Filter>('Upcoming')
  const [editing, setEditing] = useState<CommunityEvent | 'new' | null>(null)
  const [deleting, setDeleting] = useState<CommunityEvent | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const today = parishToday()

  const list = typeof events.state === 'string' ? [] : events.state
  const shown = list.filter((e) => filters[filter](e, today))
  // Past events read newest first; everything else soonest first.
  if (filter === 'Past') shown.reverse()

  const onSave = async (input: EventInput) => {
    const id = editing && editing !== 'new' ? editing.event_id : undefined
    try {
      const saved = await saveEvent(input, id)
      events.keep(saved.event_id, saved)
      toast(id ? `Saved ${saved.name}. It is waiting for PPC approval again.` : `${saved.name} sent to the PPC for approval.`)
      setEditing(null)
      return {}
    } catch (e) {
      const errors = formErrors(e, fieldFor)
      // officer_ids.0 and the like belong to the officer list.
      for (const k of Object.keys(errors)) if (k.startsWith('officer_ids.')) errors.officers ??= errors[k]
      if (errors.form) toast(errors.form)
      return errors
    }
  }

  return (
    <CommunityLayout activeHref="/community/events">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-stone-900">Events</h1>
          <p className="mt-1 max-w-2xl text-stone-600">
            Set up GKK and PYA-KKK events with their venue, date, and assigned chapel officers. Each one goes to the PPC for approval.
          </p>
        </div>
        <button type="button" onClick={() => setEditing('new')} disabled={!loaded} className={`${btnPrimary} shrink-0`}>
          <Icon name="plus" className="size-4.5" />
          Set up event
        </button>
      </div>

      <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="group" aria-label="Show events">
        {(Object.keys(filters) as Filter[]).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f} className={chipClass(filter === f)}>
            {f} <span className={`tabular-nums ${filter === f ? 'text-white/85' : 'text-stone-500'}`}>{list.filter((e) => filters[f](e, today)).length}</span>
          </button>
        ))}
      </div>

      <section aria-label="Events" className={`${cardClass} mt-4`}>
        {events.state === 'loading' ? (
          <LoadingState what="events" />
        ) : events.state === 'error' ? (
          <ErrorState what="events" help="If it keeps happening, tell the system administrator." onRetry={events.reload} />
        ) : shown.length ? (
          <EventList
            events={shown}
            actions={(e) => (
              <>
                <button type="button" onClick={() => setEditing(e)} disabled={!loaded} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-forest hover:bg-forest-soft">
                  <Icon name="pencil" className="size-4" />
                  Edit
                </button>
                <button type="button" onClick={() => setDeleting(e)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50">
                  Delete
                </button>
              </>
            )}
          />
        ) : (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-stone-800">{list.length ? `No ${filter.toLowerCase()} events` : 'No events yet'}</p>
            <p className="mt-1 text-sm text-stone-600">{list.length ? 'Choose another list above.' : 'Set up the first one to send it to the PPC.'}</p>
          </div>
        )}
      </section>
      {directory.state === 'error' && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          The officer list could not be loaded, so events can’t be set up or edited right now.{' '}
          <button type="button" onClick={directory.reload} className="font-semibold underline">
            Try again
          </button>
        </p>
      )}

      <EventDialog event={editing} chapels={loaded?.chapels ?? []} officers={loaded?.officers ?? []} onClose={() => setEditing(null)} onSave={onSave} />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this event?"
        confirmLabel="Delete"
        tone="danger"
        busy={deleteBusy}
        busyLabel="Deleting…"
        onConfirm={async () => {
          if (!deleting) return
          setDeleteBusy(true)
          try {
            await deleteEvent(deleting.event_id)
            events.keep(deleting.event_id, null)
            toast(`${deleting.name} deleted.`)
            setDeleting(null)
          } catch {
            toast(`${deleting.name} could not be deleted. Please try again.`)
          }
          setDeleteBusy(false)
        }}
      >
        {deleting && (
          <p>
            {deleting.name} on {formatEventWhen(deleting)} is removed for everyone, including the PPC
            {deleting.status === 'Approved' ? ', even though they approved it' : ''}. This can’t be undone.
          </p>
        )}
      </ConfirmDialog>
    </CommunityLayout>
  )
}
