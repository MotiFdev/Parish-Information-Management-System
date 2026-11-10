import { useState, type FormEvent } from 'react'
import { Dialog } from '../../../components/ui/Dialog'
import { Field } from '../../../components/ui/Field'
import { btnDanger, btnSecondary, inputClass } from '../../../components/ui/styles'
import type { AwaitingRequest } from '../sampleData'
import { requestTitle } from './labels'

const MIN_LENGTH = 10

interface Props {
  request: AwaitingRequest | null
  onClose: () => void
  /** Sends the rejection; rejects with an error message to show. */
  onReject: (reason: string) => Promise<void>
}

export function RejectDialog({ request, onClose, onReject }: Props) {
  return (
    <Dialog open={request !== null} onClose={onClose} labelledBy="reject-title">
      {request && <RejectForm request={request} onClose={onClose} onReject={onReject} />}
    </Dialog>
  )
}

function RejectForm({ request: r, onClose, onReject }: Props & { request: AwaitingRequest }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const text = reason.trim()
    if (text.length < MIN_LENGTH) {
      setError(text ? 'Add a little more so the requester knows what to do next.' : 'A reason is required to reject a request.')
      return document.getElementById('reject-reason')?.focus()
    }
    setBusy(true)
    try {
      await onReject(text)
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'The rejection could not be saved. Please try again.')
    }
  }

  return (
    <form noValidate onSubmit={submit}>
      <div className="px-6 pt-5 pb-4">
        <h2 id="reject-title" className="font-serif text-2xl font-semibold text-stone-900">
          Reject this request?
        </h2>
        <p className="mt-1 text-stone-700">
          {requestTitle(r)} for {r.subject} ({r.number})
        </p>
        <Field label="Reason" htmlFor="reject-reason" required error={error} hint={`Sent to ${r.client.name} and kept in the audit log.`} className="mt-4">
          <textarea
            id="reject-reason"
            rows={4}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              setError(undefined)
            }}
            placeholder="What is wrong, and what the requester can do about it"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'reject-reason-error' : 'reject-reason-hint'}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-stone-100 bg-ivory/50 px-6 py-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className={btnSecondary}>
          Cancel
        </button>
        <button type="submit" disabled={busy} className={`${btnDanger} disabled:cursor-wait disabled:opacity-70`}>
          {busy ? 'Saving…' : 'Reject request'}
        </button>
      </div>
    </form>
  )
}
