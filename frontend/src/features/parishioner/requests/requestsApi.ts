import { api } from '../../../lib/api'
import { formatDate, type DocumentStatus, type RecordRequest, type RecordType, type RequestStatus, type RequestType } from '../sampleData'
import { correctionGroup, recordForms } from './recordTypes'

/** A record request as the staff and priest portals get it (RecordRequests::present on the backend). */
export interface ApiRecordRequest {
  request_id: string
  request_number: string
  record_type: RecordType
  request_type: RequestType
  status: RequestStatus
  /** Staff verified it and it waits for the priest. */
  with_priest: boolean
  subject: string
  relationship: string
  purpose: string
  parish: string
  client: { name: string; contact_number: string; email: string; address: string }
  details: Record<string, string>
  documents: Array<{
    request_document_id: string
    label: string
    title: string
    status: DocumentStatus
    review_note: string | null
    file: { document_id: string; file_name: string; file_type: string; file_size: number; uploaded_at: string | null } | null
  }>
  remarks: Array<{ remark_id: string; kind: 'remark' | 'requirement'; body: string; by: string | null; at: string | null }>
  handled_by: string | null
  verified_by: string | null
  decided_by: string | null
  /** Register reference; the priest and staff only. */
  register: { book: string; page: string; line: string; record_id: string | null } | null
  rejection_reason: string | null
  /** Staff sent it back for the requester to correct their details. */
  details_returned: { at: string; note: string } | null
  details_updated_at: string | null
  requested_at: string
  started_at: string | null
  sent_to_priest_at: string | null
  decided_at: string | null
  ready_at: string | null
  completed_at: string | null
}

/**
 * The same request as the public site gets it (RecordRequests::presentForTracking).
 * Anyone with the reference number can read it, so contact details, the
 * personal details from the form, and the register reference are left out.
 */
type ApiTrackedRequest = Omit<ApiRecordRequest, 'request_id' | 'client' | 'details' | 'register' | 'documents'> & {
  documents: Array<Omit<ApiRecordRequest['documents'][number], 'file'> & { file: { file_name: string; uploaded_at: string | null } | null }>
}

const labels: Record<string, string> = Object.fromEntries(
  [...Object.values(recordForms).flat(), correctionGroup].flatMap((g) => g.fields.map((f) => [f.name, f.label])),
)

/** Field labels in form order for this record type, so details read the way they were entered. */
export function detailRows(recordType: RecordType, details: Record<string, string>): Array<[string, string]> {
  const order = [...recordForms[recordType], correctionGroup].flatMap((g) => g.fields.map((f) => f.name))
  // Burial and Marriage reuse a few field names (e.g. birthDate); the record type's own label wins.
  const own: Record<string, string> = Object.fromEntries(recordForms[recordType].flatMap((g) => g.fields.map((f) => [f.name, f.label])))
  return order.filter((k) => details[k]).map((k) => [own[k] ?? labels[k] ?? k, details[k]])
}

const day = (iso: string | null) => (iso ? formatDate(new Date(iso)) : '')

function toRecordRequest(r: ApiTrackedRequest): RecordRequest {
  const history: RecordRequest['history'] = [{ status: 'Pending', date: day(r.requested_at), note: 'Request submitted online.' }]
  if (r.started_at) history.push({ status: 'Under Verification', date: day(r.started_at), note: 'The parish office started checking it.' })
  if (r.sent_to_priest_at)
    history.push({ status: 'Under Verification', date: day(r.sent_to_priest_at), note: 'Checked by the office and sent to the parish priest.' })
  if (r.decided_at)
    history.push({
      status: r.status === 'Rejected' ? 'Rejected' : 'Approved',
      date: day(r.decided_at),
      note: r.status === 'Rejected' ? 'Not approved by the parish priest.' : 'Approved by the parish priest.',
    })
  if (r.ready_at) history.push({ status: 'Ready for Collection', date: day(r.ready_at), note: 'Ready to collect at the parish office.' })
  if (r.completed_at) history.push({ status: 'Completed', date: day(r.completed_at), note: 'Collected.' })

  return {
    number: r.request_number,
    recordType: r.record_type,
    requestType: r.request_type,
    subject: r.subject,
    relationship: r.relationship,
    purpose: r.purpose,
    submittedOn: day(r.requested_at),
    status: r.status,
    withPriest: r.with_priest,
    remarks: r.remarks.map((m) => ({ kind: m.kind, body: m.body, by: m.by ?? 'Parish office', at: m.at ?? r.requested_at })),
    rejectionReason: r.rejection_reason ?? undefined,
    detailsReturned: r.details_returned ?? undefined,
    documents: r.documents.map((d) => ({
      id: d.request_document_id,
      label: d.title,
      fileName: d.file?.file_name ?? '',
      status: d.status,
      note: d.review_note ?? undefined,
    })),
    history,
  }
}

/** Sends a new request (multipart: fields and files). Rejects with an ApiError on 422. */
export async function submitRecordRequest(form: FormData) {
  const r = await api<{ data: ApiTrackedRequest }>('/api/public/record-requests', { method: 'POST', body: form })
  return toRecordRequest(r.data)
}

/** Looks a request up by its reference number. Rejects with an ApiError (404 when none has it). */
export async function trackRecordRequest(reference: string) {
  const r = await api<{ data: ApiTrackedRequest }>(`/api/public/record-requests/${encodeURIComponent(reference)}`)
  return toRecordRequest(r.data)
}

/** The details on a request staff sent back, unlocked with the email it was sent with. Rejects with an ApiError (422 wrong email, 409 not waiting). */
export async function unlockRequestDetails(reference: string, email: string) {
  const r = await api<{ details: Record<string, string> }>(`/api/public/record-requests/${encodeURIComponent(reference)}/details/unlock`, {
    method: 'POST',
    body: { email },
  })
  return r.details
}

/** Sends corrected details back to the parish office. Rejects with an ApiError (422 with field errors). */
export async function updateRequestDetails(reference: string, email: string, details: Record<string, string>) {
  const r = await api<{ data: ApiTrackedRequest }>(`/api/public/record-requests/${encodeURIComponent(reference)}/details`, {
    method: 'PUT',
    body: { email, details },
  })
  return toRecordRequest(r.data)
}

/** Uploads a document again, or one staff asked for. Rejects with an ApiError (409 when it no longer waits for one). */
export async function uploadRequestDocument(reference: string, requestDocumentId: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  const r = await api<{ data: ApiTrackedRequest }>(`/api/public/record-requests/${encodeURIComponent(reference)}/documents/${requestDocumentId}`, {
    method: 'POST',
    body: form,
  })
  return toRecordRequest(r.data)
}
