import { useState, type FormEvent } from 'react'
import { Field } from '../../../components/ui/Field'
import { btnDanger, btnPrimary, btnSecondary, inputClass } from '../../../components/ui/styles'
import type { RegisterEntry } from '../registerData'
import { decideCorrection } from './correctionApi'

const sentOn = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' })
const MIN_REASON = 5

interface Props {
  entry: RegisterEntry & { pending_correction: NonNullable<RegisterEntry['pending_correction']> }
  /** The entry as the server now has it, after a decision. */
  onDecided: (entry: RegisterEntry, approved: boolean) => void
  /** Someone else decided it first; the list needs a fresh copy. */
  onStale: (message: string) => void
}

// A correction staff filed from Sacramental Records. Nothing in the register
// changes until it is approved here; the old values stay in the audit log.
export function CorrectionReview({ entry, onDecided, onStale }: Props) {
  const c = entry.pending_correction
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const send = async (approve: boolean) => {
    setBusy(true)
    const result = await decideCorrection(c.correction_id, approve, reason.trim())
    setBusy(false)
    if ('entry' in result) return onDecided(result.entry, approve)
    if ('stale' in result) return onStale(result.stale)
    setError(result.error)
  }

  const reject = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (reason.trim().length < MIN_REASON) {
      setError('Say why, so the office knows what to check.')
      return document.getElementById('correction-reason')?.focus()
    }
    void send(false)
  }

  const who = [c.requested_by ?? 'The parish office', c.requested_at && sentOn.format(new Date(c.requested_at))].filter(Boolean).join(' · ')

  return (
    <section aria-labelledby="correction-title" className="border-b border-gold/40 bg-gold-soft/60 px-5 py-4 text-sm">
      <h3 id="correction-title" className="font-semibold text-brown">
        Correction waiting for your approval
      </h3>
      <p className="text-stone-700">{who}</p>
      <ul className="mt-2 space-y-1 text-stone-800">
        {c.changes.map((ch) => (
          <li key={ch.field}>
            <span className="text-stone-700">{ch.field}:</span> <span className="text-stone-600 line-through decoration-stone-400">{ch.from || 'blank'}</span>
            <span aria-label="changed to" className="px-1 text-stone-500">
              →
            </span>
            <span className="font-semibold text-stone-900">{ch.to || 'blank'}</span>
          </li>
        ))}
      </ul>

      {mode === 'idle' && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => setMode('approve')} className={btnPrimary}>
            Approve correction
          </button>
          <button type="button" onClick={() => setMode('reject')} className={btnSecondary}>
            Reject
          </button>
        </div>
      )}

      {mode === 'approve' && (
        <div className="mt-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
          <p className="text-stone-800">The register entry will change to the new details. The old values are kept in the audit log.</p>
          {error && (
            <p role="alert" className="mt-2 text-red-700">
              {error}
            </p>
          )}
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => (setMode('idle'), setError(undefined))} disabled={busy} className={btnSecondary}>
              Cancel
            </button>
            <button type="button" onClick={() => void send(true)} disabled={busy} className={`${btnPrimary} disabled:cursor-wait`}>
              {busy ? 'Saving…' : 'Approve and update the entry'}
            </button>
          </div>
        </div>
      )}

      {mode === 'reject' && (
        <form noValidate onSubmit={reject} className="mt-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
          <Field
            label="Reason"
            htmlFor="correction-reason"
            required
            error={error}
            hint={`Sent to ${c.requested_by ?? 'the parish office'}. The entry stays as it is.`}
          >
            <textarea
              id="correction-reason"
              rows={3}
              autoFocus
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setError(undefined)
              }}
              placeholder="For example: the book says Fr. Reyes"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'correction-reason-error' : 'correction-reason-hint'}
              className={inputClass}
            />
          </Field>
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => (setMode('idle'), setError(undefined))} disabled={busy} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className={`${btnDanger} disabled:cursor-wait`}>
              {busy ? 'Saving…' : 'Reject correction'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
