import { useState, type FormEvent } from 'react'
import { AuthCard } from '../components/AuthCard'
import { Link } from '../components/Link'
import { Field } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'
import { btnPrimary, inputClass } from '../components/ui/styles'
import { api, ApiError } from '../lib/api'
import { useLocation } from '../lib/router'
import { useOfficeHours } from '../features/parishioner/officeHours'

// Opened from the emailed set/reset password link:
// /reset-password?token=…&email=…  (see SetPasswordNotification on the backend).

type Errors = { password?: string; confirm?: string }

function passwordProblem(p: string) {
  if (p.length < 8) return 'Use at least 8 characters.'
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Include at least one letter and one number.'
  return undefined
}

function PasswordInput({
  id,
  value,
  onChange,
  shown,
  invalid,
  describedBy,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  shown: boolean
  invalid: boolean
  describedBy?: string
}) {
  return (
    <input
      id={id}
      type={shown ? 'text' : 'password'}
      autoComplete="new-password"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={inputClass}
    />
  )
}

export default function ResetPasswordPage() {
  const officeHours = useOfficeHours()
  const { query } = useLocation()
  const token = query.get('token') ?? ''
  const email = query.get('email') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [shown, setShown] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const linkBroken = !token || !email

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    const next: Errors = {
      password: passwordProblem(password),
      confirm: confirm === password ? undefined : 'The two passwords don’t match.',
    }
    setErrors(next)
    setFormError(null)
    if (next.password) return document.getElementById('new-password')?.focus()
    if (next.confirm) return document.getElementById('confirm-password')?.focus()

    setSaving(true)
    try {
      await api('/api/auth/reset-password', { method: 'POST', body: { token, email, password, password_confirmation: confirm } })
      setDone(true)
    } catch (err) {
      setSaving(false)
      if (err instanceof ApiError && err.field('password')) {
        setErrors({ password: err.field('password') })
        return document.getElementById('new-password')?.focus()
      }
      setFormError(err instanceof ApiError ? (err.field('token') ?? err.field('email') ?? err.message) : 'Something went wrong. Please try again.')
    }
  }

  return (
    <AuthCard>
      {done ? (
        <div role="status">
          <h1 className="mt-8 font-serif text-4xl font-semibold text-stone-900">Password set</h1>
          <p className="mt-2 text-stone-600">You can now sign in with your new password.</p>
          <Link href="/login" className={`${btnPrimary} mt-6 w-full py-3`}>
            <Icon name="lock" className="size-4" />
            Go to sign in
          </Link>
        </div>
      ) : linkBroken ? (
        <div>
          <h1 className="mt-8 font-serif text-4xl font-semibold text-stone-900">This link is incomplete</h1>
          <p className="mt-2 text-stone-600">
            Open the link straight from the email, without editing it. If it still doesn’t work, get a new link, or contact the parish office ({officeHours}).
          </p>
          <Link href="/forgot-password" className={`${btnPrimary} mt-6 w-full py-3`}>
            Get a new link
          </Link>
        </div>
      ) : (
        <>
          <h1 className="mt-8 font-serif text-4xl font-semibold text-stone-900">Choose a password</h1>
          <p className="mt-1 text-stone-600">
            For <span className="font-semibold break-all text-stone-800">{email}</span>
          </p>

          <form noValidate onSubmit={submit} aria-busy={saving} className="mt-6 space-y-4">
            {formError && (
              <p role="alert" className="flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
                <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
                {formError}
              </p>
            )}
            <Field label="New password" htmlFor="new-password" error={errors.password} hint="At least 8 characters, with a letter and a number.">
              <PasswordInput
                id="new-password"
                value={password}
                onChange={setPassword}
                shown={shown}
                invalid={Boolean(errors.password)}
                describedBy={errors.password ? 'new-password-error' : 'new-password-hint'}
              />
            </Field>
            <Field label="Type it again" htmlFor="confirm-password" error={errors.confirm}>
              <PasswordInput
                id="confirm-password"
                value={confirm}
                onChange={setConfirm}
                shown={shown}
                invalid={Boolean(errors.confirm)}
                describedBy={errors.confirm ? 'confirm-password-error' : undefined}
              />
            </Field>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={shown} onChange={(e) => setShown(e.target.checked)} className="size-4 accent-forest" />
              Show passwords
            </label>

            <button type="submit" disabled={saving} className={`${btnPrimary} w-full py-3 disabled:cursor-wait disabled:opacity-70`}>
              <Icon name="check" className="size-4" />
              {saving ? 'Saving…' : 'Set password'}
            </button>
          </form>
        </>
      )}
    </AuthCard>
  )
}
