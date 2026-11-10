import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { detailRows, type ApiRecordRequest } from '../../parishioner/requests/requestsApi'
import type { OfficeRequest } from './requestsData'

const correctionKeys = ['correctionField', 'currentValue', 'correctValue', 'correctionReason']

/** "09175550142" -> "0917 555 0142" */
const spaced = (n: string) => (/^09\d{9}$/.test(n) ? `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}` : n)

export function toOfficeRequest(r: ApiRecordRequest): OfficeRequest {
  const d = r.details
  const subjectOnly = Object.fromEntries(Object.entries(d).filter(([k]) => !correctionKeys.includes(k)))
  const register = r.register ? { book: Number(r.register.book), page: Number(r.register.page), line: Number(r.register.line) } : undefined

  return {
    id: r.request_id,
    number: r.request_number,
    recordType: r.record_type,
    requestType: r.request_type,
    subject: r.subject,
    client: { name: r.client.name, relationship: r.relationship, contact: spaced(r.client.contact_number), email: r.client.email, address: r.client.address },
    purpose: r.purpose,
    submittedAt: r.requested_at,
    status: r.status,
    assignee: r.handled_by ?? undefined,
    sentToPriestAt: r.sent_to_priest_at ?? undefined,
    register,
    registerLinked: Boolean(r.register?.record_id),
    registerRecordId: r.register?.record_id ?? undefined,
    subjectDetails: detailRows(r.record_type, subjectOnly),
    corrections: d.correctionField
      ? [{ field: d.correctionField, from: d.currentValue ?? '', to: d.correctValue ?? '', reason: d.correctionReason }]
      : undefined,
    documents: r.documents.map((x) => ({
      id: x.request_document_id,
      label: x.title,
      file: x.file?.file_name,
      documentId: x.file?.document_id,
      status: x.status,
      note: x.review_note ?? undefined,
    })),
    remarks: r.remarks.map((m) => ({ by: m.by ?? 'Parish office', at: m.at ?? r.requested_at, text: m.body, kind: m.kind })),
    decidedAt: r.decided_at ?? undefined,
    decidedBy: r.decided_by ?? undefined,
    rejectionReason: r.rejection_reason ?? undefined,
    detailsReturned: r.details_returned ?? undefined,
    detailsUpdatedAt: r.details_updated_at ?? undefined,
    readyAt: r.ready_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
    // A New Registration counts as entered once staff record where it was written in the register.
    createdEntry: r.request_type === 'New Registration' && Boolean(register),
  }
}

/** Every record request for the office, with `reload` and `replace` for after each step. */
export function useOfficeRequests() {
  const [items, setItems] = useState<OfficeRequest[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    api<{ data: ApiRecordRequest[] }>('/api/secretary/record-requests')
      .then((r) => {
        if (cancelled) return
        setItems(r.data.map(toOfficeRequest))
        setFailed(false)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const replace = useCallback((r: OfficeRequest) => setItems((xs) => xs?.map((x) => (x.id === r.id ? r : x)) ?? xs), [])
  return { items, failed, reload, replace }
}

export type Step =
  | { kind: 'start' }
  | { kind: 'review'; documentId: string; status: 'Verified' | 'Needs Resubmission' | 'Rejected'; note?: string }
  | { kind: 'remark'; body: string }
  | { kind: 'requirements'; labels: string[]; message: string }
  | { kind: 'return-details'; note: string }
  | { kind: 'register'; book: string; page: string; line: string }
  | { kind: 'send' }
  | { kind: 'ready' }
  | { kind: 'complete' }

/** Runs one workflow step; resolves with the updated request. Rejects with an ApiError (409 if it moved on, 422 if blocked). */
export async function runStep(id: string, step: Step) {
  const base = `/api/secretary/record-requests/${id}`
  const call = (path: string, body?: unknown) => api<{ data: ApiRecordRequest }>(`${base}/${path}`, { method: 'POST', body })
  const r =
    step.kind === 'review'
      ? await call(`documents/${step.documentId}/review`, { status: step.status, note: step.note })
      : step.kind === 'remark'
        ? await call('remarks', { body: step.body })
        : step.kind === 'requirements'
          ? await call('requirements', { labels: step.labels, message: step.message })
          : step.kind === 'register'
            ? await call('register', { book: step.book, page: step.page, line: step.line })
            : step.kind === 'return-details'
              ? await call('return-details', { note: step.note })
              : await call(step.kind)
  return toOfficeRequest(r.data)
}

export interface RegisterEntry {
  record_id: string
  subject: string
  event_date: string | null
  event_place: string | null
  officiating_minister: string | null
}

/** The same place in another register, when nothing is at it in this one. */
export interface ElsewhereEntry {
  register: string
  subject: string
}

export async function lookUpEntry(recordType: string, ref: { book: string; page: string; line: string }) {
  const q = new URLSearchParams({ record_type: recordType, ...ref })
  return api<{ entry: RegisterEntry | null; elsewhere: ElsewhereEntry[] }>(`/api/secretary/registers/lookup?${q}`)
}
