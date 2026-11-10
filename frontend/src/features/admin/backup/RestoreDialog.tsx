import { useState, type FormEvent } from 'react'
import { Dialog } from '../../../components/ui/Dialog'
import { Field } from '../../../components/ui/Field'
import { btnDanger, btnSecondary, inputClass } from '../../../components/ui/styles'
import { databases, type BackupRun } from '../backupData'

interface Props {
  run: BackupRun | null
  when: string
  onClose: () => void
  /** Runs the restore; a rejection's message is shown in the dialog. */
  onConfirm: () => Promise<void>
}

const WORD = 'RESTORE'

// Restoring overwrites live data, so the dialog asks for a typed confirmation
// rather than a single click. The server checks the same word.
export function RestoreDialog({ run, when, onClose, onConfirm }: Props) {
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={run !== null} onClose={() => !busy && onClose()} labelledBy="restore-title">
      {run && <RestoreForm run={run} when={when} onClose={onClose} onConfirm={onConfirm} busy={busy} setBusy={setBusy} />}
    </Dialog>
  )
}

function RestoreForm({
  run,
  when,
  onClose,
  onConfirm,
  busy,
  setBusy,
}: Props & { run: BackupRun; busy: boolean; setBusy: (busy: boolean) => void }) {
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string>()
  const [failure, setFailure] = useState<string>()
  const db = databases[run.db]

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (typed.trim() !== WORD) {
      setError(`Type ${WORD} in capital letters to confirm.`)
      return document.getElementById('restore-confirm')?.focus()
    }
    setBusy(true)
    setFailure(undefined)
    try {
      await onConfirm()
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'The restore failed. Nothing was changed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form noValidate onSubmit={submit}>
      <div className="px-6 pt-5 pb-4">
        <h2 id="restore-title" className="font-serif text-2xl font-semibold text-stone-900">
          Restore the {db.name.toLowerCase()}?
        </h2>
        <p className="mt-2 text-stone-700">
          The {db.name.toLowerCase()} goes back to how it was on <span className="font-semibold">{when}</span>.
        </p>
        {run.db === 'relational' ? (
          <>
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">
              Anything saved after that time is replaced: new requests, status changes, register entries, appointments, and account
              changes. Audit log entries are kept.
            </p>
            <p className="mt-2 text-sm text-stone-600">
              A backup of the current data is made first, so you can undo this by restoring that backup.
            </p>
          </>
        ) : (
          <p className="mt-2 rounded-lg bg-gold-soft px-3 py-2.5 text-sm text-brown">
            Records added or changed after that time won’t show up in AI search until they are re-indexed, which happens
            automatically within the hour.
          </p>
        )}
        <Field label={`Type ${WORD} to confirm`} htmlFor="restore-confirm" error={error} className="mt-4">
          <input
            id="restore-confirm"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            disabled={busy}
            onChange={(e) => {
              setTyped(e.target.value)
              setError(undefined)
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'restore-confirm-error' : undefined}
            className={inputClass}
          />
        </Field>
        {failure && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">
            {failure}
          </p>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-stone-100 bg-ivory/50 px-6 py-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} disabled={busy} className={btnSecondary}>
          Cancel
        </button>
        <button type="submit" disabled={busy} className={btnDanger}>
          {busy && <span className="size-4 rounded-full border-2 border-white/40 border-t-white motion-safe:animate-spin" aria-hidden="true" />}
          {busy ? 'Restoring…' : `Restore ${run.db === 'relational' ? 'relational' : 'vector'} database`}
        </button>
      </div>
    </form>
  )
}
