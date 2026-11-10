import { awaitingApproval, type Sacrament } from '../../priest/sampleData'
import { staffRequests } from '../sampleData'

// The shape the staff Record Requests page works with; it is filled from the API
// (requestsApi.ts). The sample requests below still feed the Documents page's
// link picker until that page has its own endpoints.

export type RequestStatus = 'Pending' | 'Under Verification' | 'Approved' | 'Rejected' | 'Ready for Collection' | 'Completed'
export const requestStatuses: RequestStatus[] = ['Pending', 'Under Verification', 'Approved', 'Ready for Collection', 'Completed', 'Rejected']
export type RequestType = 'New Registration' | 'Certificate Request' | 'Record Correction'
export type DocStatus = 'Pending' | 'Verified' | 'Rejected' | 'Needs Resubmission'

export const documentLabels = ['Valid ID', 'Birth Certificate', 'Baptismal Certificate', 'Death Certificate', 'Burial Permit', 'Other'] as const

export interface RequestDoc {
  id: string
  label: string
  /** File name; absent while staff wait for it to be uploaded. */
  file?: string
  /** The stored file, for opening through a signed link. Sample data has none. */
  documentId?: string
  status: DocStatus
  note?: string
}

export interface Remark {
  by: string
  /** ISO timestamp with the parish's UTC+8 offset. */
  at: string
  text: string
  /** Requirements are sent to the requester as "additional requirements". */
  kind: 'remark' | 'requirement'
}

export interface Filters {
  search: string
  recordType: Sacrament | 'all'
  requestType: RequestType | 'all'
  status: RequestStatus | 'all'
  /** Submitted between these dates, as 'YYYY-MM-DD'. */
  from: string
  to: string
}

export const noFilters: Filters = { search: '', recordType: 'all', requestType: 'all', status: 'all', from: '', to: '' }

