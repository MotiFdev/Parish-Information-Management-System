import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import type { Appointment, AppointmentStatus, EventType, IntentionCategory } from './appointmentsData'

/** One row of GET /api/secretary/appointments. */
interface ApiAppointment {
  appointment_id: string
  reference_number: string
  event_type: string
  event_title: string
  status: AppointmentStatus
  venue_type: 'Parish Church' | 'Chapel' | 'Home'
  sona_id: number | null
  sona_name: string | null
  chapel_id: number | null
  chapel_name: string | null
  chapel_president: { name: string; contact_number: string | null; fb_account: string | null } | null
  house_address: string | null
  scheduled_start: string
  requester: { name: string; contact_number: string; email: string | null }
  intention_category: 'Thanksgiving' | 'Souls' | 'Healing' | 'Special' | null
  intention_details: string | null
  attendee_count: number | null
  notes: string | null
  couple: { groom_name: string; groom_contact: string | null; bride_name: string | null; bride_contact: string | null } | null
  assigned_staff_id: string | null
  assigned_name: string | null
  staff_remarks: string | null
  created_at: string | null
}

export interface Assignee {
  user_id: string
  name: string
  role: string | null
}

const intentionLabel: Record<NonNullable<ApiAppointment['intention_category']>, IntentionCategory> = {
  Thanksgiving: 'Thanksgiving',
  Souls: 'Souls of the Departed',
  Healing: 'Healing',
  Special: 'Special Intention',
}

/** "09175550142" -> "0917 555 0142" */
const spaced = (n: string | null | undefined) => (n && /^09\d{9}$/.test(n) ? `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}` : (n ?? ''))

export function fromApi(r: ApiAppointment): Appointment {
  return {
    id: r.appointment_id,
    reference: r.reference_number,
    type: r.event_type as EventType,
    title: r.event_title,
    status: r.status,
    venue: r.venue_type === 'Home' ? "Client's Home" : r.venue_type,
    sonaId: r.sona_id ? String(r.sona_id) : undefined,
    chapelId: r.chapel_id ? String(r.chapel_id) : undefined,
    sonaName: r.sona_name ?? undefined,
    chapelName: r.chapel_name ?? undefined,
    president: r.chapel_president
      ? { name: r.chapel_president.name, contact: spaced(r.chapel_president.contact_number), fb: r.chapel_president.fb_account ?? '' }
      : null,
    houseAddress: r.house_address ?? undefined,
    start: r.scheduled_start,
    requester: { name: r.requester.name, contact: spaced(r.requester.contact_number), email: r.requester.email ?? '' },
    intention: r.intention_category ? { category: intentionLabel[r.intention_category], names: r.intention_details ?? '' } : undefined,
    attendees: r.attendee_count ?? undefined,
    notes: r.notes ?? undefined,
    couple: r.couple
      ? {
          groom: r.couple.groom_name,
          bride: r.couple.bride_name ?? '',
          contacts: [r.couple.groom_contact, r.couple.bride_contact].filter(Boolean).map(spaced).join(', '),
        }
      : undefined,
    assigned: r.assigned_name ?? undefined,
    assignedId: r.assigned_staff_id ?? undefined,
    // One remarks column holds the latest word to the requester: the rejection reason or the reschedule message.
    remarks: r.status === 'Rejected' ? undefined : (r.staff_remarks ?? undefined),
    rejectionReason: r.status === 'Rejected' ? (r.staff_remarks ?? undefined) : undefined,
    requestedAt: r.created_at ?? r.scheduled_start,
  }
}

/** All requests and appointments the office needs, with `reload` and `replace` for after a decision. */
export function useStaffAppointments() {
  const [items, setItems] = useState<Appointment[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    api<{ data: ApiAppointment[] }>('/api/secretary/appointments')
      .then((r) => {
        if (cancelled) return
        setItems(r.data.map(fromApi))
        setFailed(false)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const replace = useCallback((a: Appointment) => setItems((xs) => xs?.map((x) => (x.id === a.id ? a : x)) ?? xs), [])
  return { items, failed, reload, replace }
}

/**
 * The active Parish Priest and Secretary accounts, from the server. `reload`
 * refetches, so accounts the administrator adds or deactivates show up the next
 * time a dialog opens.
 */
export function useAssignees() {
  const [people, setPeople] = useState<Assignee[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    api<{ data: Assignee[] }>('/api/secretary/appointments/assignees')
      .then((r) => {
        if (cancelled) return
        setPeople(r.data)
        setFailed(false)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [attempt])
  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  return { people, failed, reload }
}

export type Decision =
  | { mode: 'approve'; assignedId: string }
  | { mode: 'assign'; assignedId: string }
  | { mode: 'reject'; reason: string }
  | { mode: 'reschedule'; date: string; time: string; message: string; assignedId: string }

/** Sends a decision; resolves with the updated appointment. Rejects with an ApiError (409 if someone decided first). */
export async function decide(id: string, d: Decision) {
  const body =
    d.mode === 'reject'
      ? { reason: d.reason }
      : d.mode === 'reschedule'
        ? { date: d.date, time: d.time, message: d.message, assigned_staff_id: d.assignedId }
        : { assigned_staff_id: d.assignedId }
  const r = await api<{ data: ApiAppointment }>(`/api/secretary/appointments/${id}/${d.mode}`, { method: 'POST', body })
  return fromApi(r.data)
}
