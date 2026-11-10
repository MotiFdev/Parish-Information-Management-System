import { useEffect, useState, type FormEvent } from 'react'
import { Field } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'
import { btnPrimary, inputClass } from '../components/ui/styles'
import { Link } from '../components/Link'
import { useAuth, type AuthUser } from '../features/auth/authContext'
import { AuthCard } from '../components/AuthCard'
import { ApiError } from '../lib/api'
import { navigate, useLocation } from '../lib/router'

/**
 * Where to go after signing in: the page that asked for sign-in when it belongs
 * to the user's own portal, otherwise the dashboard the server names. Only
 * same-site paths are accepted, so a crafted link cannot send people elsewhere.
 */
function destination(user: AuthUser, next: string | null) {
  const home = user.dashboard_path ?? '/home'
  const portal = home.split('/')[1]
  const ownPortal = next !== null && (next === `/${portal}` || next.startsWith(`/${portal}/`))
  return ownPortal && /^\/[\w/-]*(\?[^#]*)?$/.test(next) ? next : home
}

function errorMessage(e: unknown) {
  if (!(e instanceof ApiError)) return 'Something went wrong. Please try again.'
  if (e.status === 0) return e.message
  if (e.status === 403) return 'This account has been deactivated. Please contact the parish office.'
  if (e.status === 419) return 'Your session expired. Please try again.'
  if (e.status >= 500) return 'The server ran into a problem. Please try again in a moment.'
  // 422 (wrong username or password) and 429 (too many attempts) carry the server's own wording.
  return e.field('login') ?? e.field('password') ?? e.message
}

export default function LoginPage() {
  const { login, status, user } = useAuth()
  const { query } = useLocation()
  const next = query.get('next')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Already signed in (e.g. opened /login in a new tab): skip the form.
  useEffect(() => {
    if (status === 'signed-in' && user && !submitting) navigate(destination(user, next), { replace: true })
  }, [status, user, next, submitting])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const fieldErrors = {
      identifier: identifier.trim() ? undefined : 'Enter your username or email.',
      password: password ? undefined : 'Enter your password.',
    }
    setErrors(fieldErrors)
    setFormError(null)
    if (fieldErrors.identifier) return document.getElementById('identifier')?.focus()
    if (fieldErrors.password) return document.getElementById('password')?.focus()

    setSubmitting(true)
    try {
      const signedIn = await login(identifier.trim(), password, remember)
      navigate(destination(signedIn, next), { replace: true })
    } catch (err) {
      setFormError(errorMessage(err))
      setPassword('')
      setSubmitting(false)
      document.getElementById('password')?.focus()
    }
  }

  // Carries a typed email over so it doesn't have to be entered twice.
  const forgotHref = identifier.includes('@') ? `/forgot-password?email=${encodeURIComponent(identifier.trim())}` : '/forgot-password'

  return (
    <AuthCard>
      <h1 className="mt-8 font-serif text-4xl font-semibold text-stone-900">Sign in</h1>
      <p className="mt-1 text-stone-600">For the parish secretary, clergy, and administrators.</p>

      <form noValidate onSubmit={submit} aria-busy={submitting} className="mt-6 space-y-4">
        {formError && (
          <p role="alert" className="flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
            <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
            {formError}
          </p>
        )}
        <Field label="Username or email" htmlFor="identifier" error={errors.identifier}>
          <input
            id="identifier"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            aria-invalid={errors.identifier ? true : undefined}
            className={inputClass}
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={errors.password ? true : undefined}
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-stone-400 hover:text-forest"
            >
              <Icon name={showPassword ? 'close' : 'eye'} className="size-5" />
            </button>
          </div>
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-forest" />
            Keep me signed in
          </label>
          <Link href={forgotHref} className="inline-flex min-h-11 items-center px-1 text-sm font-semibold text-forest hover:underline">
            Forgot password?
          </Link>
        </div>

        <button type="submit" disabled={submitting} className={`${btnPrimary} w-full py-3 disabled:cursor-wait disabled:opacity-70`}>
          {submitting ? (
            <span className="size-4 rounded-full border-2 border-white/40 border-t-white motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <Icon name="lock" className="size-4" />
          )}
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="mt-5 space-y-1 border-t border-stone-100 pt-4 text-center text-sm text-stone-600">
        <p>
          Parishioners don’t need an account.{' '}
          <Link href="/home" className="font-semibold text-forest hover:underline">
            Request or track online
          </Link>
        </p>
      </div>
    </AuthCard>
  )
}