export interface OfficeRequest {
  /** request_id; sample requests use their number. */
  id: string
  number: string
  recordType: Sacrament
  requestType: RequestType
  subject: string
  client: { name: string; relationship: string; contact: string; email: string; address: string }
  purpose: string
  submittedAt: string
  status: RequestStatus
  /** Who on staff is checking it. */
  assignee?: string
  /** Set when staff marked it verified (verified_by_staff_id); it stays Under Verification until the priest acts. */
  sentToPriestAt?: string
  /** The register entry linked to this request, once staff have found (or created) it. */
  register?: { book: number; page: number; line: number }
  /** True when that place matches an entry in the digital register (not just the paper one). */
  registerLinked?: boolean
  /** The digital register entry at that place, when there is one. */
  registerRecordId?: string
  /** Where the entry should be, for the design-phase lookup; the API would search the register. */
  registerHint?: { book: number; page: number; line: number }
  subjectDetails: [label: string, value: string][]
  corrections?: { field: string; from: string; to: string; reason?: string }[]
  documents: RequestDoc[]
  remarks: Remark[]
  decidedAt?: string
  decidedBy?: string
  rejectionReason?: string
  readyAt?: string
  completedAt?: string
  /** Sent back for the requester to correct their details; it can't go to the priest meanwhile. */
  detailsReturned?: { at: string; note: string }
  /** When the requester last sent corrected details. */
  detailsUpdatedAt?: string
  /** New Registration only: the entry staff created after approval. */
  createdEntry?: boolean
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')
const client = (name: string, relationship: string, n: number) => ({
  name,
  relationship,
  contact: `0917 000 ${String(1000 + n * 37).slice(-4)}`,
  email: `${slug(name).replace(/-/g, '.')}@example.com`,
  address: `Purok ${1 + (n % 6)}, Barangay San Isidro`,
})
const supporting: Record<Sacrament, string> = { Baptism: 'Birth Certificate', Confirmation: 'Baptismal Certificate', Marriage: 'Valid ID', Burial: 'Death Certificate' }

// The nine on the staff dashboard: new, or being checked by staff.
const fromDashboard: OfficeRequest[] = staffRequests.map((r, n) => {
  const docs: RequestDoc[] = Array.from({ length: r.documents.total }, (_, i) => {
    const label = i === 0 ? 'Valid ID' : i === 1 ? supporting[r.recordType] : 'Other'
    const status: DocStatus = i < r.documents.verified ? 'Verified' : i < r.documents.verified + r.documents.resubmit ? 'Needs Resubmission' : 'Pending'
    return {
      id: `${r.number}-d${i}`,
      label,
      file: `${slug(label)}-${slug(r.subject)}.${i === 0 ? 'jpg' : 'pdf'}`,
      status,
      note: status === 'Needs Resubmission' ? 'The scan is too blurry to read. Please upload a clearer copy.' : undefined,
    }
  })
  const hint = r.requestType === 'New Registration' ? undefined : { book: 3 + (n % 10), page: 20 + n * 13, line: 1 + (n % 9) }
  return {
    id: r.number,
    number: r.number,
    recordType: r.recordType,
    requestType: r.requestType,
    subject: r.subject,
    client: client(r.client, r.client === r.subject ? 'Self' : 'Relative', n),
    purpose: n % 2 ? 'Personal copy' : 'Legal purpose',
    submittedAt: r.submittedAt,
    status: r.status,
    assignee: r.assignee,
    registerHint: hint,
    subjectDetails: [
      [r.recordType === 'Burial' ? 'Deceased' : r.recordType === 'Marriage' ? 'Couple' : 'Name', r.subject],
      ['Record type', r.recordType],
      ['Approximate date', r.requestType === 'New Registration' ? 'October 2026' : 'Given by the requester'],
      ['Church', 'Sacred Heart of Jesus Parish'],
    ],
    corrections: r.requestType === 'Record Correction' ? [{ field: "Father's name", from: 'Pablo Garcia', to: 'Paulo Garcia' }] : undefined,
    documents: docs,
    remarks:
      r.documents.resubmit > 0
        ? [{ by: r.assignee ?? 'Liza Mercado', at: r.submittedAt.replace(/T\d\d/, 'T15'), text: 'Asked for a clearer copy of one document.', kind: 'requirement' }]
        : [],
  }
})

// The twelve in the priest's queue: checked by staff, waiting for a signature.
const withPriest: OfficeRequest[] = awaitingApproval.map((r, n) => ({
  id: r.number,
  number: r.number,
  recordType: r.recordType,
  requestType: r.requestType,
  subject: r.subject,
  client: client(r.client.name, r.client.relationship, n + 20),
  purpose: r.purpose,
  submittedAt: r.submittedAt,
  status: 'Under Verification',
  assignee: r.verifiedBy,
  sentToPriestAt: r.verifiedAt,
  register: r.register && { book: Number(r.register.book), page: Number(r.register.page), line: Number(r.register.line) },
  subjectDetails: r.details,
  corrections: r.corrections,
  documents: r.documents.map((d, i) => ({ id: `${r.number}-d${i}`, label: d.label, file: d.file, status: 'Verified', note: d.note })),
  remarks: [{ by: r.verifiedBy, at: r.verifiedAt, text: r.remarks, kind: 'remark' }],
}))

// Further along, matching the audit log's entries for these numbers.
const later: OfficeRequest[] = ([
  {
    number: 'REQ-2026-0131', recordType: 'Baptism', requestType: 'Certificate Request', subject: 'Rafael Ramos',
    client: client('Angela Ramos', 'Parent', 40), purpose: 'Other: school enrollment', submittedAt: '2026-10-28T09:10:00+08:00',
    status: 'Ready for Collection', assignee: 'Liza Mercado', sentToPriestAt: '2026-10-30T16:00:00+08:00', register: { book: 13, page: 66, line: 4 },
    subjectDetails: [['Baptized', 'Rafael Ramos'], ['Date of baptism', 'June 9, 2021'], ['Father', 'Edgar Ramos'], ['Mother', 'Angela Ramos (née Flores)']],
    documents: [{ id: '0131-d0', label: 'Valid ID', file: 'angela-ramos-id.jpg', status: 'Verified' }, { id: '0131-d1', label: 'Birth Certificate', file: 'birth-certificate-rafael-ramos.pdf', status: 'Verified' }],
    remarks: [{ by: 'Liza Mercado', at: '2026-10-30T16:00:00+08:00', text: 'Entry matches the birth certificate.', kind: 'remark' }],
    decidedAt: '2026-10-31T09:41:27+08:00', readyAt: '2026-10-31T09:47:03+08:00',
  },
  {
    number: 'REQ-2026-0124', recordType: 'Burial', requestType: 'Certificate Request', subject: 'Teodoro Aquino',
    client: client('Ramon Aquino', 'Child', 41), purpose: 'Legal purpose', submittedAt: '2026-10-22T10:30:00+08:00',
    status: 'Approved', assignee: 'Grace Domingo', sentToPriestAt: '2026-10-27T11:00:00+08:00', register: { book: 4, page: 79, line: 6 },
    subjectDetails: [['Deceased', 'Teodoro Aquino'], ['Date of death', 'March 3, 2024'], ['Age at death', '81'], ['Place of burial', 'Municipal Cemetery']],
    documents: [{ id: '0124-d0', label: 'Valid ID', file: 'ramon-aquino-id.jpg', status: 'Verified' }, { id: '0124-d1', label: 'Death Certificate', file: 'death-certificate-teodoro-aquino.pdf', status: 'Verified' }],
    remarks: [{ by: 'Grace Domingo', at: '2026-10-27T11:00:00+08:00', text: 'Entry found and matches the death certificate.', kind: 'remark' }],
    decidedAt: '2026-10-30T15:30:00+08:00',
  },
  {
    number: 'REQ-2026-0123', recordType: 'Baptism', requestType: 'New Registration', subject: 'Sofia Lopez',
    client: client('Dennis Lopez', 'Parent', 42), purpose: 'Personal copy', submittedAt: '2026-10-20T09:00:00+08:00',
    status: 'Approved', assignee: 'Joel Bautista', sentToPriestAt: '2026-10-26T10:00:00+08:00',
    subjectDetails: [['Baptized', 'Sofia Lopez'], ['Date of birth', 'August 30, 2026'], ['Date of baptism', 'October 18, 2026'], ['Father', 'Dennis Lopez'], ['Mother', 'Jocelyn Lopez (née Pascual)'], ['Godparents', 'Carlos Mendoza, Nina Soriano']],
    documents: [{ id: '0123-d0', label: 'Valid ID', file: 'dennis-lopez-id.jpg', status: 'Verified' }, { id: '0123-d1', label: 'Birth Certificate', file: 'birth-certificate-sofia-lopez.pdf', status: 'Verified' }],
    remarks: [{ by: 'Joel Bautista', at: '2026-10-26T10:00:00+08:00', text: 'No existing entry; baptized here on October 18.', kind: 'remark' }],
    decidedAt: '2026-10-29T09:00:00+08:00',
  },
  {
    number: 'REQ-2026-0129', recordType: 'Confirmation', requestType: 'Certificate Request', subject: 'Kristine Uy',
    client: client('Kristine Uy', 'Self', 43), purpose: 'Marriage requirement', submittedAt: '2026-10-26T14:20:00+08:00',
    status: 'Rejected', assignee: 'Grace Domingo', sentToPriestAt: '2026-10-30T16:20:57+08:00',
    subjectDetails: [['Confirmed', 'Kristine Uy'], ['Approximate date', '2010'], ['Church', 'Sacred Heart of Jesus Parish']],
    documents: [{ id: '0129-d0', label: 'Baptismal Certificate', file: 'baptismal-certificate-kristine-uy.pdf', status: 'Verified' }],
    remarks: [{ by: 'Grace Domingo', at: '2026-10-30T16:20:57+08:00', text: 'Could not find an entry for 2009 to 2011.', kind: 'remark' }],
    decidedAt: '2026-10-30T16:48:19+08:00', rejectionReason: 'No confirmation entry found for that date in this parish.',
  },
  {
    number: 'REQ-2026-0118', recordType: 'Marriage', requestType: 'Certificate Request', subject: 'Victor & Patricia Salazar',
    client: client('Patricia Salazar', 'Spouse', 44), purpose: 'Legal purpose', submittedAt: '2026-10-19T13:00:00+08:00',
    status: 'Completed', assignee: 'Joel Bautista', sentToPriestAt: '2026-10-23T10:00:00+08:00', register: { book: 6, page: 140, line: 3 },
    subjectDetails: [['Groom', 'Victor Salazar'], ['Bride', 'Patricia Salazar (née Valdez)'], ['Date of marriage', 'February 14, 2010']],
    documents: [{ id: '0118-d0', label: 'Valid ID', file: 'patricia-salazar-id.jpg', status: 'Verified' }],
    remarks: [{ by: 'Joel Bautista', at: '2026-10-23T10:00:00+08:00', text: 'Entry found.', kind: 'remark' }],
    decidedAt: '2026-10-26T09:00:00+08:00', readyAt: '2026-10-27T10:00:00+08:00', completedAt: '2026-10-29T16:30:02+08:00',
  },
] as Omit<OfficeRequest, 'id'>[]).map((r) => ({ ...r, id: r.number }))

export const officeRequests: OfficeRequest[] = [...fromDashboard, ...withPriest, ...later]

/** Where this request is in the workflow, in plain words. */
export function stage(r: OfficeRequest) {
  if (r.status === 'Under Verification') return r.sentToPriestAt ? 'With the priest' : `Being checked${r.assignee ? ` by ${r.assignee}` : ''}`
  if (r.status === 'Pending') return 'Not started'
  if (r.status === 'Approved') return r.requestType === 'New Registration' && !r.createdEntry ? 'Create the register entry' : 'Ready to release'
  if (r.status === 'Ready for Collection') return 'Waiting for pickup'
  if (r.status === 'Rejected') return 'Closed'
  return 'Released'
}
