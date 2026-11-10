import { sonas } from '../../parishioner/sampleData'
import { chapelById } from '../chapelData'

// The appointment shape the staff portal works with. The Appointments & Events
// page fills it from the API (see appointmentsApi.ts); the sample list below
// still feeds the staff dashboard until its own endpoints exist.

export type EventType = 'Mass Intention' | 'House Blessing' | 'Wedding Pre-interview' | 'General Counseling'
export const eventTypes: EventType[] = ['Mass Intention', 'House Blessing', 'Wedding Pre-interview', 'General Counseling']
export type VenueType = 'Parish Church' | 'Chapel' | "Client's Home"
export type AppointmentStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'
export type IntentionCategory = 'Thanksgiving' | 'Souls of the Departed' | 'Healing' | 'Special Intention'

export interface Appointment {
  id: string
  /** What the requester tracks it with on the public site, e.g. "AP-7K3M-9QX2". */
  reference?: string
  type: EventType
  title: string
  requester: { name: string; contact: string; email: string; address?: string }
  venue: VenueType
  sonaId?: string
  chapelId?: string
  sonaName?: string
  chapelName?: string
  /** For chapel events, so staff can coordinate. */
  president?: { name: string; contact: string; fb: string } | null
  houseAddress?: string
  /** ISO timestamp of the approved or requested start. */
  start: string
  intention?: { category: IntentionCategory; names: string }
  attendees?: number
  notes?: string
  couple?: { groom: string; bride: string; contacts: string }
  status: AppointmentStatus
  /** Display name of who leads it, and their user id. */
  assigned?: string
  assignedId?: string
  remarks?: string
  rejectionReason?: string
  /** ISO timestamp the request was sent. */
  requestedAt: string
}

const t = (day: number, hhmm: string, month = 11) => `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${hhmm}:00+08:00`
const req = (name: string, n: number, address = `Purok ${1 + (n % 6)}, Barangay San Isidro, San Miguel`) => ({
  name,
  contact: `0917 000 ${String(3000 + n * 41).slice(-4)}`,
  email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
  address,
})

