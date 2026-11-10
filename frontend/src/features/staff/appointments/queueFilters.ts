import type { Appointment, AppointmentStatus, VenueType } from './appointmentsData'

// The requests table's own filters, on top of the page's Sona, Chapel, and Event type.

export interface QueueFilters {
  search: string
  status: AppointmentStatus | 'all'
  venue: VenueType | 'all'
}

export const noQueueFilters: QueueFilters = { search: '', status: 'Pending', venue: 'all' }

/** Applies the table's own filters. Waiting requests read oldest first; decided ones newest first. */
export function filterQueue(source: Appointment[], f: QueueFilters) {
  const q = f.search.trim().toLowerCase()
  return source
    .filter(
      (a) =>
        (f.status === 'all' || a.status === f.status) &&
        (f.venue === 'all' || a.venue === f.venue) &&
        (!q || [a.reference ?? '', a.title, a.type, a.requester.name, a.intention?.names ?? '', a.houseAddress ?? ''].some((v) => v.toLowerCase().includes(q))),
    )
    .sort((a, b) => (a.status === 'Pending' && b.status === 'Pending' ? a.requestedAt.localeCompare(b.requestedAt) : a.status === 'Pending' ? -1 : b.status === 'Pending' ? 1 : b.requestedAt.localeCompare(a.requestedAt)))
}
