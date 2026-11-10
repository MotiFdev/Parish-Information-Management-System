import { useState, type ReactNode } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { Field } from '../../components/ui/Field'
import { btnDanger, btnSecondary, inputClass } from '../../components/ui/styles'

export interface RejectTarget {
  /** Keys the form, so it starts empty for each item. */
  key: string
  /** e.g. "Reject Sona Bible Sharing?" */
  title: string
  detail: ReactNode
  confirmLabel: string
}

/**
 * The PPC's reject step for an event, chapel, or officer. A reason is required;
 * onReject resolves with a server error to show, or undefined when done.
 */
export function RejectDialog({ target, onClose, onReject }: { target: RejectTarget | null; onClose: () => void; onReject: (reason: string) => Promise<string | undefined> }) {
  return (
    <Dialog open={target !== null} onClose={onClose} labelledBy="rej-title">
      {target && <RejectForm key={target.key} target={target} onClose={onClose} onReject={onReject} />}
    </Dialog>
  )
}

function RejectForm({ target, onClose, onReject }: { target: RejectTarget; onClose: () => void; onReject: (reason: string) => Promise<string | undefined> }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault()
        if (busy) return
        if (reason.trim().length < 5) {
          setError('Say why, so the organizers know what to change.')
          return document.getElementById('rej-reason')?.focus()
        }
        setBusy(true)
        const problem = await onReject(reason.trim())
        setBusy(false)
        setError(problem)
      }}
    >
      <div className="px-6 pt-5 pb-4">
        <h2 id="rej-title" className="font-serif text-2xl font-semibold text-stone-900">
          {target.title}
        </h2>
        <p className="mt-1 text-stone-700">{target.detail}</p>
        <Field label="Reason" htmlFor="rej-reason" required error={error} className="mt-4">
          <textarea
            id="rej-reason"
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              setError(undefined)
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'rej-reason-error' : undefined}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-stone-100 bg-ivory/50 px-6 py-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className={btnSecondary}>
          Cancel
        </button>
        <button type="submit" disabled={busy} className={`${btnDanger} disabled:cursor-wait disabled:opacity-70`}>
          {busy ? 'Rejecting…' : target.confirmLabel}
        </button>
      </div>
    </form>
  )
}