const sample: Appointment[] = [
  // The week ahead (also on the staff dashboard).
  { id: 'ev1', type: 'Mass Intention', title: '14 intentions for the souls of the departed', requester: req('Parish office', 1), venue: 'Parish Church', start: t(1, '06:00'), intention: { category: 'Souls of the Departed', names: 'Intentions gathered for All Saints' }, status: 'Approved', assigned: 'Fr. Antonio Reyes', requestedAt: t(20, '09:00', 10) },
  { id: 'ev2', type: 'Mass Intention', title: '9 thanksgiving and healing intentions', requester: req('Parish office', 2), venue: 'Parish Church', start: t(1, '09:00'), intention: { category: 'Thanksgiving', names: 'Intentions gathered for All Saints' }, status: 'Approved', assigned: 'Fr. Miguel Torres', requestedAt: t(20, '09:05', 10) },
  { id: 'ev3', type: 'Mass Intention', title: '22 intentions for All Souls', requester: req('Ramon Aquino', 3), venue: 'Chapel', sonaId: 's1', chapelId: 'c1', start: t(2, '18:00'), intention: { category: 'Souls of the Departed', names: 'Chapel community list' }, attendees: 120, status: 'Approved', assigned: 'Fr. Miguel Torres', requestedAt: t(22, '15:00', 10) },
  { id: 'ev4', type: 'House Blessing', title: 'House blessing for the Castillo family', requester: req('Benjie Castillo', 4, '22 Rizal Ave., Brgy. Poblacion, San Miguel'), venue: "Client's Home", sonaId: 's2', chapelId: 'c2', houseAddress: '22 Rizal Ave., Brgy. Poblacion, San Miguel', start: t(3, '16:00'), attendees: 15, notes: 'New house; family moved in last month.', status: 'Pending', requestedAt: t(28, '19:20', 10) },
  { id: 'ev5', type: 'Wedding Pre-interview', title: 'Pre-interview: Mark Aquino & Bea Gonzaga', requester: req('Bea Gonzaga', 5), venue: 'Parish Church', start: t(4, '10:00'), couple: { groom: 'Mark Aquino', bride: 'Bea Gonzaga', contacts: '0917 000 3301, 0917 000 3302' }, status: 'Approved', assigned: 'Fr. Antonio Reyes', requestedAt: t(25, '11:00', 10) },
  { id: 'ev6', type: 'General Counseling', title: 'Counseling appointment', requester: req('Grace Pascual', 6), venue: 'Parish Church', start: t(5, '14:00'), notes: 'Prefers to speak with Fr. Antonio.', status: 'Pending', requestedAt: t(30, '08:40', 10) },
  { id: 'ev7', type: 'Mass Intention', title: 'Special intention for the Lopez family', requester: req('Dennis Lopez', 7), venue: 'Chapel', sonaId: 's5', chapelId: 'c6', start: t(6, '17:30'), intention: { category: 'Special Intention', names: 'Lopez family' }, attendees: 40, status: 'Approved', assigned: 'Fr. Antonio Reyes', requestedAt: t(24, '10:00', 10) },
  // Further out, and more requests waiting for review.
  { id: 'ev8', type: 'Mass Intention', title: 'Thanksgiving for 25 years of marriage', requester: req('Maricel Gonzales', 8), venue: 'Chapel', sonaId: 's3', chapelId: 'c3', start: t(8, '08:00'), intention: { category: 'Thanksgiving', names: 'Spouses Arnel and Maricel Gonzales' }, attendees: 60, status: 'Pending', requestedAt: t(29, '13:10', 10) },
  { id: 'ev9', type: 'House Blessing', title: 'House blessing for the Valdez family', requester: req('Ricardo Valdez', 9, '7 Luna St., Brgy. Santa Cruz, San Miguel'), venue: "Client's Home", sonaId: 's4', chapelId: 'c5', houseAddress: '7 Luna St., Brgy. Santa Cruz, San Miguel', start: t(10, '15:00'), status: 'Pending', requestedAt: t(31, '07:30', 10) },
  { id: 'ev10', type: 'Wedding Pre-interview', title: 'Pre-interview: Joshua Reyes & Kristine Uy', requester: req('Joshua Reyes', 10), venue: 'Parish Church', start: t(11, '09:00'), couple: { groom: 'Joshua Reyes', bride: 'Kristine Uy', contacts: '0917 000 3410, 0917 000 3411' }, status: 'Pending', requestedAt: t(30, '17:45', 10) },
  { id: 'ev11', type: 'Mass Intention', title: 'Healing intention for Rosario Flores', requester: req('Edgar Flores', 11), venue: 'Parish Church', start: t(13, '06:00'), intention: { category: 'Healing', names: 'Rosario Flores' }, status: 'Approved', assigned: 'Fr. Miguel Torres', requestedAt: t(27, '09:00', 10) },
  { id: 'ev12', type: 'Mass Intention', title: 'Fiesta Mass intentions', requester: req('Teresa Navarro', 12), venue: 'Chapel', sonaId: 's4', chapelId: 'c4', start: t(15, '17:00'), intention: { category: 'Special Intention', names: 'Chapel community' }, attendees: 150, status: 'Approved', assigned: 'Fr. Antonio Reyes', requestedAt: t(21, '10:00', 10) },
  { id: 'ev13', type: 'General Counseling', title: 'Pre-baptism talk for parents', requester: req('Liza Domingo', 13), venue: 'Parish Church', start: t(18, '10:00'), attendees: 8, status: 'Approved', assigned: 'Grace Domingo', requestedAt: t(26, '14:00', 10) },
  { id: 'ev14', type: 'House Blessing', title: 'Blessing of a sari-sari store', requester: req('Patricia Salazar', 14, '3 Bonifacio St., Brgy. San Roque, San Miguel'), venue: "Client's Home", sonaId: 's6', chapelId: 'c7', houseAddress: '3 Bonifacio St., Brgy. San Roque, San Miguel', start: t(21, '09:00'), status: 'Rejected', rejectionReason: 'The family asked for a date after the parish fiesta. Please book again.', requestedAt: t(23, '16:00', 10) },
  // Already past this week.
  { id: 'ev15', type: 'Mass Intention', title: 'Thanksgiving for a recovery', requester: req('Joy Bautista', 15), venue: 'Parish Church', start: t(28, '06:00', 10), intention: { category: 'Thanksgiving', names: 'Gabriel Bautista' }, status: 'Approved', assigned: 'Fr. Antonio Reyes', requestedAt: t(19, '09:00', 10) },
  { id: 'ev16', type: 'Wedding Pre-interview', title: 'Pre-interview: Carlo Mendoza & Nina Soriano', requester: req('Nina Soriano', 16), venue: 'Parish Church', start: t(29, '14:00', 10), couple: { groom: 'Carlo Mendoza', bride: 'Nina Soriano', contacts: '0917 000 3516, 0917 000 3517' }, status: 'Approved', assigned: 'Fr. Antonio Reyes', requestedAt: t(18, '10:00', 10) },
]

export const appointments: Appointment[] = sample.map((a) => {
  const chapel = chapelById(a.chapelId)
  return { ...a, chapelName: chapel?.name, sonaName: sonas.find((s) => s.id === a.sonaId)?.name, president: chapel?.president }
})

/** One hour per appointment; the specification sets no slot length (section 13). */
export const SLOT_MINUTES = 60

/** "San Isidro Labrador" from "Sona San Isidro Labrador". */
export const sonaShort = (name?: string) => name?.replace(/^Sona /, '') ?? ''

/** "San Isidro Labrador Chapel · Sona San Isidro Labrador", or the church/home. */
export function placeLine(a: Appointment) {
  const sona = a.sonaName ? ` · Sona ${sonaShort(a.sonaName)}` : ''
  if (a.venue === 'Chapel') return `${a.chapelName ?? 'Chapel'}${sona}`
  if (a.venue === "Client's Home") return `Home${sona}`
  return 'Parish Church'
}

/** Rejected and cancelled appointments hold no time. */
export const holdsTime = (a: Appointment) => a.status === 'Pending' || a.status === 'Approved'

/** Other appointments at the same place within an hour, so staff see double bookings. */
export function conflictsWith(a: Appointment, start: string, all: Appointment[]) {
  const s = new Date(start).getTime()
  return all.filter(
    (o) =>
      o.id !== a.id &&
      holdsTime(o) &&
      o.venue === a.venue &&
      (a.venue === "Client's Home" ? false : a.venue === 'Chapel' ? o.chapelId === a.chapelId : true) &&
      Math.abs(new Date(o.start).getTime() - s) < SLOT_MINUTES * 60_000,
  )
}
