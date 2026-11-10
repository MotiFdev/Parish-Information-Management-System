// Placeholder content for the design phase. Replace with API data once the
// backend endpoints exist; nothing here reflects real parish records.

export type RequestStatus =
  | 'Pending'
  | 'Under Verification'
  | 'Approved'
  | 'Rejected'
  | 'Ready for Collection'
  | 'Completed'

export type DocumentStatus = 'Pending' | 'Verified' | 'Rejected' | 'Needs Resubmission'

export type AppointmentStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'

export type RecordType = 'Baptism' | 'Confirmation' | 'Marriage' | 'Burial'
export type RequestType = 'New Registration' | 'Certificate Request' | 'Record Correction'

export interface RequestDocument {
  id: string
  /** What the document is, e.g. "PSA birth certificate". */
  label: string
  /** Empty when staff asked for it and nothing is uploaded yet. */
  fileName: string
  status: DocumentStatus
  note?: string
}

export interface StatusEvent {
  status: RequestStatus
  date: string
  note?: string
}

export interface RecordRequest {
  /** The reference number, e.g. "RR-7K3M-9QX2"; it is also how the request is looked up. */
  number: string
  recordType: RecordType
  requestType: RequestType
  subject: string
  relationship: string
  purpose: string
  submittedOn: string
  status: RequestStatus
  /** Verified by staff and waiting for the priest; nothing can be changed meanwhile. */
  withPriest?: boolean
  /** Staff remarks and additional requirements, oldest first. */
  remarks: Array<{ kind: 'remark' | 'requirement'; body: string; by: string; at: string }>
  rejectionReason?: string
  /** The parish office asked the requester to correct the details they typed. */
  detailsReturned?: { at: string; note: string }
  documents: RequestDocument[]
  history: StatusEvent[]
}

export interface Appointment {
  /** The reference number, e.g. "AP-7K3M-9QX2". */
  reference: string
  eventType: string
  title: string
  venue: string
  /** "Mon, Nov 9 · 9:00 AM", in parish time. */
  schedule: string
  status: AppointmentStatus
  staffRemarks?: string | null
}

export interface MassTime {
  day: string
  times: string[]
  note?: string
}

export type AnnouncementCategory = 'Parish' | 'Liturgy' | 'Sacraments' | 'Chapels'

export interface Announcement {
  id: string
  title: string
  excerpt: string
  category: AnnouncementCategory
  postedOn: string
  pinned?: boolean
}


export interface Sona {
  id: string
  name: string
  chapels: Array<{ id: string; name: string }>
}



export const parish = {
  name: 'Sacred Heart of Jesus Parish',
  shortName: 'Sacred Heart Parish',
  patron: 'Sacred Heart of Jesus',
  // A movable solemnity, so the rule is shown rather than a fixed date.
  feastDay: 'Friday after the Second Sunday after Pentecost',
  officeHours: 'Monday to Saturday, 8:00 AM to 5:00 PM',
}

// The Sona names are the examples in the specification (section 7.8), shared by
// every portal so a parishioner's Sona reads the same in reports and directories.
// The chapel names are placeholders.
export const sonas: Sona[] = [
  { id: 's1', name: 'Sona San Isidro Labrador', chapels: [{ id: 'c1', name: 'San Isidro Labrador Chapel' }] },
  { id: 's2', name: 'Sona Birhen sa Fatima', chapels: [{ id: 'c2', name: 'Our Lady of Fatima Chapel' }] },
  { id: 's3', name: 'Sona Birhen sa Carmen', chapels: [{ id: 'c3', name: 'Our Lady of Mount Carmel Chapel' }] },
  {
    id: 's4',
    name: 'Sona San Ignacio de Loyola',
    chapels: [
      { id: 'c4', name: 'San Ignacio Chapel' },
      { id: 'c5', name: 'San Lorenzo Ruiz Chapel' },
    ],
  },
  { id: 's5', name: 'Sona San Antonio de Padua', chapels: [{ id: 'c6', name: 'San Antonio de Padua Chapel' }] },
  { id: 's6', name: "Sona Inahan sa Kanunay'ng Panabang", chapels: [{ id: 'c7', name: 'Perpetual Help Chapel' }] },
]


export const requestSteps: RequestStatus[] = [
  'Pending',
  'Under Verification',
  'Approved',
  'Ready for Collection',
  'Completed',
]


export const massSchedule: MassTime[] = [
  { day: 'Sunday', times: ['5:30 AM', '7:00 AM', '9:00 AM', '4:30 PM', '6:00 PM'] },
  { day: 'Saturday', times: ['6:00 AM', '5:30 PM'], note: '5:30 PM is the anticipated Sunday Mass' },
  { day: 'Monday to Friday', times: ['6:00 AM', '5:30 PM'] },
]

/** Can the requester still upload documents? Not once it is with the priest or decided. */
export const isOpen = (r: RecordRequest) => (r.status === 'Pending' || r.status === 'Under Verification') && !r.withPriest

/** A document to upload again, or one staff asked for that isn't uploaded yet. */
export const awaitingUpload = (d: RequestDocument) => !d.fileName || d.status === 'Needs Resubmission' || d.status === 'Rejected'



export const formatDate = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
