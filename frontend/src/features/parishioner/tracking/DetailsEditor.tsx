import { useState, type FormEvent } from 'react'
import { Card } from '../../../components/ui/Card'
import { Field } from '../../../components/ui/Field'
import { Icon } from '../../../components/ui/Icon'
import { btnPrimary, btnSecondary, inputClass } from '../../../components/ui/styles'
import { ApiError } from '../../../lib/api'
import { usePortal } from '../portalContext'
import { FormField } from '../requests/FormField'
import { correctionGroup, recordForms, type FieldDef } from '../requests/recordTypes'
import { unlockRequestDetails, updateRequestDetails } from '../requests/requestsApi'
import type { RecordRequest } from '../sampleData'

/**
 * Correcting the details on a request the parish office sent back. The
 * reference number alone shows no personal details, so the requester first
 * confirms the email they sent the request with.
 */
export function DetailsEditor({ request: r, onSaved }: { request: RecordRequest; onSaved: (r: RecordRequest) => void }) {
  const [email, setEmail] = useState('')
  const [details, setDetails] = useState<Record<string, string> | null>(null)

  return (
    <div id="details" className="scroll-mt-24">
      <Card level="h3" title="Correct your details">
        <div className="px-5 py-5">
          <p className="flex gap-2 rounded-lg bg-gold-soft/70 px-3 py-2.5 text-stone-800">
            <Icon name="alert" className="mt-0.5 size-5 shrink-0 text-brown" />
            <span>
              <span className="font-semibold">What to fix:</span> {r.detailsReturned?.note}
            </span>
          </p>
          {details ? (
            <EditForm request={r} email={email} initial={details} onSaved={onSaved} />
          ) : (
            <UnlockForm
              reference={r.number}
              onUnlocked={(e, d) => {
                setEmail(e)
                setDetails(d)
              }}
            />
          )}
        </div>
      </Card>
    </div>
  )
}

function UnlockForm({ reference, onUnlocked }: { reference: string; onUnlocked: (email: string, details: Record<string, string>) => void }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return setError('Enter the email you used on this request.')
    setBusy(true)
    try {
      onUnlocked(email.trim(), await unlockRequestDetails(reference, email.trim()))
    } catch (err) {
      setBusy(false)
      setError(
        err instanceof ApiError && (err.status === 422 || err.status === 409)
          ? (err.field('email') ?? err.message)
          : 'Your details could not be opened. Please try again.',
      )
    }
  }

  return (
    <form noValidate onSubmit={submit} className="mt-4">
      <p className="mb-3 text-stone-700">To keep your details private, enter the email you used when you sent this request.</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <Field label="Email" htmlFor="unlock-email" required error={error} className="flex-1">
          <input
            id="unlock-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(undefined)
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'unlock-email-error' : undefined}
            className={inputClass}
          />
        </Field>
        <button type="submit" disabled={busy} className={`${btnPrimary} sm:mt-7 disabled:cursor-wait disabled:opacity-70`}>
          {busy ? 'Opening…' : 'Edit my details'}
        </button>
      </div>
    </form>
  )
}

function EditForm({
  request: r,
  email,
  initial,
  onSaved,
}: {
  request: RecordRequest
  email: string
  initial: Record<string, string>
  onSaved: (r: RecordRequest) => void
}) {
  const { toast } = usePortal()
  const groups = [...recordForms[r.recordType], ...(r.requestType === 'Record Correction' ? [correctionGroup] : [])]
  const fields = groups.flatMap((g) => g.fields)
  const isRequired = (f: FieldDef) => !f.optional && (Boolean(f.key) || r.requestType === 'New Registration')
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.name, initial[f.name] ?? ''])))
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string | undefined> = {}
    for (const f of fields) if (isRequired(f) && !values[f.name]?.trim()) next[f.name] = 'This field is required.'
    setErrors(next)
    const first = fields.find((f) => next[f.name])
    if (first) return document.getElementById(first.name)?.focus()

    setBusy(true)
    try {
      onSaved(await updateRequestDetails(r.number, email, values))
      toast('Your corrected details were sent to the parish office.')
    } catch (err) {
      setBusy(false)
      if (err instanceof ApiError && err.status === 422) {
        const server = Object.fromEntries(fields.map((f) => [f.name, err.field(`details.${f.name}`)]))
        setErrors(server)
        const bad = fields.find((f) => server[f.name])
        if (bad) return document.getElementById(bad.name)?.focus()
      }
      toast(err instanceof ApiError && err.status !== 500 ? err.message : 'Your details could not be sent. Please try again.')
    }
  }

  return (
    <form noValidate onSubmit={submit} className="mt-2">
      {groups.map((g) => (
        <fieldset key={g.title} className="mt-5">
          <legend className="mb-3 font-semibold text-stone-900">{g.title}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {g.fields.map((f) => (
              <FormField
                key={f.name}
                field={f}
                value={values[f.name] ?? ''}
                required={isRequired(f)}
                error={errors[f.name]}
                onChange={(v) => {
                  setValues((x) => ({ ...x, [f.name]: v }))
                  setErrors((x) => ({ ...x, [f.name]: undefined }))
                }}
              />
            ))}
          </div>
        </fieldset>
      ))}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => setValues(Object.fromEntries(fields.map((f) => [f.name, initial[f.name] ?? ''])))}
          disabled={busy}
          className={btnSecondary}
        >
          Undo my changes
        </button>
        <button type="submit" disabled={busy} className={`${btnPrimary} disabled:cursor-wait disabled:opacity-70`}>
          {busy ? 'Sending…' : 'Send corrected details'}
        </button>
      </div>
    </form>
  )
}
