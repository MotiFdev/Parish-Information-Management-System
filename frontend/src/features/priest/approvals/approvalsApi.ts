import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { detailRows, type ApiRecordRequest } from '../../parishioner/requests/requestsApi'
import type { AwaitingRequest } from '../sampleData'

const correctionKeys = ['correctionField', 'currentValue', 'correctValue', 'correctionReason']

export function toAwaitingRequest(r: ApiRecordRequest): AwaitingRequest {
  const d = r.details
  const remarks = r.remarks.filter((m) => m.kind === 'remark').map((m) => m.body)

  return {
    id: r.request_id,
    number: r.request_number,
    recordType: r.record_type,
    requestType: r.request_type,
    subject: r.subject,
    client: { name: r.client.name, relationship: r.relationship },
    purpose: r.purpose,
    submittedAt: r.requested_at,
    verifiedAt: r.sent_to_priest_at ?? r.requested_at,
    verifiedBy: r.verified_by ?? 'Parish office',
    register: r.register ? { book: r.register.book, page: r.register.page, line: r.register.line } : undefined,
    documents: r.documents.map((x) => ({ label: x.title, file: x.file?.file_name ?? '', documentId: x.file?.document_id })),
    remarks: remarks.length ? remarks.join('\n') : 'No remarks from the secretary.',
    details: detailRows(r.record_type, Object.fromEntries(Object.entries(d).filter(([k]) => !correctionKeys.includes(k)))),
    corrections: d.correctionField ? [{ field: d.correctionField, from: d.currentValue ?? '', to: d.correctValue ?? '' }] : undefined,
  }
}

/** Requests staff verified and sent for approval, from the server. */
export function useApprovalQueue() {
  const [items, setItems] = useState<AwaitingRequest[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    api<{ data: ApiRecordRequest[] }>('/api/priest/record-requests')
      .then((r) => {
        if (cancelled) return
        setItems(r.data.map(toAwaitingRequest))
        setFailed(false)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const remove = useCallback((id: string) => setItems((xs) => xs?.filter((x) => x.id !== id) ?? xs), [])
  return { items, failed, reload, remove }
}

/** Approves (signs) or rejects; resolves once saved. Rejects with an ApiError (409 if it is no longer waiting). */
export async function decide(id: string, decision: { approve: true } | { approve: false; reason: string }) {
  await api(`/api/priest/record-requests/${id}/${decision.approve ? 'approve' : 'reject'}`, {
    method: 'POST',
    body: decision.approve ? undefined : { reason: decision.reason },
  })
}
