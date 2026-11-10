import { useState, type FormEvent } from 'react'
import { Dialog } from '../../../components/ui/Dialog'
import { Icon } from '../../../components/ui/Icon'
import { btnPrimary, btnSecondary } from '../../../components/ui/styles'
import { parish } from '../../parishioner/sampleData'
import type { AwaitingRequest } from '../sampleData'
import { registerRef } from './labels'

const longDate = new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' })

interface Props {
  request: AwaitingRequest | null
  signer: string
  onClose: () => void
  /** Sends the approval; rejects with an error message to show. */
  onApprove: () => Promise<void>
}

export function SignDialog({ request, signer, onClose, onApprove }: Props) {
  return (
    <Dialog open={request !== null} onClose={onClose} labelledBy="sign-title" className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-2xl">
      {request && <SignForm request={request} signer={signer} onClose={onClose} onApprove={onApprove} />}
    </Dialog>
  )
}

// TODO: the signature provider and signing mechanism are not in the specification
// (section 13). The preview marks where the signature goes without drawing one.
function SignForm({ request: r, signer, onClose, onApprove }: Props & { request: AwaitingRequest }) {
  const [reviewed, setReviewed] = useState(false)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string>()
  const correction = r.requestType === 'Record Correction'
  const newEntry = r.requestType === 'New Registration'

  // For a correction the preview shows the entry as it will read after approval.
  const details = r.details.map(([k, v]) => {
    const c = r.corrections?.find((c) => v.includes(c.from))
    return [k, c ? v.replace(c.from, c.to) : v, Boolean(c)] as const
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!reviewed) {
      setError('Confirm that you have reviewed the entry and the documents.')
      return document.getElementById('sign-reviewed')?.focus()
    }
    setBusy(true)
    setFailed(undefined)
    try {
      await onApprove()
    } catch (err) {
      setBusy(false)
      setFailed(err instanceof Error ? err.message : 'The approval could not be saved. Please try again.')
    }
  }

  return (
    <form noValidate onSubmit={submit}>
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
        <div>
          <h2 id="sign-title" className="font-serif text-2xl font-semibold text-stone-900">
            Verify & Sign
          </h2>
          <p className="text-sm text-stone-600">
            {r.number} · {correction ? 'Preview of the corrected register entry' : 'Preview of the certificate'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="px-6">
        {/* A sheet of the parish's paper: the one place in the portal that looks like the document it produces. */}
        <figure
          aria-label={correction ? 'Corrected entry preview' : 'Certificate preview'}
          className="rounded-lg border border-stone-300 bg-ivory px-5 py-6 sm:px-8"
        >
          <p className="text-center font-serif text-lg font-semibold text-forest">{parish.name}</p>
          <p className="mt-1 text-center font-serif text-2xl font-semibold text-stone-900 sm:text-3xl">
            {correction ? `${r.recordType} register entry` : `Certificate of ${r.recordType}`}
          </p>
          <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-stone-700">
            {correction
              ? `As corrected in the ${r.recordType} Register, ${registerRef(r)}.`
              : newEntry
                ? `This certifies that the following is to be entered in the ${r.recordType} Register of this parish.`
                : `This certifies that the following is recorded in the ${r.recordType} Register of this parish, ${registerRef(r)}.`}
          </p>
          <dl className="mx-auto mt-4 grid max-w-md grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
            {details.map(([k, v, changed]) => (
              <div key={k} className="contents">
                <dt className="text-stone-600">{k}</dt>
                <dd className="font-medium text-stone-900">{changed ? <span className="rounded bg-gold-soft box-decoration-clone px-1">{v}</span> : v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-col items-end gap-1 text-sm">
            <div className="grid h-14 w-56 max-w-full place-items-center rounded border border-dashed border-stone-400 text-xs text-stone-600">
              Your digital signature goes here
            </div>
            <p className="font-semibold text-stone-900">{signer}</p>
            <p className="text-stone-600">Parish Priest · {longDate.format(new Date())}</p>
          </div>
        </figure>
      </div>

      <div className="px-6 pt-4 pb-5">
        <label className="flex cursor-pointer items-start gap-3 rounded-lg py-1">
          <input
            id="sign-reviewed"
            type="checkbox"
            checked={reviewed}
            onChange={(e) => {
              setReviewed(e.target.checked)
              setError(undefined)
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'sign-reviewed-error' : undefined}
            className="mt-0.5 size-5 shrink-0 accent-forest"
          />
          <span className="text-stone-800">
            I have reviewed the {newEntry ? 'details' : 'register entry'} and the verified documents, and I approve this{' '}
            {correction ? 'correction' : newEntry ? 'registration' : 'certificate'}.
          </span>
        </label>
        {error && (
          <p id="sign-reviewed-error" className="mt-1 ml-8 text-sm text-red-700">
            {error}
          </p>
        )}
        {failed && (
          <p role="alert" className="mt-3 flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
            <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
            {failed}
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-stone-100 bg-ivory/50 px-6 py-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className={btnSecondary}>
          Cancel
        </button>
        <button type="submit" disabled={busy} className={`${btnPrimary} disabled:cursor-wait disabled:opacity-70`}>
          <Icon name="seal" className="size-4.5" />
          {busy ? 'Saving…' : 'Approve and sign'}
        </button>
      </div>
    </form>
  )
}
