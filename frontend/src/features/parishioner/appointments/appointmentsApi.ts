import { api } from '../../../lib/api'
import type { Appointment, AppointmentStatus } from '../sampleData'
import { formatSlot } from './slots'

/** An appointment as the public site gets it; no contact details, since the reference number opens it. */
interface ApiAppointment {
  reference_number: string
  event_type: string
  event_title: string
  status: AppointmentStatus
  venue: string
  date: string
  time: string
  staff_remarks: string | null
}

/** What Book Appointment sends, in the API's field names. */
export interface AppointmentBooking {
  event_type: string
  event_title: string
  venue_type: 'Parish Church' | 'Chapel' | 'Home'
  sona_id: number | null
  chapel_id: number | null
  house_address: string | null
  date: string
  time: string
  full_name: string
  contact_number: string
  email: string | null
  intention_category: string | null
  intention_details: string | null
  groom_name: string | null
  groom_contact: string | null
  bride_name: string | null
  bride_contact: string | null
  attendee_count: number | null
  notes: string | null
  privacy_consent: boolean
}

const toAppointment = (a: ApiAppointment): Appointment => ({
  reference: a.reference_number,
  eventType: a.event_type,
  title: a.event_title,
  venue: a.venue,
  schedule: formatSlot({ date: a.date, time: a.time }),
  status: a.status,
  staffRemarks: a.staff_remarks,
})

/** Sends a booking. Rejects with an ApiError (422 for invalid input or a time that was just taken). */
export async function bookAppointment(booking: AppointmentBooking) {
  const r = await api<{ data: ApiAppointment }>('/api/public/appointments', { method: 'POST', body: booking })
  return toAppointment(r.data)
}

/** Looks an appointment up by its reference number. Rejects with an ApiError (404 when none has it). */
export async function trackAppointment(reference: string) {
  const r = await api<{ data: ApiAppointment }>(`/api/public/appointments/${encodeURIComponent(reference)}`)
  return toAppointment(r.data)
}
