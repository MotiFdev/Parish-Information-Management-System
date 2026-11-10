import { useState, type FormEvent } from 'react'
import { Dialog } from '../../../components/ui/Dialog'
import { Field } from '../../../components/ui/Field'
import { btnDanger, btnPrimary, btnSecondary, inputClass } from '../../../components/ui/styles'
import { documentLabels, type OfficeRequest, type RequestDoc } from './requestsData'

function Footer({ onClose, label, danger }: { onClose: () => void; label: string; danger?: boolean }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-stone-100 bg-ivory/50 px-6 py-4 sm:flex-row sm:justify-end">
      <button type="button" onClick={onClose} className={btnSecondary}>
        Cancel
      </button>
      <button type="submit" className={danger ? btnDanger : btnPrimary}>
        {label}
      </button>
    </div>
  )
}

/** Asking for a document again, or rejecting it, needs a note the requester will read. */
export function DocProblemDialog({
  target,
  onClose,
  onSubmit,
}: {
  target: { doc: RequestDoc; status: 'Needs Resubmission' | 'Rejected' } | null
  onClose: () => void
  onSubmit: (note: string) => void
}) {
  return (
    <Dialog open={target !== null} onClose={onClose} labelledBy="doc-problem-title">
      {target && <DocProblemForm target={target} onClose={onClose} onSubmit={onSubmit} />}
    </Dialog>
  )
}

function DocProblemForm({
  target,
  onClose,
  onSubmit,
}: {
  target: { doc: RequestDoc; status: 'Needs Resubmission' | 'Rejected' }
  onClose: () => void
  onSubmit: (note: string) => void
}) {
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()
  const resubmit = target.status === 'Needs Resubmission'
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (note.trim().length < 8) {
      setError('Say what is wrong so the requester can fix it.')
      return document.getElementById('doc-note')?.focus()
    }
    onSubmit(note.trim())
  }
  return (
    <form noValidate onSubmit={submit}>
      <div className="px-6 pt-5 pb-4">
        <h2 id="doc-problem-title" className="font-serif text-2xl font-semibold text-stone-900">
          {resubmit ? `Ask for the ${target.doc.label} again?` : `Reject the ${target.doc.label}?`}
        </h2>
        <p className="mt-1 text-stone-700">
          {resubmit ? 'The requester can upload a new copy from their request page.' : 'Use this when the document is not acceptable at all.'}
        </p>
        <Field label="Note to the requester" htmlFor="doc-note" required error={error} className="mt-4">
          <textarea
            id="doc-note"
            rows={3}
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              setError(undefined)
            }}
            placeholder={
              resubmit ? 'For example: the photo is blurry; please upload a clearer scan.' : 'For example: this is a different person’s birth certificate.'
            }
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'doc-note-error' : undefined}
            className={inputClass}
          />
        </Field>
      </div>
      <Footer onClose={onClose} label={resubmit ? 'Ask to resubmit' : 'Reject document'} danger={!resubmit} />
    </form>
  )
}

/** Sending the request back so the requester corrects the details they typed. */
export function ReturnDetailsDialog({ request, onClose, onSubmit }: { request: OfficeRequest | null; onClose: () => void; onSubmit: (note: string) => void }) {
  return (
    <Dialog open={request !== null} onClose={onClose} labelledBy="return-details-title">
      {request && <ReturnDetailsForm request={request} onClose={onClose} onSubmit={onSubmit} />}
    </Dialog>
  )
}

function ReturnDetailsForm({ request, onClose, onSubmit }: { request: OfficeRequest; onClose: () => void; onSubmit: (note: string) => void }) {
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (note.trim().length < 8) {
      setError('Say which details are wrong so the requester can fix them.')
      return document.getElementById('return-note')?.focus()
    }
    onSubmit(note.trim())
  }
  return (
    <form noValidate onSubmit={submit}>
      <div className="px-6 pt-5 pb-4">
        <h2 id="return-details-title" className="font-serif text-2xl font-semibold text-stone-900">
          Send back to fix details?
        </h2>
        <p className="mt-1 text-stone-700">
          {request.client.name} is notified and can edit the details from the request’s tracking page. It can’t go to the priest until they send them back.
        </p>
        <Field label="What needs fixing" htmlFor="return-note" required error={error} className="mt-4">
          <textarea
            id="return-note"
            rows={3}
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              setError(undefined)
            }}
            placeholder="For example: the date of birth does not match the birth certificate."
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'return-note-error' : undefined}
            className={inputClass}
          />
        </Field>
      </div>
      <Footer onClose={onClose} label="Send back" />
    </form>
  )
}

/** "Request additional documents" from section 3: choose what is missing and explain why. */
export function RequirementDialog({
  request,
  onClose,
  onSubmit,
}: {
  request: OfficeRequest | null
  onClose: () => void
  onSubmit: (labels: string[], message: string) => void
}) {
  return (
    <Dialog open={request !== null} onClose={onClose} labelledBy="requirement-title">
      {request && <RequirementForm request={request} onClose={onClose} onSubmit={onSubmit} />}
    </Dialog>
  )
}

function RequirementForm({
  request,
  onClose,
  onSubmit,
}: {
  request: OfficeRequest
  onClose: () => void
  onSubmit: (labels: string[], message: string) => void
}) {
  const [labels, setLabels] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<{ labels?: string; message?: string }>({})
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = {
      labels: labels.length ? undefined : 'Choose at least one document.',
      message: message.trim().length >= 8 ? undefined : 'Explain what you need and why.',
    }
    setErrors(next)
    if (next.labels) return document.getElementById('req-doc-0')?.focus()
    if (next.message) return document.getElementById('req-message')?.focus()
    onSubmit(labels, message.trim())
  }
  return (
    <form noValidate onSubmit={submit}>
      <div className="px-6 pt-5 pb-4">
        <h2 id="requirement-title" className="font-serif text-2xl font-semibold text-stone-900">
          Request additional documents
        </h2>
        <p className="mt-1 text-stone-700">{request.client.name} is notified in the portal and by email, and can upload them from the request page.</p>
        <fieldset className="mt-4" aria-describedby={errors.labels ? 'req-docs-error' : undefined}>
          <legend className="mb-1.5 text-sm font-medium text-stone-700">
            Documents needed<span className="text-red-600"> *</span>
          </legend>
          <div className="grid gap-x-3 sm:grid-cols-2">
            {documentLabels.map((l, i) => (
              <label key={l} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-stone-800">
                <input
                  id={`req-doc-${i}`}
                  type="checkbox"
                  checked={labels.includes(l)}
                  onChange={(e) => {
                    setLabels((x) => (e.target.checked ? [...x, l] : x.filter((y) => y !== l)))
                    setErrors((x) => ({ ...x, labels: undefined }))
                  }}
                  className="size-4.5 accent-forest"
                />
                {l}
              </label>
            ))}
          </div>
          {errors.labels && (
            <p id="req-docs-error" className="mt-1 text-sm text-red-700">
              {errors.labels}
            </p>
          )}
        </fieldset>
        <Field label="Message" htmlFor="req-message" required error={errors.message} className="mt-3">
          <textarea
            id="req-message"
            rows={3}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value)
              setErrors((x) => ({ ...x, message: undefined }))
            }}
            placeholder="For example: we need the death certificate to confirm the date of death."
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={errors.message ? 'req-message-error' : undefined}
            className={inputClass}
          />
        </Field>
      </div>
      <Footer onClose={onClose} label="Send request" />
    </form>
  )
}
