import type { Sacrament } from '../priest/sampleData'

// Placeholder requests from the design phase. The dashboard now reads the API
// (dashboard/dashboardApi.ts); these still seed requestsData.ts's sample list.

export type StaffRequestStatus = 'Pending' | 'Under Verification'

export interface StaffRequest {
  number: string
  recordType: Sacrament
  requestType: 'New Registration' | 'Certificate Request' | 'Record Correction'
  subject: string
  client: string
  /** ISO timestamp with the parish's UTC+8 offset. */
  submittedAt: string
  status: StaffRequestStatus
  documents: { total: number; verified: number; resubmit: number }
  /** Who is checking it; only set once verification has started. */
  assignee?: string
}

export const staffRequests: StaffRequest[] = [
  {
    number: 'REQ-2026-0145',
    recordType: 'Baptism',
    requestType: 'Certificate Request',
    subject: 'Gabriel Soriano',
    client: 'Nina Soriano',
    submittedAt: '2026-10-31T08:40:00+08:00',
    status: 'Pending',
    documents: { total: 2, verified: 0, resubmit: 0 },
  },
  {
    number: 'REQ-2026-0146',
    recordType: 'Marriage',
    requestType: 'Certificate Request',
    subject: 'Edgar & Jocelyn Pascual',
    client: 'Jocelyn Pascual',
    submittedAt: '2026-10-31T09:55:00+08:00',
    status: 'Pending',
    documents: { total: 3, verified: 0, resubmit: 0 },
  },
  {
    number: 'REQ-2026-0140',
    recordType: 'Baptism',
    requestType: 'New Registration',
    subject: 'Baby girl Valdez',
    client: 'Ricardo Valdez',
    submittedAt: '2026-10-29T15:10:00+08:00',
    status: 'Pending',
    documents: { total: 2, verified: 0, resubmit: 0 },
  },
  {
    number: 'REQ-2026-0135',
    recordType: 'Burial',
    requestType: 'Certificate Request',
    subject: 'Benito Flores',
    client: 'Rosario Flores',
    submittedAt: '2026-10-27T11:30:00+08:00',
    status: 'Pending',
    documents: { total: 2, verified: 0, resubmit: 0 },
  },
  {
    number: 'REQ-2026-0149',
    recordType: 'Confirmation',
    requestType: 'Record Correction',
    subject: 'Paolo Garcia',
    client: 'Paolo Garcia',
    submittedAt: '2026-10-26T14:00:00+08:00',
    status: 'Pending',
    documents: { total: 2, verified: 0, resubmit: 0 },
  },
  {
    number: 'REQ-2026-0142',
    recordType: 'Baptism',
    requestType: 'Certificate Request',
    subject: 'Juan Miguel Dela Cruz',
    client: 'Teresa Navarro',
    submittedAt: '2026-10-29T10:20:00+08:00',
    status: 'Under Verification',
    documents: { total: 2, verified: 1, resubmit: 1 },
    assignee: 'Liza Mercado',
  },
  {
    number: 'REQ-2026-0148',
    recordType: 'Confirmation',
    requestType: 'Certificate Request',
    subject: 'Angela Ramos',
    client: 'Angela Ramos',
    submittedAt: '2026-10-25T09:05:00+08:00',
    status: 'Under Verification',
    documents: { total: 1, verified: 1, resubmit: 0 },
    assignee: 'Grace Domingo',
  },
  {
    number: 'REQ-2026-0147',
    recordType: 'Marriage',
    requestType: 'Certificate Request',
    subject: 'Arnel & Maricel Mendoza',
    client: 'Maricel Mendoza',
    submittedAt: '2026-10-28T13:45:00+08:00',
    status: 'Under Verification',
    documents: { total: 3, verified: 2, resubmit: 0 },
    assignee: 'Joel Bautista',
  },
  {
    number: 'REQ-2026-0128',
    recordType: 'Burial',
    requestType: 'Certificate Request',
    subject: 'Lucia Morales',
    client: 'Edgar Morales',
    submittedAt: '2026-10-24T16:20:00+08:00',
    status: 'Under Verification',
    documents: { total: 2, verified: 0, resubmit: 1 },
    assignee: 'Liza Mercado',
  },
]
