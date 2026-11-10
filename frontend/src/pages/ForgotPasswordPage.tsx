import { useState, type FormEvent } from 'react'
import { AuthCard } from '../components/AuthCard'
import { Link } from '../components/Link'
import { Field } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'
import { btnPrimary, inputClass } from '../components/ui/styles'
import { api, ApiError } from '../lib/api'
import { useLocation } from '../lib/router'
import { useOfficeHours } from '../features/parishioner/officeHours'

// The server answers the same way whether or not the email has an account, so
// this page never says which it was.
export default function ForgotPasswordPage() {
  const officeHours = useOfficeHours()
  const { query } = useLocation()
  const [email, setEmail] = useState(query.get('email') ?? '')
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sentMessage, setSentMessage] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (sending) return
    const value = email.trim()
    const problem = !value ? 'Enter the email on your account.' : !/^\S+@\S+\.\S+$/.test(value) ? 'Enter an email address like name@example.com.' : null
    setError(problem)
    setFormError(null)
    if (problem) return document.getElementById('forgot-email')?.focus()

    setSending(true)
    try {
      const r = await api<{ message: string }>('/api/auth/forgot-password', { method: 'POST', body: { email: value } })
      setSentMessage(r.message)
    } catch (err) {
      setSending(false)
      if (err instanceof ApiError && err.field('email')) {
        setError(err.field('email') ?? null)
        return document.getElementById('forgot-email')?.focus()
      }
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <AuthCard>
      {sentMessage ? (
        <div role="status">
          <h1 className="mt-8 font-serif text-4xl font-semibold text-stone-900">Check your email</h1>
          <p className="mt-2 text-stone-600">{sentMessage}</p>
          <p className="mt-3 text-sm text-stone-600">
            The link works for 24 hours. Nothing arrived after a few minutes? Check the address and{' '}
            <button
              type="button"
              onClick={() => {
                setSentMessage(null)
                setSending(false)
              }}
              className="font-semibold text-forest underline-offset-4 hover:underline"
            >
              try again
            </button>
            , or contact the parish office ({officeHours}).
          </p>
          <Link href="/login" className={`${btnPrimary} mt-6 w-full py-3`}>
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <h1 className="mt-8 font-serif text-4xl font-semibold text-stone-900">Forgot your password?</h1>
          <p className="mt-1 text-stone-600">Enter the email on your account and we’ll send you a link to choose a new one.</p>

          <form noValidate onSubmit={submit} aria-busy={sending} className="mt-6 space-y-4">
            {formError && (
              <p role="alert" className="flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
                <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
                {formError}
              </p>
            )}
            <Field label="Email" htmlFor="forgot-email" error={error ?? undefined}>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'forgot-email-error' : undefined}
                className={inputClass}
              />
            </Field>
            <button type="submit" disabled={sending} className={`${btnPrimary} w-full py-3 disabled:cursor-wait disabled:opacity-70`}>
              <Icon name="mail" className="size-4" />
              {sending ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
          <p className="mt-5 border-t border-stone-100 pt-4 text-center text-sm text-stone-600">
            Remembered it?{' '}
            <Link href="/login" className="font-semibold text-forest hover:underline">
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </AuthCard>
  )
}
